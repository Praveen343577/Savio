const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
// Global reference to the currently running child process. 
// Since constraint requires strictly 1 download at a time, a singleton reference is safe.
let activeProcess = null;

// Per-item cancellation flags. Checked in the 'close' handler to avoid
// treating a user-triggered SIGKILL as a failure.
const cancelledIds = new Set();

const CHROME_PROFILE = 'D:\\Projects\\Project_2\\Savio\\ChromeProfile';
const BASE_DOWNLOAD_DIR = 'D:\\Nu\\YIPT';

/**
 * Runs yt-dlp / gallery-dl with --dump-json to fetch metadata about a URL
 * before the actual download begins. Populates item.mediaInfo in-place.
 * Errors here are non-fatal — download proceeds regardless.
 *
 * @param {Object} item - Queue item (platform + url)
 * @returns {Promise<Object|null>} Parsed info object, or null on failure.
 */
function fetchMediaInfo(item) {
    return new Promise((resolve) => {
        let binary, args;

        if (item.platform === 'youtube') {
            binary = 'yt-dlp';
            args = [
                '--cookies-from-browser', `chrome:${CHROME_PROFILE}`,
                '--dump-json',
                '--no-playlist',
                item.url
            ];
        } else {
            binary = 'gallery-dl';
            args = [
                '--cookies-from-browser', `chrome:${CHROME_PROFILE}`,
                '--dump-json',
                item.url
            ];
        }

        const proc = spawn(binary, args, { windowsHide: true });
        let stdout = '';
        let resolved = false;

        proc.stdout.on('data', (data) => { stdout += data.toString(); });

        proc.on('close', (code) => {
            if (resolved) return;
            resolved = true;
            if (code !== 0 || !stdout.trim()) return resolve(null);
            try {
                // yt-dlp emits one JSON object; gallery-dl may emit one per file — take first.
                const firstLine = stdout.trim().split('\n')[0];
                const raw = JSON.parse(firstLine);

                const info = {};

                // Resolution
                if (raw.width && raw.height) {
                    info.resolution = `${raw.width}×${raw.height}`;
                }

                // FPS
                if (raw.fps) info.fps = `${raw.fps}fps`;

                // Extension / container
                info.ext = raw.ext || raw.extension || null;

                // Codecs (yt-dlp only)
                if (raw.vcodec && raw.vcodec !== 'none') info.vcodec = raw.vcodec.split('.')[0];
                if (raw.acodec && raw.acodec !== 'none') info.acodec = raw.acodec.split('.')[0];

                // File size (bytes) — not always present pre-download
                if (raw.filesize) info.filesize = raw.filesize;
                else if (raw.filesize_approx) info.filesize = raw.filesize_approx;

                // Duration (seconds, yt-dlp)
                if (raw.duration) info.duration = raw.duration;

                resolve(info);
            } catch {
                resolve(null);
            }
        });

        proc.on('error', () => {
            if (!resolved) { resolved = true; resolve(null); }
        });

        // Timeout safeguard: don't block the queue forever on a slow preflight
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill('SIGKILL');
                resolve(null);
            }
        }, 15000);
    });
}
// Track if the process was intentionally killed by the user so we don't treat it as a failure
let isCancelled = false;

// Media is stored in YIPT folder on D drive if it exists, 
// otherwise falls back to a "Savio" folder in the user's Downloads directory. 
// This is where yt-dlp and gallery-dl will output by default, and where the post-processing module will look for files to organize.
const primaryDir = 'D:\\Nu\\YIPT';
const BASE_DOWNLOAD_DIR = fs.existsSync(primaryDir) ? primaryDir : path.join(os.homedir(), 'Downloads', 'Savio');
if (!fs.existsSync(BASE_DOWNLOAD_DIR)) fs.mkdirSync(BASE_DOWNLOAD_DIR, { recursive: true });

/**
 * Dynamically builds the CLI command and arguments based on the platform.
 */
function buildCommandArgs(item) {
    const today = new Date().toISOString().split('T')[0];
    const baseArgs = ['--write-info-json'];

    if (item.platform === 'youtube') {
        const channelBase = path.join(BASE_DOWNLOAD_DIR, 'youtube', '%(uploader)s');
        return {
            binary: 'yt-dlp',
            args: [
                ...baseArgs,
                '--write-thumbnail',
                '--newline',            // Forces one progress line per stdout flush — required for regex
                '-f', 'bestvideo+bestaudio/best',
                '--merge-output-format', 'mkv',
                '-o', path.join(channelBase, '%(title).100s.%(ext)s'),
                '-o', 'infojson:' + path.join(channelBase, 'metadata', '%(title).100s.%(ext)s'),
                '-o', 'thumbnail:' + path.join(channelBase, 'metadata', '%(title).100s.%(ext)s'),
                item.url
            ]
        };
    } else {
        const stagingDir = path.join(BASE_DOWNLOAD_DIR, 'staging', item.id);
        return {
            binary: 'gallery-dl',
            args: [
                ...baseArgs,
                '--directory', stagingDir,
                '--filename', '{id}_{num}.{extension}',
                item.url
            ]
        };
    }
}

/**
 * Parses a human-readable size string from yt-dlp (e.g. "12.34MiB", "512.00KiB") into bytes.
 */
function parseSizeToBytes(str) {
    if (!str) return null;
    const units = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3 };
    const match = str.match(/^([\d.]+)\s*(B|KiB|MiB|GiB|KB|MB|GB)$/i);
    if (!match) return null;
    const factor = Object.entries(units).find(([k]) => k.toLowerCase() === match[2].toLowerCase())?.[1] ?? null;
    return factor ? Math.round(parseFloat(match[1]) * factor) : null;
}

/**
 * Parses a yt-dlp ETA string ("HH:MM:SS" or "MM:SS") into total seconds.
 */
function parseEtaToSeconds(str) {
    if (!str || str === 'Unknown') return null;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
}

/**
 * Spawns the CLI process, streams stdout for progress, size, speed, and ETA.
 *
 * @param {Object}   item       - Queue item
 * @param {Function} onProgress - Called with { percent, filesize, speed, eta } on each update
 * @returns {Promise} Resolves on exit code 0; rejects on failure or cancellation.
 */
function executeItem(item, onProgress) {
    return new Promise((resolve, reject) => {
        cancelledIds.delete(item.id);

        const { binary, args } = buildCommandArgs(item);

        const proc = spawn(binary, args, { windowsHide: true });
        activeProcesses.set(item.id, proc);

        // yt-dlp progress line example:
        // [download]  45.2% of 123.45MiB at 2.30MiB/s ETA 00:45
        const ytProgressRegex = /\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+\/s)\s+ETA\s+([\d:]+|Unknown)/;
        const ytPercentOnlyRegex = /\[download\]\s+([\d.]+)%/;

        // gallery-dl fraction: [3/10]
        const galleryRegex = /\[(\d+)\/(\d+)\]/;

        const stderrLines = [];

        proc.stdout.on('data', (data) => {
            const output = data.toString();

            if (binary === 'yt-dlp') {
                const full = output.match(ytProgressRegex);
                if (full) {
                    onProgress({
                        percent: Math.floor(parseFloat(full[1])),
                        filesize: parseSizeToBytes(full[2]),
                        speed: full[3],
                        eta: parseEtaToSeconds(full[4])
                    });
                    return;
                }
                // Fallback: percent only (e.g. during merging phase)
                const simple = output.match(ytPercentOnlyRegex);
                if (simple) {
                    onProgress({ percent: Math.floor(parseFloat(simple[1])) });
                }

            } else if (binary === 'gallery-dl') {
                const match = output.match(galleryRegex);
                if (match) {
                    const current = parseInt(match[1], 10);
                    const total = parseInt(match[2], 10);
                    onProgress({ percent: Math.floor((current / total) * 100) });
                }
            }
        });

        proc.stderr.on('data', (data) => {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) {
                    stderrLines.push(trimmed);
                    console.error(`[${binary.toUpperCase()}][${item.id.slice(0, 6)}] ${trimmed}`);
                }
            }
        });

        proc.on('close', (code) => {
            activeProcesses.delete(item.id);

            if (cancelledIds.has(item.id)) {
                cancelledIds.delete(item.id);
                return reject({ isCancelled: true });
            }

            if (code === 0) {
                resolve();
            } else {
                const errorSummary = stderrLines.slice(-5).join(' | ') || 'No stderr output captured';
                reject(new Error(`Process exited with code ${code}: ${errorSummary}`));
            }
        });

        proc.on('error', (err) => {
            activeProcesses.delete(item.id);
            reject(err);
        });
    });
}

/**
 * Suspends a specific download by item ID, or all active downloads if no ID given.
 */
function pauseActive(id) {
    if (id) {
        activeProcesses.get(id)?.kill('SIGSTOP');
    } else {
        activeProcesses.forEach(proc => proc.kill('SIGSTOP'));
    }
}

/**
 * Resumes a specific download by item ID, or all paused downloads if no ID given.
 */
function resumeActive(id) {
    if (id) {
        activeProcesses.get(id)?.kill('SIGCONT');
    } else {
        activeProcesses.forEach(proc => proc.kill('SIGCONT'));
    }
}

/**
 * Forcefully kills a specific download by item ID, or all active downloads if no ID given.
 */
function cancelActive(id) {
    if (id) {
        const proc = activeProcesses.get(id);
        if (proc) {
            cancelledIds.add(id);
            proc.kill('SIGKILL');
        }
    } else {
        activeProcesses.forEach((proc, pid) => {
            cancelledIds.add(pid);
            proc.kill('SIGKILL');
        });
    }
}

/** Returns the count of currently running child processes. */
function activeCount() {
    return activeProcesses.size;
}

module.exports = {
    fetchMediaInfo,
    executeItem,
    pauseActive,
    resumeActive,
    cancelActive,
    activeCount
};
const { spawn } = require('child_process');
const path = require('path');

// Global reference to the currently running child process. 
// Since constraint requires strictly 1 download at a time, a singleton reference is safe.
let activeProcess = null;

// Track if the process was intentionally killed by the user so we don't treat it as a failure
let isCancelled = false;

// Hardcoded paths based on the established file system schema
const CHROME_PROFILE = 'D:\\Projects\\Project_2\\Savio\\ChromeProfile';
const BASE_DOWNLOAD_DIR = 'D:\\Nu\\YIPT';

/**
 * Dynamically builds the CLI command and arguments based on the platform.
 */
function buildCommandArgs(item) {
    const today = new Date().toISOString().split('T')[0];
    const baseArgs = ['--cookies-from-browser', `chrome:${CHROME_PROFILE}`, '--write-info-json'];

    if (item.platform === 'youtube') {
        return {
            binary: 'yt-dlp',
            args: [
                ...baseArgs,
                '--write-thumbnail',
                '-f', 'bestvideo+bestaudio/best',
                '--merge-output-format', 'mp4',
                // yt-dlp uses safe C-style formatting
                '-o', path.join(BASE_DOWNLOAD_DIR, 'youtube', '%(uploader)s', today, '%(title).100s.%(ext)s'),
                item.url
            ]
        };
    } else {
        // gallery-dl handles Instagram, Twitter, and Pinterest
        return {
            binary: 'gallery-dl',
            args: [
                ...baseArgs,
                // --dest sets the base path. gallery-dl automatically creates /<platform>/<username>/ natively.
                '--dest', BASE_DOWNLOAD_DIR,
                // Safe format string: ID + Date. Prevents Python ValueError crashes from complex text parsing.
                '--filename', `{id}_${today}.{extension}`,
                item.url
            ]
        };
    }
}

/**
 * Spawns the CLI process, pipes standard output, and parses real-time progress.
 * * @param {Object} item - The current item from the queue
 * @param {Function} onProgress - Callback function triggered when regex finds a percentage update (passes integer 0-100)
 * @returns {Promise} Resolves on successful exit (code 0). Rejects on failure or cancellation.
 */
function executeItem(item, onProgress) {
    return new Promise((resolve, reject) => {
        isCancelled = false;

        const { binary, args } = buildCommandArgs(item);

        // spawn allows us to intercept the live stream, unlike exec which buffers everything until the end
        activeProcess = spawn(binary, args, {
            windowsHide: true // Prevents random cmd popups on Windows
        });

        // Regex configurations to extract progress metrics from CLI text streams
        const ytRegex = /\[download\]\s+(\d+(?:\.\d+)?)%/;
        // gallery-dl outputs fractions like [1/5] for multi-image posts. 
        const galleryRegex = /\[(\d+)\/(\d+)\]/;

        activeProcess.stdout.on('data', (data) => {
            const output = data.toString();

            if (binary === 'yt-dlp') {
                const match = output.match(ytRegex);
                if (match) {
                    const percent = parseFloat(match[1]);
                    onProgress(Math.floor(percent));
                }
            } else if (binary === 'gallery-dl') {
                const match = output.match(galleryRegex);
                if (match) {
                    const current = parseInt(match[1], 10);
                    const total = parseInt(match[2], 10);
                    const percent = (current / total) * 100;
                    onProgress(Math.floor(percent));
                }
            }
        });

        // Handle process termination (both natural and forced)
        activeProcess.on('close', (code) => {
            activeProcess = null; // Clear reference to prevent memory leaks

            if (isCancelled) {
                // Reject with a specific cancellation signature so the engine knows NOT to increment retry_count
                return reject({ isCancelled: true });
            }

            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        // Failsafe for binary not found (e.g., yt-dlp.exe is missing from PATH)
        activeProcess.on('error', (err) => {
            activeProcess = null;
            reject(err);
        });
    });
}

/**
 * OS-level Process Control: Suspends the execution state in CPU.
 * The active download pauses exactly where it is.
 */
function pauseActive() {
    if (activeProcess) {
        activeProcess.kill('SIGSTOP');
    }
}

/**
 * OS-level Process Control: Resumes the suspended execution.
 */
function resumeActive() {
    if (activeProcess) {
        activeProcess.kill('SIGCONT');
    }
}

/**
 * OS-level Process Control: Forcefully terminates the process immediately.
 * Flags isCancelled to true to intercept the 'close' event logic.
 */
function cancelActive() {
    if (activeProcess) {
        isCancelled = true;
        activeProcess.kill('SIGKILL');
    }
}

module.exports = {
    executeItem,
    pauseActive,
    resumeActive,
    cancelActive
};
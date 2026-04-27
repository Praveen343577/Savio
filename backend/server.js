const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('dotenv').config();
const { readQueue, writeQueue } = require('./fileSystem');
const { initEngine, triggerPause, triggerResume, triggerCancel, setConcurrency } = require('./scheduler');
const { controlState, engineEvents } = require('./engineState');

const app = express();
const PORT = 3000;
const primaryDir = 'D:\\Nu\\YIPT';
const BASE_DOWNLOAD_DIR = fs.existsSync(primaryDir) ? primaryDir : path.join(os.homedir(), 'Downloads', 'Savio');
if (!fs.existsSync(BASE_DOWNLOAD_DIR)) fs.mkdirSync(BASE_DOWNLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function identifyPlatform(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('music.youtube.com')) return 'youtube';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it')) return 'pinterest';
    return 'unknown';
}

function findFilesRecursively(dir, extension, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findFilesRecursively(filePath, extension, fileList);
        } else if (filePath.endsWith(extension)) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

// ==========================================
// REST ENDPOINTS
// ==========================================

/**
 * GET /queue
 * Returns queue state plus current concurrency setting.
 */
app.get('/queue', (req, res) => {
    res.json({
        items: readQueue(),
        concurrency: controlState.concurrency
    });
});

/**
 * POST /upload
 * Expects { urls: ["https://...", ...] }
 */
app.post('/upload', (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls)) {
        return res.status(400).json({ error: 'Expected an array of URLs' });
    }

    let queue = readQueue();
    let addedCount = 0;

    urls.forEach(url => {
        const cleanUrl = url.trim();
        if (!cleanUrl) return;

        const platform = identifyPlatform(cleanUrl);
        if (platform === 'unknown') return;

        const exists = queue.find(item =>
            item.url === cleanUrl &&
            (item.status === 'pending' || item.status === 'active')
        );
        if (!exists) {
            queue.push({
                id: crypto.randomUUID(),
                url: cleanUrl,
                platform,
                status: 'pending',
                progress: 0,
                retry_count: 0,
                // Runtime fields — populated by executor during download
                filesize: null,
                speed: null,
                eta: null,
                mediaInfo: null
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        writeQueue(queue);
        engineEvents.emit('update', queue);
    }

    res.json({ message: `Successfully queued ${addedCount} items.`, total_queue: queue.length });
});

/**
 * GET /metadata
 * Locked while downloads are active.
 */
app.get('/metadata', (req, res) => {
    const queue = readQueue();
    const isActive = queue.some(item =>
        item.status === 'pending' || item.status === 'active' || item.status === 'paused'
    );

    if (isActive) {
        return res.status(423).json({ error: 'Downloads are still in progress. Metadata gallery is locked.' });
    }

    try {
        const infoFiles = findFilesRecursively(BASE_DOWNLOAD_DIR, '.info.json');
        const metadataArray = infoFiles.map(filePath => {
            try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
            catch { return null; }
        }).filter(Boolean);
        res.json(metadataArray);
    } catch (err) {
        res.status(500).json({ error: 'Failed to aggregate metadata', details: err.message });
    }
});

// ==========================================
// PROCESS CONTROL ENDPOINTS
// ==========================================

app.post('/control/pause', (req, res) => {
    triggerPause();
    res.json({ status: 'Engine paused.' });
});

app.post('/control/resume', (req, res) => {
    triggerResume();
    res.json({ status: 'Engine resumed.' });
});

/**
 * POST /control/cancel
 * Body: { id: "<itemId>" } — cancels a specific item.
 * No body — cancels all active downloads.
 */
app.post('/control/cancel', (req, res) => {
    const { id } = req.body || {};
    triggerCancel(id || undefined);
    const msg = id
        ? `Item ${id} cancelled and reverted to pending.`
        : 'All active downloads cancelled and reverted to pending.';
    res.json({ status: msg });
});

/**
 * POST /control/concurrency
 * Body: { value: 3 }
 * Sets the maximum number of simultaneous downloads (clamped 1–8).
 */
app.post('/control/concurrency', (req, res) => {
    const { value } = req.body;
    if (typeof value !== 'number') {
        return res.status(400).json({ error: 'Expected { value: <number> }' });
    }
    setConcurrency(value);
    res.json({ status: `Concurrency set to ${controlState.concurrency}.`, concurrency: controlState.concurrency });
});

/**
 * POST /control/clear
 * Clears all completed and failed items from the queue.
 */
app.post('/control/clear', (req, res) => {
    let queue = readQueue();
    const newQueue = queue.filter(item => item.status !== 'completed' && item.status !== 'failed');
    writeQueue(newQueue);
    engineEvents.emit('update', newQueue);
    res.json({ status: `Cleared completed and failed items.` });
});

/**
 * POST /control/retry
 * Body: { id: "<itemId>" } - retries a specific item.
 * No body - retries all failed items.
 */
app.post('/control/retry', (req, res) => {
    const { id } = req.body || {};
    let queue = readQueue();
    let count = 0;
    queue.forEach(item => {
        if (item.status === 'failed') {
            if (!id || item.id === id) {
                item.status = 'pending';
                item.retry_count = 0;
                item.progress = 0;
                count++;
            }
        }
    });
    if (count > 0) {
        writeQueue(queue);
        engineEvents.emit('update', queue);
    }
    res.json({ status: `Retrying ${count} failed items.` });
});

// ==========================================
// SERVER-SENT EVENTS (SSE) STREAM
// ==========================================

app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial state including concurrency
    const payload = { items: readQueue(), concurrency: controlState.concurrency };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    const updateListener = (queueState) => {
        const payload = { items: queueState, concurrency: controlState.concurrency };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    engineEvents.on('update', updateListener);

    req.on('close', () => {
        engineEvents.off('update', updateListener);
        res.end();
    });
});

// ==========================================
// BOOT SEQUENCE
// ==========================================

app.listen(PORT, () => {
    console.log(`[SERVER] Backend listening on http://localhost:${PORT}`);
    initEngine();
});
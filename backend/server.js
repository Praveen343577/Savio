const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { readQueue, writeQueue } = require('./fileSystem');
const { initEngine, engineEvents, triggerPause, triggerResume, triggerCancel } = require('./engine');

const app = express();
const PORT = 3000;
const BASE_DOWNLOAD_DIR = 'D:\\Nu\\YIPT';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allows frontend to send large arrays of URLs

/**
 * Utility: Identifies the target platform from the URL string.
 */
function identifyPlatform(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerUrl.includes('music.youtube.com')) return 'youtube';
    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it')) return 'pinterest';
    return 'unknown';
}

/**
 * Utility: Recursively scans a directory for files matching an extension.
 */
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
 * Returns the current static state of the queue. Used by React on initial load.
 */
app.get('/queue', (req, res) => {
    res.json(readQueue());
});

/**
 * POST /upload
 * Expects { urls: ["https://...", "https://..."] }
 * React frontend handles the .txt file reading and sends the parsed array here.
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
        if (platform === 'unknown') return; // Silently drop unsupported URLs

        // Prevent duplicate exact URLs in pending state
        const exists = queue.find(item => item.url === cleanUrl && (item.status === 'pending' || item.status === 'active'));
        if (!exists) {
            queue.push({
                id: crypto.randomUUID(),
                url: cleanUrl,
                platform: platform,
                status: 'pending',
                progress: 0,
                retry_count: 0
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        writeQueue(queue);
        engineEvents.emit('update', queue); // Broadcast new state to connected clients
    }

    res.json({ message: `Successfully queued ${addedCount} items.`, total_queue: queue.length });
});

app.post('/upload/cookie', (req, res) => {
    const { filename, content } = req.body;
    if (!filename || !content) {
        return res.status(400).json({ error: 'Missing filename or content' });
    }

    // Extract platform from filename assuming format "platform_cookies.txt" or "platform.txt"
    const platform = filename.toLowerCase().split(/[_.]/)[0]; 
    
    // Path structure matches executor.js: path.join(__dirname, '..', '..', 'inputs', 'cookies')
    // Adjust relative path depth based on server.js actual location
    const cookieDir = path.join(__dirname, '..', 'inputs', 'cookies'); 
    
    if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true });

    const targetPath = path.join(cookieDir, `${platform}_cookies.txt`);
    fs.writeFileSync(targetPath, content, 'utf8');

    res.json({ message: `Successfully mapped ${filename} to ${platform} cookies.` });
});

/**
 * GET /metadata
 * Locks access if downloads are ongoing. If clear, returns all parsed .info.json data.
 */
app.get('/metadata', (req, res) => {
    const queue = readQueue();
    const isActive = queue.some(item => item.status === 'pending' || item.status === 'active' || item.status === 'paused');
    
    if (isActive) {
        return res.status(423).json({ error: 'Downloads are still in progress. Metadata gallery is locked.' });
    }

    try {
        const infoFiles = findFilesRecursively(BASE_DOWNLOAD_DIR, '.info.json');
        const metadataArray = infoFiles.map(filePath => {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            } catch (e) {
                return null; // Skip corrupted JSON files
            }
        }).filter(Boolean); // Remove nulls

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

app.post('/control/cancel', (req, res) => {
    triggerCancel();
    res.json({ status: 'Active process cancelled and reverted to 0%.' });
});

// ==========================================
// SERVER-SENT EVENTS (SSE) STREAM
// ==========================================

/**
 * GET /stream
 * Maintains an open connection with the React frontend to push real-time queue updates.
 */
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial state immediately upon connection
    res.write(`data: ${JSON.stringify(readQueue())}\n\n`);

    // Listener for engine updates
    const updateListener = (queueState) => {
        res.write(`data: ${JSON.stringify(queueState)}\n\n`);
    };

    engineEvents.on('update', updateListener);

    // Cleanup listener if client closes browser tab
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
    initEngine(); // Clean up previous crash states and start background loop
});
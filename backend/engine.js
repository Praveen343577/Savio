const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { readQueue, writeQueue, logFailedLink } = require('./fileSystem');
const { executeItem, pauseActive, resumeActive, cancelActive } = require('./executor');
const { runPostProcess } = require('./postProcess');

// Event emitter to broadcast state changes to server.js for SSE updates
const engineEvents = new EventEmitter();

// Centralized configuration based on specified platform constraints
// const CONFIG = {
//     youtube: { delay: [2000, 5000], limit: 50, cooldown: [300000, 300000] },       // 5 mins
//     pinterest: { delay: [5000, 15000], limit: 25, cooldown: [600000, 600000] },     // 10 mins
//     twitter: { delay: [10000, 20000], limit: 15, cooldown: [900000, 900000] },     // 15 mins
//     instagram: { delay: [15000, 30000], limit: 10, cooldown: [1200000, 1800000] }  // 20-30 mins
// };

const CONFIG = {
    youtube: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    pinterest: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    twitter: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    instagram: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] }
};

// In-memory state tracking for sessions and cooldowns
let platformState = {
    youtube: { sessionCount: 0, cooldownUntil: 0 },
    pinterest: { sessionCount: 0, cooldownUntil: 0 },
    twitter: { sessionCount: 0, cooldownUntil: 0 },
    instagram: { sessionCount: 0, cooldownUntil: 0 }
};

let isGlobalPaused = false;
let isLoopRunning = false;

function cleanFilename(caption) {
    if (!caption) return 'Untitled_Post';
    let str = caption.split('.')[0]; // Stop at first fullstop
    // Keep only letters, numbers, spaces, hyphens, and underscores. Strips emojis automatically.
    str = str.replace(/[^\p{L}\p{N}\p{Z}_\-]/gu, ' ');
    str = str.replace(/[\r\n\t]/g, ' '); // Strip newlines and tabs
    str = str.replace(/\s+/g, ' ').trim(); // Collapse multiple spaces
    str = str.substring(0, 60).trim(); // Truncate to prevent OS path limits
    return str || 'Untitled_Post';
}

/**
 * Utility: Generates a random integer between min and max inclusive.
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Utility: Promisified setTimeout to halt the async loop.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Broadcasts the current queue state to the frontend via SSE.
 */
function broadcastState() {
    engineEvents.emit('update', readQueue());
}

/**
 * Core Execution Loop. Strict linear processing to enforce 1 download at a time.
 */
async function runLoop() {
    if (isLoopRunning) return;
    isLoopRunning = true;

    while (true) {
        if (isGlobalPaused) {
            await sleep(2000); // Poll every 2 seconds while paused
            continue;
        }

        let queue = readQueue();
        let now = Date.now();

        // Find the next eligible item: pending status AND platform is not on cooldown
        let nextIndex = queue.findIndex(item =>
            item.status === 'pending' &&
            platformState[item.platform].cooldownUntil < now
        );

        // If no items are eligible (all done or all on cooldown), sleep and re-check
        if (nextIndex === -1) {
            await sleep(2000);
            continue;
        }

        let item = queue[nextIndex];
        item.status = 'active';
        writeQueue(queue);
        broadcastState();

        try {
            // Await the CLI execution. Passes progress callback to update memory and SSE.
            await executeItem(item, (percent) => {
                let currentQueue = readQueue();
                let currentItem = currentQueue.find(i => i.id === item.id);
                if (currentItem && currentItem.status === 'active') {
                    currentItem.progress = percent;
                    writeQueue(currentQueue);
                    broadcastState();
                }
            });

            // If execution succeeded, attempt post-processing (e.g., .webp to .jpg)
            // Predict the metadata path based on output schema to update it in postProcess
            const today = new Date().toISOString().split('T')[0];
            const baseDir = 'D:\\Nu\\YIPT';

            if (item.platform !== 'youtube') {
                const stagingDir = path.join(baseDir, 'staging', item.id);
                if (fs.existsSync(stagingDir)) {
                    const files = fs.readdirSync(stagingDir);
                    const jsonFile = files.find(f => f.endsWith('.json'));
                    const mediaFiles = files.filter(f => f !== jsonFile);

                    if (jsonFile && mediaFiles.length > 0) {
                        const jsonPath = path.join(stagingDir, jsonFile);
                        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

                        let author = meta.username || meta.author?.name || meta.author || 'Unknown_User';
                        author = author.replace(/[<>:"\/\\|?*]/g, '').trim();

                        let rawCaption = meta.caption || meta.content || meta.title || 'Post';
                        const finalName = cleanFilename(rawCaption);

                        const finalDir = path.join(baseDir, item.platform, author, today);
                        if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

                        const finalJsonPath = path.join(finalDir, `${finalName}.info.json`);

                        if (fs.existsSync(finalJsonPath)) {
                            // Collision detected. Original file stays in place. Move only the new duplicate.
                            const dupDir = path.join(finalDir, 'Potential Duplicates');
                            if (!fs.existsSync(dupDir)) fs.mkdirSync(dupDir, { recursive: true });

                            let dupNameBase = `${finalName} (${today})`;
                            let dupJsonDest = path.join(dupDir, `${dupNameBase}.info.json`);

                            // Failsafe: If duplicate happens multiple times on the exact same date
                            let counter = 1;
                            while (fs.existsSync(dupJsonDest)) {
                                dupNameBase = `${finalName} (${today})_${counter}`;
                                dupJsonDest = path.join(dupDir, `${dupNameBase}.info.json`);
                                counter++;
                            }

                            // 1. Move incoming (NEW) metadata
                            fs.renameSync(jsonPath, dupJsonDest);

                            // 2. Move incoming (NEW) media files & post-process
                            for (let i = 0; i < mediaFiles.length; i++) {
                                const mediaFile = mediaFiles[i];
                                const ext = path.extname(mediaFile);
                                const suffix = mediaFiles.length > 1 ? `_${i + 1}` : '';
                                const dupMediaDest = path.join(dupDir, `${dupNameBase}${suffix}${ext}`);

                                fs.renameSync(path.join(stagingDir, mediaFile), dupMediaDest);
                                await runPostProcess(dupMediaDest, dupJsonDest);
                            }
                        } else {
                            // Standard operation (No collision). Move to final folder.
                            fs.renameSync(jsonPath, finalJsonPath);

                            for (let i = 0; i < mediaFiles.length; i++) {
                                const mediaFile = mediaFiles[i];
                                const ext = path.extname(mediaFile);
                                const suffix = mediaFiles.length > 1 ? `_${i + 1}` : '';
                                const finalMediaPath = path.join(finalDir, `${finalName}${suffix}${ext}`);

                                fs.renameSync(path.join(stagingDir, mediaFile), finalMediaPath);
                                await runPostProcess(finalMediaPath, finalJsonPath);
                            }
                        }
                    }
                    // Cleanup staging
                    fs.rmSync(stagingDir, { recursive: true, force: true });
                }
            }

            // Note: In a robust setup, executor.js would return the exact downloaded file path.
            // For this scope, postProcess evaluates target extensions dynamically if path is provided.

            // Mark completed
            let finalQueue = readQueue();
            let finalItem = finalQueue.find(i => i.id === item.id);
            if (finalItem) {
                finalItem.status = 'completed';
                finalItem.progress = 100;
                writeQueue(finalQueue);
            }

            // Update platform session counters
            let pState = platformState[item.platform];
            pState.sessionCount++;

            if (pState.sessionCount >= CONFIG[item.platform].limit) {
                // Trigger cooldown
                let cdRange = CONFIG[item.platform].cooldown;
                let cdMs = getRandomInt(cdRange[0], cdRange[1]);
                pState.cooldownUntil = Date.now() + cdMs;
                pState.sessionCount = 0; // Reset for next session
                console.log(`[ENGINE] ${item.platform} hit limit. Cooldown for ${cdMs / 60000} mins.`);
            } else {
                // Trigger standard delay between downloads
                let delayRange = CONFIG[item.platform].delay;
                let delayMs = getRandomInt(delayRange[0], delayRange[1]);
                console.log(`[ENGINE] Waiting ${delayMs}ms before next item...`);
                await sleep(delayMs);
            }

        } catch (error) {
            // Re-fetch queue to ensure we don't overwrite user actions (like cancel)
            let currentQueue = readQueue();
            let currentItem = currentQueue.find(i => i.id === item.id);

            if (!currentItem) continue;

            if (error.isCancelled) {
                // Cancelled by user. Reset to pending.
                currentItem.status = 'pending';
                currentItem.progress = 0;
            } else {
                // Standard failure
                currentItem.retry_count++;
                if (currentItem.retry_count >= 3) {
                    currentItem.status = 'failed';
                    logFailedLink(item.platform, item.url);
                } else {
                    currentItem.status = 'pending';
                    currentItem.progress = 0;
                }
            }
            writeQueue(currentQueue);
        }

        broadcastState();
    }
}

/**
 * Initializes the engine. Cleans up stale state from previous crashes.
 */
function initEngine() {
    let queue = readQueue();
    let mutated = false;
    // Revert any items stuck in 'active' or 'paused' from a previous server shutdown
    queue.forEach(item => {
        if (item.status === 'active' || item.status === 'paused') {
            item.status = 'pending';
            item.progress = 0;
            mutated = true;
        }
    });
    if (mutated) writeQueue(queue);

    // Start background loop
    runLoop();
}

/**
 * External Control: Pauses the global engine and suspends active child process.
 */
function triggerPause() {
    isGlobalPaused = true;
    pauseActive();

    let queue = readQueue();
    let activeItem = queue.find(i => i.status === 'active');
    if (activeItem) {
        activeItem.status = 'paused';
        writeQueue(queue);
        broadcastState();
    }
}

/**
 * External Control: Resumes the global engine and active child process.
 */
function triggerResume() {
    isGlobalPaused = false;
    resumeActive();

    let queue = readQueue();
    let pausedItem = queue.find(i => i.status === 'paused');
    if (pausedItem) {
        pausedItem.status = 'active';
        writeQueue(queue);
        broadcastState();
    }
}

/**
 * External Control: Force cancels the active child process and resets its state to 0.
 */
function triggerCancel() {
    cancelActive();
    // Reversion logic is handled in the catch block of runLoop
}

module.exports = {
    initEngine,
    engineEvents,
    triggerPause,
    triggerResume,
    triggerCancel
};
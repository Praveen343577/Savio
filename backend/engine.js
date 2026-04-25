const { readQueue, writeQueue } = require('./fileSystem');
const { pauseActive, resumeActive, cancelActive } = require('./executor');
const { engineEvents, controlState } = require('./engineState');
const { runLoop, broadcastState } = require('./scheduler');

/**
 * Initializes the engine. Cleans up stale state from previous crashes.
 */
function initEngine() {
    let queue = readQueue();
    let mutated = false;
    queue.forEach(item => {
        if (item.status === 'active' || item.status === 'paused') {
            item.status   = 'pending';
            item.progress = 0;
            item.speed    = null;
            item.eta      = null;
            mutated = true;
        }
    });
    if (mutated) writeQueue(queue);
    runLoop();
}

/**
 * Pauses the global engine and suspends ALL active child processes.
 */
function triggerPause() {
    controlState.isGlobalPaused = true;
    pauseActive(); // No ID = pause all

    let queue = readQueue();
    let mutated = false;
    queue.forEach(item => {
        if (item.status === 'active') {
            item.status = 'paused';
            mutated = true;
        }
    });
    if (mutated) {
        writeQueue(queue);
        broadcastState();
    }
}

/**
 * Resumes the global engine and all paused child processes.
 */
function triggerResume() {
    controlState.isGlobalPaused = false;
    resumeActive(); // No ID = resume all

    let queue = readQueue();
    let mutated = false;
    queue.forEach(item => {
        if (item.status === 'paused') {
            item.status = 'active';
            mutated = true;
        }
    });
    if (mutated) {
        writeQueue(queue);
        broadcastState();
    }
}

/**
 * Cancels a specific active download by item ID.
 * If no ID is provided, cancels all active downloads.
 */
function triggerCancel(id) {
    cancelActive(id); // Reversion to 'pending' is handled in scheduler's catch block
}

/**
 * Sets the maximum number of concurrent downloads.
 * Clamped to 1–8 to stay reasonable.
 */
function setConcurrency(n) {
    controlState.concurrency = Math.max(1, Math.min(8, parseInt(n, 10) || 1));
    console.log(`[ENGINE] Concurrency set to ${controlState.concurrency}`);
}

module.exports = {
    initEngine,
    engineEvents,
    triggerPause,
    triggerResume,
    triggerCancel,
    setConcurrency
};
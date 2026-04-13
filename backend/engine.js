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
    controlState.isGlobalPaused = true;
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
    controlState.isGlobalPaused = false;
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
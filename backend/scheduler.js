const { readQueue, writeQueue, logFailedLink } = require('./fileSystem');
const { executeItem } = require('./executor');
const { organizeDownloadedMedia } = require('./mediaOrganizer');
const { sleep, getRandomInt } = require('./utils');
const { platformState, CONFIG, controlState, engineEvents } = require('./engineState');

function broadcastState() {
    engineEvents.emit('update', readQueue());
}

async function runLoop() {
    if (controlState.isLoopRunning) return;
    controlState.isLoopRunning = true;

    while (true) {
        if (controlState.isGlobalPaused) {
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

            await organizeDownloadedMedia(item);

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

module.exports = {
    runLoop,
    broadcastState
};

const { readQueue, writeQueue, logFailedLink } = require('./fileSystem');
const { fetchMediaInfo, executeItem, activeCount } = require('./executor');
const { organizeDownloadedMedia } = require('./mediaOrganizer');
const { sleep, getRandomInt } = require('./utils');
const { platformState, CONFIG, controlState, engineEvents } = require('./engineState');

function broadcastState() {
    engineEvents.emit('update', readQueue());
}

/**
 * Handles the full lifecycle of a single queue item: preflight → execute → organize → complete.
 * Runs independently and concurrently alongside other active downloads.
 *
 * @param {Object} item - The queue item to process (already written as 'active' in queue.json)
 */
async function processItem(item) {
    // --- Pre-flight: fetch media info before download begins ---
    const mediaInfo = await fetchMediaInfo(item);
    if (mediaInfo) {
        let q = readQueue();
        let target = q.find(i => i.id === item.id);
        if (target) {
            target.mediaInfo = mediaInfo;
            // If the preflight returned a filesize, seed it into the item now
            if (mediaInfo.filesize) target.filesize = mediaInfo.filesize;
            writeQueue(q);
            broadcastState();
        }
    }

    try {
        await executeItem(item, ({ percent, filesize, speed, eta }) => {
            let currentQueue = readQueue();
            let currentItem = currentQueue.find(i => i.id === item.id);
            if (currentItem && currentItem.status === 'active') {
                currentItem.progress = percent ?? currentItem.progress;
                if (filesize != null) currentItem.filesize = filesize;
                if (speed != null) currentItem.speed = speed;
                if (eta != null) currentItem.eta = eta;
                writeQueue(currentQueue);
                broadcastState();
            }
        });

        await organizeDownloadedMedia(item);

        let finalQueue = readQueue();
        let finalItem = finalQueue.find(i => i.id === item.id);
        if (finalItem) {
            finalItem.status = 'completed';
            finalItem.progress = 100;
            finalItem.speed = null;
            finalItem.eta = null;
            writeQueue(finalQueue);
        }

        // Platform session accounting
        let pState = platformState[item.platform];
        pState.sessionCount++;

        if (pState.sessionCount >= CONFIG[item.platform].limit) {
            const cdRange = CONFIG[item.platform].cooldown;
            const cdMs = getRandomInt(cdRange[0], cdRange[1]);
            pState.cooldownUntil = Date.now() + cdMs;
            pState.sessionCount = 0;
            console.log(`[ENGINE] ${item.platform} hit limit. Cooldown for ${cdMs / 60000} mins.`);
        } else {
            const delayRange = CONFIG[item.platform].delay;
            const delayMs = getRandomInt(delayRange[0], delayRange[1]);
            console.log(`[ENGINE] Waiting ${delayMs}ms after ${item.id.slice(0, 6)}...`);
            await sleep(delayMs);
        }

    } catch (error) {
        let currentQueue = readQueue();
        let currentItem = currentQueue.find(i => i.id === item.id);

        if (!currentItem) return;

        if (error.isCancelled) {
            currentItem.status = 'pending';
            currentItem.progress = 0;
            currentItem.speed = null;
            currentItem.eta = null;
        } else {
            currentItem.retry_count++;
            if (currentItem.retry_count >= 3) {
                currentItem.status = 'failed';
                logFailedLink(item.platform, item.url);
            } else {
                currentItem.status = 'pending';
                currentItem.progress = 0;
                currentItem.speed = null;
                currentItem.eta = null;
            }
        }
        writeQueue(currentQueue);
    }

    broadcastState();
}

/**
 * Main scheduler loop. Runs forever, polling for eligible items and
 * dispatching up to controlState.concurrency downloads simultaneously.
 *
 * Each dispatched item runs as a detached async task (fire-and-forget from
 * the loop's perspective) so the loop can immediately pick the next slot.
 */
async function runLoop() {
    if (controlState.isLoopRunning) return;
    controlState.isLoopRunning = true;

    while (true) {
        if (controlState.isGlobalPaused) {
            await sleep(500);
            continue;
        }

        const slots = controlState.concurrency - activeCount();

        if (slots <= 0) {
            await sleep(500);
            continue;
        }

        let queue = readQueue();
        const now = Date.now();

        // Collect IDs already being processed so we don't double-pick them
        const activeIds = new Set(
            queue.filter(i => i.status === 'active' || i.status === 'paused').map(i => i.id)
        );

        // Find up to `slots` eligible pending items
        const candidates = queue.filter(item =>
            item.status === 'pending' &&
            !activeIds.has(item.id) &&
            platformState[item.platform].cooldownUntil < now
        ).slice(0, slots);

        if (candidates.length === 0) {
            await sleep(500);
            continue;
        }

        // Mark all candidates as active in one write
        candidates.forEach(c => { c.status = 'active'; });
        writeQueue(queue);
        broadcastState();

        // Fire each as an independent concurrent task
        candidates.forEach(item => {
            processItem(item).catch(err => {
                console.error(`[ENGINE] Unhandled error in processItem for ${item.id}:`, err);
            });
        });

        // Short pause before the next scheduling tick
        await sleep(200);
    }
}

module.exports = {
    runLoop,
    broadcastState
};
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'queue.json');
const BASE_DOWNLOAD_DIR = 'D:\\Nu\\YIPT';

function writeQueue(queueArray) {
    const tmpPath = QUEUE_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(queueArray, null, 2), 'utf8');
        fs.renameSync(tmpPath, QUEUE_FILE);
    } catch (error) {
        console.error('FATAL: Failed to write queue atomically.', error);
    }
}

function readQueue() {
    if (!fs.existsSync(QUEUE_FILE)) {
        writeQueue([]);
        return [];
    }
    try {
        const data = fs.readFileSync(QUEUE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('ERROR: queue.json corrupted. Returning empty queue.', error);
        return [];
    }
}

function logFailedLink(platform, url) {
    const today = new Date().toISOString().split('T')[0];
    const targetDir = path.join(BASE_DOWNLOAD_DIR, platform, 'failedLinks', today);
    const targetFile = path.join(targetDir, `${platform}.txt`);

    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.appendFileSync(targetFile, `${url}\n`, 'utf8');
    } catch (error) {
        console.error(`ERROR: Could not append failed link to ${targetFile}`, error);
    }
}

module.exports = {
    writeQueue,
    readQueue,
    logFailedLink
};
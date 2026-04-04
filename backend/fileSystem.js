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
        if (!data.trim()) {
            writeQueue([]);
            return [];
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('ERROR: queue.json corrupted. Overwriting with empty array.', error.message);
        writeQueue([]);
        return [];
    }
}

function logFailedLink(platform, url) {
    const dateObj = new Date();
    const todayStr = `${dateObj.getFullYear()}_${String(dateObj.getMonth() + 1).padStart(2, '0')}_${String(dateObj.getDate()).padStart(2, '0')}`;

    let platformName = platform;
    if (platformName === 'twitter' || platformName === 'pinterest') {
        platformName = platformName.charAt(0).toUpperCase() + platformName.slice(1);
    }

    const targetDir = path.join('D:\\Nu\\YIPT', platformName, todayStr);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const failFile = path.join(targetDir, '@failedLinks.txt');
    fs.appendFileSync(failFile, `${url}\n`);
}

module.exports = {
    writeQueue,
    readQueue,
    logFailedLink
};
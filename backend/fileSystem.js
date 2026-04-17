const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'queue.json');
const BASE_DOWNLOAD_DIR = 'D:\\Nu\\YIPT';

function writeQueue(queueArray) {
    const tmpPath = QUEUE_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(queueArray, null, 2), 'utf8');
        // Windows does not allow renameSync over an existing open file (EPERM).
        // Unlinking the destination first sidesteps this limitation.
        if (fs.existsSync(QUEUE_FILE)) {
            fs.unlinkSync(QUEUE_FILE);
        }
        fs.renameSync(tmpPath, QUEUE_FILE);
    } catch (error) {
        console.error('FATAL: Failed to write queue atomically.', error);
        // Last-resort fallback: write directly if the tmp→rename dance fails
        try {
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueArray, null, 2), 'utf8');
        } catch (fallbackError) {
            console.error('FATAL: Fallback direct write also failed.', fallbackError);
        }
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

function logDownloadedLink(platform, url, mediaNames) {
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

    const successFile = path.join(targetDir, '@downloadedLinks.txt');
    const entry = `${url}\n${mediaNames.join('\n')}\n\n`;
    fs.appendFileSync(successFile, entry);
}

module.exports = {
    writeQueue,
    readQueue,
    logFailedLink,
    logDownloadedLink
};
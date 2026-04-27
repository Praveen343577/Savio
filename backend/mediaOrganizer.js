const fs = require('fs');
const path = require('path');
const { runPostProcess } = require('./postProcess');
const { logDownloadedLink } = require('./fileSystem');

const { escapeRegExp } = require('./utils');
require('dotenv').config();

async function organizeDownloadedMedia(item) {
    const dateObj = new Date();
    const todayStr = `${dateObj.getFullYear()}_${String(dateObj.getMonth() + 1).padStart(2, '0')}_${String(dateObj.getDate()).padStart(2, '0')}`;
    const baseDir = process.env.DOWNLOAD_DIR || require('path').join(require('os').homedir(), 'Downloads', 'Savio');

    if (item.platform === 'youtube') return;

    const stagingDir = path.join(baseDir, 'staging', item.id);
    if (!fs.existsSync(stagingDir)) return;

    const files = fs.readdirSync(stagingDir);
    const jsonFile = files.find(f => f.endsWith('.json'));
    const mediaFiles = files.filter(f => f !== jsonFile);

    if (jsonFile && mediaFiles.length > 0) {
        const jsonPath = path.join(stagingDir, jsonFile);
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        let author;
        if (item.platform === 'pinterest') {
            author = meta.native_creator?.username
                || meta.origin_pinner?.username
                || meta.pinner?.username
                || 'Unknown_User';

        } else if (item.platform === 'instagram') {
            author = meta.username
                || meta.fullname
                || 'Unknown_User';

        } else if (item.platform === 'twitter') {
            author = meta.author?.name
                || meta.user?.name
                || 'Unknown_User';
        }
        author = author.replace(/[<>:"\/\\|?*]/g, '').trim();

        // Force capitalization of platform folder names as requested
        let platformName = item.platform;
        if (platformName === 'twitter' || platformName === 'pinterest') {
            platformName = platformName.charAt(0).toUpperCase() + platformName.slice(1);
        }

        const finalDir = path.join(baseDir, platformName, todayStr);
        const metaDir = path.join(finalDir, 'metadata');

        if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
        if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });

        const existingFiles = fs.readdirSync(finalDir);
        let vCount = 0;
        let pCount = 0;

        const prefixPattern = new RegExp(`^${escapeRegExp(author)} ([vp])(\\d+)`);
        for (const f of existingFiles) {
            const match = f.match(prefixPattern);
            if (match) {
                const num = parseInt(match[2], 10);
                if (match[1] === 'v' && num > vCount) vCount = num;
                if (match[1] === 'p' && num > pCount) pCount = num;
            }
        }

        let generatedPaths = [];
        let primaryName = '';

        for (let i = 0; i < mediaFiles.length; i++) {
            const mediaFile = mediaFiles[i];
            const ext = path.extname(mediaFile).toLowerCase();
            const isVideo = ['.mp4', '.webm', '.mov', '.mkv'].includes(ext);

            let typeChar = isVideo ? 'v' : 'p';
            let currentNum = isVideo ? ++vCount : ++pCount;
            let finalName = `${author} ${typeChar}${currentNum}`;

            if (i === 0) primaryName = finalName; // Use first media item name for the single JSON file

            const finalMediaPath = path.join(finalDir, finalName + ext);
            fs.renameSync(path.join(stagingDir, mediaFile), finalMediaPath);
            generatedPaths.push(finalMediaPath);
        }

        const finalJsonPath = path.join(metaDir, `${primaryName}.info.json`);
        fs.renameSync(jsonPath, finalJsonPath);

        let finalPaths = [];
        for (const mediaPath of generatedPaths) {
            const resolvedPath = await runPostProcess(mediaPath, finalJsonPath);
            finalPaths.push(resolvedPath);
        }

        logDownloadedLink(item.platform, item.url, finalPaths);
    }
    fs.rmSync(stagingDir, { recursive: true, force: true });
}

module.exports = {
    organizeDownloadedMedia
};

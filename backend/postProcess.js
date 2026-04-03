const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Formats that web browsers struggle to render natively or natively lack broad compatibility
const TARGET_EXTENSIONS = ['.webp', '.heic', '.avif'];

/**
 * Evaluates the downloaded file. If it matches a target extension, spawns FFmpeg 
 * to convert it to a standard JPEG, deletes the original, and rewrites the metadata.
 * * @param {string} mediaPath - Absolute path to the downloaded media file.
 * @param {string} metadataPath - Absolute path to the associated .info.json file.
 * @returns {Promise<string>} Resolves with the final media path (original or converted).
 */
function runPostProcess(mediaPath, metadataPath) {
    return new Promise((resolve, reject) => {
        // Failsafe: if file doesn't exist, bypass processing
        if (!fs.existsSync(mediaPath)) {
            return resolve(mediaPath);
        }

        const ext = path.extname(mediaPath).toLowerCase();
        
        // If the extension is already standard (.mp4, .jpg, .png), bypass
        if (!TARGET_EXTENSIONS.includes(ext)) {
            return resolve(mediaPath);
        }

        const parsedPath = path.parse(mediaPath);
        // Force conversion to .jpg for maximum React UI compatibility
        const newMediaPath = path.join(parsedPath.dir, parsedPath.name + '.jpg');
        const newFilename = path.basename(newMediaPath);
        const oldFilename = path.basename(mediaPath);

        const ffmpeg = spawn('ffmpeg', [
            '-i', mediaPath, 
            newMediaPath
        ], {
            windowsHide: true // Prevents CMD popup spam on Windows
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                try {
                    // Cleanup raw unoptimized file to save disk space
                    fs.unlinkSync(mediaPath);

                    // Update the .info.json so React UI requests the .jpg, not the deleted .webp
                    if (fs.existsSync(metadataPath)) {
                        let rawData = fs.readFileSync(metadataPath, 'utf8');
                        let metaData = JSON.parse(rawData);

                        // Overwrite gallery-dl specific keys if they exist
                        if (metaData.extension) metaData.extension = 'jpg';
                        if (metaData.filename) metaData.filename = newFilename;
                        if (metaData.filepath) metaData.filepath = newMediaPath;

                        fs.writeFileSync(metadataPath, JSON.stringify(metaData, null, 2), 'utf8');
                    }

                    resolve(newMediaPath);
                } catch (err) {
                    reject(new Error(`I/O failure during post-process cleanup: ${err.message}`));
                }
            } else {
                reject(new Error(`FFmpeg conversion failed with exit code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg spawn error (is it in system PATH?): ${err.message}`));
        });
    });
}

module.exports = {
    runPostProcess
};
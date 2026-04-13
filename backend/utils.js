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

module.exports = {
    cleanFilename,
    getRandomInt,
    sleep
};

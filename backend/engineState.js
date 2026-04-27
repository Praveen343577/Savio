const EventEmitter = require('events');

const engineEvents = new EventEmitter();

const CONFIG = {
    youtube:   { delay: [3000, 6000],    limit: 40,  cooldown: [300000, 420000] },
    pinterest: { delay: [5000, 12000],   limit: 20,  cooldown: [600000, 720000] },
    twitter:   { delay: [8000, 18000],   limit: 12,  cooldown: [900000, 1200000] },
    instagram: { delay: [15000, 35000],  limit: 8,   cooldown: [1200000, 1800000] }
};

let platformState = {
    youtube: { sessionCount: 0, cooldownUntil: 0 },
    pinterest: { sessionCount: 0, cooldownUntil: 0 },
    twitter: { sessionCount: 0, cooldownUntil: 0 },
    instagram: { sessionCount: 0, cooldownUntil: 0 }
};

let controlState = {
    isGlobalPaused: false,
    isLoopRunning: false,
    concurrency: 1  // Max simultaneous downloads. Adjustable at runtime via /control/concurrency.
};

module.exports = {
    engineEvents,
    CONFIG,
    platformState,
    controlState
};
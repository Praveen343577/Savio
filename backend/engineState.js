const EventEmitter = require('events');

const engineEvents = new EventEmitter();

const CONFIG = {
    youtube: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    pinterest: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    twitter: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] },
    instagram: { delay: [1000, 2000], limit: 9999, cooldown: [0, 0] }
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
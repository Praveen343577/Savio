# Savio — Complete Codebase Analysis

**Project**: Media downloader for YouTube, Instagram, Twitter, Pinterest  
**Stack**: Node.js/Express backend + React/Vite frontend  
**Tools**: `yt-dlp`, `gallery-dl`, `ffmpeg`

---

## 1. Issues Ranked by Severity

### 🔴 CRITICAL — Will cause crashes, data loss, or bans

| # | Issue | Files |
|---|-------|-------|
| C1 | **Rate limits completely disabled** — All platform configs set to `delay: [1000,2000], limit: 9999, cooldown: [0,0]`. The safe defaults are commented out. | [engineState.js](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engineState.js#L5-L10), [engine.js](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L21-L26) |
| C2 | **Hardcoded private paths everywhere** — `D:\\Nu\\YIPT` and `D:\\Projects\\Project_2\\Savio\\ChromeProfile` are hardcoded across **5 files**. Will crash on any other machine. | [server.js:14](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/server.js#L14), [executor.js:13-14](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L13-L14), [executor.js:110-111](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L110-L111), [fileSystem.js:6-7](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/fileSystem.js#L6-L7), [mediaOrganizer.js:9](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/mediaOrganizer.js#L9) |
| C3 | **`activeProcesses` Map is never declared** in `executor.js`. Line 188 writes to `activeProcesses` but it's never `new Map()`'d. The code **will throw a ReferenceError** at runtime. | [executor.js:188](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L188) |
| C4 | **Duplicate `BASE_DOWNLOAD_DIR` const** — `executor.js` declares `BASE_DOWNLOAD_DIR` twice (line 14 and line 111), the second using `const` which will throw a `SyntaxError`. | [executor.js:14](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L14), [executor.js:111](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L111) |
| C5 | **`SIGSTOP`/`SIGCONT` don't work on Windows** — `pauseActive()` and `resumeActive()` send Unix signals that Windows doesn't support. Pause/resume will silently fail or crash. | [executor.js:269-283](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L267-L283) |
| C6 | **Chrome profile path hardcoded** — `executor.js` points to a specific Chrome profile directory that won't exist on other machines. `yt-dlp` and `gallery-dl` will fail cookie auth. | [executor.js:13](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L13) |
| C7 | **`mediaOrganizer.js` has no fallback path** — Unlike other files, it hardcodes `baseDir = 'D:\\Nu\\YIPT'` without any fallback, will crash on any machine without that D: drive. | [mediaOrganizer.js:9](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/mediaOrganizer.js#L9) |

---

### 🟠 HIGH — Will cause bugs, data corruption, or significant UX issues

| # | Issue | Files |
|---|-------|-------|
| H1 | **Duplicate/conflicting architecture** — `engine.js` and `scheduler.js` both contain `runLoop()` functions doing the same thing (queue processing). `engine.js` has its own embedded `CONFIG`, `platformState`, and `isGlobalPaused` that conflict with the centralized `engineState.js`. The server imports from `engine.js`, so `scheduler.js` + `engineState.js` are dead code. | [engine.js](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js), [scheduler.js](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/scheduler.js), [engineState.js](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engineState.js) |
| H2 | **engine.js `triggerPause` references `controlState.isGlobalPaused` but the `runLoop` checks local `isGlobalPaused`** — Pause sets `controlState.isGlobalPaused = true` but the while-loop checks the local variable `isGlobalPaused` (line 79). Pause never actually stops the loop. | [engine.js:36](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L36), [engine.js:79](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L79), [engine.js:297](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L297) |
| H3 | **Queue file is read/written on every progress tick** — Each yt-dlp stdout line triggers `readQueue()` → `writeQueue()` → `broadcastState()` (another `readQueue()`). On a fast download this is 10-50 disk writes/second, causing I/O thrashing and potential file corruption. | [engine.js:107-113](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L107-L113) |
| H4 | **`handleConcurrencyChange` function is called in JSX but never defined** in ControlBar.jsx. The +/- buttons will crash on click. | [ControlBar.jsx:92](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/ControlBar.jsx#L92), [ControlBar.jsx:99](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/ControlBar.jsx#L99) |
| H5 | **Regex injection in `mediaOrganizer.js`** — The `author` string is interpolated directly into a `RegExp` without escaping. Authors with `(`, `)`, `+`, etc. in their name will cause regex errors or silently match wrong files. | [mediaOrganizer.js:59](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/mediaOrganizer.js#L59), [engine.js:169](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L169) |
| H6 | **Race condition on queue.json** — Multiple concurrent `processItem()` calls all do `readQueue()` → mutate → `writeQueue()` independently. One write can overwrite another's progress update, losing data. | [scheduler.js:33-43](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/scheduler.js#L33-L43) |
| H7 | **engine.js has full organizer logic duplicated** — Lines 116-212 duplicate the entire `mediaOrganizer.js` + `postProcess.js` workflow inline. Any fix to one won't apply to the other. | [engine.js:116-212](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L116-L212) |

---

### 🟡 MEDIUM — Will cause inconsistencies, poor UX, or maintainability issues

| # | Issue | Files |
|---|-------|-------|
| M1 | **Massive CSS duplication** — `App.css` re-defines every style that already exists in the split CSS files (`styles/Navbar.css`, `styles/Card.css`, etc.). Changes to one won't apply if the other overrides it. | [App.css](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/App.css) vs `styles/` |
| M2 | **Keyframe animations duplicated** — `fadeUp`, `slowSpin`, `scrollBounce`, `progressPulse`, `slideIn` are defined in both `App.css` (lines 16-47) and `styles/Animations.css`. | [App.css:16-47](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/App.css#L16-L47), [Animations.css](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/styles/Animations.css) |
| M3 | **`cleanFilename` is defined in both `engine.js` and `utils.js`** but `engine.js` never imports from `utils.js`. | [engine.js:39-48](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/engine.js#L39-L48), [utils.js:1-9](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/utils.js#L1-L9) |
| M4 | **No progress bar shown on Card** — The Card component only shows URL and badges. The progress bar CSS exists (`styles/Card.css`) but the JSX never renders `<div className="progress-container">`. | [Card.jsx](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/Card.jsx) |
| M5 | **No pause/resume/cancel buttons in UI** — The API endpoints exist (`/control/pause`, `/control/resume`, `/control/cancel`) but there are no UI buttons to trigger them. | Frontend components |
| M6 | **Custom cursor hides on touch devices** — `cursor: none !important` globally disables the cursor, but touch devices don't have one. Combined with no mobile-responsive CSS, the app is unusable on mobile. | [index.css:24-26](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/index.css#L24-L26) |
| M7 | **No `node_modules/` in root `.gitignore`** — Only `ChromeProfile/` and `inputs/` are gitignored at root. `node_modules/` is only in `frontend/.gitignore`. Backend's `node_modules` could be committed. | [.gitignore](file:///c:/Users/1000863/Desktop/26mar26/Savio/.gitignore) |
| M8 | **`logDownloadedLink` re-declares `BASE_DOWNLOAD_DIR`** as a local variable shadowing the module-level one, using a different fallback mechanism. | [fileSystem.js:78-79](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/fileSystem.js#L78-L79) |

---

### 🟢 LOW — Minor quality/style issues

| # | Issue | Files |
|---|-------|-------|
| L1 | **`isCancelled` declared but unused** in executor.js (line 105). The actual cancellation uses `cancelledIds` Set. | [executor.js:105](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L105) |
| L2 | **`today` variable computed but unused** in `buildCommandArgs` (line 118). | [executor.js:118](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L118) |
| L3 | **`fetchMediaInfo` exported but never called** — The preflight function exists in executor.js but `engine.js`'s `runLoop` never calls it. Only `scheduler.js` uses it (but scheduler is dead code). | [executor.js:24](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/executor.js#L24) |
| L4 | **No `start` script in backend `package.json`** — `main` points to `index.js` (doesn't exist), no `"start": "node server.js"`. | [package.json:5](file:///c:/Users/1000863/Desktop/26mar26/Savio/backend/package.json#L5) |
| L5 | **`useMagnetic` hook in ControlBar conflicts with inline magnetic handlers** — Lines 50-59 define `handleMagneticMove`/`handleMagneticLeave` but the button uses `{...magnetic}` from the hook. Both exist, only one is used. | [ControlBar.jsx:9](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/ControlBar.jsx#L9), [ControlBar.jsx:50-60](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/ControlBar.jsx#L50-L60) |
| L6 | **`CustomCursor` uses `requestAnimationFrame` without cleanup guard** — The `animateCursor` function references `cursor` which could be null after unmount despite the cleanup. | [CustomCursor.jsx:20-29](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/src/components/CustomCursor.jsx#L20-L29) |
| L7 | **Title says "YIPT Downloader"** which reveals internal naming. Should match "Savio" branding. | [index.html:16](file:///c:/Users/1000863/Desktop/26mar26/Savio/frontend/index.html#L16) |

---

## 2. Problems Each Issue Causes

| Issue | Problem |
|-------|---------|
| **C1** | **Platforms will detect automated bulk downloading** and ban the account/IP. Instagram is especially aggressive — 10+ rapid requests trigger shadowbans or full blocks. |
| **C2** | App is **non-portable**: crashes immediately with `ENOENT` on any machine that doesn't have `D:\Nu\YIPT`. |
| **C3** | Backend **crashes on first download attempt** with `ReferenceError: activeProcesses is not defined`. |
| **C4** | Backend **won't even start** — Node.js throws `SyntaxError: Identifier 'BASE_DOWNLOAD_DIR' has already been declared`. |
| **C5** | Pause/resume buttons silently fail. On Windows, `SIGSTOP` throws, potentially crashing the backend. |
| **C6** | Cookie-based auth for Instagram/Twitter will fail, causing **all authenticated downloads to 403**. |
| **C7** | `organizeDownloadedMedia` crashes on any non-D-drive machine. Downloaded files stay in staging forever. |
| **H1** | Confusing codebase — two parallel implementations of the same logic. Bug fixes applied to one are missed in the other. |
| **H2** | **Pause command does nothing** — the loop continues running because it checks the wrong variable. |
| **H3** | Disk I/O saturation, `queue.json` can become corrupted or partially written, losing download state. |
| **H4** | Clicking +/- concurrency buttons **crashes the React app** with `handleConcurrencyChange is not defined`. |
| **H5** | Usernames like `John (Official)` or `user+name` cause regex syntax errors, crashing the file organizer. |
| **H6** | Concurrent downloads overwrite each other's progress — queue shows stale data, completed items revert to active. |
| **H7** | Maintaining two copies of 100-line file organization logic is a maintenance nightmare. |
| **M1-M2** | CSS specificity wars — styles flip-flop depending on import order. Visual bugs are hard to debug. |
| **M4** | Users can't see download progress even though the backend sends it. |
| **M5** | Users must use `curl` or browser console to pause/cancel downloads. |
| **M6** | Completely broken experience on tablets/phones — no cursor visible, no way to interact. |

---

## 3. How to Fix Each Issue

### Critical Fixes

| Issue | Fix |
|-------|-----|
| **C1** | **Uncomment the safe CONFIG** and delete the zero-delay one. Or better: load from a `config.json` file so users can tune per-platform. |
| **C2** | Create a central `config.js` that exports `BASE_DOWNLOAD_DIR` and `CHROME_PROFILE`. Use environment variables or a user-editable `config.json`. Import this single source everywhere. |
| **C3** | Add `const activeProcesses = new Map();` at the top of `executor.js` (after line 11). |
| **C4** | Remove the duplicate `const BASE_DOWNLOAD_DIR` at line 111 and `const primaryDir` at line 110 — import from the central config instead. |
| **C5** | Replace `SIGSTOP`/`SIGCONT` with a cross-platform mechanism: use `ntsuspendprocess` npm package, or implement pause via a named pipe / IPC channel. Alternatively: on Windows, use `subprocess.kill('SIGINT')` to gracefully stop and re-queue. |
| **C6** | Make `CHROME_PROFILE` configurable. Add a UI setting or read from `config.json`. |
| **C7** | Import and use the same centralized `BASE_DOWNLOAD_DIR` from the config module. |

### High Fixes

| Issue | Fix |
|-------|-----|
| **H1** | **Delete `engine.js`'s `runLoop` and inline organizer code**. Refactor `server.js` to import `{ runLoop }` from `scheduler.js` instead. Make `scheduler.js` + `engineState.js` the single source of truth. |
| **H2** | After consolidating to scheduler.js, this is automatically fixed (scheduler uses `controlState.isGlobalPaused`). |
| **H3** | **Throttle progress writes** — buffer updates and flush to disk at most once per second. Keep real-time updates in memory and only push via SSE. |
| **H4** | Define `handleConcurrencyChange` in ControlBar: `const handleConcurrencyChange = async (delta) => { const newVal = concurrency + delta; await api.setConcurrency(newVal); onConcurrencyChange(newVal); };` |
| **H5** | Escape the `author` string before regex: `author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` |
| **H6** | **Move queue to an in-memory data structure** (single array with a mutex/lock). Only persist to disk on state transitions (pending→active, active→completed/failed), not on every progress tick. |
| **H7** | Delete inline organizer in engine.js (lines 116-212). Use `await organizeDownloadedMedia(item)` from `mediaOrganizer.js`. |

### Medium/Low Fixes

| Issue | Fix |
|-------|-----|
| **M1-M2** | Remove all duplicate style blocks from `App.css`. Keep only the `@import` statements and layout-only styles. |
| **M3** | Remove `cleanFilename` and `getRandomInt` and `sleep` from `engine.js`. Import from `utils.js`. |
| **M4** | Add progress bar JSX to `Card.jsx` for active items: `{item.status === 'active' && <div className="progress-container"><div className="progress-bar" style={{width: item.progress + '%'}} /></div>}` |
| **M5** | Add Pause/Resume/Cancel buttons to the ControlBar component. |
| **M6** | Add `@media (pointer: coarse)` query to show the default cursor and hide CustomCursor on touch devices. |
| **M7** | Add `node_modules/` to root `.gitignore`. |
| **L1-L3** | Remove dead code (`isCancelled`, unused `today`, unused inline functions). |
| **L4** | Fix package.json: `"main": "server.js"`, add `"start": "node server.js"`. |
| **L7** | Change `<title>` to `Savio` to match branding. |

---

## 4. Features This Project Should Have

### Must-Have (Core Functionality Gaps)

| Feature | Why |
|---------|-----|
| **🔧 Centralized Configuration File** | A `config.json` or `.env` for `DOWNLOAD_DIR`, `CHROME_PROFILE`, platform rate limits, concurrency default. Makes the app portable. |
| **⏸️ Pause / Resume / Cancel UI Buttons** | Backend supports it but UI doesn't expose it. Users need this for basic download management. |
| **📊 Real Progress Bar on Cards** | CSS exists, JSX doesn't render it. Critical UX gap. |
| **📋 Download History / Logs View** | Currently only logged to `.txt` files. Show history in the UI with filters by platform, date, status. |
| **🗑️ Queue Management** | Delete individual items from queue, clear completed/failed items, re-queue failed items. |
| **📁 Custom Save Path Selector** | Your `todo.txt` already notes this. Let users choose where to save via a directory picker in the UI. |
| **🍪 Cookie File Upload** | Your `todo.txt` notes this too. Let users upload cookie files per platform instead of relying on a Chrome profile path. |

### Should-Have (Anti-Ban & Reliability)

| Feature | Why |
|---------|-----|
| **🛡️ Rate Limit Dashboard** | Show cooldown timers per platform in the UI. Users should see when a platform is on cooldown. |
| **🔄 Proxy Support** | Pass `--proxy` to yt-dlp/gallery-dl. Essential for avoiding IP bans on Instagram/Twitter. |
| **📡 User-Agent Rotation** | Randomize user-agent strings per request to avoid fingerprint-based bans. |
| **💾 Persistent Session State** | Save `platformState` (session counts, cooldowns) to disk so restarting the server doesn't reset cooldowns. |
| **🔔 Desktop Notifications** | Notify when downloads complete or fail (use `node-notifier`). |
| **📱 Responsive / Mobile UI** | App is completely broken on mobile. Add responsive breakpoints. |

### Nice-to-Have (Polish)

| Feature | Why |
|---------|-----|
| **🌙 Dark Mode** | Design system supports it easily with CSS variables. |
| **🔗 Drag & Drop URL Input** | Drop links directly instead of requiring a `.txt` file. |
| **📎 Paste from Clipboard** | One-click paste button for bulk URLs. |
| **🖼️ Thumbnail Preview** | Use `fetchMediaInfo` to show video/image thumbnails before downloading. |
| **📈 Download Speed Graph** | Real-time speed visualization per active download. |
| **🔍 Search/Filter Queue** | Filter by platform, status, or search by URL. |
| **⬇️ Bulk URL Text Area** | Paste multiple URLs directly without creating a `.txt` file first. |

---

## 5. Reducing Ban Risk (IMPORTANT)

> [!CAUTION]
> **Right now your app has ZERO ban protection.** All rate limits are disabled. Running this against Instagram or Twitter will result in bans within minutes.

### 5.1 — Re-Enable & Tune Rate Limits

**Current (DANGEROUS):**
```js
const CONFIG = {
    youtube:   { delay: [1000, 2000],  limit: 9999, cooldown: [0, 0] },
    instagram: { delay: [1000, 2000],  limit: 9999, cooldown: [0, 0] },
    // ...
};
```

**Recommended (SAFE):**
```js
const CONFIG = {
    youtube:   { delay: [3000, 6000],    limit: 40,  cooldown: [300000, 420000] },   // 5-7 min cooldown
    pinterest: { delay: [5000, 12000],   limit: 20,  cooldown: [600000, 720000] },   // 10-12 min cooldown
    twitter:   { delay: [8000, 18000],   limit: 12,  cooldown: [900000, 1200000] },  // 15-20 min cooldown
    instagram: { delay: [15000, 35000],  limit: 8,   cooldown: [1200000, 1800000] }, // 20-30 min cooldown
};
```

### 5.2 — Randomize Request Timing

- **Jitter all delays** — Never use fixed intervals. Always use a random range.
- **Add "human variance"** — Occasionally insert a longer pause (2-3x normal) to simulate a real user.
- **Avoid round-number patterns** — Don't use `5000ms`. Use `4823ms`, `5391ms`, etc.

```js
function humanDelay(min, max) {
    const base = getRandomInt(min, max);
    // 10% chance of a "distraction pause" (3x longer)
    const multiplier = Math.random() < 0.1 ? 3 : 1;
    return base * multiplier;
}
```

### 5.3 — Proxy Rotation

Pass a proxy to yt-dlp/gallery-dl to avoid IP-based rate limiting:

```js
// Add to buildCommandArgs:
if (proxyUrl) {
    args.push('--proxy', proxyUrl);
}
```

Support a `proxies.txt` file with one proxy per line, rotate through them.

### 5.4 — User-Agent Randomization

```js
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
    // ... 20+ agents
];

// Add to buildCommandArgs:
args.push('--user-agent', USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
```

### 5.5 — Cookie & Session Management

- **Use cookies files instead of Chrome profile** — More portable and less detectable.
- **Rotate cookies** — If you have multiple accounts, rotate which cookie file is used per session.
- **Don't share cookies across concurrent downloads** — Each concurrent download to the same platform should ideally use a different session.

```js
// Instead of --cookies-from-browser:
args.push('--cookies', path.join(COOKIES_DIR, `${platform}_cookies.txt`));
```

### 5.6 — Respect Platform Signals

Add detection for rate-limit responses and back off automatically:

```js
proc.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('429') || text.includes('rate limit') || text.includes('Please wait')) {
        // Emergency cooldown — double the normal cooldown
        platformState[item.platform].cooldownUntil = Date.now() + (CONFIG[item.platform].cooldown[1] * 2);
        proc.kill('SIGTERM');
    }
});
```

### 5.7 — Per-Platform Concurrency Limits

Even with global concurrency of 3, **never run more than 1 simultaneous download per platform**:

```js
// In scheduler's candidate selection:
const activePlatforms = new Set(
    queue.filter(i => i.status === 'active').map(i => i.platform)
);

const candidates = queue.filter(item =>
    item.status === 'pending' &&
    !activePlatforms.has(item.platform) && // <-- NEW: one at a time per platform
    platformState[item.platform].cooldownUntil < now
).slice(0, slots);
```

### 5.8 — Summary of Anti-Ban Priority

| Priority | Action | Risk Reduction |
|----------|--------|---------------|
| 🔴 **Immediate** | Re-enable rate limits | Prevents instant bans |
| 🔴 **Immediate** | Add delay jitter with human variance | Makes traffic look organic |
| 🟠 **Soon** | Add per-platform concurrency cap (max 1 per platform) | Prevents parallel request fingerprinting |
| 🟠 **Soon** | Detect 429/rate-limit errors and auto-backoff | Prevents escalation from warning → ban |
| 🟡 **Next** | Add proxy rotation support | Prevents IP-based bans |
| 🟡 **Next** | Add user-agent rotation | Prevents browser fingerprint detection |
| 🟢 **Later** | Cookie file rotation for multi-account | Distributes load across sessions |

---

> [!IMPORTANT]
> The two most impactful changes you can make **right now** are:
> 1. **Re-enable the commented-out CONFIG** in `engineState.js`
> 2. **Fix the `activeProcesses` Map declaration** in `executor.js` (without this, nothing works at all)

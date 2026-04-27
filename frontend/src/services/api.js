const BASE_URL = 'http://localhost:3000';

export const api = {
    async fetchQueue() {
        const res = await fetch(`${BASE_URL}/queue`);
        return res.json(); // Returns { items, concurrency }
    },
    async uploadUrls(urls) {
        const res = await fetch(`${BASE_URL}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });
        return res.json();
    },
    async fetchMetadata() {
        const res = await fetch(`${BASE_URL}/metadata`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Metadata fetch failed');
        }
        return res.json();
    },
    // action: 'pause' | 'resume'
    async control(action) {
        const res = await fetch(`${BASE_URL}/control/${action}`, { method: 'POST' });
        return res.json();
    },
    // Cancels a specific item by ID, or all active downloads if no ID given
    async cancelItem(id) {
        const res = await fetch(`${BASE_URL}/control/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(id ? { id } : {})
        });
        return res.json();
    },
    // Sets max concurrent downloads (1–8)
    async setConcurrency(value) {
        const res = await fetch(`${BASE_URL}/control/concurrency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        return res.json();
    },
    async clearCompleted() {
        const res = await fetch(`${BASE_URL}/control/clear`, { method: 'POST' });
        return res.json();
    },
    async retryItem(id) {
        const res = await fetch(`${BASE_URL}/control/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(id ? { id } : {})
        });
        return res.json();
    },
    createEventSource() {
        return new EventSource(`${BASE_URL}/stream`);
    }
};
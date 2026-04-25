const BASE_URL = 'http://localhost:3000';

export const api = {
    async fetchQueue() {
        const res = await fetch(`${BASE_URL}/queue`);
        return res.json();
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
    async control(action) { // action must be: 'pause', 'resume', or 'cancel'
        const res = await fetch(`${BASE_URL}/control/${action}`, { 
            method: 'POST' 
        });
        return res.json();
    },
    createEventSource() {
        return new EventSource(`${BASE_URL}/stream`);
    }
};
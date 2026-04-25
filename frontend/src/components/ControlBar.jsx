import React, { useRef, useState } from 'react';
import { api } from '../services/api';
import { useMagnetic } from '../hooks/useMagnetic';

function ControlBar({ concurrency, onConcurrencyChange }) {
    const fileInputRef = useRef(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const magnetic = useMagnetic(0.2);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setStatusMessage('Reading file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const urls = text.split('\n').map(line => line.replace('\r', '').trim()).filter(Boolean);

                if (urls.length === 0) {
                    setStatusMessage('File is empty or contains no valid lines.');
                    setIsProcessing(false);
                    return;
                }

                setStatusMessage(`Uploading ${urls.length} URLs...`);
                const response = await api.uploadUrls(urls);
                setStatusMessage(response.message || 'Upload complete.');
            } catch (error) {
                setStatusMessage(`Upload failed: ${error.message}`);
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => setStatusMessage(''), 3000);
            }
        };

        reader.onerror = () => {
            setStatusMessage('Failed to read the local file.');
            setIsProcessing(false);
        };

        reader.readAsText(file);
    };

    const handleConcurrencyChange = async (delta) => {
        const next = Math.max(1, Math.min(8, concurrency + delta));
        if (next === concurrency) return;
        try {
            const { concurrency: confirmed } = await api.setConcurrency(next);
            onConcurrencyChange(confirmed);
        } catch (err) {
            console.error('Failed to set concurrency:', err);
        }
    };

    return (
        <div className="control-bar">
            <div className="upload-section">
                <input
                    type="file"
                    accept=".txt"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    id="file-upload"
                    className="file-input"
                />
                <label
                    htmlFor="file-upload"
                    className="btn-upload"
                    {...magnetic}
                >
                    <span>
                        <span className="btn-dot" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                        {isProcessing ? 'Processing...' : 'Upload .txt File'}
                    </span>
                </label>
                {statusMessage && <span className="status-message">{statusMessage}</span>}
            </div>

            <div className="concurrency-control">
                <span className="concurrency-label">Concurrent</span>
                <button
                    className="concurrency-btn"
                    onClick={() => handleConcurrencyChange(-1)}
                    disabled={concurrency <= 1}
                    aria-label="Decrease concurrency"
                >−</button>
                <span className="concurrency-value">{concurrency}</span>
                <button
                    className="concurrency-btn"
                    onClick={() => handleConcurrencyChange(1)}
                    disabled={concurrency >= 8}
                    aria-label="Increase concurrency"
                >+</button>
            </div>
        </div>
    );
}

export default ControlBar;
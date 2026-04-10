import React, { useRef, useState } from 'react';
import { api } from '../services/api';

function ControlBar() {
    const fileInputRef = useRef(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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

    const handleMagneticMove = (e) => {
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    };

    const handleMagneticLeave = (e) => {
        e.currentTarget.style.transform = 'translate(0, 0)';
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
                    onMouseMove={handleMagneticMove}
                    onMouseLeave={handleMagneticLeave}
                >
                    <span>
                        <span className="btn-dot" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                        {isProcessing ? 'Processing...' : 'Upload .txt File'}
                    </span>
                </label>
                {statusMessage && <span className="status-message">{statusMessage}</span>}
            </div>
        </div>
    );
}

export default ControlBar;
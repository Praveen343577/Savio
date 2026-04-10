import React, { useRef, useState } from 'react';
import { api } from '../services/api';

function ControlBar() {
    const fileInputRef = useRef(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    /**
     * Reads the selected .txt file, extracts lines as an array, 
     * and transmits them to the Node.js backend.
     */
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setStatusMessage('Reading file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                // Split by newline, remove carriage returns, and filter out empty lines
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
                // Reset input so the same file can be uploaded again if needed
                if (fileInputRef.current) fileInputRef.current.value = '';
                
                // Clear success message after 3 seconds
                setTimeout(() => setStatusMessage(''), 3000);
            }
        };

        reader.onerror = () => {
            setStatusMessage('Failed to read the local file.');
            setIsProcessing(false);
        };

        reader.readAsText(file);
    };

    /**
     * Transmits global execution commands to the backend engine.
     */
    const handleCommand = async (action) => {
        try {
            const response = await api.control(action);
            setStatusMessage(response.status);
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (error) {
            setStatusMessage(`Command ${action} failed: ${error.message}`);
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
                <label htmlFor="file-upload" className="btn btn-primary">
                    {isProcessing ? 'Processing...' : 'Upload .txt File'}
                </label>
                {statusMessage && <span className="status-message">{statusMessage}</span>}
            </div>

            {/* <div className="global-controls">
                <button 
                    className="btn btn-warning" 
                    onClick={() => handleCommand('pause')}
                >
                    Pause Engine
                </button>
                <button 
                    className="btn btn-success" 
                    onClick={() => handleCommand('resume')}
                >
                    Resume Engine
                </button>
                <button 
                    className="btn btn-danger" 
                    onClick={() => handleCommand('cancel')}
                >
                    Cancel Active
                </button>
            </div> */}
        </div>
    );
}

export default ControlBar;
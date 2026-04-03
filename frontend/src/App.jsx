import { useState, useEffect } from 'react';
import { api } from './services/api';
import ControlBar from './components/ControlBar';
import Grid from './components/Grid';
import Gallery from './components/Gallery';

function App() {
  const [queue, setQueue] = useState([]);
  const [view, setView] = useState('grid'); // Enum: 'grid' | 'gallery'

  useEffect(() => {
    // Initial static fetch on mount
    api.fetchQueue().then(setQueue).catch(console.error);

    // Open SSE connection for real-time memory sync
    const eventSource = api.createEventSource();

    eventSource.onmessage = (event) => {
      const updatedQueue = JSON.parse(event.data);
      setQueue(updatedQueue);
    };

    eventSource.onerror = (err) => {
      console.error('SSE Stream Error:', err);
    };

    // Cleanup stream on component unmount
    return () => eventSource.close();
  }, []);

  // Lock condition: Gallery is disabled if any item is not completed/failed
  const isProcessing = queue.some(item =>
    ['pending', 'active', 'paused'].includes(item.status)
  );

  return (
    <div className="app-container">
      <header className="global-header">
        <h1>YIPT Downloader</h1>
        <nav className="view-toggles">
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
          >
            Queue
          </button>
          <button
            className={view === 'gallery' ? 'active' : ''}
            onClick={() => setView('gallery')}
            disabled={isProcessing}
            title={isProcessing ? "Locked: Downloads in progress" : "View Extracted Metadata"}
          >
            Gallery
          </button>
        </nav>
      </header>

      <main className="main-content">
        {view === 'grid' ? (
          <>
            <ControlBar />
            <Grid queue={queue} />
          </>
        ) : (
          <Gallery />
        )}
      </main>
    </div>
  );
}

export default App;
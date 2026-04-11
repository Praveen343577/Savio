import { useState, useEffect } from 'react';
import { api } from './services/api';
import ControlBar from './components/ControlBar';
import Grid from './components/Grid';
import Gallery from './components/Gallery';
import CustomCursor from './components/CustomCursor';
import Loader from './components/Loader';

function App() {
  const [queue, setQueue] = useState([]);
  const [view, setView] = useState('grid');

  useEffect(() => {
    api.fetchQueue().then(setQueue).catch(console.error);

    const eventSource = api.createEventSource();

    eventSource.onmessage = (event) => {
      const updatedQueue = JSON.parse(event.data);
      setQueue(updatedQueue);
    };

    eventSource.onerror = (err) => {
      console.error('SSE Stream Error:', err);
    };

    return () => eventSource.close();
  }, []);

  const isProcessing = queue.some(item =>
    ['pending', 'active', 'paused'].includes(item.status)
  );

  return (
    <div className="app-wrapper">
      {/* Target UI overlays */}
      <div className="grain"></div>
      <CustomCursor />

      <nav className="navbar">
        <div className="navbar-brand">
          savio<span>*</span>
        </div>
        
        <div className="navbar-tabs">
          <button
            className={`tab-btn ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
          >
            Queue
          </button>
          <button
            className={`tab-btn ${view === 'gallery' ? 'active' : ''}`}
            onClick={() => setView('gallery')}
            disabled={isProcessing}
            title={isProcessing ? "Locked: Downloads in progress" : "View Extracted Metadata"}
          >
            Gallery
          </button>
        </div>
      </nav>

      <main className="page-content">
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
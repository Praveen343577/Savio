import { useState, useEffect } from 'react';
import { api } from './services/api';
import ControlBar from './components/ControlBar';
import Grid from './components/Grid';
import Gallery from './components/Gallery';
import CustomCursor from './components/CustomCursor';
import ThemeToggle from './components/ThemeToggle';

function App() {
  const [queue, setQueue] = useState([]);
  const [concurrency, setConcurrency] = useState(1);
  const [view, setView] = useState('grid');

  useEffect(() => {
    api.fetchQueue()
      .then(({ items, concurrency: c }) => {
        setQueue(items);
        setConcurrency(c);
      })
      .catch(console.error);

    const eventSource = api.createEventSource();

    eventSource.onmessage = (event) => {
      const { items, concurrency: c } = JSON.parse(event.data);
      setQueue(items);
      setConcurrency(c);
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
            title={isProcessing ? 'Locked: Downloads in progress' : 'View Extracted Metadata'}
          >
            Gallery
          </button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="page-content">
        {view === 'grid' ? (
          <>
            <ControlBar concurrency={concurrency} onConcurrencyChange={setConcurrency} />
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
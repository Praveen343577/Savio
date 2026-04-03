import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

function Gallery() {
    const [metadata, setMetadata] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const data = await api.fetchMetadata();
                setMetadata(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadMetadata();
    }, []);

    /**
     * Normalizes the disparate JSON schemas from yt-dlp and gallery-dl
     * into a unified object for the UI card.
     */
    const normalizeData = (raw) => {
        // yt-dlp uses 'extractor', gallery-dl uses 'category'
        const platform = (raw.extractor || raw.category || 'Unknown').toLowerCase();

        // Base structure
        let clean = {
            id: raw.id || raw.tweet_id || Math.random().toString(),
            platform: platform,
            title: 'Untitled',
            author: raw.uploader || raw.username || raw.author?.name || raw.author || 'Unknown',
            thumbnail: raw.thumbnail || null, // Relies on remote URL inside JSON
            stats: []
        };

        switch (true) {
            case platform.includes('youtube'):
                clean.title = raw.title;
                if (raw.view_count) clean.stats.push(`👁 ${formatNumber(raw.view_count)}`);
                if (raw.like_count) clean.stats.push(`👍 ${formatNumber(raw.like_count)}`);
                if (raw.duration) clean.stats.push(`⏱ ${formatDuration(raw.duration)}`);
                break;
            case platform.includes('instagram'):
                clean.title = raw.caption || raw.title || 'Instagram Post';
                if (raw.likes) clean.stats.push(`❤️ ${formatNumber(raw.likes)}`);
                if (raw.comments) clean.stats.push(`💬 ${formatNumber(raw.comments)}`);
                break;
            case platform.includes('twitter'):
                clean.title = raw.content || 'Tweet';
                if (raw.favorite_count) clean.stats.push(`❤️ ${formatNumber(raw.favorite_count)}`);
                if (raw.retweet_count) clean.stats.push(`🔁 ${formatNumber(raw.retweet_count)}`);
                break;
            case platform.includes('pinterest'):
                clean.title = raw.title || raw.description || 'Pin';
                if (raw.repin_count) clean.stats.push(`📌 ${formatNumber(raw.repin_count)}`);
                break;
            default:
                clean.title = raw.title || raw.content || 'Media Item';
        }

        // Truncate overly long titles/captions
        if (clean.title.length > 100) {
            clean.title = clean.title.substring(0, 97) + '...';
        }

        return clean;
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) return <div className="gallery-message">Compiling metadata...</div>;
    if (error) return <div className="gallery-message error">{error}</div>;
    if (metadata.length === 0) return <div className="gallery-message">No metadata found on disk.</div>;

    return (
        <div className="gallery-grid">
            {metadata.map((rawItem, index) => {
                const item = normalizeData(rawItem);
                
                return (
                    <div key={item.id + index} className="gallery-card">
                        <div className="gallery-card-image">
                            {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.title} loading="lazy" />
                            ) : (
                                <div className="no-image">No Thumbnail</div>
                            )}
                            <span className={`badge platform-${item.platform}`}>
                                {item.platform}
                            </span>
                        </div>
                        <div className="gallery-card-content">
                            <h3 className="gallery-title" title={item.title}>{item.title}</h3>
                            <p className="gallery-author">👤 {item.author}</p>
                            <div className="gallery-stats">
                                {item.stats.map((stat, i) => (
                                    <span key={i} className="stat-pill">{stat}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default Gallery;
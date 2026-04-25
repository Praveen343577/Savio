import React, { memo } from 'react';
import Loader from './Loader';
import instagramIcon from '../assets/instagram.svg';
import pinterestIcon from '../assets/pinterest.svg';
import twitterIcon from '../assets/twitter.svg';
import youtubeIcon from '../assets/youtube.svg';
import youtubeMusicIcon from '../assets/youtube-music.svg';

const platformIcons = {
    instagram: instagramIcon,
    pinterest: pinterestIcon,
    twitter: twitterIcon,
    youtube: youtubeIcon,
    'youtube-music': youtubeMusicIcon
};

/** Converts raw bytes to a human-readable string. */
function formatBytes(bytes) {
    if (!bytes) return null;
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

/** Converts seconds to a compact MM:SS or HH:MM:SS string. */
function formatEta(seconds) {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const Card = memo(({ item }) => {
    const isActive = item.status === 'active';
    const isCompleted = item.status === 'completed';
    const iconSrc = platformIcons[item.platform] || youtubeIcon;
    const progress = isCompleted ? 100 : (item.progress || 0);

    const getTransform = (prog) => {
        if (prog < 10) return 'translateX(0)';
        if (prog > 90) return 'translateX(-100%)';
        return 'translateX(-50%)';
    };

    const fileSizeStr = formatBytes(item.filesize);
    const etaStr = formatEta(item.eta);
    const { mediaInfo } = item;

    // Build media info pills — only show fields that exist
    const infoPills = [];
    if (mediaInfo) {
        if (mediaInfo.resolution) infoPills.push(mediaInfo.resolution);
        if (mediaInfo.fps) infoPills.push(mediaInfo.fps);
        if (mediaInfo.ext) infoPills.push(mediaInfo.ext.toUpperCase());
        if (mediaInfo.vcodec) infoPills.push(mediaInfo.vcodec);
        if (mediaInfo.acodec) infoPills.push(mediaInfo.acodec);
    }

    return (
        <div className={`card state-${item.status}`}>
            <div className="url-container" title={item.url}>
                <img src={iconSrc} className="platform-icon" alt={item.platform} />
                <span className="url-text">{item.url}</span>
                {isActive && (
                    <div className="card-loader-container">
                        <Loader />
                    </div>
                )}
            </div>

            {/* Media info pills — shown once preflight completes */}
            {infoPills.length > 0 && (
                <div className="card-info-row">
                    {infoPills.map((pill, i) => (
                        <span key={i} className="card-info-pill">{pill}</span>
                    ))}
                </div>
            )}

            {/* Download stats row — size, speed, ETA */}
            {isActive && (fileSizeStr || item.speed || etaStr) && (
                <div className="card-stats-row">
                    {fileSizeStr && <span className="card-stat"><span className="card-stat-label">Size</span>{fileSizeStr}</span>}
                    {item.speed && <span className="card-stat"><span className="card-stat-label">Speed</span>{item.speed}</span>}
                    {etaStr && <span className="card-stat"><span className="card-stat-label">ETA</span>{etaStr}</span>}
                </div>
            )}

            {/* Completed size summary */}
            {isCompleted && fileSizeStr && (
                <div className="card-stats-row">
                    <span className="card-stat"><span className="card-stat-label">Size</span>{fileSizeStr}</span>
                </div>
            )}

            {(isActive || isCompleted) && (
                <div className="progress-container">
                    <div
                        className="progress-bar"
                        style={{ width: `${progress}%` }}
                    >
                        <span
                            className="progress-text"
                            style={{ transform: getTransform(progress) }}
                        >
                            {isCompleted ? 'Done' : `${Math.round(progress)}%`}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});

Card.displayName = 'Card';
export default Card;
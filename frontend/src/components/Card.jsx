import React, { memo } from 'react';
import Loader from './Loader';

const Card = memo(({ item }) => {
    // SVG Circular Progress Math
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (item.progress / 100) * circumference;

    const isActive = item.status === 'active';

    return (
        <div className={`card state-${item.status}`}>
            <div className="card-header">
                <span className={`badge platform-${item.platform}`}>
                    {item.platform}
                </span>
                <div className="badge-group">
                    {item.retry_count > 0 && item.status !== 'completed' && (
                        <span className="badge retry-badge">Retry {item.retry_count}/3</span>
                    )}
                    <span className={`badge status-${item.status}`}>
                        {item.status}
                    </span>
                </div>
            </div>

            <div className="card-body">
                <div className="url-container" title={item.url}>
                    {item.url}
                </div>
                {isActive && (
                    <div className="card-loader-container">
                        <Loader />
                    </div>
                )}
            </div>

            <div className="card-footer">
                <div className="progress-wrapper">
                    <svg className="progress-ring" width="60" height="60">
                        {/* Background track */}
                        <circle
                            className="progress-ring-bg"
                            strokeWidth="4"
                            fill="transparent"
                            r={radius}
                            cx="30"
                            cy="30"
                        />
                        {/* Active progress track */}
                        <circle
                            className="progress-ring-indicator"
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="transparent"
                            r={radius}
                            cx="30"
                            cy="30"
                        />
                    </svg>
                    <span className="progress-text">{Math.floor(item.progress)}%</span>
                </div>
            </div>
        </div>
    );
});

Card.displayName = 'Card';
export default Card;
import React, { memo } from 'react';

const Card = memo(({ item }) => {

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
                    <span className="url-text">{item.url}</span>
                </div>
            </div>
        </div>
    );
});

Card.displayName = 'Card';
export default Card;
import React, { memo } from 'react';
import Loader from './Loader';

const Card = memo(({ item }) => {

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
                    <span className="url-text">{item.url}</span>
                    {isActive && (
                        <div className="card-loader-container">
                            <Loader />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

Card.displayName = 'Card';
export default Card;
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
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
    const iconSrc = platformIcons[item.platform] || youtubeIcon;

    return (
        <div className={`card state-${item.status}`}>
            <div className="card-body">
                <div className="url-container" title={item.url}>
                    <img src={iconSrc} className="platform-icon" alt={item.platform} />
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
import React from 'react';
import Card from './Card';

function Grid({ queue }) {
    if (!queue || queue.length === 0) {
        return (
            <div className="empty-state">
                <h2>Queue is empty</h2>
                <p>Upload a .txt file containing URLs to begin.</p>
            </div>
        );
    }

    return (
        <div className="grid-container">
            {queue.map(item => (
                <Card key={item.id} item={item} />
            ))}
        </div>
    );
}

export default Grid;
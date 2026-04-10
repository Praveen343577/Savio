import React from 'react';
import Card from './Card';

function Grid({ queue }) {
    if (!queue || queue.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-asterisk">*</span>
                <h2>Queue is empty</h2>
                <p>Upload a .txt file containing URLs to begin.</p>
            </div>
        );
    }

    const gridKey = `grid-${queue.length}`;

    return (
        <div key={gridKey} className="grid-container stagger-children visible">
            {queue.map(item => (
                <Card key={item.id} item={item} />
            ))}
        </div>
    );
}

export default Grid;
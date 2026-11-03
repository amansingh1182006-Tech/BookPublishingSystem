import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('react-author-root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <div>
            <h3>Author Dynamic Pricing Dashboard Active</h3>
        </div>
    );
}
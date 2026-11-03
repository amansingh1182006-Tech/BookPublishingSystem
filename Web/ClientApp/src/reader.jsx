import React from 'react';
import ReactDOM from 'react-dom/client';
import { SecurePdfViewer } from './components/SecurePdfViewer';

const rootElement = document.getElementById('react-reader-root');
if (rootElement) {
    const chapterId = rootElement.getAttribute('data-chapter-id');
    const userEmail = rootElement.getAttribute('data-user-email');

    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <SecurePdfViewer chapterId={chapterId} userEmail={userEmail} />
        </React.StrictMode>
    );
}
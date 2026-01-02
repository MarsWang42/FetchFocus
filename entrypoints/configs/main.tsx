import React from 'react';
import ReactDOM from 'react-dom/client';
import ConfigsApp from './ConfigsApp';
import '@/assets/globals.css';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ConfigsApp />
    </React.StrictMode>,
);

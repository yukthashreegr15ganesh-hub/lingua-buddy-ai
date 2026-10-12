import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installFetchInterceptorForStaticHosting } from './services/localApiEngine';
import './index.css';

installFetchInterceptorForStaticHosting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

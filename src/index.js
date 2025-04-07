```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // グローバルCSSをインポート
import App from './App'; // Appコンポーネントをインポート

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

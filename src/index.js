import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // CSSファイルのインポート
import App from './App'; // Appコンポーネントのインポート

// public/index.html の <div id="root"></div> を取得
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} else {
    console.error('Root element not found'); // ルート要素が見つからない場合のエラー
}

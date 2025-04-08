import React from 'react';
import ReactDOM from 'react-dom/client'; // 'react-dom/client' をインポート
import './index.css'; // グローバルCSSをインポート
import App from './App'; // Appコンポーネントをインポート

// public/index.html 内の <div id="root"></div> を取得
const rootElement = document.getElementById('root');

if (rootElement) {
  // ルートを作成
  const root = ReactDOM.createRoot(rootElement);
  // アプリケーションをレンダリング
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // ルート要素が見つからない場合のエラー処理 (念のため)
  console.error('Failed to find the root element');
}

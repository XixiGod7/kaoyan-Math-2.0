import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { HomePage } from './pages/Home';
import { BankPage } from './pages/Bank';
import { PracticePage } from './pages/Practice';
import { PaperPage } from './pages/Paper';
import { ReviewPage } from './pages/Review';
import { WishPoolPage } from './pages/WishPool';

export const App: React.FC = () => {
  return (
    <div className="app pb-app">
      <TopBar />
      <div className="source-notice">导入题库含生成与整理内容，答案供练习参考；年份标签不代表已核验的官方真题。</div>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/politics" replace />} />
          <Route path="/politics" element={<HomePage />} />
          <Route path="/politics/bank/:code" element={<BankPage />} />
          <Route path="/politics/practice/:code" element={<PracticePage />} />
          <Route path="/politics/paper/:code" element={<PaperPage />} />
          <Route path="/politics/review" element={<ReviewPage />} />
          <Route path="/politics/wrong" element={<ReviewPage />} />
          <Route path="/politics/favorites" element={<ReviewPage />} />
          <Route path="/politics/wishpool" element={<WishPoolPage />} />
          <Route path="/politics/wishpool/:id" element={<WishPoolPage />} />
          <Route path="/politics/my-feedback" element={<WishPoolPage />} />
          <Route path="*" element={<Navigate to="/politics" replace />} />
        </Routes>
      </main>

      <footer className="eb-footer">
        <span>研砖 · 每一次认真练习，都算数</span>
      </footer>
    </div>
  );
};

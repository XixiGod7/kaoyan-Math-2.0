import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { LoadBoundary } from './components/LoadBoundary';
const HomePage=React.lazy(()=>import('./pages/Home').then(m=>({default:m.HomePage})));
const BankPage=React.lazy(()=>import('./pages/Bank').then(m=>({default:m.BankPage})));
const PracticePage=React.lazy(()=>import('./pages/Practice').then(m=>({default:m.PracticePage})));
const PaperPage=React.lazy(()=>import('./pages/Paper').then(m=>({default:m.PaperPage})));
const ReviewPage=React.lazy(()=>import('./pages/Review').then(m=>({default:m.ReviewPage})));
const WishPoolPage=React.lazy(()=>import('./pages/WishPool').then(m=>({default:m.WishPoolPage})));

export const App: React.FC = () => {
  return (
    <div className="app pb-app">
      <TopBar />

      <main>
        <LoadBoundary><React.Suspense fallback={<p className="platform-empty">正在载入…</p>}><Routes>
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
        </Routes></React.Suspense></LoadBoundary>
      </main>
    </div>
  );
};

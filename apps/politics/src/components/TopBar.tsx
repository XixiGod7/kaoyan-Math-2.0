import React from 'react';
import { NavLink } from 'react-router-dom';
export const TopBar: React.FC = () => <div className="subject-context">
  <span>政治练习</span><nav aria-label="政治导航">
    <NavLink end to="/politics">题册总览</NavLink><NavLink to="/politics/review">今日复习</NavLink>
    <NavLink to="/politics/wrong">错题本</NavLink><NavLink to="/politics/favorites">收藏</NavLink>
    <a href="/library">我的笔记</a><NavLink to="/politics/wishpool">反馈记录</NavLink>
  </nav>
</div>;

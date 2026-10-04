import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation,useNavigate } from 'react-router-dom';
import {
  getDueReviewsApi,
  getFavoriteIdsApi,
  getFavoritesApi,
  getWrongQuestionsApi,
  gradeReviewApi,
  S
} from '../services/politicsApi';
import { QuestionCard } from '../components/QuestionCard';
import type { Question } from '../types/politics';

type TabType = 'review' | 'wrong' | 'fav';

export const ReviewPage: React.FC = () => {
  const location = useLocation();
  const navigate=useNavigate();

  const activeTab: TabType = location.pathname.endsWith('/wrong')
    ? 'wrong'
    : location.pathname.endsWith('/favorites')
    ? 'fav'
    : 'review';

  const [currentTab, updateTab] = useState<TabType>(activeTab);
  const setCurrentTab=(tab:TabType)=>{updateTab(tab);navigate('/politics/'+({review:'review',wrong:'wrong',fav:'favorites'})[tab]);};

  useEffect(() => {
    updateTab(activeTab);
  }, [activeTab]);

  return (
    <div className="pb-page">
      {/* 面包屑 */}
      <div className="pb-crumb">
        <Link to="/politics">政治</Link> / 复习
      </div>

      {/* 选项卡 */}
      <div className="pb-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'review'}
          className={`pb-tab${currentTab === 'review' ? ' active' : ''}`}
          onClick={() => setCurrentTab('review')}
        >
          今日复习
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'wrong'}
          className={`pb-tab${currentTab === 'wrong' ? ' active' : ''}`}
          onClick={() => setCurrentTab('wrong')}
        >
          错题本
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'fav'}
          className={`pb-tab${currentTab === 'fav' ? ' active' : ''}`}
          onClick={() => setCurrentTab('fav')}
        >
          收藏
        </button>
      </div>

      {currentTab === 'review' && <DueReviewTab />}
      {currentTab === 'wrong' && <WrongBookTab />}
      {currentTab === 'fav' && <FavoritesTab />}
    </div>
  );
};

// 1. 今日复习 Tab（艾宾浩斯间隔记忆）
const DueReviewTab: React.FC = () => {
  const [items, setItems] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grading, setGrading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDue = useCallback(() => {
    setLoading(true);
    setError('');
    getDueReviewsApi(20).then(res => {
      setItems(res.items);
      setTotalCount(res.total);
      const remembered=(window as any).studyPosition?.get('politics:due')?.question;
      const position=res.items.findIndex(q=>String(q.id)===remembered);setCurrentIndex(position<0?0:position);
      setGrading(false);
      setLoading(false);
    }).catch(e => { setError(e.message || '复习加载失败'); setLoading(false); });
  }, []);

  useEffect(() => {
    fetchDue();
  }, [fetchDue]);
  useEffect(()=>{if(items[currentIndex])(window as any).studyPosition?.set('politics:due',{question:String(items[currentIndex].id)});},[items,currentIndex]);

  async function handleGrade(grade: 0 | 1 | 2) {
    const cur = items[currentIndex];
    if (!cur) return;
    setGrading(true);
    const res = await gradeReviewApi(cur.id, grade);
    if (!res.ok) { setGrading(false); alert(res.message || '复习记录保存失败'); return; }
    if (currentIndex + 1 < items.length) {
      setCurrentIndex(prev => prev + 1);
      setGrading(false);
    } else {
      fetchDue();
    }
  }

  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={fetchDue}>重新加载</button></div>;
  if (loading) {
    return <div className="pb-loading">加载中…</div>;
  }

  if (!items.length) {
    return (
      <div className="pb-empty">
        今天没有要复习的题。答错的题会在隔天回到这里，之后按记忆曲线拉开间隔。
      </div>
    );
  }

  const currentQ = items[currentIndex];

  return (
    <>
      <div className="pb-block-sub">
        待复习 {totalCount} 题，本轮 {currentIndex + 1} / {items.length}
      </div>

      {currentQ && (
        <QuestionCard
          key={currentQ.id}
          q={currentQ}
          defaultRevealed={true}
          initial={{
            ok: true,
            correct: false,
            answer: currentQ.answer,
            myChoice: currentQ.myChoice,
            analysis: currentQ.analysis
          }}
        />
      )}

      {/* 记忆程度自评按钮 */}
      <div className="pb-grade">
        <span>还记得吗？</span>
        <button
          type="button"
          className="pb-g0"
          disabled={grading}
          onClick={() => handleGrade(0)}
        >
          记得
        </button>
        <button
          type="button"
          className="pb-g1"
          disabled={grading}
          onClick={() => handleGrade(1)}
        >
          模糊
        </button>
        <button
          type="button"
          className="pb-g2"
          disabled={grading}
          onClick={() => handleGrade(2)}
        >
          忘了
        </button>
      </div>
    </>
  );
};

// 2. 错题本 Tab
const WrongBookTab: React.FC = () => {
  const [subjectFilter, setSubjectFilter] = useState(()=>(window as any).studyPosition?.get('politics:wrong')?.subject||'');
  const [page, setPage] = useState(()=>(window as any).studyPosition?.get('politics:wrong')?.page||0);
  useEffect(()=>{(window as any).studyPosition?.set('politics:wrong',{page,subject:subjectFilter});},[page,subjectFilter]);
  const [data, setData] = useState<{ total: number; items: Question[] }>({ total: 0, items: [] });
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([getWrongQuestionsApi(page, subjectFilter), getFavoriteIdsApi()]).then(
      ([res, favIds]) => {
        if (active) {
          setData({ total: res.total, items: res.items });
          setFavSet(new Set(favIds.map(String)));
          setLoading(false);
        }
      }
    ).catch(e => { if (active) { setError(e.message || '错题加载失败'); setLoading(false); } });

    return () => {
      active = false;
    };
  }, [page, subjectFilter]);

  const totalPages = Math.ceil(data.total / 20);
  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></div>;

  return (
    <>
      {/* 学科筛选器 */}
      <div className="pb-filter">
        <button
          type="button"
          className={subjectFilter === '' ? 'active' : ''}
          onClick={() => {
            setSubjectFilter('');
            setPage(0);
          }}
        >
          全部 {data.total ? `(${data.total})` : ''}
        </button>
        {S.map(subj => (
          <button
            key={subj}
            type="button"
            className={subjectFilter === subj ? 'active' : ''}
            onClick={() => {
              setSubjectFilter(subj);
              setPage(0);
            }}
          >
            {subj}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="pb-loading">加载中…</div>
      ) : data.items.length ? (
        data.items.map(q => (
          <QuestionCard
            key={q.id}
            q={q}
            favored={favSet.has(String(q.id))}
            defaultRevealed={true}
            initial={{
              ok: true,
              correct: false,
              answer: q.answer,
              myChoice: q.myChoice,
              analysis: q.analysis
            }}
            onFavor={(qid, on) => {
              setFavSet(prev => {
                const next = new Set(prev);
                if (on) next.add(String(qid));
                else next.delete(String(qid));
                return next;
              });
            }}
          />
        ))
      ) : (
        <div className="pb-empty">还没有错题</div>
      )}

      <Pager page={page} pages={totalPages} onGo={setPage} />
    </>
  );
};

// 3. 收藏 Tab
const FavoritesTab: React.FC = () => {
  const [page, setPage] = useState(()=>(window as any).studyPosition?.get('politics:favorites')?.page||0);
  useEffect(()=>{(window as any).studyPosition?.set('politics:favorites',{page});},[page]);
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getFavoritesApi(page).then(res => {
      if (active) {
        setItems(res.items);
        setLoading(false);
      }
    }).catch(e => { if (active) { setError(e.message || '收藏加载失败'); setLoading(false); } });
    return () => {
      active = false;
    };
  }, [page]);

  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></div>;
  if (loading) {
    return <div className="pb-loading">加载中…</div>;
  }

  if (!items.length) {
    return <div className="pb-empty">还没有收藏的题</div>;
  }

  return (
    <>
      {items.map(q => (
        <QuestionCard
          key={q.id}
          q={q}
          favored={true}
          defaultRevealed={true}
          initial={{
            ok: true,
            correct: q.myChoice === q.answer,
            answer: q.answer,
            myChoice: q.myChoice,
            analysis: q.analysis
          }}
          onFavor={() => {
            setItems(prev => prev.filter(item => item.id !== q.id));
          }}
        />
      ))}
      <Pager page={page} pages={items.length < 20 ? page + 1 : page + 2} onGo={setPage} />
    </>
  );
};

// 分页组件
const Pager: React.FC<{ page: number; pages: number; onGo: (p: number) => void }> = ({
  page,
  pages,
  onGo
}) => {
  if (pages <= 1) return null;

  return (
    <div className="pb-pager">
      <button type="button" disabled={page === 0} onClick={() => onGo(page - 1)}>
        上一页
      </button>
      <span>
        {page + 1} / {pages}
      </span>
      <button type="button" disabled={page >= pages - 1} onClick={() => onGo(page + 1)}>
        下一页
      </button>
    </div>
  );
};

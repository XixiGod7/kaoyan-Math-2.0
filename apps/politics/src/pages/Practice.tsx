import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getChapterAnswersApi, getChapterApi, getFavoriteIdsApi } from '../services/politicsApi';
import { QuestionCard } from '../components/QuestionCard';
import type { Chapter } from '../types/politics';

export const PracticePage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredMap, setAnsweredMap] = useState<Record<string, any>>({});
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCurrentIndex(0);

    Promise.all([getChapterApi(code), getChapterAnswersApi(code), getFavoriteIdsApi()]).then(
      ([chapRes, answersRes, favIdsRes]) => {
        if (!active) return;
        setChapter(chapRes);

        const map: Record<string, any> = {};
        for (const ans of answersRes ?? []) {
          map[String(ans.id)] = { ...ans, ok: true };
        }
        setAnsweredMap(map);
        setFavSet(new Set(favIdsRes.map(String)));
        setLoading(false);

        // 默认定位到第一个未作答的题目
        if (chapRes && chapRes.questions.length > 0) {
          const firstUnanswered = chapRes.questions.findIndex(q => !map[String(q.id)]);
          setCurrentIndex(firstUnanswered < 0 ? 0 : firstUnanswered);
        }
      }
    ).catch(e => { if (active) { setError(e.message || '章节加载失败'); setLoading(false); } });

    return () => {
      active = false;
    };
  }, [code]);

  const questions = chapter?.questions ?? [];
  const currentQ = questions[currentIndex];

  const doneCount = useMemo(
    () => questions.filter(q => answeredMap[String(q.id)]).length,
    [questions, answeredMap]
  );

  const correctCount = useMemo(
    () => questions.filter(q => answeredMap[String(q.id)]?.correct).length,
    [questions, answeredMap]
  );

  function goToQuestion(idx: number) {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentIndex(idx);
    pageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function handleRedo() {
    setAnsweredMap({});
    setCurrentIndex(0);
    pageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></div>;
  if (loading) {
    return (
      <div className="pb-page">
        <div className="pb-loading">加载中…</div>
      </div>
    );
  }

  if (!chapter || !questions.length) {
    return (
      <div className="pb-page">
        <div className="pb-empty">这一章还没有题目</div>
      </div>
    );
  }

  const accuracy = doneCount ? Math.round((correctCount / doneCount) * 100) : 0;
  const progressPercent = (doneCount / questions.length) * 100;

  return (
    <div className="pb-page pb-practice" ref={pageRef}>
      {/* 面包屑导航 */}
      <div className="pb-crumb">
        <Link to="/politics">政治</Link> /{' '}
        <Link to={`/politics/bank/${chapter.bankCode}`}>{chapter.bankName}</Link> / {chapter.name}
      </div>

      {/* 练习进度栏 */}
      <div className="pb-practice-bar">
        <div className="pb-progress-row">
          <div className="pb-progress-text">
            第 {currentIndex + 1} / {questions.length} 题 · 已做 {doneCount}
            {doneCount > 0 && <> · 本章正确 {accuracy}%</>}
          </div>
          {doneCount > 0 && (
            <button type="button" className="pb-redo-btn" onClick={handleRedo}>
              ↻ 重做本章
            </button>
          )}
        </div>
        <div className="pb-bar pb-bar-sm">
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* 当前题目卡片 */}
      {currentQ && (
        <QuestionCard
          q={currentQ}
          index={currentIndex}
          total={questions.length}
          chapterCode={code}
          favored={favSet.has(String(currentQ.id))}
          initial={answeredMap[String(currentQ.id)] ?? null}
          onFavor={(qid, on) => {
            setFavSet(prev => {
              const next = new Set(prev);
              if (on) next.add(String(qid));
              else next.delete(String(qid));
              return next;
            });
          }}
          onAnswered={(qid, res) => {
            setAnsweredMap(prev => ({ ...prev, [String(qid)]: res }));
          }}
        />
      )}

      {/* 上一题 / 下一题 */}
      <div className="pb-nav-btns">
        <button
          type="button"
          onClick={() => goToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          上一题
        </button>
        <button
          type="button"
          onClick={() => goToQuestion(currentIndex + 1)}
          disabled={currentIndex >= questions.length - 1}
        >
          下一题
        </button>
      </div>

      {/* 答题卡矩阵 */}
      <div className="pb-matrix">
        {questions.map((q, idx) => {
          const ans = answeredMap[String(q.id)];
          const classes = ['pb-cell'];
          if (idx === currentIndex) classes.push('cur');
          if (ans) {
            classes.push(ans.correct ? 'right' : 'wrong');
          }
          if (q.type === 'multi') classes.push('multi');

          return (
            <button
              key={q.id}
              type="button"
              className={classes.join(' ')}
              onClick={() => goToQuestion(idx)}
              title={q.type === 'multi' ? '多选' : '单选'}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

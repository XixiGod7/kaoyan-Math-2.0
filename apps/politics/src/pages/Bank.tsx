import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBankApi, S } from '../services/politicsApi';
import type { BankChapterSummary, BankDetail } from '../types/politics';

export const BankPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [bank, setBank] = useState<BankDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getBankApi(code).then(res => {
      if (active) {
        setBank(res);
        setLoading(false);
      }
    }).catch(e => { if (active) { setError(e.message || '题库加载失败'); setLoading(false); } });
    return () => {
      active = false;
    };
  }, [code]);

  // 按学科分组章节
  const groupedChapters = useMemo(() => {
    if (!bank) return [];
    const map = new Map<string, BankChapterSummary[]>();
    for (const ch of bank.chapters) {
      if (!map.has(ch.subject)) {
        map.set(ch.subject, []);
      }
      map.get(ch.subject)!.push(ch);
    }

    const sortOrder = [...S, '综合', '真题'];
    return [...map.entries()].sort(([subjA], [subjB]) => {
      const idxA = sortOrder.indexOf(subjA as any);
      const idxB = sortOrder.indexOf(subjB as any);
      return (idxA < 0 ? 99 : idxA) - (idxB < 0 ? 99 : idxB);
    });
  }, [bank]);

  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></div>;
  if (loading) {
    return (
      <div className="pb-page">
        <div className="pb-loading">加载中…</div>
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="pb-page">
        <div className="pb-empty">题库不存在或未发布</div>
      </div>
    );
  }

  const totalDone = bank.chapters.reduce((acc, c) => acc + c.done, 0);
  const totalPercent = bank.qCount ? Math.round((totalDone / bank.qCount) * 100) : 0;

  return (
    <div className="pb-page">
      <div className="pb-crumb">
        <Link to="/politics">政治</Link> / {bank.name}
      </div>

      <h1>{bank.name}</h1>
      <div className="pb-block-sub">
        {bank.qCount} 题 · 已完成 {totalPercent}%
      </div>

      {groupedChapters.map(([subjName, chapters]) => (
        <section key={subjName} className="pb-block">
          <h2>{subjName}</h2>
          <div className="pb-ch-list">
            {chapters.map(ch => {
              const chPercent = ch.qCount ? Math.round((ch.done / ch.qCount) * 100) : 0;
              const chAccuracy = ch.done ? Math.round((ch.correct / ch.done) * 100) : 0;

              return (
                <Link
                  key={ch.code}
                  className={`pb-ch${chPercent === 100 ? ' done' : ''}`}
                  to={`/politics/practice/${ch.code}`}
                >
                  <span className="pb-ch-name">{ch.name}</span>
                  <span className="pb-ch-meta">
                    {ch.done}/{ch.qCount}
                    {ch.done > 0 && (
                      <em className={chAccuracy >= 70 ? 'ok' : 'no'}>
                        {' '}
                        · 首答 {chAccuracy}%
                      </em>
                    )}
                  </span>
                  <span className="pb-bar pb-bar-sm">
                    <i style={{ width: `${chPercent}%` }} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

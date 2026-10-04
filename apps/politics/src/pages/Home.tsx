import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExamCountdown } from '../components/ExamCountdown';
import { getBanksApi, getStatsApi, S } from '../services/politicsApi';
import type { BankSummary, Stats } from '../types/politics';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const parsed = Date.parse(dateStr.replace(' ', 'T'));
  if (Number.isNaN(parsed)) return '';
  const mins = Math.floor((Date.now() - parsed) / 60000);
  if (mins < 2) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} 天前` : `${Math.floor(days / 30)} 个月前`;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  to?: string;
  highlight?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, to, highlight }) => {
  const content = (
    <>
      <b className={highlight ? 'hot' : undefined}>{value}</b>
      <span>{label}</span>
    </>
  );

  return to ? (
    <Link className="pb-kpi" to={to}>
      {content}
    </Link>
  ) : (
    <div className="pb-kpi">{content}</div>
  );
};

export const BankGrid: React.FC<{ banks: BankSummary[]; exam?: boolean }> = ({ banks, exam }) => {
  if (!banks.length) {
    return <div className="pb-empty">暂无内容</div>;
  }

  return (
    <div className="pb-bank-grid">
      {banks.map(bank => {
        const percent = bank.qCount ? Math.round((bank.done / bank.qCount) * 100) : 0;
        const correctRate = bank.done ? Math.round((bank.correct / bank.done) * 100) : 0;

        return (
          <Link
            key={bank.code}
            className="pb-bank"
            to={exam ? `/politics/paper/${bank.code}` : `/politics/bank/${bank.code}`}
          >
            <div className="pb-bank-name">{bank.name}</div>
            <div className="pb-bank-meta">
              {bank.qCount} 题
              {bank.done > 0 && <> · 已做 {bank.done}（{percent}%）</>}
              {bank.done > 0 && <> · 首答对 {correctRate}%</>}
            </div>
            {exam && bank.aveScore != null && (
              <div className="pb-bank-ave">全站均分 {bank.aveScore} / 50</div>
            )}
            <div className="pb-bar pb-bar-sm">
              <i style={{ width: `${percent}%` }} />
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookBanks, setBookBanks] = useState<BankSummary[]>([]);
  const [examBanks, setExamBanks] = useState<BankSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([getStatsApi(), getBanksApi('book'), getBanksApi('exam')]).then(
      ([statRes, booksRes, examsRes]) => {
        if (active) {
          setStats(statRes);
          setBookBanks(booksRes);
          setExamBanks(examsRes);
          setLoading(false);
        }
      }
    ).catch(e => { if (active) { setError(e.message || '题库加载失败'); setLoading(false); } });

    return () => {
      active = false;
    };
  }, []);

  // 最近做过的章节/真题
  const continueList = useMemo(() => {
    const combined = [...bookBanks, ...examBanks];
    return combined
      .filter(b => b.lastAt)
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
      .slice(0, 4);
  }, [bookBanks, examBanks]);

  const totalDone = stats?.total ?? 0;
  if (error) return <div className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></div>;
  const accuracy = totalDone ? Math.round(((stats?.correct ?? 0) / totalDone) * 100) : 0;

  return (
    <div className="pb-page">
      {/* 顶部标语与倒计时 */}
      <section className="pb-hero">
        <div className="pb-hero-main">
          <h1>考研政治</h1>
          <ExamCountdown />
          <p>
            单选 16×1 + 多选 17×2 = 选择题 50 分。多选错选、漏选均不得分，是全卷最大的分差来源。
          </p>
        </div>

        <div className="pb-kpis">
          <KpiCard label="已做" value={totalDone} />
          <KpiCard label="首答正确率" value={totalDone ? `${accuracy}%` : '—'} />
          <KpiCard label="错题" value={stats?.wrong ?? 0} to="/politics/wrong" />
          <KpiCard
            label="待复习"
            value={stats?.due ?? 0}
            to="/politics/review"
            highlight={(stats?.due ?? 0) > 0}
          />
        </div>
      </section>

      {/* 原版标题：五科正确率（只看首答） */}
      {(stats?.bySubject.length ?? 0) > 0 && (
        <section className="pb-block">
          <h2>各科正确率（只看首答）</h2>
          <div className="pb-subj-grid">
            {S.map(subjName => {
              const item = stats?.bySubject.find(s => s.subject === subjName);
              const done = item?.done ?? 0;
              const rate = done ? Math.round(((item?.correct ?? 0) / done) * 100) : 0;
              const multiDone = item?.multiDone ?? 0;
              const multiRate = multiDone
                ? Math.round(((item?.multiCorrect ?? 0) / multiDone) * 100)
                : 0;

              return (
                <div key={subjName} className="pb-subj">
                  <div className="pb-subj-name">{subjName}</div>
                  {done === 0 ? (
                    <div className="pb-subj-empty">还没做过</div>
                  ) : (
                    <>
                      <div className="pb-bar">
                        <i style={{ width: `${rate}%` }} />
                      </div>
                      <div className="pb-subj-meta">
                        {rate}%（{item?.correct}/{done}）
                      </div>
                      {multiDone > 0 && (
                        <div className="pb-subj-multi">
                          多选 {multiRate}%（{item?.multiCorrect}/{multiDone}）
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 继续刷 */}
      {!loading && continueList.length > 0 && (
        <section className="pb-block">
          <h2>继续刷</h2>
          <p className="pb-block-sub">接着上次的地方往下做。</p>
          <div className="pb-resume-list">
            {continueList.map(item => (
              <Link
                key={item.code}
                className="pb-resume"
                to={
                  item.resumeCode
                    ? `/politics/practice/${item.resumeCode}`
                    : item.kind === 'exam'
                    ? `/politics/paper/${item.code}`
                    : `/politics/bank/${item.code}`
                }
              >
                <div className="pb-resume-main">
                  <div className="pb-resume-name">{item.name}</div>
                  {item.resumeName && <div className="pb-resume-ch">{item.resumeName}</div>}
                </div>
                <div className="pb-resume-side">
                  <span className="pb-resume-when">{formatRelativeTime(item.lastAt)}</span>
                  <span className="pb-bank-meta">
                    {item.done}/{item.qCount}
                  </span>
                </div>
                <span className="pb-bar pb-bar-sm">
                  <i
                    style={{
                      width: `${item.qCount ? Math.round((item.done / item.qCount) * 100) : 0}%`
                    }}
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 章节带刷 */}
      <section className="pb-block">
        <h2>章节带刷</h2>
        <p className="pb-block-sub">按科目和章节推进，是强化期的主力动作。</p>
        {loading ? <div className="pb-loading">加载中…</div> : <BankGrid banks={bookBanks} />}
      </section>

      {/* 历年真题 */}
      <section className="pb-block">
        <h2>年份练习卷</h2>
        <p className="pb-block-sub">整卷计时练习，按题库参考答案判分。原资料中的年份未独立核验。</p>
        {loading ? (
          <div className="pb-loading">加载中…</div>
        ) : (
          <BankGrid banks={examBanks} exam={true} />
        )}
      </section>
    </div>
  );
};

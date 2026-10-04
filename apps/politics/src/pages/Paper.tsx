import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getBankApi,
  getChapterApi,
  getPaperHistoryApi,
  getPaperDraftApi,
  savePaperDraftApi,
  L,
  normalizeChoices,
  submitPaperApi
} from '../services/politicsApi';
import type { PaperHistoryItem, PaperSubmitResult, Question } from '../types/politics';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PaperPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [paperName, setPaperName] = useState('');
  const [aveScore, setAveScore] = useState<number | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userChoices, setUserChoices] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PaperSubmitResult | null>(null);
  const [history, setHistory] = useState<PaperHistoryItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const startTimeRef = useRef(Date.now());
  const choicesRef = useRef(userChoices);
  const submitKey = useRef(crypto.randomUUID());
  choicesRef.current = userChoices;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    setUserChoices({});
    setQuestions([]); setError(''); setDraftStatus('');
    setElapsedSeconds(0);
    submitKey.current = crypto.randomUUID();
    startTimeRef.current = Date.now();

    Promise.all([getBankApi(code), getPaperDraftApi(code), getPaperHistoryApi(code)]).then(async ([bank, draft, hist]) => {
      if (!active || !bank) {
        setLoading(false);
        return;
      }
      setPaperName(bank.name);
      setAveScore(bank.aveScore);
      const chapters = await Promise.all(bank.chapters.map(ch => getChapterApi(ch.code)));
      if (!active) return;
      setQuestions(chapters.flatMap(ch => ch?.questions || []));
      setHistory(hist);
      if (draft) {
        setUserChoices(Object.fromEntries(Object.entries(draft.choices).map(([id, choice]) => [id, new Set(normalizeChoices(choice))])));
        setElapsedSeconds(draft.elapsed);
        startTimeRef.current = Date.now() - draft.elapsed * 1000;
        setDraftStatus('已恢复云端草稿');
      }
      setLoading(false);
    }).catch(e => {
      if (active) { setError(e.message || '试卷加载失败'); setLoading(false); }
    });

    return () => {
      active = false;
    };
  }, [code]);

  // 计时器
  useEffect(() => {
    if (result || loading) return;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [result, loading]);

  useEffect(() => {
    if (loading || result || submitting) return;
    const timer = setTimeout(async () => {
      const choices = Object.fromEntries(Object.entries(choicesRef.current).map(([id, values]) => [id, normalizeChoices(values)]));
      const res = await savePaperDraftApi(code, choices, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setDraftStatus(res.ok ? '草稿已保存到云端' : '草稿保存失败，请稍后重试');
    }, 700);
    return () => clearTimeout(timer);
  }, [code, userChoices, loading, result, submitting]);

  useEffect(() => {
    if (loading || result || submitting) return;
    const timer = setInterval(async () => {
      const choices = Object.fromEntries(Object.entries(choicesRef.current).map(([id, values]) => [id, normalizeChoices(values)]));
      const res = await savePaperDraftApi(code, choices, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setDraftStatus(res.ok ? '草稿已保存到云端' : '草稿保存失败，请稍后重试');
    }, 30000);
    return () => clearInterval(timer);
  }, [code, loading, result, submitting]);

  const answeredCount = useMemo(() => {
    return questions.filter(q => (userChoices[String(q.id)]?.size ?? 0) > 0).length;
  }, [questions, userChoices]);

  // 选项点击
  function handleSelect(q: Question, opt: string) {
    if (result) return;
    const qid = String(q.id);
    setUserChoices(prev => {
      const current = new Set(prev[qid] ?? []);
      if (q.type === 'single') {
        return {
          ...prev,
          [qid]: current.has(opt) ? new Set<string>() : new Set<string>([opt])
        };
      } else {
        if (current.has(opt)) {
          current.delete(opt);
        } else {
          current.add(opt);
        }
        return {
          ...prev,
          [qid]: current
        };
      }
    });
  }

  // 交卷
  async function handleSubmit() {
    if (submitting || result) return;

    if (!result && answeredCount < questions.length) {
      if (!window.confirm(`还有 ${questions.length - answeredCount} 道题未作答，确定现在交卷吗？`)) {
        return;
      }
    }

    setSubmitting(true);
    const submissions = questions.map(q => ({
      id: q.id,
      choice: normalizeChoices(userChoices[String(q.id)] ?? [])
    }));

    const res = await submitPaperApi(code, submissions, elapsedSeconds, submitKey.current);
    setSubmitting(false);

    if (res.ok === false) {
      alert(res.message || '交卷失败');
      return;
    }

    setResult(res);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    getPaperHistoryApi(code).then(setHistory).catch(() => {});
  }

  if (error) return <div className="pb-page"><p className="pb-empty" role="alert">{error} · <button onClick={() => window.location.reload()}>重新加载</button></p></div>;
  if (loading) {
    return (
      <div className="pb-page">
        <div className="pb-loading">加载中…</div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="pb-page">
        <div className="pb-empty">这套卷子暂无题目</div>
      </div>
    );
  }

  const detailMap = new Map((result?.detail ?? []).map(d => [String(d.id), d]));

  return (
    <div className="pb-page pb-paper">
      {/* 面包屑 */}
      <div className="pb-crumb">
        <Link to="/politics">政治</Link> / {paperName}
      </div>

      <h1>{paperName}</h1>
      {!result && <p className="pb-block-sub" role="status">{draftStatus} · 完整作答交卷可获得 20 积分</p>}

      {/* 顶部考试状态栏 */}
      {!result && (
        <div className="pb-paper-bar">
          <span className="pb-timer">⏱ {formatDuration(elapsedSeconds)}</span>
          <span>
            已作答 {answeredCount} / {questions.length}
          </span>
          {aveScore != null && <span className="pb-ave">全站均分 {aveScore} / 50</span>}
          <span className="pb-spacer" />
          <button
            type="button"
            className="pb-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '判分中…' : '交卷'}
          </button>
        </div>
      )}

      {/* 成绩单面板 */}
      {result && (
        <div className="pb-score">
          <div className="pb-score-main">
            <b>{result.score}</b>
            <span>/ {result.full ?? 50} 分</span>
          </div>
          <div className="pb-score-side">
            <div>用时 {formatDuration(elapsedSeconds)}</div>
            {result.aveScore != null && (
              <div className={result.score >= result.aveScore ? 'ok' : 'no'}>
                全站均分 {result.aveScore}（
                {result.score >= result.aveScore ? '高出' : '低于'}{' '}
                {Math.abs(Number((result.score - result.aveScore).toFixed(1)))} 分）
              </div>
            )}
            <div className="pb-score-note">错题已自动进错题本与复习队列</div>
          </div>
        </div>
      )}

      {/* 题目列表 */}
      <ol className="pb-paper-list">
        {questions.map((q, idx) => {
          const detail = detailMap.get(String(q.id));
          const currentPicked = normalizeChoices(userChoices[String(q.id)] ?? []);

          return (
            <li
              key={q.id}
              className={`pb-paper-q${
                detail ? (detail.correct ? ' is-right' : ' is-wrong') : ''
              }`}
            >
              <div className="pb-card-head">
                <span className="pb-no">{idx + 1}</span>
                <span className={`pb-type ${q.type}`}>
                  {q.type === 'multi' ? '多选 2分' : '单选 1分'}
                </span>
                <span className="pb-spacer" />
                {detail && (
                  <span className={detail.correct ? 'ok' : 'no'}>
                    {detail.correct ? '✓ 答对' : '✗ 答错'} · 正确答案 <b>{detail.answer}</b>
                  </span>
                )}
              </div>

              <div className="pb-stem">{q.stem}</div>

              <div className="pb-opts">
                {L.map(opt => {
                  const optClasses = ['pb-opt'];
                  if (result) {
                    if (detail?.answer.includes(opt)) optClasses.push('right');
                    if (detail?.picked.includes(opt) && !detail.answer.includes(opt)) {
                      optClasses.push('wrong');
                    }
                    if (detail?.answer.includes(opt) && !detail.picked.includes(opt)) {
                      optClasses.push('missed');
                    }
                  } else {
                    if (userChoices[String(q.id)]?.has(opt)) {
                      optClasses.push('picked');
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      className={optClasses.join(' ')}
                      onClick={() => handleSelect(q, opt)}
                    >
                      <span className="pb-opt-let">{opt}</span>
                      <span className="pb-opt-txt">{q.choices?.[opt] ?? ''}</span>
                    </button>
                  );
                })}
              </div>

              {!result && currentPicked && (
                <div className="pb-hint">已选 {currentPicked}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/* 底部提交栏 */}
      {!result && (
        <div className="pb-actions">
          <button
            type="button"
            className="pb-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? '判分中…'
              : `交卷（已作答 ${answeredCount}/${questions.length}）`}
          </button>
        </div>
      )}

      {/* 历次成绩列表 */}
      {history.length > 0 && (
        <section className="pb-block">
          <h2>历次成绩</h2>
          <ul className="pb-history">
            {history.map((h, hIdx) => (
              <li key={hIdx}>
                <b>{h.score}</b> 分{' '}
                <span>{h.takenAt?.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
          <p className="pb-block-sub">
            可以比较首次成绩与后续练习，观察哪些知识点已经巩固。
          </p>
        </section>
      )}
    </div>
  );
};

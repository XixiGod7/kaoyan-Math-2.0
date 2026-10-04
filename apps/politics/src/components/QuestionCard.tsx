import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../types/politics';
import { L, normalizeChoices, submitAnswerApi, toggleFavoriteApi, saveUserNoteApi, askAiApi } from '../services/politicsApi';
import { useEliminate } from '../hooks/useEliminate';
import { ExcerptBar, formatExcerpt, useTextSelection } from './ExcerptBar';

interface QuestionCardProps {
  q: Question;
  index?: number;
  total?: number;
  favored?: boolean;
  onFavor?: (qid: string | number, on: boolean) => void;
  onAnswered?: (qid: string | number, result: any) => void;
  initial?: any;
  defaultRevealed?: boolean;
  chapterCode?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  q,
  index,
  total,
  favored = false,
  onFavor,
  onAnswered,
  initial = null,
  defaultRevealed = false,
  chapterCode
}) => {
  const [pickedSet, setPickedSet] = useState<Set<string>>(new Set());
  const elim = useEliminate(q.id);
  const [submission, setSubmission] = useState<any>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [isFav, setIsFav] = useState(favored);
  const [revealed, setRevealed] = useState(defaultRevealed);
  const analysisRef = useRef<HTMLDivElement>(null);
  const [selectionHit, clearSelection] = useTextSelection(analysisRef);
  const [excerptData, setExcerptData] = useState<{ seq: number; text: string } | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const excerptSeq = useRef(1);

  useEffect(() => {
    setPickedSet(new Set());
    setSubmission(initial);
    setIsFav(favored);
    setRevealed(defaultRevealed);
    setExcerptData(null);
    setToastMsg('');
  }, [q.id, initial, favored, defaultRevealed]);

  const hasResult = !!submission && submission.ok !== false && !!submission.answer;
  const standardAnswer = submission?.answer ?? q.answer ?? '';
  const myChoice = submission?.myChoice ?? q.myChoice ?? '';
  const analysisText = submission?.analysis ?? q.analysis ?? '';
  const isMulti = q.type === 'multi';
  const missed = submission?.missed ?? '';
  const extra = submission?.extra ?? '';

  // 选项点击处理
  function handleOptionClick(opt: string) {
    if (hasResult || elim.consumed()) return;

    const next = isMulti ? new Set(pickedSet) : new Set<string>();
    if (isMulti && next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }

    if (elim.off.includes(opt)) {
      elim.toggle(opt);
    }
    setPickedSet(next);
  }

  // 提交作答
  async function handleSubmit() {
    const choiceStr = normalizeChoices(pickedSet);
    if (!choiceStr || submitting) return;

    setSubmitting(true);
    const res = await submitAnswerApi(q.id, choiceStr, chapterCode);
    setSubmitting(false);

    if (res.ok === false) {
      setSubmission(res);
      return;
    }

    setSubmission(res);
    setRevealed(true);
    onAnswered?.(q.id, res);
  }

  // 收藏切换
  async function handleToggleFavorite() {
    const next = !isFav;
    setIsFav(next);
    const res = await toggleFavoriteApi(q.id, next);
    if (res.ok) {
      onFavor?.(q.id, next);
    } else {
      setIsFav(!next);
    }
  }

  // 计算选项样式
  function getOptionClass(opt: string) {
    const classes = ['pb-opt'];
    if (elim.off.includes(opt)) {
      classes.push('struck');
    }

    if (!hasResult) {
      if (pickedSet.has(opt)) classes.push('picked');
      return classes.join(' ');
    }

    const isStd = standardAnswer.includes(opt);
    const isPicked = myChoice.includes(opt);

    if (isStd) classes.push('right');
    if (isPicked && !isStd) classes.push('wrong');
    if (isStd && !isPicked) classes.push('missed');

    return classes.join(' ');
  }

  return (
    <div className={`pb-card${hasResult ? (submission?.correct ? ' is-right' : ' is-wrong') : ''}`}>
      <div className="pb-card-head">
        <span className={`pb-type ${q.type}`}>{isMulti ? '多选' : '单选'}</span>
        {typeof index === 'number' && (
          <span className="pb-no">
            {index + 1}
            {total ? ` / ${total}` : ''}
          </span>
        )}
        {q.subject && <span className="pb-subject">{q.subject}</span>}
        {q.isReal && <span className="pb-tag-real">真题</span>}
        <span className="pb-spacer" />
        {typeof q.attempts === 'number' && q.attempts > 1 && (
          <span className="pb-attempts" title="做过的次数">
            第 {q.attempts} 次
          </span>
        )}
        <button
          type="button"
          className={`pb-fav${isFav ? ' on' : ''}`}
          onClick={handleToggleFavorite}
          title={isFav ? '取消收藏' : '收藏'}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>

      <div className="pb-stem">{q.stem}</div>

      <div className="pb-opts">
        {L.map(opt => (
          <button
            key={opt}
            type="button"
            className={getOptionClass(opt)}
            onClick={() => handleOptionClick(opt)}
            {...(hasResult ? {} : elim.bind(opt))}
            disabled={submitting}
            title={hasResult ? undefined : '点击选择；右键或长按可划掉它（排除法）'}
          >
            <span className="pb-opt-let">{opt}</span>
            <span className="pb-opt-txt">{q.choices?.[opt] ?? ''}</span>
          </button>
        ))}
      </div>

      {!hasResult && (
        <div className="pb-actions">
          <button
            type="button"
            className="pb-submit"
            disabled={pickedSet.size === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting
              ? '判分中…'
              : pickedSet.size === 0
              ? '请选择答案'
              : `提交（已选 ${normalizeChoices(pickedSet)}）`}
          </button>
          {isMulti && <span className="pb-hint">多选题错选、漏选均不得分</span>}
        </div>
      )}

      {submission?.ok === false && <div className="pb-err">{submission.message || '提交失败'}</div>}

      {hasResult && (
        <div className="pb-result">
          <div className="pb-verdict">
            <b className={submission?.correct ? 'ok' : 'no'}>
              {submission?.correct ? '答对了' : '答错了'}
            </b>
            <span>
              正确答案 <b>{standardAnswer}</b>
            </span>
            {myChoice && (
              <span>
                你选了 <b>{myChoice}</b>
              </span>
            )}
            {missed && <span className="pb-missed">漏选 {missed}</span>}
            {extra && <span className="pb-extra">多选 {extra}</span>}
          </div>

          <div ref={analysisRef}>
            {analysisText ? (
              revealed ? (
                <AnalysisSection text={analysisText} />
              ) : (
                <button type="button" className="pb-link" onClick={() => setRevealed(true)}>
                  展开解析
                </button>
              )
            ) : (
              <div className="pb-no-analysis">这道题暂无解析</div>
            )}
            <ExcerptBar
              hit={selectionHit}
              busy={toastMsg || undefined}
              onPick={text => {
                setExcerptData({ seq: excerptSeq.current++, text });
                clearSelection();
              }}
            />
          </div>

          <AiQuestionAssistant qid={q.id} />
          <UserNoteSection
            qid={q.id}
            initial={submission?.userNote ?? q.userNote ?? ''}
            excerpt={excerptData}
            onSay={setToastMsg}
          />
        </div>
      )}
    </div>
  );
};

// 解析段落格式化组件
function parseAnalysisSections(text: string): Array<{ title: string | null; body: string }> {
  const sections: Array<{ title: string | null; body: string }> = [];
  const regex = /【([^】]{1,12})】/g;
  let lastIndex = 0;
  let currentTitle: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const body = text.slice(lastIndex, match.index).trim();
    if (body || currentTitle) {
      sections.push({ title: currentTitle, body });
    }
    currentTitle = match[1];
    lastIndex = match.index + match[0].length;
  }

  const trailing = text.slice(lastIndex).trim();
  if (trailing || currentTitle) {
    sections.push({ title: currentTitle, body: trailing });
  }

  return sections.length ? sections : [{ title: null, body: text }];
}

const AnalysisSection: React.FC<{ text: string }> = ({ text }) => {
  const sections = useMemo(() => parseAnalysisSections(text), [text]);

  return (
    <div className="pb-analysis">
      {sections.map((sec, idx) => (
        <div key={idx} className="pb-sec">
          {sec.title && <div className="pb-sec-title">【{sec.title}】</div>}
          {sec.body
            .split('\n')
            .filter(Boolean)
            .map((p, pIdx) => (
              <p key={pIdx}>{p}</p>
            ))}
        </div>
      ))}
    </div>
  );
};

// 笔记区组件
const NOTE_MAX_LEN = 2000;
const UserNoteSection: React.FC<{
  qid: string | number;
  initial: string;
  excerpt: { seq: number; text: string } | null;
  onSay: (msg: string) => void;
}> = ({ qid, initial, excerpt, onSay }) => {
  const [open, setOpen] = useState(!!initial);
  const [note, setNote] = useState(initial);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const debounceTimer = useRef<number | undefined>(undefined);
  const pendingNote = useRef({ qid, text: initial, dirty: false });

  useEffect(() => {
    window.clearTimeout(debounceTimer.current);
    setOpen(!!initial);
    setNote(initial);
    setSaveStatus('idle');
    pendingNote.current = { qid, text: initial, dirty: false };
  }, [qid, initial]);

  useEffect(() => () => {
    window.clearTimeout(debounceTimer.current);
    const pending = pendingNote.current;
    if (pending.dirty) void saveUserNoteApi(pending.qid, pending.text.trim());
  }, []);

  async function flushNote() {
    window.clearTimeout(debounceTimer.current);
    const pending = { ...pendingNote.current };
    if (!pending.dirty) return;
    pendingNote.current.dirty = false;
    const res = await saveUserNoteApi(pending.qid, pending.text.trim());
    if (!res.ok && pendingNote.current.text === pending.text) pendingNote.current.dirty = true;
    setSaveStatus(res.ok ? 'saved' : 'err');
  }

  // 接收划词摘录
  useEffect(() => {
    if (!excerpt || !excerpt.text) return;
    const formatted = formatExcerpt(note, excerpt.text, NOTE_MAX_LEN);
    if (formatted.over) {
      onSay(`笔记放不下了（上限 ${NOTE_MAX_LEN} 字）`);
      window.setTimeout(() => onSay(''), 4000);
      return;
    }

    window.clearTimeout(debounceTimer.current);
    setOpen(true);
    setNote(formatted.text);
    setSaveStatus('saving');
    onSay('摘录中…');

    saveUserNoteApi(qid, formatted.text.trim()).then(res => {
      setSaveStatus(res.ok ? 'saved' : 'err');
      onSay(res.ok ? '✓ 已摘进本题笔记' : '没存上，检查一下网络');
      window.setTimeout(() => onSay(''), 3000);
    });
  }, [excerpt?.seq]);

  function handleChange(val: string) {
    setNote(val);
    pendingNote.current = { qid, text: val, dirty: true };
    setSaveStatus('saving');
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(flushNote, 800);
  }

  if (!open) {
    return (
      <button type="button" className="pb-link" onClick={() => setOpen(true)}>
        📝 记笔记
      </button>
    );
  }

  return (
    <div className="pb-note">
      <textarea
        aria-label="本题学习笔记"
        value={note}
        onChange={e => handleChange(e.target.value)}
        onBlur={flushNote}
        rows={3}
        maxLength={NOTE_MAX_LEN}
        placeholder="这道题记住什么？（自动保存，错题本和复习里都看得到）"
      />
      <div className="pb-note-foot">
        <span className={saveStatus === 'err' ? 'pb-err' : 'pb-hint'}>
          {saveStatus === 'saving'
            ? '保存中…'
            : saveStatus === 'saved'
            ? '已保存'
            : saveStatus === 'err'
            ? '没存上，检查一下网络再改一个字重试'
            : ''}
        </span>
      </div>
    </div>
  );
};

// AI 智能答疑组件
const AiQuestionAssistant: React.FC<{ qid: string | number }> = ({ qid }) => {
  const imageBox = useRef<HTMLDivElement>(null);
  const picker = useRef<{ ids: () => string[]; busy: () => boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && imageBox.current) picker.current = (window as any).createStudyImagePicker(imageBox.current);
    else picker.current = null;
  }, [open, qid]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
    setReply(null);
    setError(null);
  }, [qid]);

  async function handleAsk() {
    if (asking || picker.current?.busy()) return;
    const imageIds = picker.current?.ids() || [];
    if (!query.trim() && !imageIds.length) return;
    setAsking(true);
    setError(null);

    const res = await askAiApi(qid, query.trim() || '请结合题目分析这张图片。', imageIds);
    setAsking(false);

    if (res.ok && res.answer) {
      setReply(res.answer);
    } else {
      setError(res.message || '暂时不可用');
    }
  }

  if (!open) {
    return (
      <button type="button" className="pb-link" onClick={() => setOpen(true)}>
        还有不明白的？问一句
      </button>
    );
  }

  return (
    <div className="pb-ask">
      <div className="pb-ask-row">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAsk();
          }}
          placeholder="比如：C 和 D 有什么区别？"
          maxLength={200}
        />
        <button
          type="button"
          className="pb-submit"
          disabled={asking}
          onClick={handleAsk}
        >
          {asking ? '想一下…' : '问'}
        </button>
      </div>

      <div ref={imageBox}></div>
      {error && <div className="pb-err">{error}</div>}

      {reply && (
        <div className="pb-ask-reply">
          {reply
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
        </div>
      )}

      <div className="pb-hint">只答这道题的答案与干扰项，不评论时政本身；解析没写的会直说没写。</div>
    </div>
  );
};

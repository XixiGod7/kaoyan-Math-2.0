import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface SelectionHit {
  text: string;
  x: number;
  y: number;
}

export function formatExcerpt(originalNote: string = '', newText: string, maxLen: number = 2000): { text: string; over: boolean } {
  const quote = `「${newText.trim()}」`;
  const result = originalNote.trim() ? `${originalNote.trim()}\n\n${quote}` : quote;
  if (result.length > maxLen) {
    return { text: originalNote, over: true };
  }
  return { text: result, over: false };
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement>): [SelectionHit | null, () => void] {
  const [hit, setHit] = useState<SelectionHit | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    function checkSelection() {
      const container = containerRef.current;
      if (!container) {
        setHit(null);
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setHit(null);
        return;
      }

      const range = sel.getRangeAt(0);
      if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
        setHit(null);
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < 2) {
        setHit(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setHit(null);
        return;
      }

      setHit({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }

    const handler = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(checkSelection, 30);
    };

    document.addEventListener('mouseup', handler);
    document.addEventListener('touchend', handler);
    document.addEventListener('keyup', handler);

    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('mouseup', handler);
      document.removeEventListener('touchend', handler);
      document.removeEventListener('keyup', handler);
    };
  }, [containerRef]);

  const clear = () => {
    setHit(null);
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  };

  return [hit, clear];
}

export const ExcerptBar: React.FC<{
  hit: SelectionHit | null;
  busy?: string;
  onPick: (text: string) => void;
}> = ({ hit, busy, onPick }) => {
  if (!hit) return null;

  const count = hit.text.length;
  const left = Math.max(8, Math.min(hit.x - 70, window.innerWidth - 160));
  const top = hit.y > 52 ? hit.y - 42 : hit.y + 24;

  return ReactDOM.createPortal(
    <div className="mbx-excerpt" style={{ left: `${left}px`, top: `${top}px` }}>
      {busy ? (
        <span className="mbx-excerpt-done">{busy}</span>
      ) : (
        <button
          type="button"
          className="mbx-excerpt-btn"
          title={`把选中的 ${count} 个字摘进这道题的笔记`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => onPick(hit.text)}
        >
          📝 摘录到笔记<em>{count}字</em>
        </button>
      )}
    </div>,
    document.body
  );
};

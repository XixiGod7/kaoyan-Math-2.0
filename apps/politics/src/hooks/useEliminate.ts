import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'mb-elim-v1';
const LONG_PRESS_DELAY = 500;
const CONSUMED_THRESHOLD = 400;

function getStoredEliminations(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEliminations(data: Record<string, string>) {
  try {
    const keys = Object.keys(data);
    if (keys.length > 300) {
      for (const k of keys.slice(0, keys.length - 300)) {
        delete data[k];
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useEliminate(qid: string | number) {
  const key = `pb${qid}`;
  const [off, setOff] = useState<string>('');
  const timerRef = useRef<number | null>(null);
  const consumeTimestamp = useRef<number>(0);

  useEffect(() => {
    if (qid) {
      const stored = getStoredEliminations();
      setOff(stored[key] || '');
    }
  }, [key, qid]);

  const toggle = useCallback(
    (opt: string) => {
      if (!qid) return;
      setOff(prev => {
        const next = prev.includes(opt) ? prev.replace(opt, '') : prev + opt;
        const stored = getStoredEliminations();
        if (next) {
          stored[key] = next;
        } else {
          delete stored[key];
        }
        saveEliminations(stored);
        return next;
      });
    },
    [key, qid]
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const bind = useCallback(
    (opt: string) => ({
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        consumeTimestamp.current = Date.now();
        toggle(opt);
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button === 0) {
          consumeTimestamp.current = 0;
          clearTimer();
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            consumeTimestamp.current = Date.now();
            toggle(opt);
          }, LONG_PRESS_DELAY);
        }
      },
      onPointerUp: clearTimer,
      onPointerLeave: clearTimer,
      onPointerCancel: () => {
        clearTimer();
        consumeTimestamp.current = 0;
      }
    }),
    [clearTimer, toggle]
  );

  const consumed = useCallback(() => {
    const isConsumed = consumeTimestamp.current > 0 && Date.now() - consumeTimestamp.current < CONSUMED_THRESHOLD;
    consumeTimestamp.current = 0;
    return isConsumed;
  }, []);

  return { off, toggle, bind, consumed };
}

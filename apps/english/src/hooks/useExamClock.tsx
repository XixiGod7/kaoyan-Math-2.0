import { useCallback, useEffect, useRef, useState } from "react";
export function useExamClock(initial: number, paused: boolean) {
  const base = useRef(initial),
    start = useRef(Date.now()),
    pause = useRef(paused);
  const [checkpoint, setCheckpoint] = useState(initial);
  const seconds = useCallback(
    () =>
      Math.min(
        86400,
        base.current +
          (pause.current ? 0 : Math.floor((Date.now() - start.current) / 1000)),
      ),
    [],
  );
  useEffect(() => {
    base.current = seconds();
    start.current = Date.now();
    pause.current = paused;
    setCheckpoint(base.current);
  }, [paused, seconds]);
  useEffect(() => {
    const timer = setInterval(() => setCheckpoint(seconds()), 10000);
    const save = () => setCheckpoint(seconds());
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [seconds]);
  const reset = useCallback((value: number) => {
    base.current = value;
    start.current = Date.now();
    setCheckpoint(value);
  }, []);
  return { checkpoint, seconds, reset };
}
export function ExamClock({ seconds }: { seconds: () => number }) {
  const [value, setValue] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setValue(seconds()), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return (
    <>
      {String(Math.floor(value / 60)).padStart(2, "0")}:
      {String(value % 60).padStart(2, "0")}
    </>
  );
}

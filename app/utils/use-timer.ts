import { useCallback, useEffect, useRef, useState } from 'react';

export enum Delays {
  QuarterOfASecond = 250,
  HalfSecond = 500,
  OneSecond = 1000,
  OneMinute = 60 * 1000,
}

export interface UseTimerArgs {
  delay: number;
  autoStart?: boolean;
  repeat?: boolean;
  onTimerDone?: () => void;
}

export const useTimer = ({ delay, autoStart = false, repeat = false, onTimerDone }: UseTimerArgs) => {
  const timerRef = useRef<number>();
  const [done, setTimerDone] = useState(false);

  const reset = useCallback(() => {
    setTimerDone(false);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setTimerDone(true);
      if (onTimerDone) {
        onTimerDone();
      }
      if (repeat) {
        reset();
      }
    }, delay);
  }, [delay, repeat, onTimerDone]);

  useEffect(() => {
    if (autoStart) {
      reset();
    }
    return () => {
      window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return { done, reset };
};

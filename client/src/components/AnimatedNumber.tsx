import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
  animateOnMount?: boolean;
}

export default function AnimatedNumber({
  value,
  duration = 600,
  format,
  className,
  animateOnMount = true,
}: Props) {
  // start from 0 on mount when animateOnMount is true so numbers animate on refresh
  const initialFrom = animateOnMount ? 0 : value;
  const [display, setDisplay] = useState<number>(initialFrom);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(initialFrom);

  useEffect(() => {
    if (value === fromRef.current) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    startRef.current = start;
    const from = fromRef.current;
    const delta = value - from;

    const step = (now: number) => {
      const t = Math.min(1, (now - (startRef.current || start)) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const curr = from + delta * eased;
      setDisplay(Math.round(curr));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : String(display)}</span>;
}


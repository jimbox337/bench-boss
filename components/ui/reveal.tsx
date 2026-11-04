'use client';

import { useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** A small, owned motion primitive for app content—not a decorative effect library. */
export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}

type CountUpProps = {
  value: number;
  decimals?: number;
  className?: string;
};

export function CountUp({ value, decimals = 0, className }: CountUpProps) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 180, damping: 24 });
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useMotionValueEvent(spring, 'change', (latest) => {
    if (!reduceMotion) setDisplayValue(latest);
  });

  return <span className={className}>{(reduceMotion ? value : displayValue).toFixed(decimals)}</span>;
}

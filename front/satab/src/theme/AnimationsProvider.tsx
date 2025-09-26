// src/providers/AnimationsProvider.tsx
import * as React from 'react';
import { MotionConfig, LazyMotion, domAnimation } from 'framer-motion';

export const AnimationsContext = React.createContext({ reduce:false });

export default function AnimationsProvider({ children }: { children: React.ReactNode }) {
  const reduce = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={reduce ? "always" : "never"}>
        <AnimationsContext.Provider value={{ reduce }}>
          {children}
        </AnimationsContext.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

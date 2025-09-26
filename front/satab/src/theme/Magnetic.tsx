import React from 'react';
import { m, useMotionValue, useSpring } from 'framer-motion';

export default function Magnetic({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 12 });
  const sy = useSpring(y, { stiffness: 150, damping: 12 });

  return (
    <m.div
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - .5) * 12);
        y.set(((e.clientY - r.top) / r.height - .5) * 12);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x: sx, y: sy, willChange: 'transform' }}
    >
      {children}
    </m.div>
  );
}

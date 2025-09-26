// src/layout/PageTransition.tsx
import { m } from 'framer-motion';
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const variants = {
    initial: { opacity: 0, y: 8, filter: 'blur(2px)' },
    enter:   { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: .28, ease: [0.22,0.61,0.36,1] } },
    exit:    { opacity: 0, y: -8, filter: 'blur(2px)', transition: { duration: .22 } },
  };
  return <m.div initial="initial" animate="enter" exit="exit" variants={variants}>{children}</m.div>;
}

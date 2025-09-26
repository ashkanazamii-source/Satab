// src/components/motion/Motion.tsx
import { m } from 'framer-motion';
export const MotionPaper = m.div;    // اگر Paper می‌خوای: m(Paper) ولی تایپ‌دهی‌اش بیشتره
export const hoverLift = {
  whileHover: { y: -3, boxShadow: '0 18px 44px rgba(20,184,166,.22)' },
  transition: { type: 'spring', stiffness: 320, damping: 24 }
};
export const tapPress = { whileTap: { scale: .98 } };
export const fadeInUp = (i=0)=>({ initial:{opacity:0,y:6}, animate:{opacity:1,y:0,transition:{delay:i*.04,duration:.22}}});

// Tilt.tsx
import { m, useMotionValue, useSpring } from 'framer-motion';
export default function Tilt({children}:{children:React.ReactNode}){
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx,{ stiffness:120, damping:14 });
  const sry = useSpring(ry,{ stiffness:120, damping:14 });
  return (
    <m.div
      onMouseMove={(e)=>{ const b=(e.currentTarget as HTMLElement).getBoundingClientRect();
        const x=e.clientX-b.left, y=e.clientY-b.top;
        ry.set(((x/b.width)-.5)*12); rx.set(-((y/b.height)-.5)*12); }}
      onMouseLeave={()=>{ rx.set(0); ry.set(0); }}
      style={{ transformPerspective:800, rotateX: srx, rotateY: sry }}
    >{children}</m.div>
  );
}

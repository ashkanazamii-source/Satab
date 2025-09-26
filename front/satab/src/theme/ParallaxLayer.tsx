// ParallaxLayer.tsx
import { m, useScroll, useTransform } from 'framer-motion';
export default function ParallaxLayer({ speed=0.2, children }:any){
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -600*speed]);
  return <m.div style={{ y, willChange:'transform' }}>{children}</m.div>;
}

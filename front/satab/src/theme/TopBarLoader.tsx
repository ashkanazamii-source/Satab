// TopBarLoader.tsx
import { m, useIsPresent } from 'framer-motion';
export default function TopBarLoader({ loading }: { loading: boolean }) {
  const present = useIsPresent();
  if (!loading && !present) return null;
  return (
    <m.div
      initial={{ scaleX: 0 }} animate={{ scaleX: loading ? 1 : 0 }}
      exit={{ scaleX: 0 }} style={{
        position:'fixed', top:0, left:0, right:0, height:3, transformOrigin:'0 0',
        background:'linear-gradient(90deg,#14B8A6,#06B6D4)'
      }}
      transition={{ duration:.6, repeat: loading ? Infinity : 0, repeatType:'reverse' }}
    />
  );
}

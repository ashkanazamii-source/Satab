import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ثبت پلاگین‌های GSAP
gsap.registerPlugin(ScrollTrigger);

function LandingPageAnimations() {
  useEffect(() => {
    // این کد فقط یک بار پس از رندر شدن کامل صفحه اجرا می‌شود
    
    // Floating orbs animation
    gsap.to(".o1", { x: 40, y: 20, duration: 8, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(".o2", { x: -30, y: -10, duration: 10, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(".o3", { x: 20, y: -30, duration: 12, yoyo: true, repeat: -1, ease: "sine.inOut" });

    // بقیه کدهای GSAP و انیمیشن‌ها در مراحل بعدی اینجا اضافه خواهند شد...
    
  }, []); // آرایه خالی یعنی فقط یک بار اجرا شود

  return null; // این کامپوننت هیچ چیزی را رندر نمی‌کند و فقط برای اجرای کد JS است
}

export default LandingPageAnimations;
// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';

// Providers
import ThemeModeProvider from './theme/ThemeModeProvider';
import AnimationsProvider from './theme/AnimationsProvider';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import RoleManagementPage from './pages/RoleManagementPage';
import DriversManagementPage from './pages/DriversManagementPage';
import LogsPage from './pages/LogsPage';
import ChatPage from './pages/ChatPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DefineLinePage from './pages/DefineLinePage';
import ShiftsPage from './pages/ShiftsPage';

// Common
import BackgroundEffects from './components/BackgroundEffects';
import LandingPageAnimations from './components/LandingPageAnimations';

// Styles
import 'leaflet/dist/leaflet.css';

// Layout
import PageTransition from './theme/PageTransition';

/* نوار لودینگ باریک بالای صفحه هنگام جابجایی بین مسیرها */
function TopBarLoader({ loading }: { loading: boolean }) {
  return (
    <m.div
      initial={false}
      animate={{ scaleX: loading ? 1 : 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        transformOrigin: '0 0',
        zIndex: 13000,
        background: 'linear-gradient(90deg, #14B8A6, #06B6D4)',
      }}
      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
    />
  );
}

/* جدا کردن بخش روت‌ها برای استفاده از useLocation */
function AppRoutes() {
  const location = useLocation();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 500); // مدت کوتاه برای حس انتقال
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <>
      <TopBarLoader loading={loading} />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
          <Route path="/role-management" element={<PageTransition><RoleManagementPage /></PageTransition>} />
          <Route path="/driver-management" element={<PageTransition><DriversManagementPage /></PageTransition>} />
          <Route path="/logs" element={<PageTransition><LogsPage /></PageTransition>} />
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/register" element={<PageTransition><RegisterPage /></PageTransition>} />
          <Route path="/chat" element={<PageTransition><ChatPage /></PageTransition>} />
          <Route path="/analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
          <Route path="/define-line" element={<PageTransition><DefineLinePage /></PageTransition>} />
          <Route path="/shifts" element={<PageTransition><ShiftsPage /></PageTransition>} />
          <Route path="/" element={<PageTransition><div style={{ textAlign: 'center', marginTop: 100 }}>صفحه اصلی</div></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

const App: React.FC = () => {
  return (
    <AnimationsProvider>
      <ThemeModeProvider>
        <BrowserRouter>
          {/* افکت‌های پس‌زمینه و لندینگ عمومی */}
          <BackgroundEffects />
          <LandingPageAnimations />

          <AppRoutes />
        </BrowserRouter>
      </ThemeModeProvider>
    </AnimationsProvider>
  );
};

export default App;

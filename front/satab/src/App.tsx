import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import RoleManagementPage from './pages/RoleManagementPage';
import DriversManagementPage from './pages/DriversManagementPage';
import LogsPage from './pages/LogsPage'; // صفحه‌ی لاگ‌ها
import 'leaflet/dist/leaflet.css';
import ChatPage from './pages/ChatPage'; // صفحه‌ی لاگ‌ها

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/role-management" element={<RoleManagementPage />} />
        <Route path="/driver-management" element={<DriversManagementPage />} />
        <Route path="/logs" element={<LogsPage />} /> {/* صفحه‌ی لاگ‌ها */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/chat" element={<ChatPage />} />

        <Route
          path="/"
          element={
            <div style={{ textAlign: 'center', marginTop: 100 }}>
              صفحه اصلی
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

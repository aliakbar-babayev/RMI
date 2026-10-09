import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import ActionCenterPage from './pages/ActionCenterPage';
import AnalyzePage from './pages/AnalyzePage';
import AuditPage from './pages/AuditPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--c-bg)]">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/actions" element={<ActionCenterPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Routes>
      </main>
    </div>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppProvider } from './lib/app'
import { Analyze } from './pages/Analyze'
import { AuditTrail } from './pages/AuditTrail'
import { Escalations } from './pages/Escalations'
import { Incidents } from './pages/Incidents'
import { Overview } from './pages/Overview'
import { Risks } from './pages/Risks'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="risks" element={<Risks />} />
            <Route path="analyze" element={<Analyze />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="escalations" element={<Escalations />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="actions" element={<Navigate to="/risks?status=pending" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

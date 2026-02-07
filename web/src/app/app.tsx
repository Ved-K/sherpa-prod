// src/app/App.tsx
import { Route, Routes } from 'react-router-dom';
import AppShell from './layout/AppShell';

import DashboardPage from './pages/DashboardPage';
import StartAssessmentPage from './pages/StartAssessmentPage';
import LinePage from './pages/LinePage';
import MachinePage from './pages/MachinePage';
import CreateTaskPage from './pages/CreateTaskPage';
import CreateStepsPage from './pages/CreateStepsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import AssessTaskPage from './pages/AssessTaskPage';
import RiskManagementPage from './pages/RiskManagementPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<DashboardPage />} />

        <Route path="start" element={<StartAssessmentPage />} />
        <Route path="risk" element={<RiskManagementPage />} />
        <Route path="exports" element={<PlaceholderPage title="Exports" />} />

        <Route path="lines/:lineId" element={<LinePage />} />
        <Route path="machines/:machineId" element={<MachinePage />} />

        <Route
          path="machines/:machineId/tasks/new"
          element={<CreateTaskPage />}
        />

        {/* Steps + assess */}
        <Route path="tasks/:taskId/steps/new" element={<CreateStepsPage />} />
        <Route path="tasks/:taskId/assess" element={<AssessTaskPage />} />

        <Route path="*" element={<PlaceholderPage title="404 — Not found" />} />
      </Route>
    </Routes>
  );
}

export default App;

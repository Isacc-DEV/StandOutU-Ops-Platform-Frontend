import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Guard from './components/Guard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Applications from './pages/Applications.jsx';
import ApplicationDetail from './pages/ApplicationDetail.jsx';
import Profiles from './pages/Profiles.jsx';
import ProfileDetail from './pages/ProfileDetail.jsx';
import Resumes from './pages/Resumes.jsx';
import Schedules from './pages/Schedules.jsx';
import Interviews from './pages/Interviews.jsx';
import Login from './pages/Login.jsx';
import Accounts from './pages/Accounts.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Nav />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/profiles/:id" element={<ProfileDetail />} />
            <Route path="/resumes" element={<Resumes />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/interviews" element={<Interviews />} />
            <Route path="/accounts" element={<Accounts />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

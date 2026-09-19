import { useAuth } from './hooks/useAuth.js';
import { useSettings } from './hooks/useSettings.js';
import PublicDashboard from './pages/PublicDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';

export default function App() {
  const { user, checking, login, logout, isAuthenticated } = useAuth();
  const { settings, reloadSettings } = useSettings();

  if (checking) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <PublicDashboard onLogin={login} settings={settings} />;
  }

  return <Dashboard user={user} onLogout={logout} settings={settings} reloadSettings={reloadSettings} />;
}

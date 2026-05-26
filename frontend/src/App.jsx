import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import Topbar from "./components/Topbar.jsx";
import { AppProvider, useApp } from "./context/AppContext.jsx";

import AccessView from "./views/AccessView.jsx";
import OverviewView from "./views/OverviewView.jsx";
import DevicesView from "./views/DevicesView.jsx";
import RoomsView from "./views/RoomsView.jsx";
import EnergyView from "./views/EnergyView.jsx";
import SecurityView from "./views/SecurityView.jsx";
import SchedulesView from "./views/SchedulesView.jsx";
import SettingsView from "./views/SettingsView.jsx";

const VIEWS = {
  access: AccessView,
  overview: OverviewView,
  devices: DevicesView,
  rooms: RoomsView,
  energy: EnergyView,
  security: SecurityView,
  schedules: SchedulesView,
  settings: SettingsView,
};

function Dashboard() {
  const { currentView } = useApp();
  const View = VIEWS[currentView] || OverviewView;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Topbar />
        <View />
      </main>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

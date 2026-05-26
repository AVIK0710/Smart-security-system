import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "./LucideIcon.jsx";

const NAV = [
  ["overview", "LayoutDashboard", "Overview"],
  ["devices", "Cpu", "Devices"],
  ["rooms", "Home", "Rooms"],
  ["energy", "Activity", "Telemetry"],
  ["security", "ShieldAlert", "Security"],
  ["schedules", "CalendarClock", "Scenes"],
  ["settings", "Settings", "Settings"],
];

export default function Sidebar() {
  const { currentView, switchView, metrics } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <LucideIcon name="ShieldCheck" size={28} />
        <div>
          <h2>Smart Guard</h2>
          <span>Home + Security</span>
        </div>
      </div>

      <nav>
        {NAV.map(([id, icon, label]) => (
          <button
            key={id}
            className={currentView === id ? "nav-item active" : "nav-item"}
            onClick={() => switchView(id)}
            type="button"
          >
            <LucideIcon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-card">
        <strong>
          {metrics.online}/{metrics.total}
        </strong>
        <span>devices online</span>
      </div>
    </aside>
  );
}

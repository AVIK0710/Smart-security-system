import { useApp } from "../context/AppContext.jsx";
import { AUTH_NAV_ITEM, NAV_ITEMS } from "../utils/helpers.js";
import LucideIcon from "./LucideIcon.jsx";

const STATUS_ICONS = {
  auth: {
    signedIn: ["CircleUserRound", "Signed in"],
    signedOut: ["CircleUser", "Signed out"],
  },
  backend: {
    online: ["Server", "Backend online"],
    offline: ["ServerOff", "Backend offline"],
    checking: ["Loader", "Backend checking"],
  },
  socket: {
    online: ["Wifi", "Socket online"],
    connecting: ["Loader", "Connecting"],
    offline: ["WifiOff", "Socket offline"],
  },
  voice: {
    listening: ["Mic", "Listening"],
    ready: ["Mic", "Voice ready"],
    unsupported: ["MicOff", "Not supported"],
    idle: ["MicOff", "Voice idle"],
  },
};

export default function Sidebar() {
  const {
    token,
    currentView,
    switchView,
    goToLogin,
    backendStatus,
    socketStatus,
    voiceStatus,
  } = useApp();

  const authNavLabel = token ? "Account" : "Login / Register";
  const auth = token ? STATUS_ICONS.auth.signedIn : STATUS_ICONS.auth.signedOut;
  const backend = STATUS_ICONS.backend[backendStatus] || STATUS_ICONS.backend.checking;
  const socket = STATUS_ICONS.socket[socketStatus] || STATUS_ICONS.socket.offline;
  const voice = STATUS_ICONS.voice[voiceStatus] || STATUS_ICONS.voice.idle;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <LucideIcon name="HouseWifi" />
        </div>
        <div>
          <h1>Smart Home</h1>
          <span>Command Center</span>
        </div>
      </div>

      <nav className="nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={currentView === item.id ? "active" : ""}
            title={item.label}
            onClick={() => switchView(item.id)}
          >
            <LucideIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={currentView === AUTH_NAV_ITEM.id ? "active" : ""}
          title={authNavLabel}
          onClick={() => switchView(AUTH_NAV_ITEM.id)}
        >
          <LucideIcon name={AUTH_NAV_ITEM.icon} />
          <span>{authNavLabel}</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-card">
          <LucideIcon name="Sun" />
          <strong>Good Morning!</strong>
          <span>Everything looks good. Have a nice day!</span>
        </div>
        <div className="help-card">
          <LucideIcon name="CircleHelp" />
          <span>Help</span>
        </div>
        <button
          type="button"
          className="connection-pill auth-pill"
          onClick={goToLogin}
          title={token ? "Account settings" : "Login or register"}
        >
          <LucideIcon name={auth[0]} />
          <span>{auth[1]}</span>
        </button>
        <div className="connection-pill">
          <LucideIcon name={backend[0]} />
          <span>{backend[1]}</span>
        </div>
        <div className="connection-pill">
          <LucideIcon name={socket[0]} />
          <span>{socket[1]}</span>
        </div>
        <div className="connection-pill">
          <LucideIcon name={voice[0]} />
          <span>{voice[1]}</span>
        </div>
      </div>
    </aside>
  );
}

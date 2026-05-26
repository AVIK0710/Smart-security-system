import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "./LucideIcon.jsx";

export default function Topbar() {
  const {
    backendStatus,
    socketStatus,
    alerts,
    refreshAll,
    logout,
    token,
    startVoice,
    listening,
  } = useApp();

  return (
    <header className="topbar">
      <div>
        <h1>Smart Security Dashboard</h1>
        <p>
          Backend: {backendStatus} | WebSocket: {socketStatus}
        </p>
      </div>

      <div className="top-actions">
        <button className="btn secondary" onClick={refreshAll} type="button">
          <LucideIcon name="RefreshCw" />
          <span>Refresh</span>
        </button>

        <button className="btn secondary" onClick={startVoice} type="button">
          <LucideIcon name={listening ? "Mic2" : "Mic"} />
          <span>{listening ? "Listening" : "Voice"}</span>
        </button>

        <div className={alerts ? "alert-pill active" : "alert-pill"}>
          <LucideIcon name="Bell" />
          <span>{alerts}</span>
        </div>

        {token ? (
          <button className="btn danger" onClick={logout} type="button">
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}

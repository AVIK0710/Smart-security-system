import { useApp } from "../context/AppContext.jsx";

export default function SettingsView() {
  const { backendStatus, socketStatus, clearEvents, refreshAll } = useApp();

  return (
    <section className="view active">
      <section className="panel pad">
        <h3>System Settings</h3>
        <p>Backend: {backendStatus}</p>
        <p>WebSocket: {socketStatus}</p>

        <button className="btn" onClick={refreshAll}>
          Refresh System
        </button>
        <button className="btn secondary" onClick={clearEvents}>
          Clear Live Events
        </button>
      </section>
    </section>
  );
}

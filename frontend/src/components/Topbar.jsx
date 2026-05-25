import { useApp } from "../context/AppContext.jsx";
import { VIEW_TITLES } from "../utils/helpers.js";
import LucideIcon from "./LucideIcon.jsx";

export default function Topbar() {
  const {
    token,
    currentView,
    metrics,
    refreshAll,
    startVoice,
    logout,
    goToLogin,
    goToRegister,
  } = useApp();

  const [title, subtitle] = VIEW_TITLES[currentView] || VIEW_TITLES.overview;

  return (
    <header className="topbar">
      <div className="page-title">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="toolbar">
        <div className="top-status">{metrics.homeStatusText}</div>
        {!token ? (
          <>
            <button className="btn secondary" type="button" onClick={goToLogin}>
              <LucideIcon name="LogIn" />
              <span>Login</span>
            </button>
            <button className="btn" type="button" onClick={goToRegister}>
              <LucideIcon name="UserPlus" />
              <span>Register</span>
            </button>
          </>
        ) : (
          <>
            <button className="round-btn" type="button" title="Voice command" onClick={startVoice}>
              <LucideIcon name="Mic" />
            </button>
            <button className="notification-btn" type="button" title="Notifications">
              <LucideIcon name="Bell" />
            </button>
            <div className="avatar">
              <img
                alt="Profile"
                src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80"
              />
            </div>
            <button
              className="btn secondary hidden"
              id="refreshBtn"
              type="button"
              title="Refresh"
              onClick={refreshAll}
            >
              <LucideIcon name="RefreshCw" />
              <span>Refresh</span>
            </button>
            <button className="btn danger" id="logoutBtn" type="button" title="Sign out" onClick={logout}>
              <LucideIcon name="LogOut" />
              <span>Sign out</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

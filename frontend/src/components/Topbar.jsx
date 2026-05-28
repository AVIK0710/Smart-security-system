import { useApp } from "../context/AppContext.jsx";
import { VIEW_TITLES } from "../utils/helpers.js";
import LucideIcon from "./LucideIcon.jsx";

export default function Topbar() {
  const {
    token,
    currentUser,
    currentView,
    metrics,
    listening,
    refreshAll,
    startVoice,
    logout,
    goToLogin,
    goToRegister,
  } = useApp();

  const [title, subtitle] = VIEW_TITLES[currentView] || VIEW_TITLES.overview;
  const displayName = currentUser?.username || "Account";
  const displayEmail = currentUser?.email || "Signed in";
  const initials = displayName
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

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
            <button className={`round-btn${listening ? " active" : ""}`} type="button" title="Voice command" onClick={startVoice}>
              <LucideIcon name="Mic" />
            </button>
            <button className="notification-btn" type="button" title="Notifications">
              <LucideIcon name="Bell" />
            </button>
            <div className="account-chip" title={displayEmail}>
              <div className="avatar" aria-hidden="true">{initials}</div>
              <div className="account-copy">
                <strong>{displayName}</strong>
                <span>{displayEmail}</span>
              </div>
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

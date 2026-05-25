import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "../components/LucideIcon.jsx";

export default function AccessView() {
  const {
    token,
    authTab,
    setAuthTab,
    login,
    register,
    logout,
    switchView,
    toast,
  } = useApp();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(loginUsername, loginPassword);
    } catch (error) {
      toast(error.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const username = await register(registerUsername, registerPassword);
      setLoginUsername(username);
      setRegisterUsername("");
      setRegisterPassword("");
    } catch (error) {
      toast(error.message);
    }
  };

  if (token) {
    return (
      <section className="view active">
        <div className="auth-layout">
          <section className="panel pad">
            <div className="section-head">
              <div>
                <h3>Account</h3>
                <span>You are signed in and can control your smart home.</span>
              </div>
            </div>
            <div className="safe-card" style={{ marginBottom: 20 }}>
              <LucideIcon name="CircleUserRound" size={58} />
              <div>
                <strong>Signed in</strong>
                <p>Your session is active. Use the dashboard to manage devices.</p>
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="button" onClick={() => switchView("overview")}>
                <LucideIcon name="House" />
                <span>Go to Dashboard</span>
              </button>
              <button className="btn danger" type="button" onClick={logout}>
                <LucideIcon name="LogOut" />
                <span>Sign out</span>
              </button>
            </div>
          </section>
          <div className="auth-visual" aria-hidden="true" />
        </div>
      </section>
    );
  }

  return (
    <section className="view active">
      <div className="auth-layout">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Welcome</h3>
              <span>Sign in or create an account to use the smart home dashboard.</span>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={authTab === "login" ? "active" : ""}
              onClick={() => setAuthTab("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={authTab === "register" ? "active" : ""}
              onClick={() => setAuthTab("register")}
            >
              Register
            </button>
          </div>

          <form
            className={`form-grid${authTab !== "login" ? " hidden" : ""}`}
            onSubmit={handleLogin}
          >
            <div className="field full">
              <label htmlFor="loginUsername">Username</label>
              <input
                id="loginUsername"
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="loginPassword">Password</label>
              <input
                id="loginPassword"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="LogIn" />
                <span>Login</span>
              </button>
            </div>
            <div className="field full">
              <p className="muted" style={{ margin: 0 }}>
                New here?{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setAuthTab("register")}
                >
                  Create an account
                </button>
              </p>
            </div>
          </form>

          <form
            className={`form-grid${authTab !== "register" ? " hidden" : ""}`}
            onSubmit={handleRegister}
          >
            <div className="field full">
              <label htmlFor="registerUsername">Username</label>
              <input
                id="registerUsername"
                autoComplete="username"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <label htmlFor="registerPassword">Password</label>
              <input
                id="registerPassword"
                type="password"
                autoComplete="new-password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
              />
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="UserPlus" />
                <span>Register</span>
              </button>
            </div>
            <div className="field full">
              <p className="muted" style={{ margin: 0 }}>
                Already have an account?{" "}
                <button type="button" className="link-btn" onClick={() => setAuthTab("login")}>
                  Sign in
                </button>
              </p>
            </div>
          </form>
        </section>
        <div className="auth-visual" aria-hidden="true" />
      </div>
    </section>
  );
}

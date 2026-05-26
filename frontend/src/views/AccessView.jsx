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
    requestPasswordReset,
    verifyPasswordOtp,
    resetPassword,
    logout,
    switchView,
    toast,
  } = useApp();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetSessionToken, setResetSessionToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState("email");

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
      const username = await register(registerUsername, registerEmail, registerPassword);
      setLoginUsername(username);
      setRegisterUsername("");
      setRegisterEmail("");
      setRegisterPassword("");
    } catch (error) {
      toast(error.message);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const data = await requestPasswordReset(resetEmail);
      setResetStep("otp");
      toast(data.message);
    } catch (error) {
      toast(error.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const data = await verifyPasswordOtp(resetEmail, resetOtp);
      setResetSessionToken(data.reset_token);
      setResetStep("password");
      toast("OTP verified. Set your new password.");
    } catch (error) {
      toast(error.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(resetEmail, resetSessionToken, resetPasswordValue, resetConfirmPassword);
      setLoginUsername(resetEmail);
      setResetOtp("");
      setResetSessionToken("");
      setResetPasswordValue("");
      setResetConfirmPassword("");
      setResetStep("email");
      setAuthTab("login");
      toast("Password reset complete. Sign in with the new password.");
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
            <button
              type="button"
              className={authTab === "forgot" ? "active" : ""}
              onClick={() => setAuthTab("forgot")}
            >
              Forgot
            </button>
          </div>

          <form
            className={`form-grid${authTab !== "login" ? " hidden" : ""}`}
            onSubmit={handleLogin}
          >
            <div className="field full">
              <label htmlFor="loginUsername">Username or Email</label>
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
                {" "}or{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setResetEmail(loginUsername.includes("@") ? loginUsername : "");
                    setResetStep("email");
                    setAuthTab("forgot");
                  }}
                >
                  reset password
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
              <label htmlFor="registerEmail">Email</label>
              <input
                id="registerEmail"
                type="email"
                autoComplete="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
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

          <div className={authTab !== "forgot" ? " hidden" : ""}>
            <div className="reset-steps">
              <span className={resetStep === "email" ? "active" : ""}>Email</span>
              <span className={resetStep === "otp" ? "active" : ""}>OTP</span>
              <span className={resetStep === "password" ? "active" : ""}>Password</span>
            </div>

            <form
              className={`form-grid${resetStep !== "email" ? " hidden" : ""}`}
              onSubmit={handleForgotPassword}
            >
              <div className="field full">
                <label htmlFor="resetEmail">Email</label>
                <input
                  id="resetEmail"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field full">
                <button className="btn secondary" type="submit">
                  <LucideIcon name="Mail" />
                  <span>Send OTP</span>
                </button>
              </div>
            </form>

            <form
              className={`form-grid reset-form${resetStep !== "otp" ? " hidden" : ""}`}
              onSubmit={handleVerifyOtp}
            >
              <div className="field full">
                <label htmlFor="resetOtp">OTP</label>
                <input
                  id="resetOtp"
                  inputMode="numeric"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  required
                />
              </div>
              <div className="field full">
                <button className="btn" type="submit">
                  <LucideIcon name="ShieldCheck" />
                  <span>Verify OTP</span>
                </button>
              </div>
            </form>

            <form
              className={`form-grid reset-form${resetStep !== "password" ? " hidden" : ""}`}
              onSubmit={handleResetPassword}
            >
              <div className="field full">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  required
                />
              </div>
              <div className="field full">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field full">
                <button className="btn" type="submit">
                  <LucideIcon name="ShieldCheck" />
                  <span>Save New Password</span>
                </button>
              </div>
              <div className="field full">
                <p className="muted" style={{ margin: 0 }}>
                  Remembered it?{" "}
                  <button type="button" className="link-btn" onClick={() => setAuthTab("login")}>
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          </div>
        </section>
        <div className="auth-visual" aria-hidden="true" />
      </div>
    </section>
  );
}

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function AccessView() {
  const { login, register, authTab, setAuthTab } = useApp();
  const [username, setUsername] = useState("avik");
  const [password, setPassword] = useState("1234");

  async function submit(event) {
    event.preventDefault();
    if (authTab === "register") {
      await register(username, password);
    } else {
      await login(username, password);
    }
  }

  return (
    <section className="view active">
      <div className="access-layout">
        <div className="access-copy">
          <h1>Smart Guard</h1>
          <p>Unified home automation and intruder alert platform.</p>
        </div>

        <form className="panel pad access-card" onSubmit={submit}>
          <h2>{authTab === "register" ? "Create Account" : "Login"}</h2>

          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="btn" type="submit">
            {authTab === "register" ? "Register" : "Login"}
          </button>

          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              setAuthTab(authTab === "register" ? "login" : "register")
            }
          >
            {authTab === "register" ? "Go to Login" : "Create Account"}
          </button>
        </form>
      </div>
    </section>
  );
}

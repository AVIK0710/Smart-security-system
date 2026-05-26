import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function SchedulesView() {
  const { devices, scenes, createScene, runScene } = useApp();

  const [sceneName, setSceneName] = useState("Movie Mode");
  const [deviceId, setDeviceId] = useState("");
  const [commandType, setCommandType] = useState("TURN_ON");

  async function submit(event) {
    event.preventDefault();

    if (!deviceId) return;

    await createScene({
      name: sceneName,
      actions: [
        {
          device_id: Number(deviceId),
          command_type: commandType,
          payload: null,
        },
      ],
    });
  }

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <h3>Create Scene</h3>

          <form className="form-grid" onSubmit={submit}>
            <div className="field">
              <label>Scene Name</label>
              <input
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Device</label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                <option value="">Select device</option>
                {devices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Command</label>
              <select
                value={commandType}
                onChange={(e) => setCommandType(e.target.value)}
              >
                <option value="TURN_ON">TURN_ON</option>
                <option value="TURN_OFF">TURN_OFF</option>
              </select>
            </div>

            <button className="btn" type="submit">
              Create Scene
            </button>
          </form>
        </section>

        <section className="panel pad">
          <h3>Scenes</h3>
          <div className="event-log">
            {!scenes.length ? (
              <div className="empty">No scenes yet</div>
            ) : (
              scenes.map((scene) => (
                <div key={scene.scene_id} className="event-item">
                  <strong>{scene.name}</strong>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => runScene(scene.scene_id)}
                  >
                    Run
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

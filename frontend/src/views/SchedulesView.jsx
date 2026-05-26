import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "../components/LucideIcon.jsx";

export default function SchedulesView() {
  const { scenes, devices, runScene, createScene, updateScene, deleteScene } = useApp();
  const [sceneName, setSceneName] = useState("");
  const [sceneDevice, setSceneDevice] = useState("");
  const [sceneCommand, setSceneCommand] = useState("TURN_ON");
  const [scenePayload, setScenePayload] = useState("");

  const deviceId = sceneDevice || (devices[0] ? String(devices[0].device_id) : "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createScene({
      name: sceneName,
      actions: [
        {
          device_id: Number(deviceId),
          command_type: sceneCommand,
          payload: scenePayload || null,
        },
      ],
    });
    setSceneName("");
    setScenePayload("");
  };

  const handleRename = async (scene) => {
    const name = window.prompt("Scene name", scene.name);
    if (!name || name === scene.name) return;
    await updateScene(scene.scene_id, { name });
  };

  const handleDelete = async (scene) => {
    if (!window.confirm(`Delete ${scene.name}?`)) return;
    await deleteScene(scene.scene_id);
  };

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Scenes</h3>
              <span>Run multiple device commands together</span>
            </div>
          </div>
          <div className="scene-grid">
            {!scenes.length ? (
              <div className="empty">No scenes created</div>
            ) : (
              scenes.map((scene) => (
                <article key={scene.scene_id} className="scene-card">
                  <header>
                    <div>
                      <h4>{scene.name}</h4>
                      <div className="muted">Say &quot;start {scene.name}&quot;</div>
                    </div>
                    <span className="status info">Scene</span>
                  </header>
                  <button className="btn" type="button" onClick={() => runScene(scene.scene_id)}>
                    <LucideIcon name="Play" />
                    <span>Run</span>
                  </button>
                  <div className="card-actions">
                    <button className="btn secondary" type="button" onClick={() => handleRename(scene)}>
                      <LucideIcon name="Pencil" />
                      <span>Rename</span>
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleDelete(scene)}>
                      <LucideIcon name="Trash2" />
                      <span>Delete</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Create Scene</h3>
              <span>One action can be added from this panel</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field full">
              <label htmlFor="sceneName">Scene Name</label>
              <input
                id="sceneName"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="sceneDevice">Device</label>
              <select
                id="sceneDevice"
                value={deviceId}
                onChange={(e) => setSceneDevice(e.target.value)}
              >
                {devices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name} ({device.device_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sceneCommand">Command</label>
              <select
                id="sceneCommand"
                value={sceneCommand}
                onChange={(e) => setSceneCommand(e.target.value)}
              >
                <option value="TURN_ON">TURN_ON</option>
                <option value="TURN_OFF">TURN_OFF</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="scenePayload">Payload</label>
              <input
                id="scenePayload"
                value={scenePayload}
                onChange={(e) => setScenePayload(e.target.value)}
              />
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="Save" />
                <span>Create Scene</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}

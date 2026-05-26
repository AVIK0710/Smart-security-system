import { useState } from "react";
import DeviceCard from "../components/DeviceCard.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function DevicesView() {
  const { devices, registerDevice, provisioningLog } = useApp();

  const [name, setName] = useState("Front Door Camera");
  const [deviceType, setDeviceType] = useState("camera");
  const [room, setRoom] = useState("Entrance");

  async function submit(event) {
    event.preventDefault();
    await registerDevice({
      name,
      device_type: deviceType,
      room,
    });
  }

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <h3>Register Device</h3>
          <form className="form-grid" onSubmit={submit}>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="field">
              <label>Type</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                <option value="camera">camera</option>
                <option value="sensor">sensor</option>
                <option value="fan">fan</option>
                <option value="light">light</option>
                <option value="relay">relay</option>
              </select>
            </div>

            <div className="field">
              <label>Room</label>
              <input value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>

            <button className="btn" type="submit">
              Register
            </button>
          </form>
        </section>

        <section className="panel pad">
          <h3>Provisioning Credentials</h3>
          <div className="event-log">
            {!provisioningLog.length ? (
              <div className="empty">
                New device credentials will appear here. Save them safely.
              </div>
            ) : (
              provisioningLog.map((entry) => (
                <div key={entry.id} className="event-item">
                  <strong>{entry.label || "Device credentials"}</strong>
                  <code>{JSON.stringify(entry.data, null, 2)}</code>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="panel pad">
        <h3>Devices</h3>
        <div className="card-grid">
          {devices.map((device) => (
            <DeviceCard key={device.device_id} device={device} />
          ))}
        </div>
      </section>
    </section>
  );
}

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import DeviceCard from "../components/DeviceCard.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { DEVICE_TYPES } from "../utils/helpers.js";

export default function DevicesView() {
  const {
    devices,
    commandsByDevice,
    sendCommand,
    registerDevice,
    updateDevice,
    deleteDevice,
    provisioningLog,
  } = useApp();
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState("light");
  const [room, setRoom] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await registerDevice({
      name,
      device_type: deviceType,
      room: room || null,
    });
    setName("");
    setRoom("");
    setDeviceType("light");
  };

  const handleRename = async (device) => {
    const name = window.prompt("Device name", device.device_name);
    if (!name || name === device.device_name) return;
    await updateDevice(device.device_id, { name });
  };

  const handleMove = async (device) => {
    const room = window.prompt("Room", device.room || "");
    if (room === null || room === device.room) return;
    await updateDevice(device.device_id, { room: room || null });
  };

  const handleDelete = async (device) => {
    if (!window.confirm(`Delete ${device.device_name}? Rules, telemetry, and scene actions for it will also be removed.`)) return;
    await deleteDevice(device.device_id);
  };

  const provisionItems = provisioningLog.map((item) => ({
    time: new Date(item.id),
    data: item.data,
  }));

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Devices</h3>
              <span>Manual control uses your backend command route</span>
            </div>
          </div>
          <div className="device-grid">
            {!devices.length ? (
              <div className="empty">Register a device to see live controls</div>
            ) : (
              devices.map((device) => (
                <div key={device.device_id} className="managed-card">
                  <DeviceCard
                    device={device}
                    commands={commandsByDevice[device.device_id] || []}
                    onCommand={sendCommand}
                  />
                  <div className="card-actions">
                    <button className="btn secondary" type="button" onClick={() => handleRename(device)}>
                      <LucideIcon name="Pencil" />
                      <span>Rename</span>
                    </button>
                    <button className="btn secondary" type="button" onClick={() => handleMove(device)}>
                      <LucideIcon name="MapPin" />
                      <span>Room</span>
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleDelete(device)}>
                      <LucideIcon name="Trash2" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Add Device</h3>
              <span>Creates UID and token from backend</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="deviceName">Name</label>
              <input
                id="deviceName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="deviceType">Type</label>
              <select
                id="deviceType"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                {DEVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="deviceRoom">Room</label>
              <input id="deviceRoom" value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="Plus" />
                <span>Register Device</span>
              </button>
            </div>
          </form>
          <div className="event-log compact">
            {provisionItems.length ? (
              provisionItems.map((item, i) => (
                <div key={i} className="event-item">
                  <strong>Device credentials</strong>
                  <code>{JSON.stringify(item.data, null, 2)}</code>
                </div>
              ))
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

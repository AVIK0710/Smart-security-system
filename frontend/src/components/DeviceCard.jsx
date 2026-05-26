import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "./LucideIcon.jsx";

export default function DeviceCard({ device }) {
  const { sendCommand } = useApp();

  return (
    <article className="device-card">
      <div className="device-head">
        <div>
          <h3>{device.device_name}</h3>
          <span>
            {device.device_type} • {device.room || "Unassigned"}
          </span>
        </div>
        <span className={device.is_online ? "status online" : "status offline"}>
          {device.is_online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="device-state">
        <LucideIcon name={device.state === "ON" ? "Power" : "PowerOff"} />
        <strong>{device.state || "OFF"}</strong>
      </div>

      <div className="row">
        <button
          className="btn"
          onClick={() => sendCommand(device.device_id, "TURN_ON")}
        >
          ON
        </button>
        <button
          className="btn secondary"
          onClick={() => sendCommand(device.device_id, "TURN_OFF")}
        >
          OFF
        </button>
      </div>
    </article>
  );
}

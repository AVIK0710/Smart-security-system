import { deviceImage } from "../utils/helpers.js";

export default function DeviceCard({ device, onCommand }) {
  return (
    <article className="device-card">
      <img alt={device.device_name} src={deviceImage(device)} />
      <div className="device-info">
        <h4>{device.device_name}</h4>
        <div className="device-actions">
          <button
            type="button"
            className="toggle-btn on"
            onClick={() => onCommand(device.device_id, "TURN_ON")}
          >
            ON
          </button>
          <button
            type="button"
            className="toggle-btn off"
            onClick={() => onCommand(device.device_id, "TURN_OFF")}
          >
            OFF
          </button>
        </div>
        <div className="device-health">
          <span className="green-dot" />
          {device.is_online ? "Good" : "Offline"}
          {device.room ? ` - ${device.room}` : ""}
        </div>
      </div>
    </article>
  );
}

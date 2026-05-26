import { useApp } from "../context/AppContext.jsx";

export default function EnergyView() {
  const {
    devices,
    telemetryDeviceId,
    setTelemetryDeviceId,
    tempCanvasRef,
    humidityCanvasRef,
    motionEvents,
  } = useApp();

  return (
    <section className="view active">
      <section className="panel pad">
        <h3>Telemetry Graphs</h3>

        <div className="field">
          <label>Device</label>
          <select
            value={telemetryDeviceId}
            onChange={(e) => setTelemetryDeviceId(e.target.value)}
          >
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.device_name} ({device.device_type})
              </option>
            ))}
          </select>
        </div>

        <div className="chart-box">
          <canvas ref={tempCanvasRef}></canvas>
        </div>

        <div className="chart-box">
          <canvas ref={humidityCanvasRef}></canvas>
        </div>
      </section>

      <section className="panel pad">
        <h3>Motion Timeline</h3>
        <div className="event-log">
          {!motionEvents.length ? (
            <div className="empty">No motion events yet.</div>
          ) : (
            motionEvents.map((item, index) => (
              <div key={index} className="event-item">
                <strong>{new Date(item.created_at).toLocaleString()}</strong>
                <code>Motion detected by device #{item.device_id}</code>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

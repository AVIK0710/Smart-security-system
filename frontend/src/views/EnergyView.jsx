import { useApp } from "../context/AppContext.jsx";

export default function EnergyView() {
  const { metrics, devices, telemetryDeviceId, setTelemetryDeviceId, tempCanvasRef, humidityCanvasRef } =
    useApp();

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Energy</h3>
              <span>Smart estimate from active devices</span>
            </div>
          </div>
          <div className="management-grid">
            <div className="info-card">
              <h4>Current Load</h4>
              <p>{metrics.energyLoad}</p>
            </div>
            <div className="info-card">
              <h4>Eco Tip</h4>
              <p>Turn off inactive plugs, fans, and AC units from the dashboard.</p>
            </div>
            <div className="info-card">
              <h4>Automation</h4>
              <p>Create a scene to switch off non-essential devices at night.</p>
            </div>
          </div>
        </section>
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Telemetry</h3>
              <span>Temperature and humidity history</span>
            </div>
            <select
              id="telemetryDeviceSelect"
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
          <div className="chart-wrap">
            <canvas ref={tempCanvasRef} id="temperatureChart" />
          </div>
          <div className="chart-wrap">
            <canvas ref={humidityCanvasRef} id="humidityChart" />
          </div>
        </section>
      </div>
    </section>
  );
}

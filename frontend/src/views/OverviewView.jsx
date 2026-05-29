import { useApp } from "../context/AppContext.jsx";
import DeviceCard from "../components/DeviceCard.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { deviceIcon, roomIcon } from "../utils/helpers.js";
import { useState } from "react";

const ENERGY_POINTS = [
  1.1, 1.7, 1.8, 2.5, 2.1, 1.5, 2.4, 2.0, 2.6, 1.7, 3.3, 2.1, 3.0,
];

const ENERGY_TIMES = [
  "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00",
  "14:00", "16:00", "18:00", "20:00", "22:00", "24:00",
];

export default function OverviewView() {
  const {
    devices,
    rules,
    scenes,
    events,
    roomEntries,
    commandsByDevice,
    metrics,
    switchView,
    startVoice,
    runScene,
    sendCommand,
  } = useApp();
  const [chartPoint, setChartPoint] = useState({
    index: 6,
    x: 50,
    value: ENERGY_POINTS[6],
    time: ENERGY_TIMES[6],
  });
  const activeAutomations = rules.filter((rule) => rule.is_active).length + scenes.length;
  const topDevices = devices.slice(0, 4);
  const topRooms = roomEntries.slice(0, 4);
  const recentEvents = events.slice(0, 3);

  const quickActions = [
    ["Moon", "Good Night", scenes[0]?.scene_id],
    ["Plane", "Away Mode", scenes[1]?.scene_id],
    ["Clapperboard", "Movie Time", scenes[2]?.scene_id],
    ["Sun", "Morning Lights", scenes[3]?.scene_id],
  ];

  const resetChartPoint = () => {
    setChartPoint({
      index: 6,
      x: 50,
      value: ENERGY_POINTS[6],
      time: ENERGY_TIMES[6],
    });
  };

  const handleChartPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const index = Math.round(ratio * (ENERGY_POINTS.length - 1));
    setChartPoint({
      index,
      x: (index / (ENERGY_POINTS.length - 1)) * 100,
      value: ENERGY_POINTS[index],
      time: ENERGY_TIMES[index],
    });
  };

  return (
    <section className="view active">
      <div className="dashboard-home">
        <div className="room-summary-row">
          {topRooms.length ? topRooms.map(([room, roomDevices], index) => (
            <article className="room-summary-card" key={room}>
              <div className="summary-icon">
                <LucideIcon name={roomIcon(room)} />
              </div>
              <div>
                <h3>{room}</h3>
                <span>{roomDevices.length} Device{roomDevices.length === 1 ? "" : "s"}</span>
                <small><i /> All Online</small>
              </div>
              <strong>{22 + ((roomDevices.length + index) % 4)}&deg;C</strong>
              <svg className="sparkline" viewBox="0 0 110 34" aria-hidden="true">
                <path d="M2 24 C18 16, 25 20, 37 18 S58 9, 70 16 87 25 108 8" />
              </svg>
            </article>
          )) : (
            <div className="empty">Register devices to build room summaries</div>
          )}
        </div>

        <div className="dashboard-columns">
          <div className="dashboard-main-col">
            <section className="panel dashboard-card">
              <div className="section-head">
                <h3>Top Devices</h3>
                <button className="link-btn" type="button" onClick={() => switchView("devices")}>View all</button>
              </div>
              <div className="dashboard-device-grid featured-devices">
                {!topDevices.length ? (
                  <div className="empty">Register a device to see live controls</div>
                ) : (
                  topDevices.map((device) => (
                    <DeviceCard
                      key={device.device_id}
                      device={device}
                      commands={commandsByDevice[device.device_id] || []}
                      onCommand={sendCommand}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="panel metric-strip">
              <div className="metric-tile">
                <LucideIcon name="LayoutDashboard" />
                <strong>{metrics.total}</strong>
                <span>Total Devices</span>
                <small>2 this week</small>
              </div>
              <div className="metric-tile">
                <LucideIcon name="Wifi" />
                <strong>{metrics.online}</strong>
                <span>Online</span>
                <small>1 this week</small>
              </div>
              <div className="metric-tile">
                <LucideIcon name="WifiOff" />
                <strong>{metrics.offline}</strong>
                <span>Offline</span>
                <small>1 this week</small>
              </div>
              <div className="metric-tile">
                <LucideIcon name="ShieldCheck" />
                <strong>{metrics.alerts}</strong>
                <span>Alerts</span>
                <small>No new alerts</small>
              </div>
            </section>

            <section className="panel energy-overview-card">
              <div className="section-head">
                <div className="energy-title">
                  <LucideIcon name="Zap" />
                  <div>
                    <h3>Energy Overview</h3>
                    <span>Live usage from all devices</span>
                  </div>
                </div>
                <button className="btn secondary" type="button" onClick={() => switchView("energy")}>Today</button>
              </div>
              <div className="energy-body">
                <div className="energy-copy">
                  <span>Today's Usage</span>
                  <strong>12.4 <small>kWh</small></strong>
                  <em>8% vs yesterday</em>
                  <span>This Month</span>
                  <strong>286 <small>kWh</small></strong>
                  <em>12% vs last month</em>
                  <button className="btn secondary" type="button" onClick={() => switchView("energy")}>View Detailed Report</button>
                </div>
                <div
                  className="energy-chart"
                  onPointerMove={handleChartPointer}
                  onPointerLeave={resetChartPoint}
                >
                  <span className="chart-cursor" style={{ left: `${chartPoint.x}%` }} />
                  <span className="chart-badge" style={{ left: `${chartPoint.x}%` }}>
                    {chartPoint.time}<br /><strong>{chartPoint.value.toFixed(1)} kWh</strong>
                  </span>
                  <svg viewBox="0 0 620 210">
                    <defs>
                      <linearGradient id="energyFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2563ff" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#2563ff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path className="chart-fill" d="M0 160 C35 130 55 128 88 135 S145 75 188 95 250 160 296 112 345 128 376 104 430 174 465 98 528 150 620 96 V210 H0 Z" />
                    <path className="chart-line" d="M0 160 C35 130 55 128 88 135 S145 75 188 95 250 160 296 112 345 128 376 104 430 174 465 98 528 150 620 96" />
                  </svg>
                </div>
              </div>
            </section>

            <section className="panel automation-status-card">
              <div className="energy-title">
                <LucideIcon name="Workflow" />
                <div>
                  <h3>Automation Status</h3>
                  <span>Your smart home is running smoothly</span>
                </div>
              </div>
              <div className="automation-count">
                <span>Active Automations</span>
                <strong>{activeAutomations}</strong>
              </div>
            </section>
          </div>

          <aside className="dashboard-side-col">
            <section className="panel live-camera-card">
              <div className="section-head">
                <h3>Live Feed</h3>
                <button className="link-btn" type="button" onClick={() => switchView("security")}>View all</button>
              </div>
              <div className="camera-frame">
                <img alt="" src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80" />
                <span>LIVE</span>
                <button type="button" aria-label="Play live feed"><LucideIcon name="Play" /></button>
              </div>
              <div className="camera-caption">
                <span className="green-dot" /> Living Room Camera <small>Live</small>
              </div>
            </section>

            <section className="panel quick-actions-card">
              <h3>Quick Actions</h3>
              <div className="quick-actions-grid">
                {quickActions.map(([icon, label, sceneId]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (sceneId ? runScene(sceneId) : startVoice())}
                  >
                    <LucideIcon name={icon} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel recent-activity-card">
              <div className="section-head">
                <h3>Recent Activity</h3>
                <button className="link-btn" type="button" onClick={() => switchView("settings")}>View all</button>
              </div>
              <div className="activity-list">
                {recentEvents.length ? recentEvents.map((item, index) => (
                  <article key={`${item.time}-${index}`} className="activity-row">
                    <LucideIcon name={deviceIcon(item.data || {}) || "Bell"} />
                    <div>
                      <strong>{item.data?.message || item.data?.event || "Activity"}</strong>
                      <span>{item.data?.room || "Smart Home"} - {new Date(item.time).toLocaleTimeString()}</span>
                    </div>
                    <i />
                  </article>
                )) : (
                  <div className="empty">No recent activity</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

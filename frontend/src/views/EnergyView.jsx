import { useMemo, useState } from "react";
import LucideIcon from "../components/LucideIcon.jsx";

const RANGE_TABS = ["Today", "Week", "Month", "Year"];
const CHART_POINTS = [4.6, 6.2, 8.4, 7.2, 4.8, 5.4, 9.2, 8.0, 6.8, 11.5, 12.4, 9.6, 7.4, 11.2, 15.8, 9.0, 13.1, 16.2, 12.6, 9.7];
const USAGE_BREAKDOWN = [
  { label: "Lights", value: 40, color: "#1764ff", className: "lights" },
  { label: "AC", value: 30, color: "#2ec77e", className: "ac" },
  { label: "Appliances", value: 20, color: "#8057ff", className: "appliances" },
  { label: "Others", value: 10, color: "#aeb7c4", className: "others" },
];

function linePath(points) {
  return points.map((value, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 100 - (value / 20) * 100;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function areaPath(points) {
  return `${linePath(points)} L 100 100 L 0 100 Z`;
}

export default function EnergyView() {
  const [activeRange, setActiveRange] = useState("Today");
  const [hoverIndex, setHoverIndex] = useState(10);

  const donutStops = useMemo(() => {
    let start = 0;
    return USAGE_BREAKDOWN.map((item) => {
      const end = start + item.value;
      const stop = `${item.color} ${start}% ${end}%`;
      start = end;
      return stop;
    }).join(", ");
  }, []);

  const activePoint = CHART_POINTS[hoverIndex] ?? CHART_POINTS[10];
  const activeX = (hoverIndex / (CHART_POINTS.length - 1)) * 100;
  const activeY = 100 - (activePoint / 20) * 100;
  const activeHour = Math.round((hoverIndex / (CHART_POINTS.length - 1)) * 24);
  const tooltipTime = `${String(activeHour).padStart(2, "0")}:00`;

  const handleChartPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const nextIndex = Math.round((x / rect.width) * (CHART_POINTS.length - 1));
    setHoverIndex(nextIndex);
  };

  return (
    <section className="view active energy-reference-page energy-with-shared-nav">
      <div className="energy-stat-grid">
        <article className="energy-stat-card">
          <div className="energy-stat-icon blue"><LucideIcon name="Zap" /></div>
          <div>
            <span>Current Usage</span>
            <strong>12.4 <small>kWh</small></strong>
            <em className="blue">8% vs yesterday</em>
          </div>
        </article>
        <article className="energy-stat-card">
          <div className="energy-stat-icon green"><LucideIcon name="ShieldCheck" /></div>
          <div>
            <span>Daily Average</span>
            <strong>86.7 <small>kWh</small></strong>
            <em className="green">5% vs yesterday</em>
          </div>
        </article>
        <article className="energy-stat-card">
          <div className="energy-stat-icon blue"><LucideIcon name="CalendarDays" /></div>
          <div>
            <span>This Month</span>
            <strong>286 <small>kWh</small></strong>
            <em className="green">12% vs last month</em>
          </div>
        </article>
        <article className="energy-stat-card">
          <div className="energy-stat-icon amber"><LucideIcon name="Workflow" /></div>
          <div>
            <span>Estimated Bill</span>
            <strong>Rs 1,286</strong>
            <em className="red">8% vs last month</em>
          </div>
        </article>
      </div>

      <div className="energy-dashboard-grid">
        <section className="energy-usage-card">
          <div className="energy-card-head energy-card-head-stacked">
            <h3>Energy Usage</h3>
            <div className="energy-range-tabs">
              {RANGE_TABS.map((range) => (
                <button
                  className={activeRange === range ? "active" : ""}
                  type="button"
                  key={range}
                  onClick={() => setActiveRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div
            className="energy-line-chart"
            onMouseMove={handleChartPointer}
            onMouseLeave={() => setHoverIndex(10)}
          >
            <span className="energy-axis-label">kWh</span>
            <div
              className="energy-tooltip"
              style={{ left: `${Math.min(Math.max(activeX, 12), 88)}%` }}
            >
              <small>{tooltipTime}</small>
              <strong>{activePoint.toFixed(1)} kWh</strong>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="energyLineFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1764ff" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#1764ff" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path className="energy-line-area" d={areaPath(CHART_POINTS)} />
              <path className="energy-line-path" d={linePath(CHART_POINTS)} />
              {CHART_POINTS.map((value, index) => (
                <circle
                  key={`${value}-${index}`}
                  cx={(index / (CHART_POINTS.length - 1)) * 100}
                  cy={100 - (value / 20) * 100}
                  r={index === hoverIndex ? "1.35" : "0.8"}
                />
              ))}
              <line className="energy-chart-marker" x1={activeX} x2={activeX} y1={activeY} y2="100" />
            </svg>
            <div className="energy-y-axis">
              <span>20</span>
              <span>15</span>
              <span>10</span>
              <span>5</span>
              <span>0</span>
            </div>
            <div className="energy-x-axis">
              <span>00:00</span>
              <span>04:00</span>
              <span>08:00</span>
              <span>12:00</span>
              <span>16:00</span>
              <span>20:00</span>
              <span>24:00</span>
            </div>
          </div>
        </section>

        <section className="energy-device-card">
          <h3>Usage by Devices</h3>
          <div className="energy-donut-layout">
            <div className="energy-donut" style={{ "--donut-stops": donutStops }}>
              <div>
                <strong>286</strong>
                <span>kWh</span>
              </div>
            </div>
            <div className="energy-donut-legend">
              {USAGE_BREAKDOWN.map((item) => (
                <div key={item.label}>
                  <span className={item.className} />
                  <p>{item.label}</p>
                  <strong>{item.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

    </section>
  );
}

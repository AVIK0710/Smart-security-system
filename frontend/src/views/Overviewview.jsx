import DeviceCard from "../components/DeviceCard.jsx";
import EventList from "../components/EventList.jsx";
import RoomCard from "../components/RoomCard.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function OverviewView() {
  const { metrics, devices, roomEntries, events } = useApp();

  return (
    <section className="view active">
      <div className="hero panel pad">
        <div>
          <h2>{metrics.safeStatusTitle}</h2>
          <p>{metrics.safeStatusText}</p>
        </div>
        <div className="metric-row">
          <div>
            <strong>{metrics.total}</strong>
            <span>Total Devices</span>
          </div>
          <div>
            <strong>{metrics.online}</strong>
            <span>Online</span>
          </div>
          <div>
            <strong>{metrics.alerts}</strong>
            <span>Alerts</span>
          </div>
        </div>
      </div>

      <div className="grid two">
        <section className="panel pad">
          <h3>Devices</h3>
          <div className="card-grid">
            {devices.slice(0, 4).map((device) => (
              <DeviceCard key={device.device_id} device={device} />
            ))}
          </div>
        </section>

        <section className="panel pad">
          <h3>Rooms</h3>
          <div className="card-grid">
            {roomEntries.map(([room, roomDevices]) => (
              <RoomCard key={room} room={room} devices={roomDevices} />
            ))}
          </div>
        </section>
      </div>

      <section className="panel pad">
        <h3>Live Events</h3>
        <EventList items={events} />
      </section>
    </section>
  );
}

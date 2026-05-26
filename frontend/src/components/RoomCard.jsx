export default function RoomCard({ room, devices }) {
  return (
    <article className="room-card">
      <h3>{room}</h3>
      <p>
        {devices.length} device{devices.length === 1 ? "" : "s"}
      </p>

      <div className="room-devices">
        {devices.map((device) => (
          <div key={device.device_id} className="room-device">
            <span>{device.device_name}</span>
            <strong>{device.state}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

import { useApp } from "../context/AppContext.jsx";
import RoomCard from "../components/RoomCard.jsx";

export default function RoomsView() {
  const { roomEntries } = useApp();

  return (
    <section className="view active">
      <section className="panel pad">
        <div className="section-head">
          <div>
            <h3>Rooms</h3>
            <span>Live room status from your backend dashboard</span>
          </div>
        </div>
        <div className="room-grid">
          {!roomEntries.length ? (
            <div className="empty">
              Register a device with a room to build your dashboard
            </div>
          ) : (
            roomEntries.map(([room, roomDevices], index) => (
              <RoomCard
                key={room}
                room={room}
                count={roomDevices.length}
                active={index === 0}
              />
            ))
          )}
        </div>
      </section>
    </section>
  );
}

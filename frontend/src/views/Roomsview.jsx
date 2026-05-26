import RoomCard from "../components/RoomCard.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function RoomsView() {
  const { roomEntries } = useApp();

  return (
    <section className="view active">
      <section className="panel pad">
        <h3>Rooms</h3>
        <div className="card-grid">
          {roomEntries.map(([room, devices]) => (
            <RoomCard key={room} room={room} devices={devices} />
          ))}
        </div>
      </section>
    </section>
  );
}

import { roomImage } from "../utils/helpers.js";

export default function RoomCard({ room, count, active }) {
  return (
    <article className={`room-card${active ? " active" : ""}`}>
      <img alt={room} src={roomImage(room)} />
      <h4>{room}</h4>
      <div>
        <span className="green-dot" />
        {count} Device{count === 1 ? "" : "s"}
      </div>
    </article>
  );
}

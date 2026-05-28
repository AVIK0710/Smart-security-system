import { roomIcon } from "../utils/helpers.js";
import LucideIcon from "./LucideIcon.jsx";

export default function RoomCard({ room, count, active }) {
  return (
    <article className={`room-card${active ? " active" : ""}`}>
      <div className="room-icon" aria-hidden="true">
        <LucideIcon name={roomIcon(room)} size={42} />
      </div>
      <h4>{room}</h4>
      <div>
        <span className="green-dot" />
        {count} Device{count === 1 ? "" : "s"}
      </div>
    </article>
  );
}

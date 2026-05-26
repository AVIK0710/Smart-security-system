export default function EventList({ items, emptyText = "No events yet" }) {
  if (!items.length) {
    return <div className="empty">{emptyText}</div>;
  }

  return (
    <div className="event-log">
      {items.map((item, index) => (
        <div key={index} className="event-item">
          <strong>
            {new Date(
              item.time || item.created_at || Date.now(),
            ).toLocaleString()}
          </strong>
          <code>{JSON.stringify(item.data || item, null, 2)}</code>
        </div>
      ))}
    </div>
  );
}

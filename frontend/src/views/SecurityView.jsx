import { useEffect, useMemo, useState } from "react";
import EventList from "../components/EventList.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { useApp } from "../context/AppContext.jsx";
import { cameraStreamUrl, snapshotUrl } from "../api/security.js";
import { readImageAsDataUrl, PERSON_ROLES } from "../utils/helpers.js";

export default function SecurityView() {
  const {
    token,
    devices,
    events,
    knownPeople,
    addKnownPerson,
    removeKnownPerson,
    motionEvents,
    telemetryDeviceId,
    setTelemetryDeviceId,
    securityEvents,
    notifications,
    loadSecurityEvents,
    loadNotifications,
    refreshAll,
  } = useApp();

  const [cameraId, setCameraId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState(PERSON_ROLES[0]);
  const [personAccess, setPersonAccess] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const cameras = useMemo(
    () => devices.filter((d) => d.device_type === "camera"),
    [devices],
  );

  useEffect(() => {
    if (!cameraId && cameras.length) setCameraId(String(cameras[0].device_id));
  }, [cameraId, cameras]);

  const intruderEvents = useMemo(
    () =>
      events.filter(
        (item) =>
          item.data?.event === "intruder_alert" ||
          item.data?.event === "camera_frame_received",
      ),
    [events],
  );

  async function handleKnownPerson(event) {
    event.preventDefault();

    const image = await readImageAsDataUrl(imageFile);

    addKnownPerson({
      id: `${Date.now()}`,
      name: personName,
      role: personRole,
      access: personAccess,
      image,
    });

    setPersonName("");
    setPersonRole(PERSON_ROLES[0]);
    setPersonAccess("");
    setImageFile(null);
  }

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad security-hero">
          <div className="section-head">
            <div>
              <h3>Intruder Alert Center</h3>
              <span>
                Live camera, alerts, notifications, and access records
              </span>
            </div>

            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                refreshAll();
                loadSecurityEvents();
                loadNotifications();
              }}
            >
              <LucideIcon name="RefreshCw" />
              <span>Refresh</span>
            </button>
          </div>

          {!cameras.length ? (
            <div className="empty">
              Register a camera device first from Devices page.
            </div>
          ) : (
            <>
              <div className="field">
                <label>Camera</label>
                <select
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                >
                  {cameras.map((camera) => (
                    <option key={camera.device_id} value={camera.device_id}>
                      {camera.device_name} - {camera.room || "Unassigned"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="camera-frame">
                {cameraId ? (
                  <img
                    alt="Live camera stream"
                    src={cameraStreamUrl(cameraId, token)}
                  />
                ) : (
                  <div className="empty">Select camera to view live feed</div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="panel pad">
          <h3>Live Security Alerts</h3>
          <EventList
            items={intruderEvents}
            emptyText="No live security alerts yet"
          />
        </section>

        <section className="panel pad">
          <h3>Security Event History</h3>
          <div className="event-log">
            {!securityEvents.length ? (
              <div className="empty">No security events stored yet</div>
            ) : (
              securityEvents.map((event) => (
                <div key={event.id} className="event-item security-event-item">
                  <strong>
                    {event.event_type} -{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </strong>
                  <code>
                    Camera ID: {event.camera_device_id}
                    {"\n"}Person: {event.person_label || "Unknown"}
                    {"\n"}Confidence: {event.confidence || "N/A"}
                    {"\n"}Threat Score: {event.threat_score || "N/A"}
                    {"\n"}Message: {event.message || "No message"}
                  </code>

                  {event.snapshot_path ? (
                    <a
                      className="btn secondary"
                      href={snapshotUrl(event.id, token)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Snapshot
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <h3>Notification History</h3>
          <div className="event-log">
            {!notifications.length ? (
              <div className="empty">No notifications stored yet</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="event-item">
                  <strong>
                    {n.notification_type} - {n.status}
                  </strong>
                  <code>
                    {n.title}
                    {"\n"}
                    {n.message}
                    {"\n"}Created: {new Date(n.created_at).toLocaleString()}
                    {"\n"}Sent: {n.sent_at || "Not sent"}
                  </code>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <h3>Known People</h3>

          <form className="form-grid" onSubmit={handleKnownPerson}>
            <div className="field">
              <label>Name</label>
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Role</label>
              <select
                value={personRole}
                onChange={(e) => setPersonRole(e.target.value)}
              >
                {PERSON_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Access</label>
              <input
                value={personAccess}
                onChange={(e) => setPersonAccess(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Face Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
            </div>

            <button className="btn" type="submit">
              Add Person
            </button>
          </form>

          <div className="known-grid">
            {!knownPeople.length ? (
              <div className="empty">No known people added yet.</div>
            ) : (
              knownPeople.map((person) => (
                <article key={person.id} className="known-card">
                  <div className="known-avatar">
                    {person.image ? (
                      <img src={person.image} alt={person.name} />
                    ) : (
                      <LucideIcon name="UserRound" />
                    )}
                  </div>
                  <div>
                    <h4>{person.name}</h4>
                    <span>
                      {person.role} - {person.access || "Whole home"}
                    </span>
                  </div>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => removeKnownPerson(person.id)}
                  >
                    Remove
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <h3>Motion Timeline</h3>

          <div className="field">
            <label>Telemetry Device</label>
            <select
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

          <div className="event-log">
            {!motionEvents.length ? (
              <div className="empty">No motion events for selected device</div>
            ) : (
              motionEvents.map((item, index) => (
                <div key={index} className="event-item">
                  <strong>{new Date(item.created_at).toLocaleString()}</strong>
                  <code>Motion detected by device #{item.device_id}</code>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { PERSON_ROLES, readImageAsDataUrl } from "../utils/helpers.js";

export default function SecurityView() {
  const { knownPeople, addKnownPerson, removeKnownPerson, motionEvents } = useApp();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Owner");
  const [access, setAccess] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const image = await readImageAsDataUrl(imageFile);
    addKnownPerson({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      role,
      access: access.trim(),
      image,
      created_at: new Date().toISOString(),
    });
    setName("");
    setAccess("");
    setRole("Owner");
    setImageFile(null);
    e.target.reset();
  };

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Security</h3>
              <span>Live safety and motion status</span>
            </div>
          </div>
          <div className="safe-card">
            <LucideIcon name="ShieldCheck" size={58} />
            <div>
              <strong>Protected</strong>
              <p>Motion events, rules, and device status are monitored.</p>
            </div>
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Known Faces & Owners</h3>
              <span>Add trusted people for security records</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="personName">Name</label>
              <input
                id="personName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="personRole">Access Type</label>
              <select id="personRole" value={role} onChange={(e) => setRole(e.target.value)}>
                {PERSON_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="personAccess">Access Area</label>
              <input
                id="personAccess"
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="personImage">Face Image</label>
              <input
                id="personImage"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="UserRoundPlus" />
                <span>Add Person</span>
              </button>
            </div>
          </form>
          <div className="known-grid">
            {!knownPeople.length ? (
              <div className="empty">
                Add owners, family members, guests, or blocked faces
              </div>
            ) : (
              knownPeople.map((person) => (
                <article key={person.id} className="known-card">
                  <div className="known-avatar">
                    {person.image ? (
                      <img alt={person.name} src={person.image} />
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
                    className="btn secondary icon"
                    type="button"
                    title="Remove"
                    onClick={() => removeKnownPerson(person.id)}
                  >
                    <LucideIcon name="Trash2" />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Motion Timeline</h3>
              <span>Detected from telemetry events</span>
            </div>
          </div>
          <div className="event-log">
            {!motionEvents.length ? (
              <div className="empty">No motion events for selected device</div>
            ) : (
              motionEvents.map((item, i) => (
                <div key={i} className="event-item">
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

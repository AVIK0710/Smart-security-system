import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import DeviceCard from "../components/DeviceCard.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { DEVICE_TYPES, normalizeText, roomIcon, roomImage } from "../utils/helpers.js";

const ROOMS_KEY = "smart_home_custom_rooms";

function loadCustomRooms() {
  try {
    const items = JSON.parse(localStorage.getItem(ROOMS_KEY) || "[]");
    return Array.isArray(items) ? items.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function RoomsView() {
  const {
    roomEntries,
    devices,
    commandsByDevice,
    sendCommand,
    registerDevice,
    updateDevice,
    deleteDevice,
  } = useApp();
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState("grid");
  const [customRooms, setCustomRooms] = useState(loadCustomRooms);
  const [showForm, setShowForm] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [detailsDeviceId, setDetailsDeviceId] = useState("");
  const [editingDeviceId, setEditingDeviceId] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("light");
  const [editRoom, setEditRoom] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceType, setNewDeviceType] = useState("light");

  const rooms = useMemo(() => {
    const roomsByName = new Map();

    roomEntries.forEach(([room, roomDevices]) => {
      const online = roomDevices.filter((device) => device.is_online).length;
      roomsByName.set(normalizeText(room), {
        name: room,
        count: roomDevices.length,
        online,
        source: "devices",
      });
    });

    customRooms.forEach((room) => {
      const key = normalizeText(room);
      if (!roomsByName.has(key)) {
        roomsByName.set(key, {
          name: room,
          count: 0,
          online: 0,
          source: "custom",
        });
      }
    });

    return Array.from(roomsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roomEntries, customRooms]);

  const filteredRooms = rooms.filter((room) =>
    normalizeText(room.name).includes(normalizeText(search)),
  );

  const activeRoom = selectedRoom && rooms.find(
    (room) => normalizeText(room.name) === normalizeText(selectedRoom),
  );

  const activeRoomDevices = activeRoom
    ? devices.filter((device) => normalizeText(device.room || "Unassigned") === normalizeText(activeRoom.name))
    : [];

  const detailsDevice = activeRoomDevices.find(
    (device) => String(device.device_id) === String(detailsDeviceId),
  );

  const canDeleteRoom = (room) => normalizeText(room.name) !== "unassigned";

  const saveCustomRooms = (nextRooms) => {
    setCustomRooms(nextRooms);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(nextRooms));
  };

  const handleAddRoom = (event) => {
    event.preventDefault();
    const nextRoom = roomName.trim();
    if (!nextRoom) return;

    const exists = rooms.some((room) => normalizeText(room.name) === normalizeText(nextRoom));
    if (!exists) {
      const nextRooms = [...customRooms, nextRoom];
      saveCustomRooms(nextRooms);
    }

    setSelectedRoom(nextRoom);
    setRoomName("");
    setShowForm(false);
  };

  const handleAddDevice = async (event) => {
    event.preventDefault();
    if (!activeRoom || !newDeviceName.trim()) return;

    await registerDevice({
      name: newDeviceName.trim(),
      device_type: newDeviceType,
      room: activeRoom.name,
    });
    setNewDeviceName("");
    setNewDeviceType("light");
  };

  const handleStartEdit = (device) => {
    setDetailsDeviceId("");
    setEditingDeviceId(String(device.device_id));
    setEditName(device.device_name);
    setEditType(device.device_type);
    setEditRoom(device.room || activeRoom?.name || "");
  };

  const handleSaveDevice = async (event) => {
    event.preventDefault();
    if (!editingDeviceId || !editName.trim()) return;

    await updateDevice(Number(editingDeviceId), {
      name: editName.trim(),
      device_type: editType,
      room: editRoom.trim() || null,
    });
    setEditingDeviceId("");
  };

  const handleDeleteDevice = async (device) => {
    if (!window.confirm(`Delete ${device.device_name}? Rules, telemetry, and scene actions for it will also be removed.`)) return;
    await deleteDevice(device.device_id);
    if (detailsDeviceId === String(device.device_id)) setDetailsDeviceId("");
    if (editingDeviceId === String(device.device_id)) setEditingDeviceId("");
  };

  const handleDeleteRoom = async (room) => {
    const roomDevices = devices.filter(
      (device) => normalizeText(device.room || "Unassigned") === normalizeText(room.name),
    );
    const message = roomDevices.length
      ? `Delete ${room.name}? ${roomDevices.length} device${roomDevices.length === 1 ? "" : "s"} will be moved to Unassigned.`
      : `Delete ${room.name}?`;

    if (!window.confirm(message)) return;

    const nextRooms = customRooms.filter(
      (item) => normalizeText(item) !== normalizeText(room.name),
    );
    saveCustomRooms(nextRooms);

    for (const device of roomDevices) {
      await updateDevice(device.device_id, { room: null });
    }

    setSelectedRoom("");
    setDetailsDeviceId("");
    setEditingDeviceId("");
  };

  return (
    <section className="view active rooms-page">
      <div className="rooms-actions">
        <label className="rooms-search" aria-label="Search rooms">
          <LucideIcon name="Search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rooms..."
            type="search"
          />
        </label>
        <div className="rooms-view-toggle" aria-label="Room view mode">
          <button
            className={layout === "grid" ? "active" : ""}
            type="button"
            title="Grid view"
            onClick={() => setLayout("grid")}
          >
            <LucideIcon name="LayoutDashboard" />
          </button>
          <button
            className={layout === "list" ? "active" : ""}
            type="button"
            title="List view"
            onClick={() => setLayout("list")}
          >
            <LucideIcon name="List" />
          </button>
        </div>
        <button className="btn rooms-add" type="button" onClick={() => setShowForm((value) => !value)}>
          <LucideIcon name="Plus" />
          <span>Add Room</span>
        </button>
      </div>

      {showForm ? (
        <form className="rooms-add-form" onSubmit={handleAddRoom}>
          <div className="field">
            <label htmlFor="newRoomName">Room name</label>
            <input
              id="newRoomName"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Study Room"
              required
            />
          </div>
          <button className="btn" type="submit">
            <LucideIcon name="Save" />
            <span>Save Room</span>
          </button>
          <button className="btn secondary" type="button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      <div className={`rooms-gallery ${layout}`}>
        {filteredRooms.length ? filteredRooms.map((room) => (
          <article className="rooms-gallery-card" key={room.name}>
            <div className="rooms-gallery-photo">
              <img src={roomImage(room.name)} alt="" />
              <div className="rooms-gallery-icon">
                <LucideIcon name={roomIcon(room.name)} />
              </div>
            </div>
            <div className="rooms-gallery-body">
              <div>
                <h3>{room.name}</h3>
                <span><LucideIcon name="PanelTop" /> {room.count} Device{room.count === 1 ? "" : "s"}</span>
                <small>
                  <i className={room.count > 0 && room.online === 0 ? "offline" : ""} />
                  {room.count === 0
                    ? "No devices assigned"
                    : room.online === room.count
                    ? "All Online"
                    : `${room.online} Online`}
                </small>
              </div>
              <strong>{room.count}</strong>
            </div>
            <div className="rooms-card-actions">
              <button className="btn secondary" type="button" onClick={() => setSelectedRoom(room.name)}>
                <LucideIcon name="Eye" />
                <span>Manage</span>
              </button>
              {canDeleteRoom(room) ? (
                <button className="btn danger" type="button" onClick={() => handleDeleteRoom(room)}>
                  <LucideIcon name="Trash2" />
                  <span>Delete Room</span>
                </button>
              ) : null}
            </div>
          </article>
        )) : (
          <div className="empty">
            {search ? "No rooms match your search" : "Add a room or assign devices to rooms"}
          </div>
        )}
      </div>

      {activeRoom ? (
        <section className="panel pad room-manager">
          <div className="section-head">
            <div>
              <h3>{activeRoom.name}</h3>
              <span>{activeRoomDevices.length} device{activeRoomDevices.length === 1 ? "" : "s"} assigned</span>
            </div>
            <div className="card-actions">
              {canDeleteRoom(activeRoom) ? (
                <button className="btn danger" type="button" onClick={() => handleDeleteRoom(activeRoom)}>
                  <LucideIcon name="Trash2" />
                  <span>Delete Room</span>
                </button>
              ) : null}
              <button className="btn secondary" type="button" onClick={() => setSelectedRoom("")}>
                <LucideIcon name="X" />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="room-manager-grid">
            <div className="room-device-list">
              {activeRoomDevices.length ? activeRoomDevices.map((device) => (
                <div className="managed-card" key={device.device_id}>
                  <DeviceCard
                    device={device}
                    commands={commandsByDevice[device.device_id] || []}
                    onCommand={sendCommand}
                  />
                  <div className="card-actions">
                    <button className="btn secondary" type="button" onClick={() => setDetailsDeviceId(String(device.device_id))}>
                      <LucideIcon name="Eye" />
                      <span>View</span>
                    </button>
                    <button className="btn secondary" type="button" onClick={() => handleStartEdit(device)}>
                      <LucideIcon name="Pencil" />
                      <span>Edit</span>
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleDeleteDevice(device)}>
                      <LucideIcon name="Trash2" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )) : (
                <div className="empty">Add a device to this room</div>
              )}
            </div>

            <aside className="room-side-panel">
              {detailsDevice ? (
                <div className="room-device-details">
                  <div className="section-head compact">
                    <div>
                      <h3>{detailsDevice.device_name}</h3>
                      <span>{detailsDevice.device_type}</span>
                    </div>
                    <button className="btn icon secondary" type="button" onClick={() => setDetailsDeviceId("")} title="Close details">
                      <LucideIcon name="X" />
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>State</dt>
                      <dd>{detailsDevice.state}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{detailsDevice.presence_label || (detailsDevice.is_online ? "Online" : "Offline")}</dd>
                    </div>
                    <div>
                      <dt>UID</dt>
                      <dd>{detailsDevice.device_uid}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {editingDeviceId ? (
                <form className="form-grid room-device-form" onSubmit={handleSaveDevice}>
                  <div className="field full">
                    <label htmlFor="editDeviceName">Device name</label>
                    <input
                      id="editDeviceName"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="editDeviceType">Type</label>
                    <select
                      id="editDeviceType"
                      value={editType}
                      onChange={(event) => setEditType(event.target.value)}
                    >
                      {DEVICE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="editDeviceRoom">Room</label>
                    <input
                      id="editDeviceRoom"
                      value={editRoom}
                      onChange={(event) => setEditRoom(event.target.value)}
                    />
                  </div>
                  <div className="field full room-form-actions">
                    <button className="btn" type="submit">
                      <LucideIcon name="Save" />
                      <span>Save Device</span>
                    </button>
                    <button className="btn secondary" type="button" onClick={() => setEditingDeviceId("")}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <form className="form-grid room-device-form" onSubmit={handleAddDevice}>
                  <div className="section-head compact full">
                    <div>
                      <h3>Add Device</h3>
                      <span>Registers it in {activeRoom.name}</span>
                    </div>
                  </div>
                  <div className="field full">
                    <label htmlFor="roomDeviceName">Device name</label>
                    <input
                      id="roomDeviceName"
                      value={newDeviceName}
                      onChange={(event) => setNewDeviceName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor="roomDeviceType">Type</label>
                    <select
                      id="roomDeviceType"
                      value={newDeviceType}
                      onChange={(event) => setNewDeviceType(event.target.value)}
                    >
                      {DEVICE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field full">
                    <button className="btn" type="submit">
                      <LucideIcon name="Plus" />
                      <span>Add Device</span>
                    </button>
                  </div>
                </form>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </section>
  );
}

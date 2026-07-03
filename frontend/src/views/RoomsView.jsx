import { useCallback, useEffect, useMemo, useState } from "react";
import { api, authHeaders } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { normalizeText } from "../utils/helpers.js";
import { formatKwh } from "../utils/energyUtils.js";

const SMART_HOME_ROOMS = [
  {
    name: "Bedroom",
    icon: "BedDouble",
    description: "Comfort, lighting, and presence monitoring.",
  },
  {
    name: "Kitchen",
    icon: "CookingPot",
    description: "Safety sensors and alert devices.",
  },
  {
    name: "Bathroom",
    icon: "Bath",
    description: "Occupancy and utility automation.",
  },
];

function formatPinLabel(device) {
  if (!device) return "Select a device";
  return `${device.pin_name} / GPIO ${device.gpio_pin}`;
}

export default function RoomsView() {
  const {
    devices,
    roomEntries,
    energySummary,
    commandsByDevice,
    sendCommand,
    token,
    toast,
    refreshAll,
  } = useApp();
  const [smartHome, setSmartHome] = useState({
    pin_definitions: {},
    devices: [],
    rooms: [],
  });
  const [selectedKeys, setSelectedKeys] = useState({});
  const [localAssignments, setLocalAssignments] = useState({});
  const [savingRoom, setSavingRoom] = useState("");

  const loadSmartHome = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/smart-home/gpio", {
        headers: authHeaders(token),
      });
      setSmartHome(data);
      setSelectedKeys(
        Object.fromEntries(
          (data.rooms || []).map((room) => [room.name, room.selected_device_key || ""]),
        ),
      );
      setLocalAssignments(
        Object.fromEntries(
          (data.rooms || [])
            .filter((room) => room.assignment)
            .map((room) => [room.name, room.assignment]),
        ),
      );
    } catch (error) {
      toast(error.message, "error");
    }
  }, [token, toast]);

  useEffect(() => {
    loadSmartHome();
  }, [loadSmartHome]);

  const roomCards = useMemo(() => {
    return SMART_HOME_ROOMS.map((room) => {
      const roomDevices = devices.filter(
        (device) => normalizeText(device.room || "") === normalizeText(room.name),
      );
      const roomEntry = roomEntries.find(
        (entry) => normalizeText(entry.name) === normalizeText(room.name),
      );
      const deviceFromAppState = devices.find(
        (device) =>
          normalizeText(device.room || "") === normalizeText(room.name) &&
          Boolean(device.gpio_key),
      );
      const configRoom = smartHome.rooms.find(
        (item) => normalizeText(item.name) === normalizeText(room.name),
      );
      const assignedDevice =
        deviceFromAppState ||
        localAssignments[room.name] ||
        configRoom?.assignment ||
        null;
      const selectedKey =
        selectedKeys[room.name] ??
        assignedDevice?.gpio_key ??
        configRoom?.selected_device_key ??
        "";
      const selectedOption = smartHome.devices.find(
        (device) => device.device_key === selectedKey,
      );

      return {
        ...room,
        roomDevices,
        temperature: roomEntry?.temperature ?? null,
        onlineDevices: roomDevices.filter((device) => device.is_online).length,
        lightCount: roomDevices.filter((device) =>
          normalizeText(`${device.device_name} ${device.device_type}`).includes("light"),
        ).length,
        sensorCount: roomDevices.filter((device) =>
          normalizeText(`${device.device_name} ${device.device_type}`).includes("sensor"),
        ).length,
        assignedDevice,
        selectedKey,
        selectedOption,
      };
    });
  }, [devices, localAssignments, roomEntries, selectedKeys, smartHome]);

  const handleDeviceSelection = async (roomName, deviceKey) => {
    setSelectedKeys((current) => ({ ...current, [roomName]: deviceKey }));
    if (!deviceKey) return;

    setSavingRoom(roomName);
    try {
      const result = await api(`/smart-home/rooms/${encodeURIComponent(roomName)}/device`, {
        method: "PUT",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ device_key: deviceKey }),
      });
      setLocalAssignments((current) => ({
        ...current,
        [roomName]: result.device,
      }));
      setSmartHome((current) => ({
        ...current,
        rooms: current.rooms.map((room) =>
          normalizeText(room.name) === normalizeText(roomName)
            ? {
                ...room,
                selected_device_key: result.device.gpio_key,
                assignment: result.device,
              }
            : room,
        ),
      }));
      await refreshAll(token, { force: true });
      toast(
        `${roomName} now uses ${result.device.gpio_label} on ${result.device.gpio_pin_name} / GPIO ${result.device.gpio_pin}`,
        "success",
      );
    } catch (error) {
      toast(error.message, "error");
      await loadSmartHome();
    } finally {
      setSavingRoom("");
    }
  };

  const handleControl = (room) => {
    if (!room.assignedDevice?.device_id || !room.selectedOption?.controllable) return;
    const isOn = String(room.assignedDevice.state || "").toUpperCase() === "ON";
    sendCommand(room.assignedDevice.device_id, isOn ? "TURN_OFF" : "TURN_ON", "room");
  };

  return (
    <section className="view active rooms-page smart-room-page">
      <section className="smart-room-hero">
        <div>
          <p>Smart Home</p>
          <h3>Room control center</h3>
          <span>
            Manage comfort, safety, devices, and automation for Bedroom, Kitchen, and Bathroom from one polished surface.
          </span>
        </div>
        <div className="smart-room-hero-grid">
          <div className="smart-room-sync">
            <LucideIcon name="ShieldCheck" />
            <strong>{devices.filter((device) => device.is_online).length}</strong>
            <span>online devices</span>
          </div>
          <div className="smart-room-sync warning">
            <LucideIcon name="Zap" />
            <strong>{formatKwh(energySummary?.current_kw ?? 0)}</strong>
            <span>kW live load</span>
          </div>
        </div>
      </section>

      <section className="smart-room-grid" aria-label="Smart home rooms">
        {roomCards.map((room) => {
          const isSaving = savingRoom === room.name;
          const isControllable = Boolean(room.selectedOption?.controllable && room.assignedDevice?.device_id);
          const isOn = String(room.assignedDevice?.state || "").toUpperCase() === "ON";
          const latestCommand = commandsByDevice[room.assignedDevice?.device_id]?.[0];
          const powerLabel = room.roomDevices.length
            ? `${Math.max(room.lightCount * 12 + room.sensorCount * 2, 2)} W est.`
            : "No load";
          const motionLabel = room.roomDevices.some((device) =>
            normalizeText(`${device.device_name} ${device.device_type}`).includes("motion"),
          ) ? "Monitored" : "Idle";

          return (
            <article className="smart-room-card" key={room.name}>
              <div className="smart-room-card-head">
                <div className="smart-room-icon">
                  <LucideIcon name={room.icon} />
                </div>
                <div>
                  <h3>{room.name}</h3>
                  <p>{room.description}</p>
                </div>
              </div>

              <div className="smart-room-glance">
                <div>
                  <span>Temperature</span>
                  <strong>{room.temperature != null ? `${room.temperature}°C` : "--"}</strong>
                </div>
                <div>
                  <span>Humidity</span>
                  <strong>{room.selectedOption?.device_key === "dht11" ? "Live" : "--"}</strong>
                </div>
                <div>
                  <span>Power</span>
                  <strong>{powerLabel}</strong>
                </div>
                <div>
                  <span>Motion</span>
                  <strong>{motionLabel}</strong>
                </div>
              </div>

              <label className="smart-room-field">
                <span>Primary device or sensor</span>
                <select
                  value={room.selectedKey}
                  onChange={(event) => handleDeviceSelection(room.name, event.target.value)}
                  disabled={isSaving}
                >
                  <option value="">Select device...</option>
                  {smartHome.devices.map((device) => (
                    <option key={device.device_key} value={device.device_key}>
                      {device.label} - GPIO {device.gpio_pin}
                    </option>
                  ))}
                </select>
              </label>

              <div className="smart-room-health-row">
                <div>
                  <span className="green-dot" />
                  <strong>{room.onlineDevices}/{room.roomDevices.length || 0}</strong>
                  <small>devices online</small>
                </div>
                <div>
                  <LucideIcon name="Lightbulb" />
                  <strong>{room.lightCount}</strong>
                  <small>lights</small>
                </div>
                <div>
                  <LucideIcon name="Radar" />
                  <strong>{room.sensorCount}</strong>
                  <small>sensors</small>
                </div>
              </div>

              <div className="smart-room-actions">
                <button
                  className={`btn smart-room-control ${isOn ? "is-on" : ""}`}
                  type="button"
                  disabled={!isControllable || isSaving}
                  onClick={() => handleControl(room)}
                >
                  <LucideIcon name={isControllable ? (isOn ? "PowerOff" : "Power") : "Activity"} />
                  <span>
                    {isSaving
                      ? "Saving..."
                      : isControllable
                      ? `${isOn ? "Turn off" : "Turn on"}`
                      : room.selectedOption
                      ? "Monitoring"
                      : "Select device"}
                  </span>
                </button>
                <button className="btn secondary smart-room-control" type="button" disabled>
                  <LucideIcon name="Workflow" />
                  <span>Automation</span>
                </button>
              </div>

              {latestCommand ? (
                <div className="smart-room-command-note">
                  {latestCommand.command_type} - {latestCommand.status}
                </div>
              ) : null}

              <details className="smart-room-advanced">
                <summary>
                  <span>Advanced GPIO settings</span>
                  <LucideIcon name="ChevronDown" />
                </summary>
                <div className="smart-room-state">
                  <div>
                    <span>Backend mapping</span>
                    <strong>{formatPinLabel(room.selectedOption)}</strong>
                  </div>
                  <small>
                    {room.assignedDevice
                      ? `${room.assignedDevice.gpio_label} is saved for ${room.name}.`
                      : "Select a dropdown value to save this room assignment."}
                  </small>
                </div>
                <div className="smart-room-device-strip">
                  <div>
                    <span>GPIO</span>
                    <strong>{room.selectedOption ? `GPIO ${room.selectedOption.gpio_pin}` : "--"}</strong>
                  </div>
                  <div>
                    <span>Pin</span>
                    <strong>{room.selectedOption?.pin_name || "--"}</strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>{room.selectedOption?.controllable ? "Control" : "Sensor"}</strong>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <details className="gpio-definition-panel smart-room-advanced-global" aria-label="ESP32 GPIO pin definitions">
        <summary>
          <span>
            <LucideIcon name="CircuitBoard" />
            ESP32 pin definitions
          </span>
          <LucideIcon name="ChevronDown" />
        </summary>
        <div className="gpio-chip-grid">
          <div className="gpio-chip">
            <strong>DHTTYPE</strong>
            <span>{smartHome.dht_type || "DHT11"}</span>
          </div>
          {Object.entries(smartHome.pin_definitions).map(([pinName, gpio]) => (
            <div className="gpio-chip" key={pinName}>
              <strong>{pinName}</strong>
              <span>GPIO {gpio}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

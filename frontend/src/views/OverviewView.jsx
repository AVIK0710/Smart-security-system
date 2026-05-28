import { useApp } from "../context/AppContext.jsx";
import DeviceCard from "../components/DeviceCard.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import RoomCard from "../components/RoomCard.jsx";
import { useState } from "react";

export default function OverviewView() {
  const {
    devices,
    roomEntries,
    selectedRoom,
    selectedRoomCount,
    commandsByDevice,
    metrics,
    voiceStatus,
    voiceTranscript,
    voiceResult,
    listening,
    startVoice,
    stopVoice,
    runVoiceCommand,
    sendCommand,
  } = useApp();
  const [voiceText, setVoiceText] = useState("");

  const handleVoiceTextSubmit = async (event) => {
    event.preventDefault();
    await runVoiceCommand(voiceText);
    setVoiceText("");
  };

  return (
    <section className="view active">
      <section className="panel dashboard-panel">
        <div className="section-head">
          <h3>Your Rooms</h3>
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

        <div className="room-detail-head">
          <LucideIcon name="ArrowLeft" className="back-icon" />
          <div>
            <h3>{selectedRoom}</h3>
            <span>
              {selectedRoomCount} Device{selectedRoomCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="dashboard-device-grid">
          {!devices.length ? (
            <div className="empty">Register a device to see live controls</div>
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                commands={commandsByDevice[device.device_id] || []}
                onCommand={sendCommand}
              />
            ))
          )}
        </div>

        <div className="summary-row">
          <div className="metrics">
            <div className="metric">
              <strong>{metrics.total}</strong>
              <div className="label">Total Devices</div>
            </div>
            <div className="metric">
              <strong>{metrics.online}</strong>
              <div className="label">Online</div>
            </div>
            <div className="metric">
              <strong>{metrics.offline}</strong>
              <div className="label">Offline</div>
            </div>
            <div className="metric">
              <strong>{metrics.alerts}</strong>
              <div className="label">Not Responding</div>
            </div>
          </div>
          <div className="safe-card">
            <LucideIcon name="ShieldCheck" size={58} />
            <div>
              <strong>{metrics.safeStatusTitle}</strong>
              <p>{metrics.safeStatusText}</p>
            </div>
          </div>
        </div>

        <div className="voice-strip">
          <div className={`voice-orb${voiceStatus === "listening" ? " listening" : ""}`}>
            <LucideIcon name="Mic" />
          </div>
          <div>
            <h3>Voice Control</h3>
            <p>{voiceTranscript}</p>
          </div>
          <div className="voice-actions">
            <button className="btn" type="button" onClick={startVoice}>
              <LucideIcon name="Mic" />
              <span>{listening ? "Listening" : "Speak"}</span>
            </button>
            <button className="btn secondary" type="button" onClick={stopVoice}>
              <LucideIcon name="Square" />
              <span>Stop</span>
            </button>
          </div>
          <div className="voice-result">{voiceResult}</div>
          <form className="voice-command-form" onSubmit={handleVoiceTextSubmit}>
            <input
              aria-label="Voice command text"
              value={voiceText}
              onChange={(event) => setVoiceText(event.target.value)}
              placeholder="turn on living room light"
            />
            <button className="btn" type="submit">
              <LucideIcon name="Send" />
              <span>Run</span>
            </button>
          </form>
        </div>
      </section>
    </section>
  );
}

import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import EventList from "../components/EventList.jsx";
import LucideIcon from "../components/LucideIcon.jsx";

export default function SettingsView() {
  const { rules, devices, events, createRule, clearEvents } = useApp();
  const [ruleName, setRuleName] = useState("");
  const [ruleSensor, setRuleSensor] = useState("");
  const [conditionType, setConditionType] = useState("motion");
  const [conditionOperator, setConditionOperator] = useState("");
  const [conditionValue, setConditionValue] = useState("");
  const [actionDevice, setActionDevice] = useState("");
  const [actionCommand, setActionCommand] = useState("TURN_ON");

  const sensorId = ruleSensor || (devices[0] ? String(devices[0].device_id) : "");
  const actionId = actionDevice || (devices[0] ? String(devices[0].device_id) : "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createRule({
      name: ruleName,
      device_id: Number(sensorId),
      condition_type: conditionType,
      operator: conditionOperator || null,
      value: conditionValue || null,
      action_device_id: Number(actionId),
      action_command: actionCommand,
    });
    setRuleName("");
    setConditionValue("");
    setConditionOperator("");
  };

  return (
    <section className="view active">
      <div className="grid two">
        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Rules</h3>
              <span>Sensor conditions trigger commands</span>
            </div>
          </div>
          <div className="rule-grid">
            {!rules.length ? (
              <div className="empty">No rules created</div>
            ) : (
              rules.map((rule) => (
                <article key={rule.rule_id} className="rule-card">
                  <header>
                    <div>
                      <h4>{rule.name}</h4>
                      <div className="muted">
                        {rule.condition_type} {rule.operator || ""} {rule.value || ""}
                      </div>
                    </div>
                    <span className={`status ${rule.is_active ? "online" : "offline"}`}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </span>
                  </header>
                  <div className="meta-list">
                    <div className="meta-row">
                      <span>Sensor</span>
                      <strong>#{rule.device_id}</strong>
                    </div>
                    <div className="meta-row">
                      <span>Action</span>
                      <strong>
                        #{rule.action_device_id} {rule.action_command}
                      </strong>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Create Rule</h3>
              <span>Compatible with your existing rule schema</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field full">
              <label htmlFor="ruleName">Rule Name</label>
              <input
                id="ruleName"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ruleSensor">Sensor Device</label>
              <select
                id="ruleSensor"
                value={sensorId}
                onChange={(e) => setRuleSensor(e.target.value)}
              >
                {devices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name} ({device.device_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="conditionType">Condition</label>
              <select
                id="conditionType"
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
              >
                <option value="motion">motion</option>
                <option value="temperature">temperature</option>
                <option value="humidity">humidity</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="conditionOperator">Operator</label>
              <select
                id="conditionOperator"
                value={conditionOperator}
                onChange={(e) => setConditionOperator(e.target.value)}
              >
                <option value="">none</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="=">=</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="conditionValue">Value</label>
              <input
                id="conditionValue"
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="actionDevice">Action Device</label>
              <select
                id="actionDevice"
                value={actionId}
                onChange={(e) => setActionDevice(e.target.value)}
              >
                {devices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    {device.device_name} ({device.device_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="actionCommand">Command</label>
              <select
                id="actionCommand"
                value={actionCommand}
                onChange={(e) => setActionCommand(e.target.value)}
              >
                <option value="TURN_ON">TURN_ON</option>
                <option value="TURN_OFF">TURN_OFF</option>
              </select>
            </div>
            <div className="field full">
              <button className="btn" type="submit">
                <LucideIcon name="Workflow" />
                <span>Create Rule</span>
              </button>
            </div>
          </form>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <div>
              <h3>Live Feed</h3>
              <span>WebSocket messages, voice commands, and actions</span>
            </div>
            <button className="btn secondary" type="button" title="Clear events" onClick={clearEvents}>
              <LucideIcon name="Trash2" />
              <span>Clear</span>
            </button>
          </div>
          <div className="live-feed">
            <EventList items={events} variant="live-feed" />
          </div>
        </section>
      </div>
    </section>
  );
}

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization")
    devices = relationship("Device", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)

    organization_id = Column(Integer, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="users")

    devices = relationship("Device", back_populates="owner")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    device_type = Column(String, nullable=False)
    room = Column(String, nullable=True)

    device_uid = Column(String, unique=True, index=True, nullable=False)
    device_token = Column(String, unique=True, nullable=False)

    current_state = Column(String, default="OFF")
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=datetime.utcnow)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="devices")

    organization_id = Column(Integer, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="devices")

    telemetry = relationship("DeviceTelemetry", back_populates="device")


class DeviceTelemetry(Base):
    __tablename__ = "device_telemetry"

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(Integer, ForeignKey("devices.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))

    temperature = Column(String)
    humidity = Column(String)
    motion_detected = Column(Boolean)

    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="telemetry")


class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(Integer, ForeignKey("devices.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))

    command_type = Column(String, nullable=False)
    payload = Column(Text, nullable=True)

    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime, nullable=True)

    device = relationship("Device")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class SceneAction(Base):
    __tablename__ = "scene_actions"

    id = Column(Integer, primary_key=True, index=True)

    scene_id = Column(Integer, ForeignKey("scenes.id"))
    device_id = Column(Integer, ForeignKey("devices.id"))

    command_type = Column(String, nullable=False)
    payload = Column(Text, nullable=True)


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"))

    device_id = Column(Integer, ForeignKey("devices.id"))

    condition_type = Column(String, nullable=False)
    operator = Column(String, nullable=True)
    value = Column(String, nullable=True)

    action_device_id = Column(Integer, ForeignKey("devices.id"))
    action_command = Column(String, nullable=False)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AutomationRuleActivity(Base):
    __tablename__ = "automation_rule_activity"

    id = Column(Integer, primary_key=True, index=True)

    rule_id = Column(Integer, ForeignKey("automation_rules.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))

    sensor_device_id = Column(Integer, ForeignKey("devices.id"))
    action_device_id = Column(Integer, ForeignKey("devices.id"))
    command_id = Column(Integer, ForeignKey("device_commands.id"))

    trigger_type = Column(String, nullable=False)
    observed_value = Column(String, nullable=True)
    action_command = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(Integer, ForeignKey("organizations.id"))
    camera_device_id = Column(Integer, ForeignKey("devices.id"))

    event_type = Column(String, nullable=False)  
    # motion, unknown_face, known_face, forced_entry

    person_label = Column(String, nullable=True)
    confidence = Column(String, nullable=True)
    threat_score = Column(String, nullable=True)

    snapshot_path = Column(String, nullable=True)
    message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(Integer, ForeignKey("organizations.id"))
    security_event_id = Column(Integer, ForeignKey("security_events.id"), nullable=True)

    notification_type = Column(String, nullable=False)
    # websocket, telegram, email, sms, app_push

    recipient = Column(String, nullable=True)

    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)

    status = Column(String, default="created")
    # created, sent, failed

    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
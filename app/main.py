import secrets
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal
from . import models
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from .schemas import UserCreate
from .device_schemas import DeviceCreate
from .device_auth_schemas import DeviceAuthRequest
from .telemetry_schemas import TelemetryCreate
from .scene_schemas import SceneCreate
from .rule_schemas import RuleCreate
from .websocket_manager import manager
from fastapi.middleware.cors import CORSMiddleware

import os
import uuid
import asyncio
from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from .security_stream import update_latest_frame, get_latest_frame

from .telegram_service import send_telegram_message
from app.camera_stream import video_feed

app = FastAPI()
TELEGRAM_BOT_TOKEN = "8734485272:AAE_sHtD21MyCRIwcnMIKS0uPjyT1nZxuRI"
TELEGRAM_CHAT_ID = "7399959459"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_notification_log(
    db: Session,
    organization_id: int,
    notification_type: str,
    title: str,
    message: str,
    security_event_id: int | None = None,
    recipient: str | None = None,
    status: str = "created"
):
    notification = models.NotificationLog(
        organization_id=organization_id,
        security_event_id=security_event_id,
        notification_type=notification_type,
        recipient=recipient,
        title=title,
        message=message,
        status=status
    )

    db.add(notification)
    db.flush()

    return notification

@app.get("/")
def root():
    return {"message": "Home Server Secure Backend Running"}


@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        models.User.username == user.username
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    org = models.Organization(name=f"{user.username}_org")
    db.add(org)
    db.commit()
    db.refresh(org)

    hashed_pw = hash_password(user.password)

    new_user = models.User(
        username=user.username,
        hashed_password=hashed_pw,
        is_admin=True,
        organization_id=org.id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Organization and admin user created"}


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username")

    if not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid password")

    access_token = create_access_token({"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/protected")
def protected_route(current_user: models.User = Depends(get_current_user)):
    return {
        "message": "Access granted",
        "user": current_user.username,
        "organization_id": current_user.organization_id
    }


@app.post("/devices/register")
async def register_device(
    device: DeviceCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device_uid = secrets.token_hex(8)
    device_token = secrets.token_hex(32)

    new_device = models.Device(
        name=device.name,
        device_type=device.device_type,
        room=device.room,
        device_uid=device_uid,
        device_token=device_token,
        owner_id=current_user.id,
        organization_id=current_user.organization_id
    )

    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    await manager.broadcast({
        "event": "device_registered",
        "device_id": new_device.id,
        "device_name": new_device.name,
        "device_type": new_device.device_type,
        "room": new_device.room,
        "organization_id": new_device.organization_id
    })

    return {
        "device_id": new_device.id,
        "device_uid": new_device.device_uid,
        "device_token": new_device.device_token
    }


@app.post("/devices/auth")
def authenticate_device(device_data: DeviceAuthRequest, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_data.device_uid
    ).first()

    if not device:
        raise HTTPException(status_code=401, detail="Invalid device UID")

    if device.device_token != device_data.device_token:
        raise HTTPException(status_code=401, detail="Invalid device token")

    if not device.is_active:
        raise HTTPException(status_code=403, detail="Device is inactive")

    return {
        "message": "Device authenticated",
        "device_id": device.id,
        "device_name": device.name
    }


@app.post("/devices/heartbeat")
async def device_heartbeat(
    telemetry: TelemetryCreate,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == telemetry.device_uid
    ).first()

    if not device or device.device_token != telemetry.device_token:
        raise HTTPException(status_code=401, detail="Invalid device credentials")

    device.last_seen = datetime.utcnow()
    db.commit()

    await manager.broadcast({
        "event": "heartbeat",
        "device_id": device.id,
        "device_name": device.name,
        "last_seen": device.last_seen
    })

    return {"message": "Heartbeat received"}


@app.post("/devices/telemetry")
async def device_telemetry(
    telemetry: TelemetryCreate,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == telemetry.device_uid
    ).first()

    if not device or device.device_token != telemetry.device_token:
        raise HTTPException(status_code=401, detail="Invalid device credentials")

    new_entry = models.DeviceTelemetry(
        device_id=device.id,
        organization_id=device.organization_id,
        temperature=str(telemetry.temperature),
        humidity=str(telemetry.humidity),
        motion_detected=telemetry.motion_detected
    )

    device.last_seen = datetime.utcnow()
    db.add(new_entry)

    triggered_rules = []

    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.device_id == device.id,
        models.AutomationRule.organization_id == device.organization_id,
        models.AutomationRule.is_active == True
    ).all()

    for rule in rules:
        trigger = False
        observed_value = None

        if rule.condition_type == "motion":
            observed_value = str(telemetry.motion_detected)
            if telemetry.motion_detected:
                trigger = True

        elif rule.condition_type == "temperature":
            observed_value = str(telemetry.temperature)

            if rule.value:
                if rule.operator == ">" and telemetry.temperature > float(rule.value):
                    trigger = True
                elif rule.operator == "<" and telemetry.temperature < float(rule.value):
                    trigger = True
                elif rule.operator == "=" and telemetry.temperature == float(rule.value):
                    trigger = True

        elif rule.condition_type == "humidity":
            observed_value = str(telemetry.humidity)

            if rule.value:
                if rule.operator == ">" and telemetry.humidity > float(rule.value):
                    trigger = True
                elif rule.operator == "<" and telemetry.humidity < float(rule.value):
                    trigger = True
                elif rule.operator == "=" and telemetry.humidity == float(rule.value):
                    trigger = True

        if not trigger:
            continue

        existing_command = db.query(models.DeviceCommand).filter(
            models.DeviceCommand.device_id == rule.action_device_id,
            models.DeviceCommand.command_type == rule.action_command,
            models.DeviceCommand.status.in_(["pending", "delivered"])
        ).first()

        if existing_command:
            continue

        command = models.DeviceCommand(
            device_id=rule.action_device_id,
            organization_id=device.organization_id,
            command_type=rule.action_command
        )

        db.add(command)
        db.flush()

        activity = models.AutomationRuleActivity(
            rule_id=rule.id,
            organization_id=device.organization_id,
            sensor_device_id=device.id,
            action_device_id=rule.action_device_id,
            command_id=command.id,
            trigger_type=rule.condition_type,
            observed_value=observed_value,
            action_command=rule.action_command
        )

        db.add(activity)

        triggered_rules.append({
            "rule_id": rule.id,
            "rule_name": rule.name,
            "command_id": command.id,
            "action_device_id": rule.action_device_id,
            "action_command": rule.action_command
        })

    db.commit()

    await manager.broadcast({
        "event": "telemetry",
        "device_id": device.id,
        "device_name": device.name,
        "temperature": telemetry.temperature,
        "humidity": telemetry.humidity,
        "motion_detected": telemetry.motion_detected
    })

    for item in triggered_rules:
        await manager.broadcast({
            "event": "rule_triggered",
            **item
        })

    return {
        "message": "Telemetry stored",
        "triggered_rules": triggered_rules
    }


@app.get("/devices")
def list_devices(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    devices = db.query(models.Device).filter(
        models.Device.organization_id == current_user.organization_id
    ).all()

    result = []
    now = datetime.utcnow()

    for device in devices:
        seconds_since_seen = (now - device.last_seen).total_seconds()
        is_online = seconds_since_seen < 60

        result.append({
            "device_id": device.id,
            "device_name": device.name,
            "device_type": device.device_type,
            "room": device.room,
            "state": device.current_state,
            "device_uid": device.device_uid,
            "is_online": is_online,
            "last_seen": device.last_seen
        })

    return result


@app.post("/devices/{device_id}/command")
async def create_command(
    device_id: int,
    command_type: str,
    payload: str = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == current_user.organization_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    command = models.DeviceCommand(
        device_id=device.id,
        organization_id=device.organization_id,
        command_type=command_type,
        payload=payload
    )

    db.add(command)
    db.commit()
    db.refresh(command)

    await manager.broadcast({
        "event": "command_created",
        "command_id": command.id,
        "device_id": device.id,
        "device_name": device.name,
        "command_type": command.command_type,
        "payload": command.payload
    })

    return {"message": "Command created", "command_id": command.id}


@app.post("/devices/commands")
async def fetch_device_commands(
    device_data: DeviceAuthRequest,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_data.device_uid
    ).first()

    if not device or device.device_token != device_data.device_token:
        raise HTTPException(status_code=401, detail="Invalid device credentials")

    commands = db.query(models.DeviceCommand).filter(
        models.DeviceCommand.device_id == device.id,
        models.DeviceCommand.status == "pending"
    ).all()

    result = []

    for cmd in commands:
        cmd.status = "delivered"
        result.append({
            "command_id": cmd.id,
            "command_type": cmd.command_type,
            "payload": cmd.payload
        })

    db.commit()

    if result:
        await manager.broadcast({
            "event": "commands_delivered",
            "device_id": device.id,
            "device_name": device.name,
            "commands": result
        })

    return result


@app.post("/devices/commands/{command_id}/complete")
async def complete_command(
    command_id: int,
    request: DeviceAuthRequest,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == request.device_uid
    ).first()

    if not device or device.device_token != request.device_token:
        raise HTTPException(status_code=401, detail="Invalid device credentials")

    command = db.query(models.DeviceCommand).filter(
        models.DeviceCommand.id == command_id,
        models.DeviceCommand.device_id == device.id
    ).first()

    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    command.status = "executed"
    command.executed_at = datetime.utcnow()

    if command.command_type == "TURN_ON":
        device.current_state = "ON"

    elif command.command_type == "TURN_OFF":
        device.current_state = "OFF"

    db.commit()

    await manager.broadcast({
        "event": "device_state_changed",
        "device_id": device.id,
        "device_name": device.name,
        "new_state": device.current_state
    })

    return {
        "message": "Command completed",
        "device_state": device.current_state
    }

@app.get("/dashboard")
def dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    devices = db.query(models.Device).filter(
        models.Device.organization_id == current_user.organization_id
    ).all()

    result = {}

    for device in devices:
        room = device.room or "Unassigned"

        if room not in result:
            result[room] = []

        result[room].append({
            "device_id": device.id,
            "device_name": device.name,
            "device_type": device.device_type,
            "state": device.current_state,
            "is_online": (datetime.utcnow() - device.last_seen).total_seconds() < 60
        })

    return result


@app.post("/scenes")
async def create_scene(
    scene: SceneCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_scene = models.Scene(
        name=scene.name,
        organization_id=current_user.organization_id
    )
    db.add(new_scene)
    db.commit()
    db.refresh(new_scene)

    for action in scene.actions:
        device = db.query(models.Device).filter(
            models.Device.id == action.device_id,
            models.Device.organization_id == current_user.organization_id
        ).first()

        if not device:
            raise HTTPException(
                status_code=404,
                detail=f"Device {action.device_id} not found"
            )

        new_action = models.SceneAction(
            scene_id=new_scene.id,
            device_id=action.device_id,
            command_type=action.command_type,
            payload=action.payload
        )
        db.add(new_action)

    db.commit()

    await manager.broadcast({
        "event": "scene_created",
        "scene_id": new_scene.id,
        "scene_name": new_scene.name
    })

    return {"message": "Scene created", "scene_id": new_scene.id}


@app.get("/scenes")
def list_scenes(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scenes = db.query(models.Scene).filter(
        models.Scene.organization_id == current_user.organization_id
    ).all()

    return [
        {
            "scene_id": scene.id,
            "name": scene.name
        }
        for scene in scenes
    ]


@app.post("/scenes/{scene_id}/run")
async def run_scene(
    scene_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scene = db.query(models.Scene).filter(
        models.Scene.id == scene_id,
        models.Scene.organization_id == current_user.organization_id
    ).first()

    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    actions = db.query(models.SceneAction).filter(
        models.SceneAction.scene_id == scene.id
    ).all()

    created_commands = []

    for action in actions:
        device = db.query(models.Device).filter(
            models.Device.id == action.device_id,
            models.Device.organization_id == current_user.organization_id
        ).first()

        if not device:
            continue

        command = models.DeviceCommand(
            device_id=device.id,
            organization_id=device.organization_id,
            command_type=action.command_type,
            payload=action.payload
        )
        db.add(command)
        db.flush()

        created_commands.append({
            "device_id": device.id,
            "device_name": device.name,
            "command_id": command.id,
            "command_type": command.command_type,
            "payload": command.payload
        })

    db.commit()

    await manager.broadcast({
        "event": "scene_executed",
        "scene_id": scene.id,
        "scene_name": scene.name,
        "commands": created_commands
    })

    return {
        "message": "Scene executed",
        "commands": created_commands
    }


@app.post("/rules")
async def create_rule(
    rule: RuleCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_rule = models.AutomationRule(
        name=rule.name,
        organization_id=current_user.organization_id,
        device_id=rule.device_id,
        condition_type=rule.condition_type,
        operator=rule.operator,
        value=rule.value,
        action_device_id=rule.action_device_id,
        action_command=rule.action_command
    )

    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    await manager.broadcast({
        "event": "rule_created",
        "rule_id": new_rule.id,
        "rule_name": new_rule.name
    })

    return {"message": "Rule created", "rule_id": new_rule.id}


@app.get("/rules")
def list_rules(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.organization_id == current_user.organization_id
    ).all()

    return rules


@app.get("/devices/{device_id}/telemetry")
def get_device_telemetry(
    device_id: int,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == current_user.organization_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    telemetry = db.query(models.DeviceTelemetry).filter(
        models.DeviceTelemetry.device_id == device.id
    ).order_by(
        models.DeviceTelemetry.created_at.desc()
    ).limit(limit).all()

    return telemetry


@app.get("/devices/{device_id}/commands")
def get_device_commands(
    device_id: int,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == current_user.organization_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    commands = db.query(models.DeviceCommand).filter(
        models.DeviceCommand.device_id == device.id
    ).order_by(
        models.DeviceCommand.created_at.desc()
    ).limit(limit).all()

    return commands


@app.get("/rules/{rule_id}/activity")
def get_rule_activity(
    rule_id: int,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(
        models.AutomationRule.id == rule_id,
        models.AutomationRule.organization_id == current_user.organization_id
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    activity = db.query(models.AutomationRuleActivity).filter(
        models.AutomationRuleActivity.rule_id == rule.id
    ).order_by(
        models.AutomationRuleActivity.created_at.desc()
    ).limit(limit).all()

    return activity


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/test-broadcast")
async def test_broadcast():
    await manager.broadcast({
        "event": "test",
        "message": "WebSocket broadcast working"
    })

    return {"message": "Broadcast sent"}


SECURITY_MEDIA_DIR = "media/security_snapshots"
os.makedirs(SECURITY_MEDIA_DIR, exist_ok=True)


@app.post("/security/frame")
async def upload_camera_frame(
    device_uid: str = Form(...),
    device_token: str = Form(...),
    frame: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_uid
    ).first()

    if not device or device.device_token != device_token:
        raise HTTPException(status_code=401, detail="Invalid camera credentials")

    frame_bytes = await frame.read()
    update_latest_frame(device.id, frame_bytes)

    device.last_seen = datetime.utcnow()
    db.commit()

    await manager.broadcast({
        "event": "camera_frame_received",
        "device_id": device.id,
        "device_name": device.name
    })

    return {"message": "Frame received"}


@app.get("/security/cameras/{device_id}/stream")
async def camera_stream(
    device_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid or missing stream token"
    )

    try:
        from jose import jwt, JWTError
        from .auth import SECRET_KEY, ALGORITHM

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")

        if username is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(
        models.User.username == username
    ).first()

    if not user:
        raise credentials_exception

    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == user.organization_id,
        models.Device.device_type == "camera"
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Camera not found")

    async def generate():
        while True:
            frame = get_latest_frame(device_id)

            if frame:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" +
                    frame +
                    b"\r\n"
                )

            await asyncio.sleep(0.1)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.post("/security/events")
async def create_security_event(
    device_uid: str = Form(...),
    device_token: str = Form(...),
    event_type: str = Form(...),
    person_label: str = Form(None),
    confidence: float = Form(None),
    threat_score: float = Form(None),
    message: str = Form(None),
    snapshot: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_uid
    ).first()

    if not device or device.device_token != device_token:
        raise HTTPException(status_code=401, detail="Invalid camera credentials")

    snapshot_path = None

    if snapshot:
        filename = f"{uuid.uuid4().hex}.jpg"
        snapshot_path = os.path.join(SECURITY_MEDIA_DIR, filename)

        with open(snapshot_path, "wb") as f:
            f.write(await snapshot.read())

    event = models.SecurityEvent(
        organization_id=device.organization_id,
        camera_device_id=device.id,
        event_type=event_type,
        person_label=person_label,
        confidence=str(confidence) if confidence is not None else None,
        threat_score=str(threat_score) if threat_score is not None else None,
        snapshot_path=snapshot_path,
        message=message
    )

    device.last_seen = datetime.utcnow()

    db.add(event)
    db.flush()

    alert_message = (
        f"🚨 <b>Security Alert</b>\n\n"
        f"<b>Camera:</b> {device.name}\n"
        f"<b>Event:</b> {event_type}\n"
        f"<b>Person:</b> {person_label or 'Unknown'}\n"
        f"<b>Confidence:</b> {confidence if confidence is not None else 'N/A'}\n"
        f"<b>Threat Score:</b> {threat_score if threat_score is not None else 'N/A'}\n"
        f"<b>Message:</b> {message or 'Security event detected'}"
    )

    websocket_notification = create_notification_log(
        db=db,
        organization_id=device.organization_id,
        notification_type="websocket",
        title="Security Alert",
        message=message or f"{event_type} detected by {device.name}",
        security_event_id=event.id,
        status="sent"
    )
    websocket_notification.sent_at = datetime.utcnow()

    telegram_status = "created"

    telegram_sent = send_telegram_message(
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    alert_message
)

    telegram_status = "sent" if telegram_sent else "failed"

    telegram_notification = create_notification_log(
        db=db,
        organization_id=device.organization_id,
        notification_type="telegram",
        title="Telegram Security Alert",
        message=alert_message,
        security_event_id=event.id,
        recipient=TELEGRAM_CHAT_ID,
        status=telegram_status
    )

    if telegram_status == "sent":
        telegram_notification.sent_at = datetime.utcnow()

    db.commit()
    db.refresh(event)

    await manager.broadcast({
        "event": "intruder_alert",
        "security_event_id": event.id,
        "camera_device_id": device.id,
        "camera_name": device.name,
        "event_type": event.event_type,
        "person_label": event.person_label,
        "confidence": event.confidence,
        "threat_score": event.threat_score,
        "message": event.message,
        "created_at": event.created_at
    })

    return {
        "message": "Security event created",
        "event_id": event.id,
        "telegram_status": telegram_status
    }

@app.get("/security/events")
def list_security_events(
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    events = db.query(models.SecurityEvent).filter(
        models.SecurityEvent.organization_id == current_user.organization_id
    ).order_by(
        models.SecurityEvent.created_at.desc()
    ).limit(limit).all()

    return events


@app.get("/security/events/{event_id}/snapshot")
def get_security_snapshot(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(models.SecurityEvent).filter(
        models.SecurityEvent.id == event_id,
        models.SecurityEvent.organization_id == current_user.organization_id
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Security event not found")

    if not event.snapshot_path or not os.path.exists(event.snapshot_path):
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return FileResponse(event.snapshot_path)


@app.get("/notifications")
def list_notifications(
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(models.NotificationLog).filter(
        models.NotificationLog.organization_id == current_user.organization_id
    ).order_by(
        models.NotificationLog.created_at.desc()
    ).limit(limit).all()

    return notifications

@app.get("/video_feed/{camera_id}")
async def stream_camera(camera_id: int):
    return video_feed()
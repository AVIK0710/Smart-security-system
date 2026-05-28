import json
import random
import re
import secrets
import smtplib
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from email.message import EmailMessage

from fastapi import FastAPI, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal
from . import models
from .auth import (
    hash_secret,
    hash_password,
    verify_secret,
    verify_password,
    create_access_token,
    get_current_user
)
from .config import (
    ALLOWED_ORIGINS,
    AUTH_RATE_LIMIT_REQUESTS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS,
    EXPOSE_RESET_OTP,
    ENABLE_DEMO_DEVICE_PULSE,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    RESET_OTP_EXPIRE_MINUTES,
    RESET_TOKEN_EXPIRE_MINUTES,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_USE_TLS,
)
from .schemas import PasswordOtpVerify, PasswordResetConfirm, PasswordResetRequest, UserCreate, UserLogin
from .device_schemas import DeviceCreate, DeviceUpdate
from .device_auth_schemas import DeviceAuthRequest
from .telemetry_schemas import TelemetryCreate
from .scene_schemas import SceneCreate, SceneUpdate
from .rule_schemas import RuleCreate, RuleUpdate
from .websocket_manager import manager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)


RATE_LIMIT_BUCKETS: dict[str, deque] = defaultdict(deque)
AUTH_PATHS = {"/login", "/register", "/password/forgot", "/password/verify-otp", "/password/reset"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEVICE_ONLINE_THRESHOLD_SECONDS = 75
DEMO_DEVICE_NAMES = {"Living Room Light", "Living Room Fan", "Entry Motion Sensor"}


def ensure_sqlite_schema() -> None:
    with engine.begin() as conn:
        user_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if "email" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
        if "password_reset_otp_hash" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_otp_hash VARCHAR"))
        if "password_reset_otp_expires_at" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_otp_expires_at DATETIME"))
        if "password_reset_token_hash" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR"))
        if "password_reset_expires_at" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME"))


ensure_sqlite_schema()


@app.middleware("http")
async def rate_limit_requests(request: Request, call_next):
    if request.url.path.startswith("/assets"):
        return await call_next(request)

    client = request.client.host if request.client else "unknown"
    is_auth_path = request.url.path in AUTH_PATHS
    limit = AUTH_RATE_LIMIT_REQUESTS if is_auth_path else RATE_LIMIT_REQUESTS
    window = AUTH_RATE_LIMIT_WINDOW_SECONDS if is_auth_path else RATE_LIMIT_WINDOW_SECONDS
    bucket_key = f"{client}:{request.url.path if is_auth_path else 'global'}"
    bucket = RATE_LIMIT_BUCKETS[bucket_key]
    now = time.time()

    while bucket and bucket[0] <= now - window:
        bucket.popleft()

    if len(bucket) >= limit:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please wait and try again."},
        )

    bucket.append(now)
    return await call_next(request)


STARTER_DEVICES = [
    {"name": "Living Room Light", "device_type": "light", "room": "Living Room", "state": "OFF"},
    {"name": "Living Room Fan", "device_type": "fan", "room": "Living Room", "state": "OFF"},
    {"name": "Entry Motion Sensor", "device_type": "sensor", "room": "Entrance", "state": "ACTIVE"},
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def record_event(
    db: Session,
    event_type: str,
    organization_id: int | None = None,
    message: str | None = None,
    payload: dict | None = None,
) -> models.AppEvent:
    event = models.AppEvent(
        organization_id=organization_id,
        event_type=event_type,
        message=message,
        payload=json.dumps(payload or {}),
    )
    db.add(event)
    return event


def serialize_event(event: models.AppEvent) -> dict:
    try:
        payload = json.loads(event.payload or "{}")
    except json.JSONDecodeError:
        payload = {}

    return {
        "event_id": event.id,
        "event": event.event_type,
        "message": event.message,
        "payload": payload,
        "created_at": event.created_at,
    }


def schema_updates(schema) -> dict:
    if hasattr(schema, "model_dump"):
        return schema.model_dump(exclude_unset=True)
    return schema.dict(exclude_unset=True)


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise HTTPException(status_code=400, detail="Password must include letters and numbers")


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return normalized


def device_presence(device: models.Device, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    seconds_since_seen = (now - device.last_seen).total_seconds() if device.last_seen else None
    is_active_sensor = (
        device.is_active
        and device.device_type == "sensor"
        and str(device.current_state).upper() == "ACTIVE"
    )
    is_powered_on = str(device.current_state).upper() == "ON"
    is_online = device.is_active and (is_active_sensor or is_powered_on)
    age = None if seconds_since_seen is None else max(0, int(seconds_since_seen))

    if is_active_sensor:
        label = "Monitoring"
    elif not device.is_active:
        label = "Inactive"
    elif not is_powered_on:
        label = "Offline"
    elif age is None:
        label = "Online"
    elif age < 10:
        label = "Live now"
    elif age < DEVICE_ONLINE_THRESHOLD_SECONDS:
        label = f"Seen {age}s ago"
    else:
        label = "Online"

    return {
        "is_online": is_online,
        "last_seen": device.last_seen,
        "presence_age_seconds": age,
        "presence_label": label,
    }


def send_password_reset_otp(email: str, otp: str) -> bool:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        print(f"Password reset OTP for {email}: {otp}")
        return False

    message = EmailMessage()
    message["Subject"] = "Your Smart Home password reset OTP"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        f"Your Smart Home password reset OTP is {otp}. "
        f"It expires in {RESET_OTP_EXPIRE_MINUTES} minutes."
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception as exc:
        print(f"Password reset OTP email failed for {email}: {exc}")
        return False

    return True


def verify_device_token(device: models.Device, provided_token: str, db: Session) -> bool:
    if verify_secret(provided_token, device.device_token):
        if not device.device_token.startswith("$2"):
            device.device_token = hash_secret(provided_token)
            db.flush()
        return True
    return False


def ensure_starter_home(db: Session, user: models.User) -> None:
    device_count = db.query(models.Device).filter(
        models.Device.organization_id == user.organization_id
    ).count()

    if device_count:
        return

    devices_by_type = {}
    for starter in STARTER_DEVICES:
        device = models.Device(
            name=starter["name"],
            device_type=starter["device_type"],
            room=starter["room"],
            current_state=starter["state"],
            device_uid=secrets.token_hex(8),
            device_token=hash_secret(secrets.token_hex(32)),
            owner_id=user.id,
            organization_id=user.organization_id,
            last_seen=datetime.utcnow(),
        )
        db.add(device)
        db.flush()
        devices_by_type[starter["device_type"]] = device

    light = devices_by_type.get("light")
    sensor = devices_by_type.get("sensor")

    if light:
        scene = models.Scene(
            name="Evening Lights",
            organization_id=user.organization_id,
        )
        db.add(scene)
        db.flush()
        db.add(models.SceneAction(
            scene_id=scene.id,
            device_id=light.id,
            command_type="TURN_ON",
        ))

    if sensor and light:
        db.add(models.AutomationRule(
            name="Motion turns on light",
            organization_id=user.organization_id,
            device_id=sensor.id,
            condition_type="motion",
            operator=None,
            value=None,
            action_device_id=light.id,
            action_command="TURN_ON",
        ))

    if sensor:
        for temperature, humidity, motion in [
            (27.4, 54.0, False),
            (28.1, 57.5, True),
            (27.8, 55.2, False),
        ]:
            db.add(models.DeviceTelemetry(
                device_id=sensor.id,
                organization_id=user.organization_id,
                temperature=str(temperature),
                humidity=str(humidity),
                motion_detected=motion,
            ))

    db.commit()


def seed_empty_registered_homes() -> None:
    db = SessionLocal()
    try:
        for user in db.query(models.User).all():
            ensure_starter_home(db, user)
    finally:
        db.close()


seed_empty_registered_homes()


@app.get("/")
def root():
    return {"message": "Home Server Secure Backend Running"}


@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    validate_password_strength(user.password)
    email = normalize_email(user.email)
    existing_user = db.query(models.User).filter(
        models.User.username == user.username
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        org = models.Organization(name=f"{user.username}_org")
        db.add(org)
        db.flush()

        new_user = models.User(
            username=user.username,
            email=email,
            hashed_password=hash_password(user.password),
            is_admin=True,
            organization_id=org.id,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        ensure_starter_home(db, new_user)
        record_event(
            db,
            "user_registered",
            new_user.organization_id,
            f"{new_user.username} registered",
            {"user_id": new_user.id, "username": new_user.username, "email": new_user.email},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or organization already exists")
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {exc}")

    return {"message": "Organization and admin user created"}


def _authenticate_user(identifier: str, password: str, db: Session) -> models.User:
    normalized = identifier.strip().lower()
    db_user = db.query(models.User).filter(
        (models.User.username == identifier) | (models.User.email == normalized)
    ).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username or email")

    if not verify_password(password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid password")

    return db_user


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        db_user = _authenticate_user(user.username, user.password, db)
    except HTTPException:
        normalized = user.username.strip().lower()
        candidate = db.query(models.User).filter(
            (models.User.username == user.username) | (models.User.email == normalized)
        ).first()
        record_event(
            db,
            "failed_login",
            candidate.organization_id if candidate else None,
            f"Failed login for {user.username}",
            {"identifier": user.username},
        )
        db.commit()
        raise
    ensure_starter_home(db, db_user)
    record_event(
        db,
        "user_login",
        db_user.organization_id,
        f"{db_user.username} signed in",
        {"user_id": db_user.id, "username": db_user.username},
    )
    db.commit()
    access_token = create_access_token({"sub": db_user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": db_user.username,
            "email": db_user.email,
            "organization_id": db_user.organization_id,
        },
    }


@app.post("/password/forgot")
def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    email = normalize_email(request.email)
    user = db.query(models.User).filter(models.User.email == email).first()
    response = {"message": "If the account exists, an OTP was sent."}

    if not user:
        record_event(
            db,
            "password_reset_requested_unknown",
            None,
            f"Password reset requested for unknown email {email}",
            {"email": email},
        )
        db.commit()
        return response

    otp = f"{secrets.randbelow(1000000):06d}"
    delivered = send_password_reset_otp(email, otp)
    if not delivered and not EXPOSE_RESET_OTP:
        record_event(
            db,
            "password_reset_email_failed",
            user.organization_id,
            f"Password reset OTP email failed for {user.email}",
            {"user_id": user.id, "username": user.username, "email": user.email},
        )
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="OTP email could not be sent. Check SMTP settings in .env.",
        )

    user.password_reset_otp_hash = hash_secret(otp)
    user.password_reset_otp_expires_at = datetime.utcnow() + timedelta(minutes=RESET_OTP_EXPIRE_MINUTES)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    record_event(
        db,
        "password_reset_requested",
        user.organization_id,
        f"Password reset OTP requested for {user.email}",
        {"user_id": user.id, "username": user.username, "email": user.email, "delivered": delivered},
    )
    db.commit()

    if EXPOSE_RESET_OTP and not delivered:
        response["otp"] = otp

    return response


@app.post("/password/verify-otp")
def verify_password_otp(otp_data: PasswordOtpVerify, db: Session = Depends(get_db)):
    email = normalize_email(otp_data.email)
    user = db.query(models.User).filter(models.User.email == email).first()

    if (
        not user
        or not user.password_reset_otp_hash
        or not user.password_reset_otp_expires_at
        or user.password_reset_otp_expires_at < datetime.utcnow()
        or not verify_secret(otp_data.otp, user.password_reset_otp_hash)
    ):
        record_event(
            db,
            "password_otp_failed",
            user.organization_id if user else None,
            f"Password reset OTP failed for {email}",
            {"email": email},
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    reset_token = secrets.token_urlsafe(32)
    user.password_reset_otp_hash = None
    user.password_reset_otp_expires_at = None
    user.password_reset_token_hash = hash_secret(reset_token)
    user.password_reset_expires_at = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    record_event(
        db,
        "password_otp_verified",
        user.organization_id,
        f"Password reset OTP verified for {user.email}",
        {"user_id": user.id, "username": user.username, "email": user.email},
    )
    db.commit()

    return {"message": "OTP verified", "reset_token": reset_token}


@app.post("/password/reset")
def reset_password(reset: PasswordResetConfirm, db: Session = Depends(get_db)):
    if reset.new_password != reset.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    validate_password_strength(reset.new_password)
    email = normalize_email(reset.email)
    user = db.query(models.User).filter(models.User.email == email).first()

    if (
        not user
        or not user.password_reset_token_hash
        or not user.password_reset_expires_at
        or user.password_reset_expires_at < datetime.utcnow()
        or not verify_secret(reset.reset_token, user.password_reset_token_hash)
    ):
        record_event(
            db,
            "password_reset_failed",
            user.organization_id if user else None,
            f"Password reset failed for {email}",
            {"email": email},
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(reset.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    record_event(
        db,
        "password_reset_completed",
        user.organization_id,
        f"Password reset completed for {user.email}",
        {"user_id": user.id, "username": user.username, "email": user.email},
    )
    db.commit()

    return {"message": "Password reset complete"}


@app.get("/protected")
def protected_route(current_user: models.User = Depends(get_current_user)):
    return {
        "message": "Access granted",
        "user": current_user.username,
        "email": current_user.email,
        "organization_id": current_user.organization_id
    }


@app.get("/events")
def list_events(
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cutoff = datetime.utcnow().timestamp() - (72 * 60 * 60)
    cutoff_dt = datetime.utcfromtimestamp(cutoff)
    db.query(models.AppEvent).filter(
        models.AppEvent.organization_id == current_user.organization_id,
        models.AppEvent.created_at < cutoff_dt,
    ).delete(synchronize_session=False)
    db.commit()

    events = db.query(models.AppEvent).filter(
        models.AppEvent.organization_id == current_user.organization_id
    ).order_by(
        models.AppEvent.created_at.desc()
    ).limit(min(limit, 200)).all()

    return [serialize_event(event) for event in events]


@app.delete("/events")
def clear_events(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.AppEvent).filter(
        models.AppEvent.organization_id == current_user.organization_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Events cleared"}


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
        device_token=hash_secret(device_token),
        owner_id=current_user.id,
        organization_id=current_user.organization_id
    )

    db.add(new_device)
    db.flush()
    record_event(
        db,
        "device_registered",
        current_user.organization_id,
        f"{new_device.name} registered",
        {"device_id": new_device.id, "device_name": new_device.name, "room": new_device.room},
    )
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
        "device_token": device_token
    }


@app.patch("/devices/{device_id}")
async def update_device(
    device_id: int,
    updates: DeviceUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == current_user.organization_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = schema_updates(updates)
    for field, value in update_data.items():
        if field == "name":
            device.name = value
        elif field == "device_type":
            device.device_type = value
        elif field == "room":
            device.room = value
        elif field == "is_active":
            device.is_active = value

    record_event(
        db,
        "device_updated",
        current_user.organization_id,
        f"{device.name} updated",
        {"device_id": device.id, "changes": update_data},
    )
    db.commit()

    await manager.broadcast({
        "event": "device_updated",
        "device_id": device.id,
        "device_name": device.name,
        "changes": update_data,
    })

    return {"message": "Device updated"}


@app.delete("/devices/{device_id}")
async def delete_device(
    device_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.organization_id == current_user.organization_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device_name = device.name

    db.query(models.DeviceTelemetry).filter(models.DeviceTelemetry.device_id == device.id).delete()
    db.query(models.DeviceCommand).filter(models.DeviceCommand.device_id == device.id).delete()
    db.query(models.AutomationRuleActivity).filter(
        (models.AutomationRuleActivity.sensor_device_id == device.id) |
        (models.AutomationRuleActivity.action_device_id == device.id)
    ).delete(synchronize_session=False)
    db.query(models.AutomationRule).filter(
        (models.AutomationRule.device_id == device.id) |
        (models.AutomationRule.action_device_id == device.id)
    ).delete(synchronize_session=False)
    db.query(models.SceneAction).filter(models.SceneAction.device_id == device.id).delete()
    db.delete(device)
    record_event(
        db,
        "device_deleted",
        current_user.organization_id,
        f"{device_name} deleted",
        {"device_id": device_id, "device_name": device_name},
    )
    db.commit()

    await manager.broadcast({
        "event": "device_deleted",
        "device_id": device_id,
        "device_name": device_name,
    })

    return {"message": "Device deleted"}


@app.post("/devices/auth")
def authenticate_device(device_data: DeviceAuthRequest, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_data.device_uid
    ).first()

    if not device:
        raise HTTPException(status_code=401, detail="Invalid device UID")

    if not verify_device_token(device, device_data.device_token, db):
        record_event(
            db,
            "device_auth_failed",
            device.organization_id,
            f"Invalid token for {device.name}",
            {"device_id": device.id, "device_uid": device.device_uid},
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid device token")

    if not device.is_active:
        raise HTTPException(status_code=403, detail="Device is inactive")

    db.commit()
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

    if not device or not verify_device_token(device, telemetry.device_token, db):
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

    if not device or not verify_device_token(device, telemetry.device_token, db):
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

    record_event(
        db,
        "telemetry_received",
        device.organization_id,
        f"Telemetry received from {device.name}",
        {
            "device_id": device.id,
            "device_name": device.name,
            "temperature": telemetry.temperature,
            "humidity": telemetry.humidity,
            "motion_detected": telemetry.motion_detected,
        },
    )
    for item in triggered_rules:
        record_event(
            db,
            "rule_triggered",
            device.organization_id,
            f"{item['rule_name']} triggered",
            item,
        )
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

    now = datetime.utcnow()
    result = []

    for device in devices:
        result.append({
            "device_id": device.id,
            "device_name": device.name,
            "device_type": device.device_type,
            "room": device.room,
            "state": device.current_state,
            "device_uid": device.device_uid,
            "is_demo_device": device.name in DEMO_DEVICE_NAMES,
            **device_presence(device, now),
        })

    return result


@app.post("/devices/demo/pulse")
async def pulse_demo_devices(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not ENABLE_DEMO_DEVICE_PULSE:
        return {"message": "Demo device pulse is disabled", "updated": 0}

    now = datetime.utcnow()
    devices = db.query(models.Device).filter(
        models.Device.organization_id == current_user.organization_id,
        models.Device.name.in_(DEMO_DEVICE_NAMES)
    ).all()

    updated = []
    cycle = int(now.timestamp() // 30)
    for index, device in enumerate(devices):
        is_active_sensor = (
            device.device_type == "sensor"
            and str(device.current_state).upper() == "ACTIVE"
        )
        online = is_active_sensor or (cycle + index) % 5 != 0
        device.last_seen = now - timedelta(seconds=random.randint(0, 12) if online else 140)
        presence = device_presence(device, now)
        updated.append({
            "device_id": device.id,
            "device_name": device.name,
            **presence,
            "last_seen": presence["last_seen"].isoformat() if presence["last_seen"] else None,
        })

        if device.device_type == "sensor" and online:
            db.add(models.DeviceTelemetry(
                device_id=device.id,
                organization_id=device.organization_id,
                temperature=str(round(random.uniform(24, 32), 1)),
                humidity=str(round(random.uniform(42, 68), 1)),
                motion_detected=random.choice([False, False, True]),
            ))

    if updated:
        record_event(
            db,
            "demo_devices_pulsed",
            current_user.organization_id,
            "Demo devices updated live presence",
            {"devices": updated},
        )

    db.commit()
    await manager.broadcast({"event": "demo_devices_pulsed", "devices": updated})

    return {"message": "Demo devices pulsed", "updated": len(updated), "devices": updated}


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

    if command_type == "TURN_ON":
        device.current_state = "ON"
    elif command_type == "TURN_OFF":
        device.current_state = "OFF"
    device.last_seen = datetime.utcnow()

    db.add(command)
    db.flush()
    presence = device_presence(device)
    record_event(
        db,
        "command_created",
        current_user.organization_id,
        f"{command_type} sent to {device.name}",
        {
            "command_id": command.id,
            "device_id": device.id,
            "device_name": device.name,
            "command_type": command_type,
            "state": device.current_state,
            "status": command.status,
            "is_online": presence["is_online"],
        },
    )
    db.commit()
    db.refresh(command)

    await manager.broadcast({
        "event": "command_created",
        "command_id": command.id,
        "device_id": device.id,
        "device_name": device.name,
        "command_type": command.command_type,
        "payload": command.payload,
        "state": device.current_state,
        "is_online": presence["is_online"],
        "presence_label": presence["presence_label"],
    })

    return {
        "message": "Command created",
        "command_id": command.id,
        "status": command.status,
        "state": device.current_state,
        "is_online": presence["is_online"],
        "presence_label": presence["presence_label"],
        "presence_age_seconds": presence["presence_age_seconds"],
        "last_seen": presence["last_seen"],
    }


@app.post("/devices/commands")
async def fetch_device_commands(
    device_data: DeviceAuthRequest,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_data.device_uid
    ).first()

    if not device or not verify_device_token(device, device_data.device_token, db):
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
        record_event(
            db,
            "commands_delivered",
            device.organization_id,
            f"{len(result)} command(s) delivered to {device.name}",
            {"device_id": device.id, "device_name": device.name, "commands": result},
        )
        db.commit()
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
    device_data: DeviceAuthRequest,
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.device_uid == device_data.device_uid
    ).first()

    if not device or not verify_device_token(device, device_data.device_token, db):
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
    device.last_seen = datetime.utcnow()
    presence = device_presence(device)

    record_event(
        db,
        "command_completed",
        device.organization_id,
        f"{command.command_type} executed by {device.name}",
        {
            "command_id": command.id,
            "device_id": device.id,
            "device_name": device.name,
            "command_type": command.command_type,
            "state": device.current_state,
            "status": command.status,
            "is_online": presence["is_online"],
        },
    )
    db.commit()

    await manager.broadcast({
        "event": "command_completed",
        "command_id": command.id,
        "device_id": device.id,
        "device_name": device.name,
        "command_type": command.command_type,
        "state": device.current_state,
        "is_online": presence["is_online"],
        "presence_label": presence["presence_label"],
    })

    return {"message": "Command marked as executed"}


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
            **device_presence(device),
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

    record_event(
        db,
        "scene_created",
        current_user.organization_id,
        f"{new_scene.name} created",
        {"scene_id": new_scene.id, "scene_name": new_scene.name},
    )
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

    result = []
    for scene in scenes:
        actions = db.query(models.SceneAction).filter(
            models.SceneAction.scene_id == scene.id
        ).all()
        result.append({
            "scene_id": scene.id,
            "name": scene.name,
            "actions": [
                {
                    "device_id": action.device_id,
                    "command_type": action.command_type,
                    "payload": action.payload,
                }
                for action in actions
            ],
        })

    return result


@app.patch("/scenes/{scene_id}")
async def update_scene(
    scene_id: int,
    updates: SceneUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scene = db.query(models.Scene).filter(
        models.Scene.id == scene_id,
        models.Scene.organization_id == current_user.organization_id
    ).first()

    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    update_data = schema_updates(updates)
    if "name" in update_data and update_data["name"]:
        scene.name = update_data["name"]

    if "actions" in update_data and update_data["actions"] is not None:
        db.query(models.SceneAction).filter(models.SceneAction.scene_id == scene.id).delete()
        for action in updates.actions:
            device = db.query(models.Device).filter(
                models.Device.id == action.device_id,
                models.Device.organization_id == current_user.organization_id
            ).first()

            if not device:
                raise HTTPException(status_code=404, detail=f"Device {action.device_id} not found")

            db.add(models.SceneAction(
                scene_id=scene.id,
                device_id=action.device_id,
                command_type=action.command_type,
                payload=action.payload,
            ))

    record_event(
        db,
        "scene_updated",
        current_user.organization_id,
        f"{scene.name} updated",
        {"scene_id": scene.id, "changes": update_data},
    )
    db.commit()

    await manager.broadcast({
        "event": "scene_updated",
        "scene_id": scene.id,
        "scene_name": scene.name,
    })

    return {"message": "Scene updated"}


@app.delete("/scenes/{scene_id}")
async def delete_scene(
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

    scene_name = scene.name
    db.query(models.SceneAction).filter(models.SceneAction.scene_id == scene.id).delete()
    db.delete(scene)
    record_event(
        db,
        "scene_deleted",
        current_user.organization_id,
        f"{scene_name} deleted",
        {"scene_id": scene_id, "scene_name": scene_name},
    )
    db.commit()

    await manager.broadcast({
        "event": "scene_deleted",
        "scene_id": scene_id,
        "scene_name": scene_name,
    })

    return {"message": "Scene deleted"}


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

        if action.command_type == "TURN_ON":
            device.current_state = "ON"
        elif action.command_type == "TURN_OFF":
            device.current_state = "OFF"
        device.last_seen = datetime.utcnow()
        presence = device_presence(device)

        created_commands.append({
            "device_id": device.id,
            "device_name": device.name,
            "command_id": command.id,
            "command_type": command.command_type,
            "payload": command.payload,
            "state": device.current_state,
            "is_online": presence["is_online"],
            "presence_label": presence["presence_label"],
        })

    db.commit()

    record_event(
        db,
        "scene_executed",
        current_user.organization_id,
        f"{scene.name} executed",
        {"scene_id": scene.id, "scene_name": scene.name, "commands": created_commands},
    )
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
    db.flush()
    record_event(
        db,
        "rule_created",
        current_user.organization_id,
        f"{new_rule.name} created",
        {"rule_id": new_rule.id, "rule_name": new_rule.name},
    )
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

    return [
        {
            "rule_id": rule.id,
            "name": rule.name,
            "device_id": rule.device_id,
            "condition_type": rule.condition_type,
            "operator": rule.operator,
            "value": rule.value,
            "action_device_id": rule.action_device_id,
            "action_command": rule.action_command,
            "is_active": rule.is_active,
        }
        for rule in rules
    ]


@app.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: int,
    updates: RuleUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(
        models.AutomationRule.id == rule_id,
        models.AutomationRule.organization_id == current_user.organization_id
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = schema_updates(updates)
    for field, value in update_data.items():
        setattr(rule, field, value)

    record_event(
        db,
        "rule_updated",
        current_user.organization_id,
        f"{rule.name} updated",
        {"rule_id": rule.id, "changes": update_data},
    )
    db.commit()

    await manager.broadcast({
        "event": "rule_updated",
        "rule_id": rule.id,
        "rule_name": rule.name,
    })

    return {"message": "Rule updated"}


@app.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(models.AutomationRule).filter(
        models.AutomationRule.id == rule_id,
        models.AutomationRule.organization_id == current_user.organization_id
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule_name = rule.name
    db.query(models.AutomationRuleActivity).filter(
        models.AutomationRuleActivity.rule_id == rule.id
    ).delete()
    db.delete(rule)
    record_event(
        db,
        "rule_deleted",
        current_user.organization_id,
        f"{rule_name} deleted",
        {"rule_id": rule_id, "rule_name": rule_name},
    )
    db.commit()

    await manager.broadcast({
        "event": "rule_deleted",
        "rule_id": rule_id,
        "rule_name": rule_name,
    })

    return {"message": "Rule deleted"}


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


_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")

from pydantic import BaseModel

class TelemetryCreate(BaseModel):
    device_uid: str
    device_token: str
    temperature: float
    humidity: float
    motion_detected: bool
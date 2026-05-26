from pydantic import BaseModel


class DeviceCreate(BaseModel):
    name: str
    device_type: str
    room: str | None = None
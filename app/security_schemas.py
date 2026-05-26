from pydantic import BaseModel
from typing import Optional


class SecurityEventCreate(BaseModel):
    device_uid: str
    device_token: str
    event_type: str
    person_label: Optional[str] = None
    confidence: Optional[float] = None
    threat_score: Optional[float] = None
    message: Optional[str] = None
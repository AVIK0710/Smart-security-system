from pydantic import BaseModel
from typing import List, Optional


class SceneActionCreate(BaseModel):
    device_id: int
    command_type: str
    payload: Optional[str] = None


class SceneCreate(BaseModel):
    name: str
    actions: List[SceneActionCreate]
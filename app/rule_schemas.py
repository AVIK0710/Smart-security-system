from pydantic import BaseModel


class RuleCreate(BaseModel):
    name: str
    device_id: int
    condition_type: str
    operator: str | None = None
    value: str | None = None
    action_device_id: int
    action_command: str
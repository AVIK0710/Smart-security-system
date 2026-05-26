from typing import Dict, Optional


latest_frames: Dict[int, bytes] = {}


def update_latest_frame(device_id: int, frame: bytes):
    latest_frames[device_id] = frame


def get_latest_frame(device_id: int) -> Optional[bytes]:
    return latest_frames.get(device_id)
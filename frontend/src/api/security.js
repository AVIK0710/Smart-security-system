import { API_BASE } from "./config.js";

export function cameraStreamUrl(cameraId, token) {
  if (!cameraId || !token) return "";
  return `${API_BASE}/security/cameras/${cameraId}/stream?token=${encodeURIComponent(token)}`;
}

export function snapshotUrl(eventId, token) {
  return `${API_BASE}/security/events/${eventId}/snapshot?token=${encodeURIComponent(token)}`;
}

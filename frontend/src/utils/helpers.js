export const PERSON_ROLES = ["Owner", "Family", "Guest", "Worker", "Blocked"];

export function normalizeText(text = "") {
  return text.toLowerCase().trim();
}

export function commandTypeFromSpeech(text = "") {
  const value = normalizeText(text);
  if (value.includes("turn on") || value.includes("switch on"))
    return "TURN_ON";
  if (value.includes("turn off") || value.includes("switch off"))
    return "TURN_OFF";
  return null;
}

export function findBestDevice(devices, text) {
  const value = normalizeText(text);
  return devices.find((d) => value.includes(normalizeText(d.device_name)));
}

export function findBestScene(scenes, text) {
  const value = normalizeText(text);
  return scenes.find((s) => value.includes(normalizeText(s.name)));
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

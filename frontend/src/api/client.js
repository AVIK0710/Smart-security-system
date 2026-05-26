import { API_BASE } from "./config.js";

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const type = response.headers.get("content-type") || "";

  const data = type.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const msg = typeof data === "object" && data.detail ? data.detail : data;
    throw new Error(msg || "Request failed");
  }

  return data;
}

export function authHeaders(token, extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

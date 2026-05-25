const useDevProxy = import.meta.env.DEV;

export const API_BASE = useDevProxy ? "/api" : "";
export const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

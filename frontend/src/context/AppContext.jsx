import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Chart from "chart.js/auto";
import { api, authHeaders } from "../api/client.js";
import { WS_URL } from "../api/config.js";
import {
  commandTypeFromSpeech,
  findBestDevice,
  findBestScene,
  normalizeText,
} from "../utils/helpers.js";

const AppContext = createContext(null);

const KNOWN_PEOPLE_KEY = "smart_home_known_people";
const TOKEN_KEY = "smart_home_token";

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [currentView, setCurrentView] = useState("overview");
  const [devices, setDevices] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [scenes, setScenes] = useState([]);
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState(0);
  const [knownPeople, setKnownPeople] = useState(() =>
    JSON.parse(localStorage.getItem(KNOWN_PEOPLE_KEY) || "[]"),
  );
  const [provisioningLog, setProvisioningLog] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [backendStatus, setBackendStatus] = useState("checking");
  const [socketStatus, setSocketStatus] = useState("offline");
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("Speak a device or scene command.");
  const [voiceResult, setVoiceResult] = useState("Voice is ready");
  const [listening, setListening] = useState(false);

  const [telemetryDeviceId, setTelemetryDeviceId] = useState("");
  const [motionEvents, setMotionEvents] = useState([]);
  const [authTab, setAuthTab] = useState("login");

  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const tempChartRef = useRef(null);
  const humidityChartRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const humidityCanvasRef = useRef(null);

  const toast = useCallback((message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const addEvent = useCallback((eventData) => {
    setEvents((prev) => {
      const next = [{ time: new Date(), data: eventData }, ...prev].slice(0, 100);
      return next;
    });
    if (
      eventData.event === "rule_triggered" ||
      (eventData.event === "telemetry" && eventData.motion_detected)
    ) {
      setAlerts((a) => a + 1);
    }
  }, []);

  const switchView = useCallback(
    (viewId, options = {}) => {
      if (viewId !== "access" && !token) {
        setCurrentView("access");
        if (options.authTab) setAuthTab(options.authTab);
        return;
      }
      setCurrentView(viewId);
    },
    [token],
  );

  const goToLogin = useCallback(() => {
    setAuthTab("login");
    setCurrentView("access");
  }, []);

  const goToRegister = useCallback(() => {
    setAuthTab("register");
    setCurrentView("access");
  }, []);

  const checkBackend = useCallback(async () => {
    setBackendStatus("checking");
    try {
      await api("/");
      setBackendStatus("online");
      return true;
    } catch {
      setBackendStatus("offline");
      toast("Backend is not reachable on port 8000");
      return false;
    }
  }, [toast]);

  const loadDevices = useCallback(async () => {
    if (!token) return;
    const data = await api("/devices", { headers: authHeaders(token) });
    setDevices(data);
    if (data.length && !telemetryDeviceId) {
      setTelemetryDeviceId(String(data[0].device_id));
    }
  }, [token, telemetryDeviceId]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    const data = await api("/dashboard", { headers: authHeaders(token) });
    setDashboard(data);
  }, [token]);

  const loadScenes = useCallback(async () => {
    if (!token) return;
    const data = await api("/scenes", { headers: authHeaders(token) });
    setScenes(data);
  }, [token]);

  const loadRules = useCallback(async () => {
    if (!token) return;
    const data = await api("/rules", { headers: authHeaders(token) });
    setRules(data);
  }, [token]);

  const renderMotion = useCallback((items) => {
    setMotionEvents(items);
  }, []);

  const loadTelemetryHistory = useCallback(async () => {
    if (!token || !telemetryDeviceId || !tempChartRef.current) return;

    try {
      const telemetry = await api(`/devices/${telemetryDeviceId}/telemetry?limit=30`, {
        headers: authHeaders(token),
      });

      const sorted = [...telemetry].reverse();
      const labels = sorted.map((item) => new Date(item.created_at).toLocaleTimeString());
      tempChartRef.current.data.labels = labels;
      tempChartRef.current.data.datasets[0].data = sorted.map((item) => Number(item.temperature));
      humidityChartRef.current.data.labels = labels;
      humidityChartRef.current.data.datasets[0].data = sorted.map((item) => Number(item.humidity));
      tempChartRef.current.update();
      humidityChartRef.current.update();
      renderMotion(sorted.filter((item) => item.motion_detected));
    } catch (error) {
      toast(error.message);
    }
  }, [token, telemetryDeviceId, toast, renderMotion]);

  const refreshAll = useCallback(async () => {
    await checkBackend();
    if (!token) {
      switchView("access");
      return;
    }
    try {
      await Promise.all([loadDevices(), loadDashboard(), loadScenes(), loadRules()]);
      await loadTelemetryHistory();
    } catch (error) {
      toast(error.message);
    }
  }, [
    checkBackend,
    token,
    switchView,
    loadDevices,
    loadDashboard,
    loadScenes,
    loadRules,
    loadTelemetryHistory,
    toast,
  ]);

  const sendCommand = useCallback(
    async (deviceId, commandType, source = "manual") => {
      try {
        const data = await api(
          `/devices/${deviceId}/command?command_type=${encodeURIComponent(commandType)}`,
          { method: "POST", headers: authHeaders(token) },
        );
        addEvent({
          event: `${source}_command_sent`,
          device_id: deviceId,
          command_type: commandType,
          response: data,
        });
        toast(`${commandType} sent`);
        await refreshAll();
      } catch (error) {
        toast(error.message);
      }
    },
    [token, addEvent, toast, refreshAll],
  );

  const runScene = useCallback(
    async (sceneId, source = "manual") => {
      try {
        const data = await api(`/scenes/${sceneId}/run`, {
          method: "POST",
          headers: authHeaders(token),
        });
        addEvent({ event: `${source}_scene_run`, scene_id: sceneId, response: data });
        toast("Scene started");
        await refreshAll();
      } catch (error) {
        toast(error.message);
      }
    },
    [token, addEvent, toast, refreshAll],
  );

  const addLiveTelemetry = useCallback(
    (data) => {
      if (!tempChartRef.current) return;
      if (telemetryDeviceId && data.device_id !== Number(telemetryDeviceId)) return;

      const time = new Date().toLocaleTimeString();
      tempChartRef.current.data.labels.push(time);
      tempChartRef.current.data.datasets[0].data.push(Number(data.temperature));
      humidityChartRef.current.data.labels.push(time);
      humidityChartRef.current.data.datasets[0].data.push(Number(data.humidity));

      [tempChartRef, humidityChartRef].forEach((ref) => {
        if (ref.current.data.labels.length > 30) {
          ref.current.data.labels.shift();
          ref.current.data.datasets[0].data.shift();
        }
        ref.current.update();
      });

      if (data.motion_detected) {
        renderMotion([
          { created_at: new Date(), device_id: data.device_id, motion_detected: true },
        ]);
      }
    },
    [telemetryDeviceId, renderMotion],
  );

  const connectWebSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.close();

    setSocketStatus("connecting");
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketStatus("online");
      addEvent({ event: "websocket_connected" });
    };

    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      addEvent(data);
      if (data.event === "telemetry") addLiveTelemetry(data);
      refreshAll();
    };

    socket.onerror = () => {
      setSocketStatus("offline");
      addEvent({ event: "websocket_error" });
    };

    socket.onclose = () => setSocketStatus("offline");
  }, [addEvent, addLiveTelemetry, refreshAll]);

  const handleVoiceCommand = useCallback(
    async (spokenText) => {
      if (!token) {
        switchView("access");
        toast("Login first");
        return;
      }

      const normalized = normalizeText(spokenText);
      setVoiceTranscript(spokenText);
      addEvent({ event: "voice_heard", text: spokenText });

      if (
        normalized.includes("scene") ||
        normalized.includes("mode") ||
        normalized.includes("activate") ||
        normalized.includes("start")
      ) {
        const scene = findBestScene(scenes, spokenText);
        if (scene) {
          setVoiceResult(`Running scene: ${scene.name}`);
          await runScene(scene.scene_id, "voice");
          return;
        }
      }

      const commandType = commandTypeFromSpeech(spokenText);
      const device = findBestDevice(devices, spokenText);

      if (!commandType || !device) {
        setVoiceResult(
          "Command not matched. Try: turn on AC, turn off bedroom light, start night mode.",
        );
        addEvent({ event: "voice_not_matched", text: spokenText });
        return;
      }

      setVoiceResult(`${commandType} sent to ${device.device_name}`);
      await sendCommand(device.device_id, commandType, "voice");
    },
    [token, scenes, devices, switchView, toast, addEvent, runScene, sendCommand],
  );

  const initVoiceRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("unsupported");
      setVoiceResult(
        "Speech recognition is not supported in this browser. Use Chrome or Edge.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("listening");
      setVoiceResult("Listening...");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      handleVoiceCommand(spokenText);
    };

    recognition.onerror = (event) => {
      toast(`Voice error: ${event.error}`);
      setVoiceStatus("ready");
    };

    recognition.onend = () => {
      setListening(false);
      setVoiceStatus("ready");
    };

    recognitionRef.current = recognition;
    setVoiceStatus("ready");
  }, [handleVoiceCommand, toast]);

  const startVoice = useCallback(() => {
    if (!recognitionRef.current) initVoiceRecognition();
    if (!recognitionRef.current || listening) return;
    switchView("overview");
    recognitionRef.current.start();
  }, [initVoiceRecognition, listening, switchView]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current && listening) recognitionRef.current.stop();
  }, [listening]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setDevices([]);
    setDashboard({});
    if (socketRef.current) socketRef.current.close();
    setSocketStatus("offline");
    switchView("access");
  }, [switchView]);

  const login = useCallback(
    async (username, password) => {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      const data = await api("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      setToken(data.access_token);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      connectWebSocket();
      switchView("overview");
      toast("Signed in");
    },
    [connectWebSocket, switchView, toast],
  );

  const register = useCallback(
    async (username, password) => {
      await api("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setAuthTab("login");
      setCurrentView("access");
      toast("Account created. Log in with your new credentials.");
      return username;
    },
    [toast],
  );

  const registerDevice = useCallback(
    async (payload) => {
      const data = await api("/devices/register", {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      setProvisioningLog((prev) => [
        { id: Date.now(), label: "Device credentials", data },
        ...prev,
      ]);
      await refreshAll();
      toast("Device registered");
    },
    [token, refreshAll, toast],
  );

  const createScene = useCallback(
    async (payload) => {
      await api("/scenes", {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      await refreshAll();
      toast("Scene created");
    },
    [token, refreshAll, toast],
  );

  const createRule = useCallback(
    async (payload) => {
      await api("/rules", {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      await refreshAll();
      toast("Rule created");
    },
    [token, refreshAll, toast],
  );

  const addKnownPerson = useCallback((person) => {
    setKnownPeople((prev) => {
      const next = [person, ...prev];
      localStorage.setItem(KNOWN_PEOPLE_KEY, JSON.stringify(next));
      return next;
    });
    toast("Person added to security records");
  }, [toast]);

  const removeKnownPerson = useCallback((id) => {
    setKnownPeople((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem(KNOWN_PEOPLE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const metrics = useMemo(() => {
    const rooms = new Set(devices.map((d) => d.room || "Unassigned"));
    const online = devices.filter((d) => d.is_online).length;
    const offline = Math.max(devices.length - online, 0);
    const homeStatusText =
      offline === 0 ? "All Devices Online" : `${offline} Device${offline === 1 ? "" : "s"} Offline`;
    const safeStatusTitle = offline === 0 ? "All Systems Normal" : "Attention Needed";
    const safeStatusText =
      offline === 0
        ? "Your home is safe and smart."
        : "Some devices are offline or not responding.";
    const energyLoad = devices.length
      ? `${online} active across ${rooms.size} room${rooms.size === 1 ? "" : "s"}`
      : "No active devices yet";
    return {
      total: devices.length,
      online,
      offline,
      alerts,
      homeStatusText,
      safeStatusTitle,
      safeStatusText,
      energyLoad,
    };
  }, [devices, alerts]);

  const roomEntries = useMemo(() => Object.entries(dashboard), [dashboard]);
  const selectedRoom = roomEntries[0]?.[0] ?? "Rooms";
  const selectedRoomCount = roomEntries[0]?.[1]?.length ?? 0;

  useEffect(() => {
    initVoiceRecognition();
    checkBackend();
  }, [initVoiceRecognition, checkBackend]);

  useEffect(() => {
    if (token) {
      connectWebSocket();
      refreshAll();
    } else {
      switchView("access");
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tempCanvasRef.current || !humidityCanvasRef.current) return;
    if (tempChartRef.current) return;

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#1f2937" } } },
      scales: {
        x: { ticks: { color: "#475569" }, grid: { color: "#e5e7eb" } },
        y: { ticks: { color: "#475569" }, grid: { color: "#e5e7eb" } },
      },
    };

    tempChartRef.current = new Chart(tempCanvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Temperature",
            data: [],
            borderColor: "#fb7185",
            backgroundColor: "rgba(251,113,133,0.12)",
            tension: 0.32,
            fill: true,
          },
        ],
      },
      options: baseOptions,
    });

    humidityChartRef.current = new Chart(humidityCanvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Humidity",
            data: [],
            borderColor: "#22d3ee",
            backgroundColor: "rgba(34,211,238,0.12)",
            tension: 0.32,
            fill: true,
          },
        ],
      },
      options: baseOptions,
    });

    return () => {
      tempChartRef.current?.destroy();
      humidityChartRef.current?.destroy();
      tempChartRef.current = null;
      humidityChartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (token && telemetryDeviceId && tempChartRef.current) {
      loadTelemetryHistory();
    }
  }, [telemetryDeviceId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    token,
    currentView,
    switchView,
    goToLogin,
    goToRegister,
    devices,
    dashboard,
    scenes,
    rules,
    events,
    knownPeople,
    provisioningLog,
    toasts,
    backendStatus,
    socketStatus,
    voiceStatus,
    voiceTranscript,
    voiceResult,
    listening,
    telemetryDeviceId,
    setTelemetryDeviceId,
    motionEvents,
    authTab,
    setAuthTab,
    metrics,
    roomEntries,
    selectedRoom,
    selectedRoomCount,
    toast,
    refreshAll,
    sendCommand,
    runScene,
    startVoice,
    stopVoice,
    logout,
    login,
    register,
    registerDevice,
    createScene,
    createRule,
    addKnownPerson,
    removeKnownPerson,
    clearEvents,
    tempCanvasRef,
    humidityCanvasRef,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

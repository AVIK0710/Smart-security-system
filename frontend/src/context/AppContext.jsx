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
const TOKEN_KEY = "smart_home_token";
const KNOWN_PEOPLE_KEY = "smart_home_known_people";

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [currentView, setCurrentView] = useState("overview");

  const [devices, setDevices] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [scenes, setScenes] = useState([]);
  const [rules, setRules] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);

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
  const [voiceTranscript, setVoiceTranscript] = useState("Speak a command");
  const [voiceResult, setVoiceResult] = useState("Voice ready");
  const [listening, setListening] = useState(false);

  const [telemetryDeviceId, setTelemetryDeviceId] = useState("");
  const [motionEvents, setMotionEvents] = useState([]);
  const [authTab, setAuthTab] = useState("login");

  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const humidityCanvasRef = useRef(null);
  const tempChartRef = useRef(null);
  const humidityChartRef = useRef(null);

  const toast = useCallback((message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3500,
    );
  }, []);

  const addEvent = useCallback((data) => {
    setEvents((prev) => [{ time: new Date(), data }, ...prev].slice(0, 100));

    if (
      data.event === "intruder_alert" ||
      data.event === "rule_triggered" ||
      (data.event === "telemetry" && data.motion_detected)
    ) {
      setAlerts((prev) => prev + 1);
    }
  }, []);

  const switchView = useCallback(
    (view) => {
      if (view !== "access" && !token) {
        setCurrentView("access");
        return;
      }
      setCurrentView(view);
    },
    [token],
  );

  const checkBackend = useCallback(async () => {
    try {
      await api("/");
      setBackendStatus("online");
    } catch {
      setBackendStatus("offline");
    }
  }, []);

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
    setDashboard(await api("/dashboard", { headers: authHeaders(token) }));
  }, [token]);

  const loadScenes = useCallback(async () => {
    if (!token) return;
    setScenes(await api("/scenes", { headers: authHeaders(token) }));
  }, [token]);

  const loadRules = useCallback(async () => {
    if (!token) return;
    setRules(await api("/rules", { headers: authHeaders(token) }));
  }, [token]);

  const loadSecurityEvents = useCallback(async () => {
    if (!token) return;
    setSecurityEvents(
      await api("/security/events?limit=50", { headers: authHeaders(token) }),
    );
  }, [token]);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setNotifications(
      await api("/notifications?limit=50", { headers: authHeaders(token) }),
    );
  }, [token]);

  const loadTelemetryHistory = useCallback(async () => {
    if (
      !token ||
      !telemetryDeviceId ||
      !tempChartRef.current ||
      !humidityChartRef.current
    )
      return;

    try {
      const data = await api(
        `/devices/${telemetryDeviceId}/telemetry?limit=30`,
        {
          headers: authHeaders(token),
        },
      );

      const sorted = [...data].reverse();
      const labels = sorted.map((x) =>
        new Date(x.created_at).toLocaleTimeString(),
      );

      tempChartRef.current.data.labels = labels;
      tempChartRef.current.data.datasets[0].data = sorted.map((x) =>
        Number(x.temperature),
      );

      humidityChartRef.current.data.labels = labels;
      humidityChartRef.current.data.datasets[0].data = sorted.map((x) =>
        Number(x.humidity),
      );

      tempChartRef.current.update();
      humidityChartRef.current.update();

      setMotionEvents(sorted.filter((x) => x.motion_detected));
    } catch (err) {
      toast(err.message);
    }
  }, [token, telemetryDeviceId, toast]);

  const refreshAll = useCallback(async () => {
    await checkBackend();
    if (!token) {
      setCurrentView("access");
      return;
    }

    try {
      await Promise.all([
        loadDevices(),
        loadDashboard(),
        loadScenes(),
        loadRules(),
        loadSecurityEvents(),
        loadNotifications(),
      ]);
      await loadTelemetryHistory();
    } catch (err) {
      toast(err.message);
    }
  }, [
    token,
    checkBackend,
    loadDevices,
    loadDashboard,
    loadScenes,
    loadRules,
    loadSecurityEvents,
    loadNotifications,
    loadTelemetryHistory,
    toast,
  ]);

  const sendCommand = useCallback(
    async (deviceId, commandType, source = "manual") => {
      try {
        const data = await api(
          `/devices/${deviceId}/command?command_type=${commandType}`,
          {
            method: "POST",
            headers: authHeaders(token),
          },
        );

        addEvent({ event: `${source}_command_sent`, response: data });
        await refreshAll();
      } catch (err) {
        toast(err.message);
      }
    },
    [token, addEvent, refreshAll, toast],
  );

  const runScene = useCallback(
    async (sceneId, source = "manual") => {
      try {
        const data = await api(`/scenes/${sceneId}/run`, {
          method: "POST",
          headers: authHeaders(token),
        });
        addEvent({ event: `${source}_scene_run`, response: data });
        await refreshAll();
      } catch (err) {
        toast(err.message);
      }
    },
    [token, addEvent, refreshAll, toast],
  );

  const addLiveTelemetry = useCallback(
    (data) => {
      if (!tempChartRef.current || !humidityChartRef.current) return;
      if (telemetryDeviceId && data.device_id !== Number(telemetryDeviceId))
        return;

      const label = new Date().toLocaleTimeString();

      tempChartRef.current.data.labels.push(label);
      tempChartRef.current.data.datasets[0].data.push(Number(data.temperature));

      humidityChartRef.current.data.labels.push(label);
      humidityChartRef.current.data.datasets[0].data.push(
        Number(data.humidity),
      );

      [tempChartRef.current, humidityChartRef.current].forEach((chart) => {
        if (chart.data.labels.length > 30) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
        }
        chart.update();
      });

      if (data.motion_detected) {
        setMotionEvents((prev) => [
          {
            created_at: new Date(),
            device_id: data.device_id,
            motion_detected: true,
          },
          ...prev,
        ]);
      }
    },
    [telemetryDeviceId],
  );

  const connectWebSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.close();

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    setSocketStatus("connecting");

    socket.onopen = () => {
      setSocketStatus("online");
      addEvent({ event: "websocket_connected" });
    };

    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      addEvent(data);
      if (data.event === "telemetry") addLiveTelemetry(data);
      if (data.event === "intruder_alert") {
        loadSecurityEvents();
        loadNotifications();
      }
      refreshAll();
    };

    socket.onerror = () => {
      setSocketStatus("offline");
      addEvent({ event: "websocket_error" });
    };

    socket.onclose = () => setSocketStatus("offline");
  }, [
    addEvent,
    addLiveTelemetry,
    refreshAll,
    loadSecurityEvents,
    loadNotifications,
  ]);

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

      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setCurrentView("overview");
      toast("Logged in");
    },
    [toast],
  );

  const register = useCallback(
    async (username, password) => {
      await api("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setAuthTab("login");
      toast("Registered. Please login.");
    },
    [toast],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCurrentView("access");
    setDevices([]);
    setDashboard({});
    if (socketRef.current) socketRef.current.close();
  }, []);

  const registerDevice = useCallback(
    async (payload) => {
      const data = await api("/devices/register", {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      setProvisioningLog((prev) => [{ id: Date.now(), data }, ...prev]);
      await refreshAll();
      toast("Device registered. Save credentials.");
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

  const addKnownPerson = useCallback(
    (person) => {
      setKnownPeople((prev) => {
        const next = [person, ...prev];
        localStorage.setItem(KNOWN_PEOPLE_KEY, JSON.stringify(next));
        return next;
      });
      toast("Person added");
    },
    [toast],
  );

  const removeKnownPerson = useCallback((id) => {
    setKnownPeople((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem(KNOWN_PEOPLE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const handleVoiceCommand = useCallback(
    async (text) => {
      const normalized = normalizeText(text);
      setVoiceTranscript(text);

      const commandType = commandTypeFromSpeech(normalized);
      const scene = findBestScene(scenes, normalized);
      const device = findBestDevice(devices, normalized);

      if (scene) {
        setVoiceResult(`Running ${scene.name}`);
        await runScene(scene.scene_id, "voice");
        return;
      }

      if (commandType && device) {
        setVoiceResult(`${commandType} ${device.device_name}`);
        await sendCommand(device.device_id, commandType, "voice");
        return;
      }

      setVoiceResult("Voice command not matched");
    },
    [devices, scenes, runScene, sendCommand],
  );

  const initVoiceRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("listening");
    };

    recognition.onresult = (event) => {
      handleVoiceCommand(event.results[0][0].transcript);
    };

    recognition.onend = () => {
      setListening(false);
      setVoiceStatus("ready");
    };

    recognitionRef.current = recognition;
    setVoiceStatus("ready");
  }, [handleVoiceCommand]);

  const startVoice = useCallback(() => {
    if (!recognitionRef.current) initVoiceRecognition();
    recognitionRef.current?.start();
  }, [initVoiceRecognition]);

  const stopVoice = useCallback(() => recognitionRef.current?.stop(), []);

  const metrics = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.is_online).length;
    const offline = total - online;

    return {
      total,
      online,
      offline,
      alerts,
      homeStatusText: offline
        ? `${offline} devices offline`
        : "All devices online",
      safeStatusTitle: alerts ? "Security Alert Active" : "All Systems Normal",
      safeStatusText: alerts ? "Check security alerts" : "System is stable",
      energyLoad: `${online} active devices`,
    };
  }, [devices, alerts]);

  const roomEntries = useMemo(() => Object.entries(dashboard), [dashboard]);
  const selectedRoom = roomEntries[0]?.[0] || "Rooms";
  const selectedRoomCount = roomEntries[0]?.[1]?.length || 0;

  useEffect(() => {
    checkBackend();
    initVoiceRecognition();
  }, [checkBackend, initVoiceRecognition]);

  useEffect(() => {
    if (token) {
      connectWebSocket();
      refreshAll();
    } else {
      setCurrentView("access");
    }

    return () => socketRef.current?.close();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      !tempCanvasRef.current ||
      !humidityCanvasRef.current ||
      tempChartRef.current
    )
      return;

    tempChartRef.current = new Chart(tempCanvasRef.current, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Temperature", data: [] }] },
    });

    humidityChartRef.current = new Chart(humidityCanvasRef.current, {
      type: "line",
      data: { labels: [], datasets: [{ label: "Humidity", data: [] }] },
    });

    return () => {
      tempChartRef.current?.destroy();
      humidityChartRef.current?.destroy();
      tempChartRef.current = null;
      humidityChartRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadTelemetryHistory();
  }, [telemetryDeviceId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider
      value={{
        token,
        currentView,
        switchView,
        devices,
        dashboard,
        scenes,
        rules,
        securityEvents,
        notifications,
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
        loadSecurityEvents,
        loadNotifications,
        tempCanvasRef,
        humidityCanvasRef,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

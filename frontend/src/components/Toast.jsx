import { useApp } from "../context/AppContext.jsx";

export default function Toast() {
  const { toasts } = useApp();

  return (
    <div className="toast-wrap">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          <span className="font-sans text-sm">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

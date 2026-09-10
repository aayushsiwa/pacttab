"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-600/30 bg-amber-500/90 px-4 py-2 text-xs font-semibold text-amber-950 shadow-sm backdrop-blur-sm dark:bg-amber-600 dark:text-white"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You are currently offline. Real-time updates and sync will resume when you reconnect.
      </span>
    </div>
  );
}

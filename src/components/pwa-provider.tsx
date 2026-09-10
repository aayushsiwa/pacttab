"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextType {
  isInstallable: boolean;
  install: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  install: async () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.error("[PWA] Service Worker registration failed:", error);
          });
      });
    }

    // 2. Listen for install prompt
    const isDismissed = localStorage.getItem("pacttab_pwa_dismissed");

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      console.log("[PWA] PactTab successfully installed!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pacttab_pwa_dismissed", "true");
  };

  return (
    <PwaContext.Provider value={{ isInstallable: !!deferredPrompt, install }}>
      {children}

      {showBanner && deferredPrompt && (
        <aside
          aria-label="Install PactTab"
          className="animate-in fade-in slide-in-from-bottom-4 fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md duration-200"
        >
          <div className="border-border/80 bg-card/95 flex items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 font-black text-white shadow-sm">
                ₹
              </div>
              <div className="min-w-0">
                <p className="text-foreground text-xs font-bold">Install PactTab</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  Add to home screen for instant offline access
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                onClick={install}
                className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground h-8 w-8 cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>
      )}
    </PwaContext.Provider>
  );
}

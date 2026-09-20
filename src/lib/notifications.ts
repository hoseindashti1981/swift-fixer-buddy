import { useEffect, useState } from "react";

export type NotifyStatus =
  | "granted"
  | "denied"
  | "default"
  | "unsupported"
  | "open-in-new-tab"
  | "needs-install";

export function getNotifyStatus(): NotifyStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    // On iOS, web notifications only exist once the app is added to the home screen.
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIos && !standalone) return "needs-install";
    return "unsupported";
  }
  if (window.top !== window.self) return "open-in-new-tab";
  return Notification.permission as "granted" | "denied" | "default";
}

export async function enableNotifications(): Promise<NotifyStatus> {
  const status = getNotifyStatus();
  if (status !== "default") return status;
  const permission = await Notification.requestPermission();
  return permission as NotifyStatus;
}

/** Show a local notification (no server needed — the app itself triggers it). */
export async function notify(title: string, body: string, url = "/") {
  if (getNotifyStatus() !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const options: NotificationOptions = {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "fa",
      tag: "ai-answer",
      data: { url },
    };
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    /* notifications are optional */
  }
}

export function useNotifyStatus() {
  const [status, setStatus] = useState<NotifyStatus>("unsupported");
  useEffect(() => {
    setStatus(getNotifyStatus());
  }, []);
  return {
    status,
    enable: async () => setStatus(await enableNotifications()),
  };
}

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function PwaStatus() {
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [ios, setIos] = useState(false);
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    let alive = true;
    const sync = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => {
      setInstall(null);
      setIos(false);
    };
    const error = () => setFailed(true);
    const available = (event: Event) => setUpdate((event as CustomEvent<ServiceWorker>).detail);
    sync();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !window.matchMedia("(display-mode: standalone)").matches,
    );
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("pwa-error", error);
    window.addEventListener("pwa-update", available);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (alive) setReady(true);
      });
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (
            alive &&
            registration?.waiting &&
            registration.active &&
            navigator.serviceWorker.controller
          )
            setUpdate(registration.waiting);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("pwa-error", error);
      window.removeEventListener("pwa-update", available);
    };
  }, []);
  useEffect(() => {
    if (!reloading || !("serviceWorker" in navigator)) return;
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    update?.postMessage({ type: "SKIP_WAITING" });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, [reloading, update]);

  return (
    <aside
      aria-label="وضعیت برنامه"
      className="mx-auto max-w-xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <p role="status">
          {!online
            ? "آفلاین · هوش مصنوعی آنلاین در دسترس نیست"
            : failed
              ? "آماده‌سازی آفلاین انجام نشد؛ صفحه را دوباره باز کنید"
              : ready
                ? "آمادهٔ استفادهٔ آفلاین"
                : "راهنمای جیبی پکیج"}
        </p>
        {install && (
          <button
            className="rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground"
            onClick={async () => {
              try {
                await install.prompt();
                await install.userChoice;
              } catch {
                setInstall(null);
              } finally {
                setInstall(null);
              }
            }}
          >
            نصب برنامه
          </button>
        )}
        {update && (
          <button
            disabled={reloading}
            className="rounded-lg border border-primary px-3 py-2 text-primary"
            onClick={() => setReloading(true)}
          >
            نصب نسخهٔ جدید و بازخوانی صفحه
          </button>
        )}
        {ios && (
          <p className="leading-6">برای نصب در Safari: اشتراک‌گذاری ← افزودن به صفحهٔ اصلی</p>
        )}
      </div>
    </aside>
  );
}

export async function verifyOfflineAssets(): Promise<boolean> {
  if (
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller ||
    !("caches" in window)
  )
    return false;
  try {
    const response = await fetch("/offline-assets.json");
    if (!response.ok) return false;
    const manifest = await response.json();
    if (manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length < 2)
      return false;
    const present = await Promise.all(
      manifest.entries.map(async (entry: { url: string; revision: string | null }) => {
        const url = new URL(entry.url, location.origin);
        if (url.origin !== location.origin) return false;
        if (entry.revision !== null) url.searchParams.set("__WB_REVISION__", entry.revision);
        return Boolean(await caches.match(url.href));
      }),
    );
    return present.every(Boolean);
  } catch {
    return false;
  }
}

import { useEffect } from "react";
import { parseSearchState, type SearchState } from "./search-state";
const storageKey = "library-search-position-v1";
const stateKey = (state: SearchState) => JSON.stringify(parseSearchState(state));
export function saveSearchPosition(state: SearchState) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ key: stateKey(state), y: window.scrollY }));
  } catch {
    /* Reading remains usable when browser storage is disabled. */
  }
}
export function useSearchPosition(state: SearchState) {
  const key = stateKey(state);
  useEffect(() => {
    let frame = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved?.key === key && Number.isFinite(saved.y) && saved.y >= 0) {
        // Wait for the route and router scroll effects before restoring the result list.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() =>
            window.scrollTo({ top: saved.y, behavior: "instant" }),
          );
        });
      }
    } catch {
      /* Malformed or unavailable session data is ignored. */
    }
    const snapshot = () => saveSearchPosition(JSON.parse(key));
    window.addEventListener("pagehide", snapshot);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pagehide", snapshot);
    };
  }, [key]);
}

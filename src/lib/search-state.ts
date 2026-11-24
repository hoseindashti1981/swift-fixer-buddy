export type SearchState = {
  favorites?: boolean;
  q?: string;
  model?: string;
  brand?: string;
  category?: string;
  limit?: number;
};
export function parseSearchState(raw: Record<string, unknown>): SearchState {
  const state: SearchState = {};
  if (raw["favorites"] === true || raw["favorites"] === "true") state.favorites = true;
  for (const key of ["q", "model", "brand", "category"] as const) {
    const value = raw[key];
    if (typeof value === "string" && value.trim())
      state[key] = value.slice(0, key === "q" ? 1000 : 80);
  }
  const limit = Number(raw["limit"]);
  if (Number.isFinite(limit) && limit > 25) state.limit = Math.min(1000, Math.floor(limit));
  return state;
}

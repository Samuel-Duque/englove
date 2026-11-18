export type AppearancePreference = "system" | "light" | "dark";

// Mantener las claves en sync con public/origami-appearance.js.
const PREFERENCE_KEY = "upward_english_appearance";
const GENERATION_KEY = "upward_english_appearance_epoch";
const listeners = new Set<() => void>();
let boundGeneration: number | null = null;

export function getAppearance(): AppearancePreference {
  if (typeof document === "undefined") return "system";
  const value = document.documentElement?.dataset?.appearance;
  return value === "light" || value === "dark" ? value : "system";
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredGeneration(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage?.getItem(GENERATION_KEY);
    if (!stored) return null;
    const generation = Number(stored);
    return Number.isSafeInteger(generation) && generation >= 0
      ? generation
      : null;
  } catch {
    return null;
  }
}

function removePersistedAppearance() {
  try {
    window.sessionStorage?.removeItem(PREFERENCE_KEY);
    window.sessionStorage?.removeItem(GENERATION_KEY);
  } catch {
    // La preferencia sigue funcionando en memoria en data-appearance.
  }
}

function persistAppearance(preference: AppearancePreference) {
  if (typeof window === "undefined") return;
  if (preference === "system") {
    removePersistedAppearance();
    return;
  }
  try {
    const storage = window.sessionStorage;
    if (boundGeneration === null) storage?.removeItem(GENERATION_KEY);
    else storage?.setItem(GENERATION_KEY, String(boundGeneration));
    storage?.setItem(PREFERENCE_KEY, preference);
  } catch {
    removePersistedAppearance();
  }
}

function applyAppearance(preference: AppearancePreference) {
  if (typeof document === "undefined" || !document.documentElement?.dataset)
    return;
  const before = getAppearance();
  if (preference === "system")
    delete document.documentElement.dataset.appearance;
  else document.documentElement.dataset.appearance = preference;
  persistAppearance(preference);
  if (before !== preference) {
    for (const listener of listeners) listener();
  }
}

export function setAppearance(preference: AppearancePreference) {
  boundGeneration ??= readStoredGeneration();
  applyAppearance(preference);
}

export function resetAppearance() {
  boundGeneration = null;
  if (typeof document !== "undefined" && document.documentElement) {
    applyAppearance("system");
  } else if (typeof window !== "undefined") {
    removePersistedAppearance();
  }
}

export function resetAuthenticatedAppearance() {
  if (boundGeneration !== null || readStoredGeneration() !== null) {
    resetAppearance();
  }
}

export function bindAppearanceSession(generation: number) {
  if (typeof window === "undefined" || boundGeneration === generation) return;
  boundGeneration = generation;
  // La generación permite descartar una elección obsoleta al recargar, sin
  // duplicar el identificador de cuenta almacenado por la coordinación de sesión.
  persistAppearance(getAppearance());
}

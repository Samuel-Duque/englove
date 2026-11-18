import { afterEach, expect, it, vi } from "vitest";
import { Role, type SessionView } from "@upward-english/shared";
import {
  clearSharedSession,
  fetchSharedSession,
  getSharedSession,
  requestSharedRefresh,
  SESSION_EPOCH_KEY,
  setSessionAppearance,
  setSharedSession,
} from "../src/lib/auth-session";
import { getAppearance, setAppearance } from "../src/lib/appearance";

const appearanceKey = "upward_english_appearance";

function mockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

function useBrowser() {
  const sessionStorage = mockStorage();
  const localStorage = mockStorage();
  const dataset: DOMStringMap = {};
  vi.stubGlobal("window", { sessionStorage, localStorage });
  vi.stubGlobal("document", { cookie: "", documentElement: { dataset } });
  return { sessionStorage, localStorage, dataset };
}

function teacher(id: string): SessionView {
  return {
    user: { id, email: id + "@example.invalid", name: id, role: Role.teacher },
    student: null,
  };
}

afterEach(() => {
  clearSharedSession();
  vi.unstubAllGlobals();
});

it("RF-3: conserva en primera sesión y renovación; limpia al reemplazar la cuenta o salir", () => {
  const { dataset, sessionStorage } = useBrowser();
  const chooseDark = () => setAppearance("dark");

  chooseDark();
  setSharedSession(teacher("teacher-a"));
  expect(dataset.appearance).toBe("dark");
  setSharedSession(teacher("teacher-a"));
  expect(dataset.appearance).toBe("dark");
  expect(sessionStorage.getItem(appearanceKey)).toBe("dark");

  setSharedSession(teacher("teacher-b"));
  expect(dataset.appearance).toBeUndefined();
  expect(sessionStorage.getItem(appearanceKey)).toBeNull();
  expect(getSharedSession()).toEqual(teacher("teacher-b"));

  chooseDark();
  clearSharedSession();
  expect(dataset.appearance).toBeUndefined();
  expect(sessionStorage.getItem(appearanceKey)).toBeNull();
  expect(getSharedSession()).toBeNull();
});

it("RF-3: una consulta que confirma otra cuenta limpia la apariencia antes de publicar la identidad", async () => {
  const { dataset, sessionStorage } = useBrowser();
  setSharedSession(teacher("teacher-a"));
  setAppearance("dark");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => teacher("teacher-b"),
    }),
  );

  await expect(fetchSharedSession(true)).resolves.toEqual(teacher("teacher-b"));
  expect(dataset.appearance).toBeUndefined();
  expect(sessionStorage.getItem(appearanceKey)).toBeNull();
});

it("RF-3: la rotación conserva la elección y un rechazo de la renovación la elimina", async () => {
  const { sessionStorage } = useBrowser();
  const now = vi.spyOn(Date, "now");
  const account = teacher("teacher-a");
  now.mockReturnValue(1000);
  setSharedSession(account);
  setAppearance("light");
  const refresh = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => account })
    .mockResolvedValueOnce({ ok: false, status: 401 });
  vi.stubGlobal("fetch", refresh);

  try {
    now.mockReturnValue(10000);
    await expect(requestSharedRefresh()).resolves.toBe(true);
    expect(getAppearance()).toBe("light");
    expect(sessionStorage.getItem(appearanceKey)).toBe("light");
    now.mockReturnValue(20000);
    await expect(requestSharedRefresh()).resolves.toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(getAppearance()).toBe("system");
    expect(sessionStorage.getItem(appearanceKey)).toBeNull();
  } finally {
    now.mockRestore();
  }
});

it("RF-2: la apariencia sigue funcionando si el acceso a sessionStorage falla", () => {
  const { dataset } = useBrowser();
  dataset.theme = "teens";
  Object.defineProperty(window, "sessionStorage", {
    get() {
      throw new Error("Storage access blocked");
    },
  });

  setAppearance("dark");
  expect(getAppearance()).toBe("dark");
  expect(dataset.theme).toBe("teens");
  setAppearance("system");
  expect(getAppearance()).toBe("system");
  expect(dataset.theme).toBe("teens");
});

it.each(["401", "change"] as const)(
  "RF-3: una entrada docente directa pierde su elección al invalidar la sesión (%s)",
  async (transition) => {
    const { sessionStorage, localStorage } = useBrowser();
    localStorage.setItem(
      SESSION_EPOCH_KEY,
      JSON.stringify({ gen: 4, state: "active", uid: "teacher-a" }),
    );
    setSessionAppearance("dark");
    expect(getAppearance()).toBe("dark");
    expect(sessionStorage.getItem(appearanceKey)).toBe("dark");

    if (transition === "401") {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 401 }),
      );
      await expect(requestSharedRefresh()).resolves.toBe(false);
      expect(getSharedSession()).toBeNull();
    } else {
      setSharedSession(teacher("teacher-b"));
      expect(getSharedSession()).toEqual(teacher("teacher-b"));
    }

    expect(getAppearance()).toBe("system");
    expect(sessionStorage.getItem(appearanceKey)).toBeNull();
  },
);

"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import React, { useSyncExternalStore } from "react";
import {
  type AppearancePreference,
  getAppearance,
  setAppearance,
  subscribeAppearance,
} from "../lib/appearance";
import { setSessionAppearance } from "../lib/auth-session";

const getServerAppearance = (): AppearancePreference => "system";

export function AppearanceSelector({
  authenticated = false,
  className,
}: {
  authenticated?: boolean;
  className?: string;
}) {
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getAppearance,
    getServerAppearance,
  );
  const Icon =
    appearance === "light" ? Sun : appearance === "dark" ? Moon : Monitor;

  return (
    <label
      className={["relative inline-flex items-center", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="sr-only">Apariencia</span>
      <Icon
        aria-hidden="true"
        className="origami-appearance-icon pointer-events-none absolute start-3"
        size={24}
      />
      <select
        value={appearance}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "system" || value === "light" || value === "dark") {
            if (authenticated) setSessionAppearance(value);
            else setAppearance(value);
          }
        }}
        className="origami-button origami-button--secondary origami-appearance-select cursor-pointer"
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}

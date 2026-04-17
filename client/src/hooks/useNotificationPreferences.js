import { useEffect, useState } from "react";

const defaultPreferences = {
  soundEnabled: true,
  vibrationEnabled: true,
};

const getStorageKey = (mode) => `notification-feedback:${mode}`;

const readPreferences = (mode) => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(mode));
    if (!raw) {
      return defaultPreferences;
    }

    const parsed = JSON.parse(raw);
    return {
      soundEnabled: parsed.soundEnabled !== false,
      vibrationEnabled: parsed.vibrationEnabled !== false,
    };
  } catch (error) {
    return defaultPreferences;
  }
};

export default function useNotificationPreferences(mode = "customer") {
  const [preferences, setPreferences] = useState(() => readPreferences(mode));

  useEffect(() => {
    setPreferences(readPreferences(mode));
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getStorageKey(mode), JSON.stringify(preferences));
  }, [mode, preferences]);

  return {
    ...preferences,
    setSoundEnabled: (enabled) =>
      setPreferences((current) => ({ ...current, soundEnabled: Boolean(enabled) })),
    setVibrationEnabled: (enabled) =>
      setPreferences((current) => ({ ...current, vibrationEnabled: Boolean(enabled) })),
  };
}

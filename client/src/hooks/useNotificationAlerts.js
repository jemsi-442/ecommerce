import { useCallback } from "react";
import useNotificationStream from "./useNotificationStream";
import useToast from "./useToast";

export default function useNotificationAlerts({
  enabled = true,
  mode = "customer",
  soundEnabled = true,
  vibrationEnabled = true,
} = {}) {
  const toast = useToast();

  const handleNotification = useCallback(
    (notification) => {
      if (!enabled || !notification) {
        return;
      }

      const prefix = mode === "admin" ? "Admin update" : "Order update";
      toast.info(`${prefix}: ${notification.message}`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("notifications:refresh", {
            detail: {
              mode,
              notification,
            },
          })
        );
      }

      if (vibrationEnabled) {
        triggerNotificationVibration();
      }

      if (soundEnabled) {
        playNotificationChime().catch(() => {});
      }
    },
    [enabled, mode, soundEnabled, toast, vibrationEnabled]
  );

  useNotificationStream({
    enabled,
    audience: mode,
    onNotification: handleNotification,
  });
}

export const playNotificationChime = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();

  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(784, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1046, audioContext.currentTime + 0.18);

    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);

    await new Promise((resolve) => {
      oscillator.onended = resolve;
    });
  } finally {
    await audioContext.close().catch(() => {});
  }
};

export const triggerNotificationVibration = () => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  navigator.vibrate([120, 50, 120]);
};

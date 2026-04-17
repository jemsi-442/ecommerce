import { useEffect } from "react";
import { apiBaseUrl } from "../utils/axios";

const parseEventBlock = (block = "") => {
  const lines = block.split("\n");
  let event = "message";
  const dataLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const dataText = dataLines.join("\n");
  if (!dataText) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataText),
    };
  } catch (error) {
    return null;
  }
};

export default function useNotificationStream({
  enabled = true,
  audience = "customer",
  onNotification,
} = {}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    const token = window.localStorage.getItem("token");
    if (!token) {
      return undefined;
    }

    const controller = new AbortController();
    let reconnectTimer = null;
    let disposed = false;

    const connect = async () => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/notifications/stream?audience=${encodeURIComponent(audience)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "text/event-stream",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) {
          throw new Error("Failed to connect to notifications stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!disposed) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const parsed = parseEventBlock(block);
            if (!parsed || parsed.event !== "notification") {
              continue;
            }

            onNotification?.(parsed.data);
          }
        }
      } catch (error) {
        if (disposed || controller.signal.aborted) {
          return;
        }
      }

      if (!disposed) {
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    connect();

    return () => {
      disposed = true;
      controller.abort();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [audience, enabled, onNotification]);
}

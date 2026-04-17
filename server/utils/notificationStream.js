import { Op } from "sequelize";
import { NotificationEvent } from "../models/index.js";

const clients = new Map();
const instanceId =
  process.env.NOTIFICATION_INSTANCE_ID ||
  `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
let relayInterval = null;
let cleanupInterval = null;
let lastSeenEventId = 0;

const buildClientId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const writeEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const subscribeToNotificationStream = ({
  audience,
  userId = null,
  res,
}) => {
  const clientId = buildClientId();
  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  clients.set(clientId, {
    audience,
    userId: userId == null ? null : String(userId),
    res,
    heartbeat,
  });

  writeEvent(res, "ready", {
    ok: true,
    audience,
  });

  return () => {
    const client = clients.get(clientId);
    if (!client) {
      return;
    }

    clearInterval(client.heartbeat);
    clients.delete(clientId);
  };
};

export const getNotificationStreamInstanceId = () => instanceId;
export const getNotificationStreamClientCount = ({
  audience = null,
} = {}) => {
  if (!audience) {
    return clients.size;
  }

  let count = 0;
  for (const client of clients.values()) {
    if (client.audience === audience) {
      count += 1;
    }
  }

  return count;
};

export const publishNotificationEvent = ({
  audience,
  userId = null,
  notification,
}) => {
  if (!notification || !audience) {
    return;
  }

  const normalizedUserId = userId == null ? null : String(userId);

  for (const client of clients.values()) {
    if (client.audience !== audience) {
      continue;
    }

    if (audience === "customer" && normalizedUserId && client.userId !== normalizedUserId) {
      continue;
    }

    writeEvent(client.res, "notification", notification);
  }
};

export const enqueueNotificationEvent = async ({
  audience,
  userId = null,
  notificationId = null,
  payload,
}) => {
  if (!audience || !payload) {
    return null;
  }

  return NotificationEvent.create({
    audience,
    userId,
    notificationId,
    sourceInstance: instanceId,
    payload,
  });
};

const initializeRelayCursor = async () => {
  const latestEvent = await NotificationEvent.findOne({
    attributes: ["id"],
    order: [["id", "DESC"]],
  });

  lastSeenEventId = Number(latestEvent?.id || 0);
};

const relayQueuedNotificationEvents = async () => {
  const events = await NotificationEvent.findAll({
    where: {
      id: { [Op.gt]: lastSeenEventId },
    },
    order: [["id", "ASC"]],
    limit: 100,
  });

  if (!events.length) {
    return;
  }

  for (const event of events) {
    lastSeenEventId = Math.max(lastSeenEventId, Number(event.id || 0));

    if (event.sourceInstance === instanceId) {
      continue;
    }

    publishNotificationEvent({
      audience: event.audience,
      userId: event.userId,
      notification: event.payload,
    });
  }
};

const cleanupOldNotificationEvents = async ({
  retentionHours = Number(process.env.NOTIFICATION_EVENT_RETENTION_HOURS || 24),
} = {}) => {
  const safeRetentionHours = Number.isFinite(retentionHours) && retentionHours > 0
    ? retentionHours
    : 24;
  const cutoff = new Date(Date.now() - safeRetentionHours * 60 * 60 * 1000);

  await NotificationEvent.destroy({
    where: {
      createdAt: { [Op.lt]: cutoff },
    },
  });
};

export const startNotificationEventRelay = ({
  intervalMs = Number(process.env.NOTIFICATION_RELAY_INTERVAL_MS || 2000),
  cleanupIntervalMs = Number(process.env.NOTIFICATION_EVENT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
} = {}) => {
  let stopped = false;

  if (relayInterval || cleanupInterval) {
    return () => {
      stopped = true;
    };
  }

  initializeRelayCursor().catch((error) => {
    console.error("NOTIFICATION RELAY INIT ERROR:", error);
  });

  relayInterval = setInterval(() => {
    relayQueuedNotificationEvents().catch((error) => {
      console.error("NOTIFICATION RELAY ERROR:", error);
    });
  }, intervalMs);

  cleanupInterval = setInterval(() => {
    cleanupOldNotificationEvents().catch((error) => {
      console.error("NOTIFICATION CLEANUP ERROR:", error);
    });
  }, cleanupIntervalMs);

  return () => {
    if (stopped) {
      return;
    }

    if (!relayInterval) {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }

      return;
    }

    clearInterval(relayInterval);
    relayInterval = null;
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  };
};

const indexExists = async (queryInterface, tableName, indexName, transaction) => {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  return indexes.some((index) => index.name === indexName);
};

const addIndexIfMissing = async ({
  queryInterface,
  tableName,
  indexName,
  fields,
  transaction,
}) => {
  if (await indexExists(queryInterface, tableName, indexName, transaction)) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, {
    name: indexName,
    transaction,
  });
};

export const up = async ({ queryInterface, transaction }) => {
  await addIndexIfMissing({
    queryInterface,
    tableName: "notifications",
    indexName: "idx_notifications_audience_read_created",
    fields: ["audience", "read", "created_at"],
    transaction,
  });

  await addIndexIfMissing({
    queryInterface,
    tableName: "notifications",
    indexName: "idx_notifications_order_audience",
    fields: ["order_id", "audience"],
    transaction,
  });

  await addIndexIfMissing({
    queryInterface,
    tableName: "notification_events",
    indexName: "idx_notification_events_created_at",
    fields: ["created_at"],
    transaction,
  });

  await addIndexIfMissing({
    queryInterface,
    tableName: "notification_events",
    indexName: "idx_notification_events_source_instance",
    fields: ["source_instance"],
    transaction,
  });

  await addIndexIfMissing({
    queryInterface,
    tableName: "notification_events",
    indexName: "idx_notification_events_audience_user",
    fields: ["audience", "user_id"],
    transaction,
  });
};

export default { up };

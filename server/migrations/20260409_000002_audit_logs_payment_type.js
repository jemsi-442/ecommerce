export const up = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `
      ALTER TABLE audit_logs
      MODIFY COLUMN type ENUM('status','delivery','notification','refund','user','payment') NOT NULL
    `,
    { transaction }
  );
};

export default { up };

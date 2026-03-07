import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || smtpPort === 465;

export const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_FROM
  );

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

export const sendPasswordResetEmail = async ({ to, resetUrl, appName }) => {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const brand = appName || process.env.APP_NAME || "RihanCollection";

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: `${brand} password reset`,
    text: `Use this link to reset your password: ${resetUrl}\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">${brand} Password Reset</h2>
        <p>You requested a password reset.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#e11d48;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 15 minutes.</p>
      </div>
    `,
  });
};

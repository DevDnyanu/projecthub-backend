import nodemailer from "nodemailer";

// Lazy transporter — created on first use so dotenv has already loaded by then
const getTransporter = () =>
  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

export const sendVerificationEmail = async (
  toEmail: string,
  name: string,
  token: string
): Promise<void> => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}&email=${encodeURIComponent(toEmail)}`;

  await getTransporter().sendMail({
    from: `"ProjectHub" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your ProjectHub account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#f1f5f9">
          Welcome to ProjectHub, ${name}!
        </h1>
        <p style="color:#94a3b8;margin-bottom:24px;line-height:1.6">
          Please verify your email address to activate your account and start browsing projects.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Verify Email Address
        </a>
        <p style="color:#64748b;font-size:12px;margin-top:24px">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0" />
        <p style="color:#475569;font-size:12px;margin:0">© 2025 ProjectHub. All rights reserved.</p>
      </div>
    `,
  });
};

export const sendOtpEmail = async (
  toEmail: string,
  name: string,
  otp: string
): Promise<void> => {
  await getTransporter().sendMail({
    from: `"ProjectHub" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your ProjectHub Password Reset OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:12px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#f1f5f9">
          Password Reset OTP
        </h1>
        <p style="color:#94a3b8;margin-bottom:8px;line-height:1.6">
          Hi ${name}, use the OTP below to reset your ProjectHub password.
        </p>
        <p style="color:#94a3b8;margin-bottom:24px;line-height:1.6">
          This OTP expires in <strong style="color:#f1f5f9">10 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <div style="display:inline-block;background:#1e293b;border:2px solid #6366f1;border-radius:12px;padding:20px 40px">
            <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#6366f1;font-family:monospace">
              ${otp}
            </span>
          </div>
        </div>
        <p style="color:#64748b;font-size:12px;margin-top:24px">
          If you didn't request a password reset, you can safely ignore this email — your password will not change.
        </p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0" />
        <p style="color:#475569;font-size:12px;margin:0">© 2025 ProjectHub. All rights reserved.</p>
      </div>
    `,
  });
};

export default getTransporter;

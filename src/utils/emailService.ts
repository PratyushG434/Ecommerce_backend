// src/utils/emailService.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  pool: true,            // ✅ KEEPS CONNECTION ALIVE (Faster & More Reliable)
  host: "smtp.gmail.com",
  port: 587,
  secure: false,         // Must be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: 'SSLv3',    // Helps with some strict firewalls
    rejectUnauthorized: false,
  },
  maxConnections: 1,     // ⚠️ Limit to 1 connection to avoid Gmail blocking you
  maxMessages: 100,      // Reuse connection for 100 emails
});

export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("✅ Email Server Connected Successfully");
  } catch (error) {
    console.error("❌ Email Server Connection Failed:", error);
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const url = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  
  await transporter.sendMail({
    from: '"Raawr Store" <no-reply@raawr.com>',
    to: email,
    subject: 'Verify your email - Raawr Store',
    html: `
      <h1>Welcome to Raawr!</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${url}">Verify Email</a>
    `,
  });
};

export const sendOrderConfirmationEmail = async (email: string, orderId: string, total: number) => {
  await transporter.sendMail({
    from: '"Raawr Store" <no-reply@raawr.com>',
    to: email,
    subject: `Order Confirmed #${orderId.slice(0, 8)}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Your order <b>#${orderId}</b> has been placed successfully.</p>
      <h2>Total: ₹${total}</h2>
      <p>We will notify you when it ships.</p>
    `,
  });
};
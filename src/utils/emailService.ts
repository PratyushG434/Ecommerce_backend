import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ IMPORTANT: In Resend "Test Mode", use the onboarding email
// or verify your domain to use a custom one.
const FROM_EMAIL = 'Raawr <noreply@raawr.in>'; 

export const verifyEmailConnection = async () => {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ Resend API Key is missing in Environment Variables!");
  } else {
    console.log("✅ Resend API Key found. Email service is ready via HTTP (Port 443).");
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const url = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  
  try {
    // 👇 FIX: Destructure 'data' and 'error' from the response
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email, 
      subject: 'Verify your email - Raawr Store',
      html: `
        <h1>Welcome to Raawr!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${url}">Verify Email</a>
      `,
    });

    if (error) {
      console.error("❌ Resend API returned error:", error);
      return;
    }

    console.log("✅ Verification Email Sent via Resend:", data?.id);
  } catch (err) {
    console.error("❌ Resend Verification Unexpected Error:", err);
  }
};

export const sendOrderConfirmationEmail = async (email: string, orderId: string, total: number) => {
  try {
    // 👇 FIX: Destructure 'data' and 'error' here too
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email, 
      subject: `Order Confirmed #${orderId.slice(0, 8)}`,
      html: `
        <h1>Thank you for your order!</h1>
        <p>Your order <b>#${orderId}</b> has been placed successfully.</p>
        <h2>Total: ₹${total}</h2>
        <p>We will notify you when it ships.</p>
      `,
    });

    if (error) {
      console.error("❌ Resend API returned error:", error);
      return;
    }

    console.log("✅ Order Email Sent via Resend:", data?.id);
  } catch (err) {
    console.error("❌ Resend Order Unexpected Error:", err);
  }
};
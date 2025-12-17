import Razorpay from 'razorpay';

/**
 * Razorpay instance created using CLIENT's API keys
 * Keys MUST come from environment variables
 */
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

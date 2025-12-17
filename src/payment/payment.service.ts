import { Injectable, BadRequestException } from '@nestjs/common';
import { razorpay } from '../config/razorpay.config';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {

  /**
   * Create Razorpay order
   * Razorpay accepts amount in PAISA (₹1 = 100 paisa)
   */
  async createOrder(amount: number) {
    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paisa
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    });

    return order;
  }

  /**
   * Verify payment signature
   * This ensures payment was NOT tampered
   */
  verifyPayment(data: any) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new BadRequestException('Payment verification failed');
    }

    return { status: 'Payment verified successfully' };
  }
}

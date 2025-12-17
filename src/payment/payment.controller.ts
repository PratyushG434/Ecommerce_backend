import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create Razorpay order
   */
  @Post('create-order')
  async createOrder(@Body() body: CreateOrderDto) {
    return this.paymentService.createOrder(body.amount);
  }

  /**
   * Verify Razorpay payment
   */
  @Post('verify')
  async verifyPayment(@Body() body: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(body);
  }
}

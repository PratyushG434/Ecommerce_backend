import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/**
 * 1. CREATE ORDER
 * Handles:
 * - Cart Checkout vs. Direct Buy ("Buy Now")
 * - Online Payment (Razorpay) vs. COD
 */
export const createOrder = async (req: Request, res: Response) => {
  try {

    const userId = req.user?.id;
    // directItems: Optional array for "Buy Now"
    // paymentMethod: "ONLINE" (default) or "COD"
    // address: The shipping address object from frontend
    const { directItems, paymentMethod = "ONLINE", address } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let finalItems = [];
    let totalAmount = 0;
    let orderSource = 'cart'; // Default source is cart

    // --- STEP 1: CALCULATE ITEMS & TOTAL (Securely) ---

    // A. SCENARIO: DIRECT BUY
    if (directItems && Array.isArray(directItems) && directItems.length > 0) {
      orderSource = 'direct';

      for (const item of directItems) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (product) {
          finalItems.push({
            productId: product.id,
            quantity: item.quantity,
            price: Number(product.price), // Use DB price
            size: item.size || "N/A",
            color: item.color || "N/A"
          });
          totalAmount += Number(product.price) * item.quantity;
        }
      }
    }

    // B. SCENARIO: CART CHECKOUT
    else {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } }
      });

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      finalItems = cart.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.product.price),
        size: item.size || "N/A",
        color: item.color || "N/A"
      }));

      totalAmount = finalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // --- STEP 2: SAFETY CHECKS ---
    if (finalItems.length === 0) {
      return res.status(400).json({ message: "No valid items found" });
    }
    if (totalAmount < 1) {
      return res.status(400).json({ message: "Order amount must be at least ₹1" });
    }

    // --- STEP 3: CREATE ORDER BASED ON PAYMENT METHOD ---
    const shipping = totalAmount > 75 ? 0 : 10
    const tax = Math.round(totalAmount * 0.18)
    const total = totalAmount + shipping + tax
    // === OPTION A: CASH ON DELIVERY (COD) ===
    if (paymentMethod === "COD") {
      // 1. Create DB Order Immediately
      const order = await prisma.order.create({
        data: {
          userId,
          total: total,
          status: 'PENDING', // COD orders are pending until delivered/paid
          paymentMethod: 'COD',
          metadata: { source: orderSource },
          shippingAddress: address || {}, // Save address snapshot
          items: {
            create: finalItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              size: item.size,
              color: item.color
            }))
          }
        }
      });

      // 2. Clear Cart (Only if it was a cart checkout)
      if (orderSource === 'cart') {
        await prisma.cart.update({
          where: { userId },
          data: { items: { deleteMany: {} } }
        });
      }

      return res.json({ success: true, orderId: order.id, mode: 'COD' });
    }

    // === OPTION B: ONLINE (RAZORPAY) ===
    else {
      // 1. Create Razorpay Order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100), // paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      });

      // 2. Create DB Order (Status: PENDING)
      await prisma.order.create({
        data: {
          userId,
          total: totalAmount,
          status: 'PENDING',
          paymentMethod: 'ONLINE',
          razorpayOrderId: razorpayOrder.id, // Store for verification
          metadata: { source: orderSource },
          shippingAddress: address || {}, // Save address snapshot
          items: {
            create: finalItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              size: item.size,
              color: item.color
            }))
          }
        }
      });

      // Return Razorpay details so frontend can open modal
      return res.json({ ...razorpayOrder, mode: 'ONLINE' });
    }

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};


/**
 * 2. VERIFY PAYMENT (Online Only)
 * Verifies signature, marks DB order as PAID, and clears cart if needed.
 */
export const verifyPayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  try {
    // A. Generate Expected Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    // B. Compare Signatures
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ valid: false, message: "Invalid Signature" });
    }

    // C. Find Order in DB
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id }
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // D. Update Order Status to PAID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        razorpayPaymentId: razorpay_payment_id
      }
    });

    // E. Clear Cart Logic (Only if source was 'cart')
    const metadata = order.metadata as any;

    if (metadata?.source === 'cart') {
      await prisma.cart.update({
        where: { userId: order.userId },
        data: { items: { deleteMany: {} } }
      });
      console.log(`Cart cleared for user ${order.userId}`);
    } else {
      console.log(`Direct buy detected. Cart preserved for user ${order.userId}`);
    }

    res.json({ valid: true, orderId: order.id });

  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
};
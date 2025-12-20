import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendOrderConfirmationEmail } from '../utils/emailService';
import { generatePayUHash, verifyPayUHash } from '../utils/payu'; 

const prisma = new PrismaClient();

const PAYU_KEY = process.env.PAYU_KEY || "";
const PAYU_SALT = process.env.PAYU_SALT || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * 1. CREATE ORDER
 * Handles:
 * - Cart Checkout vs. Direct Buy ("Buy Now")
 * - Online Payment (PayU) vs. COD
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { directItems, paymentMethod = "ONLINE", address } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let finalItems = [];
    let totalAmount = 0;
    let orderSource = 'cart';

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
            price: Number(product.price), // Handle potential Decimal/Float types
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
    if (finalItems.length === 0) return res.status(400).json({ message: "No valid items found" });
    if (totalAmount < 1) return res.status(400).json({ message: "Order amount must be at least ₹1" });

    // --- STEP 3: CREATE ORDER BASED ON PAYMENT METHOD ---
    const shipping = totalAmount > 75 ? 0 : 10;
    const tax = Math.round(totalAmount * 0.18);
    const total = totalAmount + shipping + tax;
    

    // === OPTION A: CASH ON DELIVERY (COD) ===
    if (paymentMethod === "COD") {
      // ✅ 1. REDUCE STOCK (COD: Reduce immediately)
      // Using a loop to update stock for each item securely
      for (const item of finalItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      const order = await prisma.order.create({
        data: {
          userId,
          total: total,
          orderStatus: 'PROCESSING', // Matches Enum
          paymentStatus: 'PENDING',  // Matches Enum
          paymentMethod: 'COD',      // Matches Enum
          metadata: { source: orderSource },
          shippingAddress: address || {}, // Matches Json type
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

      if (orderSource === 'cart') {
        await prisma.cart.update({
          where: { userId },
          data: { items: { deleteMany: {} } }
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        // Wrap email in try-catch to prevent crash if email service fails
        try {
          await sendOrderConfirmationEmail(user.email, order.id, Number(order.total));
        } catch (emailErr) {
          console.error("COD Email failed:", emailErr);
        }
      }

      return res.json({ success: true, orderId: order.id, mode: 'COD' });
    }

    // === OPTION B: ONLINE (PAYU) ===
    else {
      // 1. Generate a Unique Transaction ID for PayU
      const txnid = "TXN" + Date.now() + Math.floor(Math.random() * 1000);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const firstName = user?.name?.split(' ')[0] || "Guest";
      const email = user?.email || "guest@example.com";

      // 3. Create DB Order (Status: PENDING)
      const order = await prisma.order.create({
        data: {
          userId,
          total: total,
          orderStatus: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'ONLINE',
          payuTxnId: txnid, 
          metadata: { source: orderSource },
          shippingAddress: address || {},
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

      // 4. Generate Hash
      const hash = generatePayUHash({
        key: PAYU_KEY,
        txnid: txnid,
        amount: total.toString(),
        productinfo: "Raawr Order",
        firstname: firstName,
        email: email
      }, PAYU_SALT);

      // 5. Return Form Data to Frontend
      return res.json({
        success: true,
        mode: 'ONLINE', 
        payuParams: {
          key: PAYU_KEY,
          txnid: txnid,
          amount: total,
          productinfo: "Raawr Order",
          firstname: firstName,
          email: email,
          phone: "9999999999", 
          surl: `${process.env.BACKEND_URL}/api/payment/payu-response`,
          furl: `${process.env.BACKEND_URL}/api/payment/payu-response`,
          hash: hash
        }
      });
    }

  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

/**
 * 2. VERIFY PAYMENT (Handle PayU Callback)
 */
export const handlePayUResponse = async (req: Request, res: Response) => {
  const response = req.body; 

  try {
    // A. Verify Hash
    const isValid = verifyPayUHash(response, PAYU_SALT);
    if (!isValid) {
      console.error("Invalid PayU Hash");
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=hash_mismatch`);
    }

    // B. Find Order in DB using Transaction ID
    // We also need to include 'items' now to reduce stock
    const order = await prisma.order.findUnique({
      where: { payuTxnId: response.txnid },
      include: { user: true, items: true } 
    });

    if (!order) {
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=order_not_found`);
    }

    // C. Check PayU Status
    if (response.status === 'success') {
      
      // ✅ 1. REDUCE STOCK (Online: Reduce ONLY on Success)
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      // D. Update Order Status to PAID
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          orderStatus: 'PROCESSING',
          payuMihpayid: response.mihpayid 
        }
      });

      const metadata = order.metadata as any;
      if (metadata?.source === 'cart' && order.userId) {
        await prisma.cart.update({
          where: { userId: order.userId },
          data: { items: { deleteMany: {} } }
        });
        console.log(`Cart cleared for user ${order.userId}`);
      }

      // F. Send Email
      if (order.user) {
        try {
            await sendOrderConfirmationEmail(order.user.email, order.id, Number(order.total));
        } catch (emailErr) {
            console.error("Online Payment Email failed but payment success:", emailErr);
        }
      }

      // G. Redirect to Success Page
      return res.redirect(`${FRONTEND_URL}/payment/success?id=${order.id}`);
    
    } else {
      // Payment Failed logic
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          orderStatus: 'CANCELLED'
        }
      });
      return res.redirect(`${FRONTEND_URL}/payment/failed?reason=transaction_failed`);
    }

  } catch (error) {
    console.error("PayU Response Error:", error);
    res.redirect(`${FRONTEND_URL}/payment/failed?reason=server_error`);
  }
};
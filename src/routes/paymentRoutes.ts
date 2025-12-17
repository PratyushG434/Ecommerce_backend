import express from 'express';
import { createOrder, verifyPayment } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();
router.use(protect); 
/**
 * 1. CREATE ORDER
 * Route: POST /api/payment/create-order
 * Protected: YES (Need userId to fetch cart or create order)
 */
// @ts-ignore
router.post('/create-order',createOrder);

/**
 * 2. VERIFY PAYMENT
 * Route: POST /api/payment/verify
 * Protected: OPTIONAL (Technically public, but safest to keep protected if frontend sends token)
 * Note: If your frontend doesn't send a token for verify, remove 'protect'.
 */
// @ts-ignore
router.post('/verify', verifyPayment);

export default router;
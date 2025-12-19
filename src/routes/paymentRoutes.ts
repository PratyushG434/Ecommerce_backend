import express from 'express';
import { createOrder, handlePayUResponse } from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * 1. CREATE ORDER
 * Route: POST /api/payment/create-order
 * Protected: YES (Need userId to fetch cart or create order)
 */
// @ts-ignore
router.post('/create-order',protect, createOrder);

/**
 * 2. VERIFY PAYMENT
 * Route: POST /api/payment/verify
 * Protected: OPTIONAL (Technically public, but safest to keep protected if frontend sends token)
 * Note: If your frontend doesn't send a token for verify, remove 'protect'.
 */
// @ts-ignore
router.post('/payu-response', handlePayUResponse);

export default router;
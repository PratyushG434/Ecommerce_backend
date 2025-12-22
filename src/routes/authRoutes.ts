import express from 'express';
import { login, refresh, logout, getMe, register, verifyEmail, resendVerification } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/register', register);
router.get('/me', protect, getMe);
router.get('/verify-email', verifyEmail);
router.get('/resend-verification', resendVerification);

export default router;
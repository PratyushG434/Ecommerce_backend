import express from 'express';
import { login, refresh, logout, getMe } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
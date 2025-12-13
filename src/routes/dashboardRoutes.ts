import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/dashboard', protect, adminOnly, getDashboardStats);

export default router;
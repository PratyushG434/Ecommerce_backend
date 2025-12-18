import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware';
import multer from 'multer';
import {
  getDashboardStats, getMetrics,
  createProduct, updateProduct, deleteProduct,
  getOrders, updateOrderStatus, refundOrder,
  getCustomers, updateCustomerNotes,
  exportOrdersCsv, getActivityLogs , getCurrentAdmin, uploadImage , getOrderById, getCustomerById
} from '../controllers/adminController';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// 🔒 GLOBAL LOCK: All routes below this line require Login + Admin Role
router.use(protect);
router.use(adminOnly);

// --- DASHBOARD ---
router.get('/dashboard', getDashboardStats);
router.get('/metrics', getMetrics);

// --- PRODUCTS (Admin Ops) ---
// Note: Public viewing is in productRoutes. These are for EDITING.
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/upload', upload.single('file'), uploadImage);
// router.post('/products/:id/images') -> Use existing upload logic

// --- ORDERS ---
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/refund', refundOrder);

// --- CUSTOMERS ---
router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);
router.put('/customers/:id/notes', updateCustomerNotes);

// --- UTILITIES ---
router.get('/exports/orders.csv', exportOrdersCsv);
router.get('/activity', getActivityLogs);
router.get('/me', getCurrentAdmin);

export default router;
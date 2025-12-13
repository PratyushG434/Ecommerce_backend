import express from 'express';
import { getProducts, getProductById, getTrendingProducts, getBestsellers } from '../controllers/productController';

const router = express.Router();

// Specific routes MUST come before dynamic :productId route
router.get('/trending', getTrendingProducts);
router.get('/bestsellers', getBestsellers);

router.get('/', getProducts);
router.get('/:id', getProductById);

export default router;
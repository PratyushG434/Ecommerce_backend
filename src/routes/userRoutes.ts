import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { 
  addToCart, getCart, removeFromCart, checkout,
  addToWishlist, getWishlist, getCurrentUser 
} from '../controllers/userController';


const router = express.Router();

router.use(protect); // All routes below require login

// Cart
router.post('/cart', addToCart);
router.get('/cart', getCart);
router.delete('/cart/item/:itemId', removeFromCart);

// Wishlist
router.post('/wishlist', addToWishlist);
router.get('/wishlist', getWishlist);
router.post('/checkout', checkout);

// Auth Me
router.get('/me', getCurrentUser);

export default router;
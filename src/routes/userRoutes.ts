import express from 'express';
import { customerOnly, protect } from '../middleware/authMiddleware';
import { 
  addToCart, getCart, removeFromCart,
  addToWishlist, getWishlist, getCurrentUser , getOrderById,getOrders,updateProfile, getAddresses, deleteAddress, addAddress,removeFromWishlist,checkWishlistStatus
} from '../controllers/userController';


const router = express.Router();

router.use(protect); 
router.use(customerOnly);

// Cart
router.post('/cart', addToCart);
router.get('/cart', getCart);
router.delete('/cart/:itemId', removeFromCart);

// Wishlist
router.post('/wishlist', addToWishlist);
router.get('/wishlist', getWishlist);
router.get('/wishlist/check/:productId', checkWishlistStatus);
router.delete('/wishlist/:productId',removeFromWishlist);
// router.post('/checkout', checkout);

// Order Routes
router.get('/orders',  getOrders);
router.get('/orders/:id', getOrderById);

// Profile Route (Using PUT since we are updating)
router.put('/me', updateProfile);
// Auth Me
router.get('/me', getCurrentUser);


// Add these lines to your router
router.get('/addresses', getAddresses);
router.post('/addresses', addAddress);
router.delete('/addresses/:id', deleteAddress);

export default router;
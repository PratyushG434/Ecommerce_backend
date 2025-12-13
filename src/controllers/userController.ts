import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- CART APIs ---

export const addToCart = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { productId, size, color, quantity } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // 1. Find or Create User's Cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // 2. Check if item exists in cart (same product + same size + same color)
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, size, color }
    });

    if (existingItem) {
      // Update quantity
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity }
      });
    } else {
      // Create new item
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, size, color, quantity }
      });
    }

    // Return full cart
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { items: { include: { product: true } } }
    });
    
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart' });
  }
};

export const getCart = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { 
        items: { 
          include: { 
            product: { select: { name: true, price: true, images: true } } 
          } 
        } 
      }
    });
    res.json(cart || { items: [] });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart' });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    await prisma.cartItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error removing item' });
  }
};

// --- WISHLIST APIs ---

export const addToWishlist = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { productId } = req.body;
  
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }

    // Use upsert to avoid error if already exists
    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      update: {},
      create: { wishlistId: wishlist.id, productId }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to wishlist' });
  }
};

export const getWishlist = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } }
    });
    
    // Formatting response to match your requirement
    const products = wishlist?.items.map(item => ({
      productId: item.productId,
      name: item.product.name,
      price: item.product.price,
      image: item.product.images[0] || ""
    })) || [];

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching wishlist' });
  }
};



// ... existing cart functions ...

export const checkout = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { items, paymentMethod, paymentId } = req.body; 
  // items = [{ productId, quantity, size, color }]

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // 1. Calculate Total Price (Server-side calculation is safer)
    let total = 0;
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });
      
      // Check Stock
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      }
      
      total += Number(product.price) * item.quantity;
    }

    // 2. Determine Status based on Payment
    let orderStatus = 'PENDING';
    if (paymentMethod === 'ONLINE' && paymentId) {
      // In a real app, you would verify paymentId with Stripe/Razorpay SDK here
      orderStatus = 'PAID'; 
    }

    // 3. Create the Order
    const order = await prisma.order.create({
      data: {
        userId,
        total,
        status: orderStatus,
        paymentMethod: paymentMethod, // "COD" or "ONLINE"
        paymentId: paymentId || null, // Null if COD
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: 0, // Ideally fetch current price from DB, simplified here
            size: item.size,
            color: item.color
          }))
        }
      }
    });

    // 4. Clear User's Cart (Optional: only if they bought everything in cart)
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    res.json({ success: true, orderId: order.id });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error placing order' });
  }
};

// --- AUTH / ME ---
export const getCurrentUser = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true }
  });
  res.json(user);
};
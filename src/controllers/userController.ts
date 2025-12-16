import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- ADDRESS APIs (NEW) ---

// src/controllers/userController.ts

export const addAddress = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  // Extract 'tag' along with other fields
  const { name, phone, street, city, state, zip, isDefault, tag } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        name,
        phone,
        tag: tag || "HOME", // Default to HOME if not provided
        street,
        city,
        state,
        zip,
        isDefault: isDefault || false
      }
    });

    res.json(address);
  } catch (error) {
    console.error("Add Address Error:", error);
    res.status(500).json({ message: 'Error adding address' });
  }
};

export const getAddresses = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' } // Default address on top
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching addresses' });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const addressId = req.params.id;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // Security: Ensure address belongs to user
    const address = await prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.address.delete({ where: { id: addressId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting address' });
  }
};

// --- CART APIs ---

export const addToCart = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { productId, size, color, quantity } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, size, color }
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity }
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, size, color, quantity }
      });
    }

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

// --- ORDER APIs ---

export const checkout = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { items, paymentMethod, paymentId } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    let total = 0;
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      }

      total += Number(product.price) * item.quantity;
    }

    let orderStatus = 'PENDING';
    if (paymentMethod === 'ONLINE' && paymentId) {
      orderStatus = 'PAID';
    }

    const order = await prisma.order.create({
      data: {
        userId,
        total,
        status: orderStatus,
        paymentMethod: paymentMethod,
        paymentId: paymentId || null,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: 0,
            size: item.size,
            color: item.color
          }))
        }
      }
    });

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

export const getOrderById = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const orderId = req.params.id;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } }
      }
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.userId !== userId) return res.status(403).json({ message: 'Forbidden' });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details' });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        total: true,
        status: true,
        items: {
          select: {
            id: true,
            quantity: true,
            product: {
              select: { name: true, images: true }
            }
          }
        }
      }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

// --- PROFILE APIs ---

export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { name } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true }
  });
  res.json(user);
};
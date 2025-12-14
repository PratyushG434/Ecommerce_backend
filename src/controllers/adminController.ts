import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// --- CONFIGURATION ---
const prisma = new PrismaClient();

// Configure Cloudinary (Make sure these are in your .env file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: Log Activity
const logActivity = async (userId: string, action: string, details: string) => {
  await prisma.activityLog.create({ data: { userId, action, details } });
};

// --- IMAGE UPLOAD ---

export const uploadImage = async (req: Request, res: Response) => {
  try {
    // 1. Check if file exists (Multer middleware should handle parsing)
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 2. Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ecommerce_products', // Optional: Organize in a folder
      use_filename: true,
      unique_filename: false,
    });

    // 3. Remove file from local server (cleanup)
    // Note: Only needed if using DiskStorage with Multer. If using MemoryStorage, skip this.
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // 4. Return the Cloudinary URL
    res.json({
      success: true,
      url: result.secure_url
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ message: 'Image upload failed', error: String(error) });
  }
};

// --- DASHBOARD & METRICS ---

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const revenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'PAID' }
    });

    const totalOrders = await prisma.order.count();

    const lowStock = await prisma.product.findMany({
      where: { stock: { lte: 5 } },
      take: 5
    });

    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } }
    });

    res.json({
      revenue: revenue._sum.total || 0,
      totalOrders,
      lowStockCount: lowStock.length,
      recentOrders,
      lowStock
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

export const getMetrics = async (req: Request, res: Response) => {
  const { range } = req.query; 

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sales = await prisma.order.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      status: 'PAID'
    },
    select: { createdAt: true, total: true }
  });

  res.json({ range, data: sales });
};

// --- PRODUCTS (Admin Management) ---

export const createProduct = async (req: Request, res: Response) => {
  const { 
    name, description, price, stock, category, gender, 
    sizes, colors, tags, images, originalPrice 
  } = req.body;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: typeof price === 'string' ? parseFloat(price) : price,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        stock: typeof stock === 'string' ? parseInt(stock) : stock,
        category,
        gender: gender || null,
        sizes: sizes || [],
        colors: colors || [],
        tags: tags || [],
        images: images || [],
      }
    });

    if (req.user?.id) {
      await logActivity(req.user.id, 'CREATE_PRODUCT', `Created ${product.name}`);
    }

    res.status(201).json({ success: true, data: product });

  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({ success: false, message: 'Error creating product', error: String(error) });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Destructure ALL fields to allow full updates
  const { 
    name, description, price, stock, category, gender, 
    sizes, colors, tags, images, originalPrice 
  } = req.body;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: typeof price === 'string' ? parseFloat(price) : price,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined, // use undefined to skip update if missing
        stock: typeof stock === 'string' ? parseInt(stock) : stock,
        category,
        gender,
        sizes,
        colors,
        tags,
        images
      }
    });

    if (req.user?.id) {
      await logActivity(req.user.id, 'UPDATE_PRODUCT', `Updated ${product.name}`);
    }

    res.json({ success: true, data: product });

  } catch (error) {
    console.error("UPDATE FAILED:", error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id } });
    if (req.user?.id) {
        await logActivity(req.user.id, 'DELETE_PRODUCT', `Deleted product ${id}`);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
};

// --- ORDERS ---

export const getOrders = async (req: Request, res: Response) => {
  const { status, page = '1' } = req.query;
  const p = Number(page);
  const take = 20;

  const where: any = {};
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    skip: (p - 1) * take,
    take,
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders);
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status }
    });

    if (req.user?.id) {
        await logActivity(req.user.id, 'UPDATE_ORDER', `Order ${id} set to ${status}`);
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error updating status' });
  }
};

export const refundOrder = async (req: Request, res: Response) => {
  const { id } = req.params; 
  const { items, reason } = req.body;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    let refundAmount = 0;

    for (const refundItem of items) {
      const dbItem = order.items.find(i => i.id === refundItem.orderItemId);
      if (!dbItem) {
        return res.status(400).json({ message: `Item ${refundItem.orderItemId} not found` });
      }
      if (refundItem.quantity > dbItem.quantity) {
        return res.status(400).json({ message: 'Cannot refund more items than purchased' });
      }
      refundAmount += Number(dbItem.price) * refundItem.quantity;
    }

    const fakeGatewayId = "re_" + Math.random().toString(36).substr(2, 9);

    const refund = await prisma.refund.create({
      data: {
        orderId: id,
        amount: refundAmount,
        reason,
        status: 'COMPLETED',
        gatewayRefundId: fakeGatewayId,
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity
          }))
        }
      }
    });

    res.json({ success: true, refund });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing refund' });
  }
};

// --- CUSTOMERS ---

export const getCustomers = async (req: Request, res: Response) => {
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    select: { id: true, name: true, email: true, createdAt: true, orders: true }
  });
  res.json(customers);
};

export const updateCustomerNotes = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  await prisma.user.update({ where: { id }, data: { notes } });
  res.json({ success: true });
};

// --- EXPORTS & REPORTS ---

export const exportOrdersCsv = async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({ include: { user: true } });

  const fields = ['id', 'user.email', 'total', 'status', 'createdAt'];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(orders);

  res.header('Content-Type', 'text/csv');
  res.attachment('orders.csv');
  res.send(csv);
};

export const getActivityLogs = async (req: Request, res: Response) => {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
    take: 50
  });
  res.json(logs);
};

export const getCurrentAdmin = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true }
  });
  res.json(user);
};
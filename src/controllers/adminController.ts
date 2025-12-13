import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv'; // You might need: npm install json2csv

const prisma = new PrismaClient();

// Helper: Log Activity
const logActivity = async (userId: string, action: string, details: string) => {
  await prisma.activityLog.create({ data: { userId, action, details } });
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
  const { range } = req.query; // e.g., "30d"
  
  // Simple example: Get daily sales for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sales = await prisma.order.findMany({
    where: { 
      createdAt: { gte: thirtyDaysAgo },
      status: 'PAID'
    },
    select: { createdAt: true, total: true }
  });

  // In a real app, you would group these by day here using JS or SQL
  res.json({ range, data: sales });
};

// --- PRODUCTS (Admin Management) ---

export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    await logActivity(req.user!.id, 'CREATE_PRODUCT', `Created ${product.name}`);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error creating product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: req.body
    });
    await logActivity(req.user!.id, 'UPDATE_PRODUCT', `Updated ${product.name}`);
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error updating product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Note: In real world, "Soft Delete" (isActive=false) is better than Delete
    await prisma.product.delete({ where: { id } });
    await logActivity(req.user!.id, 'DELETE_PRODUCT', `Deleted product ${id}`);
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
    
    // TODO: Send Fulfillment Email Trigger Here
    
    await logActivity(req.user!.id, 'UPDATE_ORDER', `Order ${id} set to ${status}`);
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error updating status' });
  }
};

export const refundOrder = async (req: Request, res: Response) => {
  const { id } = req.params; // Order ID
  const { items, reason } = req.body; 
  // Expect body like: 
  // { 
  //   items: [{ orderItemId: "item_123", quantity: 1 }], 
  //   reason: "Customer disliked material" 
  // }

  try {
    // 1. Fetch the Order with its items
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // 2. Calculate Refund Amount
    let refundAmount = 0;
    
    // We need to validate that they aren't refunding more than they bought
    for (const refundItem of items) {
      const dbItem = order.items.find(i => i.id === refundItem.orderItemId);
      if (!dbItem) {
        return res.status(400).json({ message: `Item ${refundItem.orderItemId} not found in order` });
      }
      if (refundItem.quantity > dbItem.quantity) {
        return res.status(400).json({ message: 'Cannot refund more items than purchased' });
      }
      
      // Add price * quantity to total refund
      refundAmount += Number(dbItem.price) * refundItem.quantity;
    }

    // 3. Process with Payment Gateway (Fake Stripe Call)
    // In real life: const stripeRefund = await stripe.refunds.create({ amount: refundAmount ... });
    const fakeGatewayId = "re_" + Math.random().toString(36).substr(2, 9);

    // 4. Save to Database (Transaction to ensure safety)
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

    // 5. Optional: Update Order Status if EVERYTHING was refunded
    // (Logic: Check if total refunded items == total ordered items)

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
  
  // Transform data for CSV
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
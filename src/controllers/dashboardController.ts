import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // 1. Calculate Revenue (Only count orders where money is PAID)
    const revenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { 
        paymentStatus: 'PAID' // ✅ FIXED: changed from 'status'
      }
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
      // ✅ FIXED: Added optional chaining (?.) for safety
      revenue: revenue._sum?.total || 0, 
      totalOrders,
      lowStockCount: lowStock.length,
      recentOrders,
      lowStock
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};
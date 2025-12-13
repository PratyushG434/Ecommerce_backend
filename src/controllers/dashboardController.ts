import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
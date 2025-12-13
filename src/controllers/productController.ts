import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Get All Products (With Filters & Search)
export const getProducts = async (req: Request, res: Response) => {
  const { 
    category, gender, colors, sizes, 
    priceMin, priceMax, sort, search, 
    page = '1', limit = '12' 
  } = req.query;

  const p = Number(page);
  const l = Number(limit);

  // Build Filter Object
  const where: any = {};
  
  if (category) where.category = category;
  if (gender) where.gender = gender;
  if (search) where.name = { contains: search as string, mode: 'insensitive' };
  
  // Array Filters (Postgres specific)
  if (colors) where.colors = { hasSome: (colors as string).split(',') };
  if (sizes) where.sizes = { hasSome: (sizes as string).split(',') };
  
  // Price Range
  if (priceMin || priceMax) {
    where.price = {};
    if (priceMin) where.price.gte = parseFloat(priceMin as string);
    if (priceMax) where.price.lte = parseFloat(priceMax as string);
  }

  // Sorting
  let orderBy: any = { createdAt: 'desc' }; // Default: Newest
  if (sort === 'price-low') orderBy = { price: 'asc' };
  if (sort === 'price-high') orderBy = { price: 'desc' };

  try {
    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip: (p - 1) * l,
      take: l,
    });
    
    const total = await prisma.product.count({ where });

    // ✅ STANDARD RESPONSE: Everything wrapped in 'data'
    res.json({
      success: true,
      message: "Products fetched successfully",
      data: {
        total,
        page: p,
        totalPages: Math.ceil(total / l),
        products
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
};

// 2. Get Single Product
export const getProductById = async (req: Request, res: Response) => {
  try {
    // DEBUG: Check what is actually coming in the URL
    console.log("Params received:", req.params); 

    // FIX: Use 'req.params.id' if your route is '/products/:id'
    // fallback to 'req.params.productId' just in case
    console.log(req.params)
    const id = req.params.id;

    const product = await prisma.product.findUnique({
      where: { id: id } 
    });

    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error(error); // Log the real error to see if it's a database issue
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// 3. Get Trending (New Arrivals)
export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { tags: { has: 'New' } },
      take: 4
    });

    // ✅ STANDARD RESPONSE
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching trending' });
  }
};

// 4. Get Bestsellers
export const getBestsellers = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { tags: { has: 'Bestseller' } },
      take: 4
    });

    // ✅ STANDARD RESPONSE
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bestsellers' });
  }
};
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Clean existing data (Order matters to avoid foreign key errors)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users with STRICT roles
  const password = await bcrypt.hash('admin123', 10);
  
  // Create Admin
  await prisma.user.create({
    data: {
      email: 'admin@rawwr.com',
      password,
      name: 'Admin User',
      role: 'ADMIN', 
    },
  });

  // Create Customer
  const customer = await prisma.user.create({
    data: {
      email: 'anushka@example.com',
      password,
      name: 'Anushka',
      role: 'CUSTOMER', 
    },
  });

  console.log(`✅ Users created: Admin & Customer`);

  // 3. Create Products (Now includes gender, sizes, colors)
  
  // Product 1: Men's Tee
  await prisma.product.create({
    data: {
      name: 'Raawr Classic Tee - Beige',
      description: 'A premium beige tee for everyday wear.',
      price: 45.00,
      originalPrice: 55.00,
      stock: 50,
      category: 'Tops',
      gender: 'Men',
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'],
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Beige', 'Black'],
      tags: ['Bestseller', 'Classic'],
    }
  });

  // Product 2: Women's Active Wear
  const p2 = await prisma.product.create({
    data: {
      name: 'Girls Lift Tee',
      description: 'Performance wear for serious lifting.',
      price: 35.00,
      originalPrice: 45.00,
      stock: 100,
      category: 'Tops',
      gender: 'Women',
      images: ['https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80'],
      sizes: ['XS', 'S', 'M'],
      colors: ['Pink', 'White'],
      tags: ['New', 'Trending'],
    }
  });

  // Product 3: Unisex Hoodie
  await prisma.product.create({
    data: {
      name: 'Stealth Black Hoodie',
      description: 'Oversized comfort.',
      price: 89.99,
      stock: 20,
      category: 'Hoodies',
      gender: 'Unisex',
      images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80'],
      sizes: ['M', 'L', 'XL'],
      colors: ['Black'],
      tags: [],
    }
  });

  console.log('✅ Products seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
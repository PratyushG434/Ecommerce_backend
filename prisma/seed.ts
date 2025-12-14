import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Starting seed...');

//   // 1. Clean existing data (Order matters to avoid foreign key errors)
//   await prisma.orderItem.deleteMany();
//   await prisma.order.deleteMany();
//   await prisma.cartItem.deleteMany();
//   await prisma.cart.deleteMany();
//   await prisma.wishlistItem.deleteMany();
//   await prisma.wishlist.deleteMany();
//   await prisma.product.deleteMany();
//   await prisma.user.deleteMany();

//   // 2. Create Users with STRICT roles
//   const password = await bcrypt.hash('admin123', 10);
  
//   // Create Admin
//   await prisma.user.create({
//     data: {
//       email: 'admin@rawwr.com',
//       password,
//       name: 'Admin User',
//       role: 'ADMIN', 
//     },
//   });

//   // Create Customer
//   const customer = await prisma.user.create({
//     data: {
//       email: 'anushka@example.com',
//       password,
//       name: 'Anushka',
//       role: 'CUSTOMER', 
//     },
//   });

//   console.log(`✅ Users created: Admin & Customer`);

//   // 3. Create Products (Now includes gender, sizes, colors)
  
//   // Product 1: Men's Tee
//   await prisma.product.create({
//     data: {
//       name: 'Raawr Classic Tee - Beige',
//       description: 'A premium beige tee for everyday wear.',
//       price: 45.00,
//       originalPrice: 55.00,
//       stock: 50,
//       category: 'Tops',
//       gender: 'Men',
//       images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'],
//       sizes: ['S', 'M', 'L', 'XL'],
//       colors: ['Beige', 'Black'],
//       tags: ['Bestseller', 'Classic'],
//     }
//   });

//   // Product 2: Women's Active Wear
//   const p2 = await prisma.product.create({
//     data: {
//       name: 'Girls Lift Tee',
//       description: 'Performance wear for serious lifting.',
//       price: 35.00,
//       originalPrice: 45.00,
//       stock: 100,
//       category: 'Tops',
//       gender: 'Women',
//       images: ['https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80'],
//       sizes: ['XS', 'S', 'M'],
//       colors: ['Pink', 'White'],
//       tags: ['New', 'Trending'],
//     }
//   });

//   // Product 3: Unisex Hoodie
//   await prisma.product.create({
//     data: {
//       name: 'Stealth Black Hoodie',
//       description: 'Oversized comfort.',
//       price: 89.99,
//       stock: 20,
//       category: 'Hoodies',
//       gender: 'Unisex',
//       images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80'],
//       sizes: ['M', 'L', 'XL'],
//       colors: ['Black'],
//       tags: [],
//     }
//   });

//   console.log('✅ Products seeded!');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });


async function main() {
  console.log('🌱 Starting seed...')

  // 1. Create Dummy Customers
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      password: 'hashed_password_here',
      role: 'CUSTOMER',
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      password: 'hashed_password_here',
      role: 'CUSTOMER',
    },
  })

  const users = [alice, bob]

  // --- FIX START: Create a Real Product First ---
  const product = await prisma.product.upsert({
    where: { id: 'seed-product-1' }, // If you use UUIDs, this might need to be created differently, but upsert works if you specify ID
    update: {},
    create: {
      // If your DB auto-generates IDs, remove the 'id' line below and let it generate
      // But for seeding, it's often easier to force a known ID if possible, or just capture the result
      name: 'Seed Test Product',
      description: 'A product created for testing orders',
      price: 50.00,
      stock: 100,
      category: 'Testing',
      gender: 'Unisex',
      images: ['https://via.placeholder.com/150'], // Matches your array schema
    }
  })
  // --- FIX END ---

  // 3. Create Orders
  const ordersData = [
    { status: 'PENDING', total: 59.99, date: new Date() }, 
    { status: 'PAID', total: 120.50, date: new Date(Date.now() - 86400000 * 1) }, 
    { status: 'SHIPPED', total: 299.00, date: new Date(Date.now() - 86400000 * 3) }, 
    { status: 'DELIVERED', total: 45.00, date: new Date(Date.now() - 86400000 * 7) }, 
    { status: 'CANCELLED', total: 15.99, date: new Date(Date.now() - 86400000 * 2) },
    { status: 'PAID', total: 89.99, date: new Date(Date.now() - 86400000 * 5) },
  ]

  for (const order of ordersData) {
    const randomUser = users[Math.floor(Math.random() * users.length)]

    await prisma.order.create({
      data: {
        userId: randomUser.id,
        status: order.status,
        total: order.total,
        createdAt: order.date,
        items: {
          create: [
            {
              // FIX: Use the REAL product ID we just created
              productId: product.id, 
              quantity: 1,
              price: order.total 
            }
          ]
        }
      },
    })
  }

  console.log(`✅ Seeded orders successfully`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
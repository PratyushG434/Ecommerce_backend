import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  const password = await bcrypt.hash('admin123', 10);

  // ✅ Use upsert to prevent errors if running seed multiple times
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rawwr.com' },
    update: {}, // If exists, do nothing
    create: {
      email: 'admin@rawwr.com',
      password,
      name: 'Admin User',
      role: 'ADMIN',
      isVerified: true, // Important for your Hard Verification login logic
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);
}

// ✅ boilerplate to execute the function
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

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


// async function main() {
//   console.log('🌱 Starting seed...')

//   // 1. Create Dummy Customers
//   const alice = await prisma.user.upsert({
//     where: { email: 'alice@example.com' },
//     update: {},
//     create: {
//       email: 'alice@example.com',
//       name: 'Alice Johnson',
//       password: 'hashed_password_here',
//       role: 'CUSTOMER',
//     },
//   })

//   const bob = await prisma.user.upsert({
//     where: { email: 'bob@example.com' },
//     update: {},
//     create: {
//       email: 'bob@example.com',
//       name: 'Bob Smith',
//       password: 'hashed_password_here',
//       role: 'CUSTOMER',
//     },
//   })

//   const users = [alice, bob]

//   // --- FIX START: Create a Real Product First ---
//   const product = await prisma.product.upsert({
//     where: { id: 'seed-product-1' }, // If you use UUIDs, this might need to be created differently, but upsert works if you specify ID
//     update: {},
//     create: {
//       // If your DB auto-generates IDs, remove the 'id' line below and let it generate
//       // But for seeding, it's often easier to force a known ID if possible, or just capture the result
//       name: 'Seed Test Product',
//       description: 'A product created for testing orders',
//       price: 50.00,
//       stock: 100,
//       category: 'Testing',
//       gender: 'Unisex',
//       images: ['https://via.placeholder.com/150'], // Matches your array schema
//     }
//   })
//   // --- FIX END ---

//   // 3. Create Orders
//   const ordersData = [
//     { status: 'PENDING', total: 59.99, date: new Date() }, 
//     { status: 'PAID', total: 120.50, date: new Date(Date.now() - 86400000 * 1) }, 
//     { status: 'SHIPPED', total: 299.00, date: new Date(Date.now() - 86400000 * 3) }, 
//     { status: 'DELIVERED', total: 45.00, date: new Date(Date.now() - 86400000 * 7) }, 
//     { status: 'CANCELLED', total: 15.99, date: new Date(Date.now() - 86400000 * 2) },
//     { status: 'PAID', total: 89.99, date: new Date(Date.now() - 86400000 * 5) },
//   ]

//   for (const order of ordersData) {
//     const randomUser = users[Math.floor(Math.random() * users.length)]

//     await prisma.order.create({
//       data: {
//         userId: randomUser.id,
//         status: order.status,
//         total: order.total,
//         createdAt: order.date,
//         items: {
//           create: [
//             {
//               // FIX: Use the REAL product ID we just created
//               productId: product.id, 
//               quantity: 1,
//               price: order.total 
//             }
//           ]
//         }
//       },
//     })
//   }

//   console.log(`✅ Seeded orders successfully`)
// }

// main()
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prisma.$disconnect()
//   })


// async function main() {
//   console.log('Start seeding...')

  // 1. Cleanup existing products (Optional - use with caution)
  // await prisma.product.deleteMany({}) 

  // 2. Define the exact products from your UI
//   const products = [
//     // --- FEATURED (New) ---
//     {
//       name: "Girls Lift Tee",
//       price: 35.00,
//       originalPrice: 45.00,
//       description: "Empowering tee designed for women who lift. Breathable fabric.",
//       category: "Tops",
//       gender: "Women",
//       tags: ["New", "Trending"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/img2-1765447269678.jpg?width=600&height=600&resize=contain"],
//       colors: [{ name: "Pink", hex: "#FFC0CB" }],
//       colorNames: ["Pink"],
//       sizes: ["S", "M", "L"],
//       stock: 50
//     },
//     {
//       name: "Raawr Classic Tee - Black",
//       price: 55.00,
//       originalPrice: 70.00,
//       description: "Our signature classic tee in premium black cotton.",
//       category: "Tops",
//       gender: "Men", // Assuming Men/Unisex based on name
//       tags: ["Bestseller", "Classic"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/DSC_0116-1765447272114.jpg?width=600&height=600&resize=contain"],
//       colors: [{ name: "Black", hex: "#000000" }],
//       colorNames: ["Black"],
//       sizes: ["M", "L", "XL"],
//       stock: 100
//     },
//     {
//       name: "Raawr Classic Tee - White",
//       price: 40.00,
//       description: "Clean, crisp white tee for everyday wear.",
//       category: "Tops",
//       gender: "Unisex",
//       tags: ["New", "Classic"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/DSC_0013-1765447268417.JPG?width=600&height=600&resize=contain"],
//       colors: [{ name: "White", hex: "#FFFFFF" }],
//       colorNames: ["White"],
//       sizes: ["S", "M", "L", "XL"],
//       stock: 80
//     },
//     {
//       name: "Down Bad Crying Tee",
//       price: 65.00,
//       originalPrice: 80.00,
//       description: "Express your feelings with this unique graphic tee.",
//       category: "Tops",
//       gender: "Unisex",
//       tags: ["Sale", "Graphic"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/DSC_0024-1765447268972.JPG?width=600&height=600&resize=contain"],
//       colors: [{ name: "Black", hex: "#111111" }],
//       colorNames: ["Black"],
//       sizes: ["S", "M"],
//       stock: 30
//     },
//     // --- BESTSELLERS ---
//     {
//       name: "Raawr Classic Tee - Beige",
//       price: 45.00,
//       description: "The classic fit in a versatile beige tone.",
//       category: "Tops",
//       gender: "Unisex",
//       tags: ["Bestseller"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/DSC_0104-1765447268802.JPG?width=600&height=600&resize=contain"],
//       colors: [{ name: "Beige", hex: "#F5F5DC" }],
//       colorNames: ["Beige"],
//       sizes: ["S", "M", "L"],
//       stock: 60
//     },
//     {
//       name: "Girls Lift Oversized Tee",
//       price: 60.00,
//       originalPrice: 75.00,
//       description: "Maximum comfort meets gym style. Oversized fit.",
//       category: "Tops",
//       gender: "Women",
//       tags: ["Bestseller", "Oversized"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/DSC_0127-1765447268704.JPG?width=600&height=600&resize=contain"],
//       colors: [{ name: "White", hex: "#FFFFFF" }],
//       colorNames: ["White"],
//       sizes: ["S", "M"],
//       stock: 40
//     },
//     {
//       name: "More Than An Athlete Sweatshirt",
//       price: 30.00,
//       description: "Make a statement on and off the field.",
//       category: "Outerwear",
//       gender: "Unisex",
//       tags: ["Bestseller", "Winter"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/IMG_6043-1765447271104.JPG?width=600&height=600&resize=contain"],
//       colors: [{ name: "Black", hex: "#000000" }],
//       colorNames: ["Black"],
//       sizes: ["M", "L", "XL"],
//       stock: 25
//     },
//     {
//       name: "Girls Lift Tee - Pink",
//       price: 70.00,
//       originalPrice: 85.00,
//       description: "Premium pink edition of our popular lift tee.",
//       category: "Tops",
//       gender: "Women",
//       tags: ["Bestseller", "Premium"],
//       images: ["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/img2-1765447269678.jpg?width=600&height=600&resize=contain"],
//       colors: [{ name: "Pink", hex: "#FFC0CB" }],
//       colorNames: ["Pink"],
//       sizes: ["S", "M"],
//       stock: 15
//     },
//   ]

//   console.log(`Adding ${products.length} products...`)

//   for (const p of products) {
//     await prisma.product.create({
//       data: p
//     })
//   }

//   console.log('Seeding finished.')
// }

// main()
//   .then(async () => {
//     await prisma.$disconnect()
//   })
//   .catch(async (e) => {
//     console.error(e)
//     await prisma.$disconnect()
//     process.exit(1)
//   })
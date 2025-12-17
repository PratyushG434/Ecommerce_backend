import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import paymentRoutes from './routes/paymentRoutes';


import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import { PrismaClient } from '@prisma/client';
import { adminOnly, protect } from './middleware/authMiddleware';
const prisma = new PrismaClient();
// We can add orderRoutes later



const app = express();
const PORT = process.env.PORT || 8000;

app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true 
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/user', userRoutes); 
app.use('/api/admin',adminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);


// Health Check
async function checkDbConnection() {
  try {
    await prisma.$connect(); // Try to connect
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
}
app.get('/', (req, res) => { res.send('API Running'); });

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

checkDbConnection();


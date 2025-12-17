import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail } from '../utils/emailService';

const prisma = new PrismaClient();

const generateAccessToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
};

const generateRefreshToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // 1. Basic Credentials Check
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 🔒 2. HARD VERIFICATION CHECK
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address to log in.',
        needsVerification: true // Optional: Frontend can use this to show a "Resend Email" button
      });
    }

    // 3. Generate Tokens (Only if verified)
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, role: user.role });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 1. Check if user exists (By Email Only)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash & Create
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        verificationToken,
        isVerified: false, // 🔒 Starts as false
        role: "CUSTOMER"
      }
    });

    // 3. Send Email
    await sendVerificationEmail(newUser.email, verificationToken);

    // 4. Return Success Message ONLY (No Tokens)
    res.status(201).json({
      message: "Registration successful! Please check your email to verify your account before logging in.",
      success: true
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ message: "Invalid token" });

    const user = await prisma.user.findFirst({
      where: { verificationToken: String(token) }
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        isVerified: true,
        verificationToken: null // Clear token after use
      }
    });

    res.json({ message: "Email verified successfully!" });

  } catch (error) {
    res.status(500).json({ message: "Verification failed" });
  }
};

export const refresh = (req: Request, res: Response) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized' });

  const refreshToken = cookies.jwt;

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    const accessToken = generateAccessToken(decoded.id, decoded.role);
    res.json({ accessToken });
  });
};

export const getMe = async (req: Request, res: Response) => {
  try {

    console.log(req.user)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);

  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'strict', secure: true });
  res.json({ message: 'Logged out' });
};
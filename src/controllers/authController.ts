import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
    if (user && (await bcrypt.compare(password, user.password))) {
      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken(user.id, user.role);
      
      // Store refresh token in httpOnly cookie
      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ accessToken, role: user.role });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

export const logout = (req: Request, res: Response) => {
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'strict', secure: true });
  res.json({ message: 'Logged out' });
};
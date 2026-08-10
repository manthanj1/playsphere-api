import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_me';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Create a Nodemailer transporter.
// In dev, falls back to Ethereal (free test SMTP) if the real credentials fail,
// and prints a clickable preview URL to the console.
async function sendResetEmail(mailOptions: nodemailer.SendMailOptions): Promise<void> {
  // Try real SMTP first (from .env)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail(mailOptions);
      console.log(`[auth] ✅ Email sent via ${process.env.SMTP_HOST} to ${mailOptions.to}`);
      return;
    } catch (err) {
      console.warn('[auth] ⚠️  Real SMTP failed, falling back to Ethereal test account:', (err as Error).message);
    }
  }

  // Fallback: generate a free Ethereal test account and send there
  const testAccount = await nodemailer.createTestAccount();
  const devTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const info = await devTransporter.sendMail(mailOptions);
  console.log(`[auth] ✅ Ethereal test email sent`);
  console.log(`[auth] 👉 Preview URL (click to view): ${nodemailer.getTestMessageUrl(info)}`);
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
      },
    });

    const token = jwt.sign({ uid: user.id, email: user.email, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ uid: user.id, email: user.email, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({ user, token });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't leak whether user exists for security
      res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
      return;
    }

    // Generate a secure random reset token and store it with a 1-hour expiry
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"PlaySphere" <${process.env.SMTP_FROM || 'noreply@playsphere.test'}>`,
      to: email,
      subject: 'PlaySphere Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You recently requested to reset your password for your PlaySphere account.</p>
          <p>Click the button below to reset it. This link is valid for 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #003ec7; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await sendResetEmail(mailOptions);
    } catch (emailError) {
      // Ethereal fallback also failed — log the raw link as last resort
      console.error('[auth] All email transports failed:', emailError);
      console.log(`[auth] DEV FALLBACK — Reset link for ${email}:\n  ${resetLink}`);
    }

    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password failed:', error);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      res.status(400).json({ error: 'Email, token, and new password are required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password failed:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

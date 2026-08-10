import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 2. Create the Authentication Middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Check if the request has a Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    // Verify the custom JWT
    const decodedToken = jwt.verify(token, jwtSecret);
    
    // Attach the verified user's data (like uid) to the request
    (req as any).user = decodedToken;
    
    // Move on to the actual route handler
    next();
  } catch (error) {
    console.error('JWT token verification failed:', error);
    res.status(403).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
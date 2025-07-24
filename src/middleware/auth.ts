import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  authenticated?: boolean;
}

export const authenticateWebhook = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const webhookSecret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== webhookSecret) {
    return res.status(403).json({ error: 'Invalid webhook secret' });
  }
  
  req.authenticated = true;
  next();
}; 
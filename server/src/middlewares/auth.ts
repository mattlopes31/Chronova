import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

export interface AuthRequest extends Request {
  user?: {
    id: bigint;
    email: string;
    role: string;
    nom: string;
    prenom: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'chronova-secret';
    
    const decoded = jwt.verify(token, secret) as { id: string; email: string };
    
    const salarie = await prisma.salarie.findUnique({
      where: { id: BigInt(decoded.id) },
      select: {
        id: true,
        email: true,
        role: true,
        nom: true,
        prenom: true,
        actif: true
      }
    });

    if (!salarie || !salarie.actif) {
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }

    req.user = {
      id: salarie.id,
      email: salarie.email,
      role: salarie.role,
      nom: salarie.nom,
      prenom: salarie.prenom
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

export const managerMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== 'Admin' && req.user?.role !== 'Manager') {
    return res.status(403).json({ error: 'Accès réservé aux managers' });
  }
  next();
};

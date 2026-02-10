import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Sérializer BigInt en JSON
const serializeBigInt = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const salarie = await prisma.salarie.findUnique({
      where: { email },
      include: {
        fonction: true,
        status: true
      }
    });

    if (!salarie || !salarie.password_hash) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!salarie.actif) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    const validPassword = await bcrypt.compare(password, salarie.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour dernière connexion
    await prisma.salarie.update({
      where: { id: salarie.id },
      data: { derniere_connexion: new Date() }
    });

    const secret = process.env.JWT_SECRET || 'chronova-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const payload = { id: salarie.id.toString(), email: salarie.email };
    // @ts-ignore - TypeScript type issue with jsonwebtoken
    const token = jwt.sign(payload, secret, { expiresIn });

    const { password_hash, token_reset_password, token_expiration, ...salarieData } = salarie;

    res.json({
      token,
      user: serializeBigInt(salarieData)
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/register (Admin seulement)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { 
      email, 
      password, 
      nom, 
      prenom, 
      tel,
      matricule,
      role,
      salarie_fonction_id,
      salarie_status_id 
    } = req.body;

    if (!email || !password || !nom || !prenom) {
      return res.status(400).json({ 
        error: 'Email, mot de passe, nom et prénom requis' 
      });
    }

    const existingSalarie = await prisma.salarie.findUnique({
      where: { email }
    });

    if (existingSalarie) {
      return res.status(400).json({ error: 'Cet email existe déjà' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const salarie = await prisma.salarie.create({
      data: {
        email,
        password_hash: hashedPassword,
        nom,
        prenom,
        tel,
        matricule,
        role: role || 'Salarie',
        salarie_fonction_id: salarie_fonction_id ? BigInt(salarie_fonction_id) : null,
        salarie_status_id: salarie_status_id ? BigInt(salarie_status_id) : null,
        actif: true,
        date_entree: new Date()
      },
      include: {
        fonction: true,
        status: true
      }
    });

    const { password_hash, token_reset_password, token_expiration, ...salarieData } = salarie;

    res.status(201).json(serializeBigInt(salarieData));
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const salarie = await prisma.salarie.findUnique({
      where: { id: req.user!.id },
      include: {
        fonction: true,
        status: true,
        manager: {
          select: { id: true, nom: true, prenom: true, email: true }
        }
      }
    });

    if (!salarie) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const { password_hash, token_reset_password, token_expiration, ...salarieData } = salarie;

    res.json(serializeBigInt(salarieData));
  } catch (error) {
    console.error('Erreur me:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe requis' });
    }

    const salarie = await prisma.salarie.findUnique({
      where: { id: req.user!.id }
    });

    if (!salarie || !salarie.password_hash) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(currentPassword, salarie.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.salarie.update({
      where: { id: req.user!.id },
      data: { password_hash: hashedPassword }
    });

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    console.error('Erreur password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

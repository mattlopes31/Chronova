import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/auth';
import salariesRoutes from './routes/salaries';
import projetsRoutes from './routes/projets';
import clientsRoutes from './routes/clients';
import tachesRoutes from './routes/taches';
import pointagesRoutes from './routes/pointages';
import congesRoutes from './routes/conges';
import dashboardRoutes from './routes/dashboard';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: (error as Error).message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/salaries', salariesRoutes);
app.use('/api/projets', projetsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/taches', tachesRoutes);
app.use('/api/pointages', pointagesRoutes);
app.use('/api/conges', congesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur:', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Chronova Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat';
import { liveTokenRouter } from './routes/liveToken';
import { schemesRouter } from './routes/schemes';
import { cropCalendarRouter } from './routes/cropCalendar';
import { searchRouter } from './routes/search';
import { agentRouter } from './agent/agentController';
import { profileRouter } from './routes/profile';
import { formCopilotRouter } from './routes/formCopilot';
import { initKnowledgeBase, getKBStats } from './services/knowledgeBase';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost origin (5173, 5174, etc.)
    if (/^http:\/\/localhost:[0-9]+$/.test(origin)) return callback(null, true);
    if (process.env.CLIENT_ORIGIN && origin === process.env.CLIENT_ORIGIN) return callback(null, true);
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Initialize knowledge base on startup
async function bootstrap() {
  try {
    await initKnowledgeBase();
    console.log('✅ Knowledge base loaded successfully');
  } catch (err) {
    console.error('⚠️  Knowledge base failed to load:', err);
    console.log('   Server will continue without knowledge base context.');
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY is not set. Chat will return errors.');
  }

  app.use('/api', chatRouter);
  app.use('/api/live', liveTokenRouter);
  app.use('/api/schemes', schemesRouter);
  app.use('/api/crop-calendar', cropCalendarRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/form-copilot', formCopilotRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.listen(PORT, () => {
    console.log(`🚀 gram Sathi API server running on http://localhost:${PORT}`);
    const stats = getKBStats();
    console.log(`📚 Knowledge base: ${stats.totalRecords} records loaded`);
  });
}

bootstrap().catch(console.error);

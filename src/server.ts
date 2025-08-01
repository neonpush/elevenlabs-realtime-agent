import express from 'express';
import WebSocket from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { ElevenLabsSession } from './elevenlabs-session';
import { TwilioHandler } from './twilio-handler';
import leadRoutes from './routes/leads';
import { sequelize, testConnection } from './database/config';

// Load environment variables
config();

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Add error handling for the WebSocket server
wss.on('error', (error) => {
  console.error('❌ WebSocket Server error:', error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', leadRoutes);

// Twilio webhook endpoints
app.post('/voice', TwilioHandler.handleIncomingCall);
app.post('/media-stream', TwilioHandler.handleMediaStream);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['lead-integration', 'smart-routing']
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ElevenLabs Realtime Agent Server v2',
    endpoints: {
      voice: '/voice',
      mediaStream: '/media-stream',
      health: '/health',
      leadWebhook: '/api/webhook/lead-data',
      leadLookup: '/api/leads/:phoneNumber'
    },
    websocket: 'ws://localhost:3000/ws',
    features: {
      leadIntegration: true,
      smartConversation: true,
      dataCompleteness: ['COMPLETE', 'PARTIAL', 'MINIMAL']
    }
  });
});

// WebSocket connection handler for Twilio Media Streams
wss.on('connection', (ws: WebSocket, req: any) => {
  const clientIP = req.socket.remoteAddress;
  const url = req.url;
  console.log(`🔌 New WebSocket connection from: ${clientIP}`);
  console.log(`🔗 Connection URL: ${url}`);
  console.log(`📊 Total connections: ${wss.clients.size}`);
  
  const session = new ElevenLabsSession(ws);
  
  ws.on('message', (data: WebSocket.Data) => {
    try {
      session.handleMessage(data as Buffer);
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  });
  
  ws.on('close', (code: number, reason: Buffer) => {
    console.log(`🔌 WebSocket connection closed: ${code} - ${reason.toString()}`);
    console.log(`📊 Remaining connections: ${wss.clients.size - 1}`);
    session.cleanup();
  });

  ws.on('error', (error: Error) => {
    console.error('❌ WebSocket error:', error);
    session.cleanup();
  });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection
    console.log('🔌 Connecting to PostgreSQL database...');
    await testConnection();
    await sequelize.sync({ force: true }); // This will drop and recreate tables
    console.log('✅ Database synchronized');
    
    server.listen(PORT, () => {
      console.log('🚀 ElevenLabs Realtime Agent Server v2');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔑 ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
      console.log(`🤖 Agent ID: ${process.env.ELEVENLABS_AGENT_ID ? '✅ Configured' : '❌ Missing'}`);
      console.log(`📞 Twilio Phone: ${process.env.TWILIO_PHONE_NUMBER || 'Not configured'}`);
      console.log(`🗄️  Database: ${process.env.DATABASE_URL ? '✅ Connected' : '⚠️  Using default'}`);
      console.log(`🔐 Webhook Secret: ${process.env.WEBHOOK_SECRET ? '✅ Configured' : '⚠️  Using default'}`);
      console.log('💡 Ready to receive calls with lead integration!');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 
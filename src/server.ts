import express from 'express';
import WebSocket from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { ElevenLabsSession } from './elevenlabs-session';
import { TwilioHandler } from './twilio-handler';

// Load environment variables
config();

const app = express();
const server = createServer(app);
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Twilio webhook endpoints
app.post('/voice', TwilioHandler.handleIncomingCall);
app.post('/media-stream', TwilioHandler.handleMediaStream);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ElevenLabs Realtime Agent Server',
    endpoints: {
      voice: '/voice',
      mediaStream: '/media-stream',
      health: '/health'
    },
    websocket: 'ws://localhost:3000/ws'
  });
});

// WebSocket connection handler for Twilio Media Streams
wss.on('connection', (ws: WebSocket, req: any) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`🔌 New WebSocket connection from: ${clientIP}`);
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
          console.log(`📊 Remaining connections: ${wss.clients.size}`);
    session.cleanup();
  });

  ws.on('error', (error: Error) => {
    console.error('❌ WebSocket error:', error);
    session.cleanup();
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 ElevenLabs Realtime Agent Server');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔑 ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🤖 Agent ID: ${process.env.ELEVENLABS_AGENT_ID ? '✅ Configured' : '❌ Missing'}`);
  console.log(`📞 Twilio Phone: ${process.env.TWILIO_PHONE_NUMBER || 'Not configured'}`);
  console.log('💡 Ready to receive calls!');
}); 
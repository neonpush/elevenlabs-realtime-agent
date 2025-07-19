import { Request, Response } from 'express';
import { TwilioWebhookRequest } from './types/twilio';
import { ConnectionPool } from './connection-pool';

export class TwilioHandler {
  static async handleIncomingCall(req: Request, res: Response): Promise<void> {
    const webhookData = req.body as TwilioWebhookRequest;
    console.log('📞 Incoming call from:', webhookData.From);
    console.log('📋 Call SID:', webhookData.CallSid);
    
    // Pre-connect to ElevenLabs while phone is ringing
    ConnectionPool.getInstance().getOrCreateConnection(webhookData.CallSid);
    
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL || `${req.protocol}://${req.get('host')}`;
    const wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://') + '/ws';
    
    console.log('🔗 WebSocket URL:', wsUrl);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${wsUrl}" />
      </Connect>
    </Response>`;
    
    console.log('📤 TwiML Response:', twiml);
    res.type('text/xml');
    res.send(twiml);
  }
  
  static handleMediaStream(req: Request, res: Response): void {
    console.log('🎵 Media stream webhook called');
    res.sendStatus(200);
  }
} 
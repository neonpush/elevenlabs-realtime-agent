import { Request, Response } from 'express';
import { TwilioWebhookRequest } from './types/twilio';
import { ConnectionPool } from './connection-pool';

export class TwilioHandler {
  static async handleIncomingCall(req: Request, res: Response): Promise<void> {
    const webhookData = req.body as TwilioWebhookRequest;
    console.log('📞 Incoming call from:', webhookData.From);
    console.log('📋 Call SID:', webhookData.CallSid);
    console.log('📞 To:', webhookData.To);
    console.log('🔄 Direction:', webhookData.Direction);
    
    // For outbound calls (Direction = "outbound-api"), the lead's phone is in "To"
    // For inbound calls (Direction = "inbound"), the lead's phone is in "From"
    const leadPhoneNumber = webhookData.Direction === 'outbound-api' 
      ? webhookData.To 
      : webhookData.From;
    
    console.log('👤 Lead phone number:', leadPhoneNumber);
    
    // Pre-connect to ElevenLabs while phone is ringing
    // Pass phone number along with call SID for lead lookup
    ConnectionPool.getInstance().getOrCreateConnection(
      webhookData.CallSid,
      leadPhoneNumber // Pass the correct phone number based on call direction
    );
    
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL || `${req.protocol}://${req.get('host')}`;
    const wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://') + '/ws';
    
    console.log('🔗 WebSocket URL:', wsUrl);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${wsUrl}">
          <Parameter name="from" value="${leadPhoneNumber}" />
        </Stream>
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
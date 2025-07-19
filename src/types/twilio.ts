export interface TwilioWebhookRequest {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  Direction?: string;
  AccountSid?: string;
}

export interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop';
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    callSid: string;
    accountSid: string;
    tracks: string[];
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

export interface TwilioResponse {
  event: 'media';
  streamSid: string;
  media: {
    payload: string;
  };
} 
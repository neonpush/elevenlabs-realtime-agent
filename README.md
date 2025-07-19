# ElevenLabs Realtime Agent

A high-performance voice AI agent using ElevenLabs Conversational AI and Twilio for ultra-low latency phone conversations.

## Features

- ⚡ **Ultra-low latency** (< 500ms TTFT expected)
- 🎭 **Superior voice quality** with ElevenLabs
- 🔌 **Pre-connection optimization** for faster response times
- 📊 **Real-time metrics tracking**
- 🌍 **Multi-language support** (29+ languages)
- 🎨 **Voice cloning capabilities**

## Quick Start

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your credentials:

```bash
cp .env.example .env
```

Required variables:
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `ELEVENLABS_AGENT_ID` - Your ElevenLabs agent ID
- `TWILIO_ACCOUNT_SID` - Your Twilio account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `USER_PHONE_NUMBER` - Phone number to call for testing

### 3. Start the Server

```bash
npm run dev
```

### 4. Set Up Tunnel

In a new terminal:

```bash
lt --port 3000 --subdomain your-subdomain
```

Or use ngrok:

```bash
ngrok http 3000
```

### 5. Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active numbers
3. Select your phone number
4. Set the webhook URL to: `https://your-tunnel-url/voice`

### 6. Test the Agent

```bash
npm test
```

## Performance Metrics

| Metric | Expected Performance |
|--------|---------------------|
| TTFT | < 500ms |
| Connection Time | 200-400ms |
| Voice Quality | Excellent |
| Languages | 29+ |

## Architecture

- **Express Server**: Handles Twilio webhooks
- **WebSocket**: Real-time audio streaming
- **Connection Pool**: Pre-warms ElevenLabs connections
- **Metrics Tracker**: Logs performance data to CSV

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build TypeScript
- `npm start` - Run production server
- `npm test` - Make a test call
- `npm run metrics` - View performance metrics

## Troubleshooting

### High Latency
- Check network connection
- Verify audio format conversion
- Review connection pool status

### Connection Issues
- Ensure all environment variables are set
- Check ElevenLabs agent is active
- Verify Twilio webhook configuration

### Audio Quality
- Confirm proper audio format (PCM 16kHz → μ-law 8kHz)
- Check ElevenLabs voice settings
- Monitor interruption events

## License

MIT 
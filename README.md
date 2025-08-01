# ElevenLabs Realtime Agent v2

A high-performance voice AI agent using ElevenLabs Conversational AI and Twilio for ultra-low latency phone conversations, now with intelligent lead data integration.

## Features

- ⚡ **Ultra-low latency** (< 500ms TTFT expected)
- 🎭 **Superior voice quality** with ElevenLabs
- 🔌 **Pre-connection optimization** for faster response times
- 📊 **Real-time metrics tracking**
- 🌍 **Multi-language support** (29+ languages)
- 🎨 **Voice cloning capabilities**
- 🧠 **Smart Lead Integration** - Pre-populate lead data for context-aware conversations
- 📈 **Adaptive Conversation Flow** - Adjusts based on data completeness
- 🗄️ **PostgreSQL Integration** - Persistent lead storage and tracking

## What's New in v2

- **Lead Data Integration**: Receive pre-populated lead information via webhook
- **Smart Conversation Strategies**: Agent adapts based on available data (COMPLETE/PARTIAL/MINIMAL)
- **Efficient Data Collection**: Only asks for missing information
- **Database Backend**: PostgreSQL for lead tracking and analytics
- **Webhook API**: Secure endpoints for CRM/form integrations

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
- `DATABASE_URL` - PostgreSQL connection string
- `WEBHOOK_SECRET` - Secret for webhook authentication
- `TWILIO_ACCOUNT_SID` - Your Twilio account SID (optional)
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token (optional)
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number

### 3. Set Up Database

```bash
# Create database
createdb elevenlabs_leads

# Run migration
psql elevenlabs_leads < src/database/migrations/001_create_leads_table.sql
```

### 4. Start the Server

```bash
npm run dev
```

### 5. Set Up Tunnel

In a new terminal:

```bash
lt --port 3000 --subdomain your-subdomain
```

Or use ngrok:

```bash
ngrok http 3000
```

### 6. Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active numbers
3. Select your phone number
4. Set the webhook URL to: `https://your-tunnel-url/voice`

### 7. Test the Agent

```bash
npm test
```

## Lead Data Integration

### Send Lead Data

Before a call, send lead information to the webhook:

```bash
npm run test:webhook
```

Or manually:

```bash
curl -X POST http://localhost:3000/api/webhook/lead-data \
  -H "Authorization: Bearer your_webhook_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "John Smith",
      "phoneNumber": "+447123456789",
      "budget": 1200,
      "yearlyWage": 35000,
      "occupation": "employed"
    }
  }'
```

### Lead Completeness Levels

- **COMPLETE (7/7 fields)**: ~30-45 seconds call time
- **PARTIAL (4-6/7 fields)**: ~60-90 seconds call time
- **MINIMAL (1-3/7 fields)**: ~90-120 seconds call time

See [Lead Integration Guide](docs/LEAD_INTEGRATION.md) for detailed documentation.

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
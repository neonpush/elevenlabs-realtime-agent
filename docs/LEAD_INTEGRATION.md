# Lead Data Integration Guide

## Overview

The ElevenLabs Realtime Agent v2 now supports pre-populated lead data integration. This allows the agent to receive lead information before calls, enabling smarter conversations with context-aware responses.

## Features

- **Smart Lead Analysis**: Automatically categorizes leads as COMPLETE, PARTIAL, or MINIMAL
- **Context-Aware Conversations**: Agent adapts conversation strategy based on available data
- **Efficient Data Collection**: Only asks for missing information
- **Database Integration**: PostgreSQL storage for lead tracking
- **Webhook API**: Secure endpoint for receiving lead data from external systems

## Setup

### 1. Database Setup

Create a PostgreSQL database and run the migration:

```bash
# Create database
createdb elevenlabs_leads

# Run migration
psql elevenlabs_leads < src/database/migrations/001_create_leads_table.sql
```

### 2. Environment Configuration

Add these variables to your `.env` file:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/elevenlabs_leads

# Webhook Security
WEBHOOK_SECRET=your_secure_webhook_secret_here
```

### 3. Install Dependencies

```bash
npm install
```

## API Reference

### Lead Data Webhook

**Endpoint:** `POST /api/webhook/lead-data`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_WEBHOOK_SECRET",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "leadId": "LEAD_12345",
  "timestamp": "2024-01-19T10:30:00Z",
  "source": "website_form",
  "data": {
    "name": "John Smith",
    "moveInDate": "2024-03-15",
    "budget": 1200,
    "yearlyWage": 35000,
    "occupation": "employed",
    "contractLength": "TWELVE_MONTHS",
    "phoneNumber": "+447123456789",
    "email": "john@example.com",
    "preferredTime": "afternoon",
    "propertyType": "1-bed",
    "area": "Central London",
    "availability": [
      "29 July 2025 - Morning (9:00 - 12:00)",
      "31 July 2025 - Afternoon (12:00 - 14:00)"
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "leadId": 123,
  "completeness": "COMPLETE",
  "status": "stored",
  "phoneNumber": "+447123456789"
}
```

### Lead Lookup

**Endpoint:** `GET /api/leads/:phoneNumber`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_WEBHOOK_SECRET"
}
```

**Response:**
```json
{
  "lead": { ... },
  "strategy": {
    "completenessLevel": "PARTIAL",
    "missingFields": ["moveInDate", "occupation"],
    "existingData": { ... }
  }
}
```

## Testing

### Test the Webhook

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
      "name": "Test User",
      "phoneNumber": "+447123456789",
      "budget": 1200
    }
  }'
```

## Conversation Strategies

### Complete Lead (7/7 fields)
- Quick batch confirmation
- Focus on booking
- ~30-45 seconds call time

### Partial Lead (4-6/7 fields)
- Confirm existing data
- Collect missing fields strategically
- ~60-90 seconds call time

### Minimal Lead (1-3/7 fields)
- Standard qualification flow
- Systematic data collection
- ~90-120 seconds call time

## Required Fields

1. **name** - Full name
2. **moveInDate** - When they want to move in
3. **budget** - Monthly budget in GBP
4. **yearlyWage** - Annual income as integer (e.g., 35000 for £35k)
5. **occupation** - "employed" or "student"
6. **contractLength** - Contract enum: "LT_SIX_MONTHS", "SIX_MONTHS", "TWELVE_MONTHS", "GT_TWELVE_MONTHS"
7. **phoneNumber** - Contact number

## Integration Examples

### From a CRM

```javascript
// When a lead is created in your CRM
const leadData = {
  leadId: crmLead.id,
  source: "salesforce",
  data: {
    name: crmLead.fullName,
    phoneNumber: crmLead.phone,
    budget: crmLead.monthlyBudget,
    // ... map other fields
  }
};

await axios.post('https://your-agent.com/api/webhook/lead-data', leadData, {
  headers: {
    'Authorization': 'Bearer YOUR_WEBHOOK_SECRET'
  }
});
```

### From a Website Form

```javascript
// When a form is submitted
const formData = {
  source: "website_contact_form",
  data: {
    name: form.name,
    phoneNumber: form.phone,
    budget: parseInt(form.budget),
    moveInDate: form.moveDate,
    // ... other fields
  }
};

await fetch('/api/webhook/lead-data', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_WEBHOOK_SECRET',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(formData)
});
```

## Monitoring

The system logs detailed information about lead processing:

- Lead creation and completeness level
- Missing fields identification
- Call association and status updates
- Conversation strategy selection

Check logs for entries like:
```
📥 Received lead data webhook
✅ Lead created successfully: { id: 123, completeness: 'PARTIAL' }
🔍 Looking up lead data for +447123456789
📋 Initializing conversation with lead context
```

## Security

- Always use HTTPS in production
- Keep your webhook secret secure
- Validate all incoming data
- Use environment variables for sensitive configuration
- Implement rate limiting for webhook endpoints

## Troubleshooting

### Database Connection Issues
- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify database exists and user has permissions

### Webhook Not Working
- Verify Authorization header includes "Bearer " prefix
- Check webhook secret matches
- Ensure JSON body is valid
- Check server logs for detailed errors

### Lead Not Found During Call
- Verify phone number format matches
- Check lead status (must be 'pending' or 'in_progress')
- Ensure lead was created before call
- Check database for lead record 
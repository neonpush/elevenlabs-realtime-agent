# 🚀 ElevenLabs Agent v2 - Lead Data Integration

## 📋 Overview

Transform the ElevenLabs voice agent from a basic conversation flow to an intelligent lead confirmation and booking system that receives pre-populated lead data and efficiently confirms/completes missing information.

## 🎯 Core Objective

**Input:** JSON with partial lead data
**Process:** Confirm existing data + collect missing fields
**Output:** Complete lead profile + scheduled viewing

---

## 📊 Lead Data Schema

### **Expected JSON Input Format:**
```json
{
  "leadId": "LEAD_12345",
  "timestamp": "2024-01-19T10:30:00Z",
  "source": "website_form",
  "data": {
    "name": "John Smith",           // ✅ Required
    "moveInDate": "2024-03-15",     // ✅ Required  
    "budget": 1200,                 // ✅ Required (monthly £)
    "yearlyWage": "30k-40k",        // ✅ Required (range: 20k-30k, 30k-40k, 40k-50k, etc.)
    "occupation": "employed",       // ✅ Required (employed/student)
    "contractLength": 12,           // ✅ Required (months)
    "phoneNumber": "+447123456789", // ✅ Required
    "email": "john@example.com",    // ⚪ Optional
    "preferredTime": "afternoon",   // ⚪ Optional
    "propertyType": "1-bed",        // ⚪ Optional
    "area": "Central London",       // ⚪ Optional
    "availability": [               // ⚪ Optional - viewing availability
      "29 July 2025 - Morning (9:00 - 12:00)",
      "31 July 2025 - Morning (9:00 - 12:00)",
      "31 July 2025 - Afternoon (12:00 - 14:00)"
    ]
  }
}
```

### **Data Completeness Levels:**
- **🟢 Complete Lead** (7/7 required fields) → Quick confirmation only
- **🟡 Partial Lead** (4-6/7 fields) → Targeted questions for missing data
- **🔴 Minimal Lead** (1-3/7 fields) → Structured data collection

---

## 🤖 Agent Workflow v2

### **Phase 1: Lead Analysis (Silent)**
```typescript
// Agent receives lead data before call connects
const leadCompleteness = analyzeLeadData(jsonInput);
const missingFields = identifyMissingFields(jsonInput);
const conversationStrategy = planConversation(leadCompleteness);
```

### **Phase 2: Intelligent Greeting**
Based on lead completeness:

#### **🟢 Complete Lead Greeting:**
```
"Hi John! I'm calling from Lobby about the property viewing you requested. 
I have most of your details already - just need to confirm a few things 
and book your viewing. This should only take a minute!"
```

#### **🟡 Partial Lead Greeting:**
```
"Hi John! Thanks for your interest in our properties. I have some of your 
details from your enquiry, but I need to collect a few more pieces of 
information to get your viewing booked."
```

#### **🔴 Minimal Lead Greeting:**
```
"Hi! I'm calling from Lobby about the property you enquired about. 
I'll need to collect some details to get your viewing booked. 
Could I start by getting your full name?"
```

### **Phase 3: Smart Data Confirmation**

#### **Strategy A: Batch Confirmation (Complete Leads)**
```
"Perfect! I have your details from your enquiry. Let me just confirm everything quickly - you're John Smith, looking to move in on March 15th with a budget of £1,200 monthly, income in the £30-40k range, you're employed, and you're looking for a 12-month contract. Does that all sound correct?"
```




#### **Strategy B: Targeted Collection (Partial Leads)**
```
"I have your name as John Smith and budget of £1,200 monthly. 
I just need a couple more details:
- What's your annual income range - are you in the 20-30k, 30-40k, or 40-50k bracket?
- When are you looking to move in?"
```

#### **Strategy C: Structured Collection (Minimal Leads)**
Traditional question-by-question approach.

### **Phase 4: Intelligent Booking**
```
"Perfect! All details confirmed. I can book your viewing now. 
What day works best for you this week?"
```

---

## 🛠️ Technical Implementation

### **1. Lead Data Integration**

#### **API Endpoint for Lead Data:**
```typescript
interface LeadDataWebhook {
  endpoint: '/api/webhook/lead-data'
  method: 'POST'
  headers: {
    'Authorization': 'Bearer YOUR_WEBHOOK_SECRET'
    'Content-Type': 'application/json'
  }
  body: {
    phoneNumber: string
    leadData: LeadData
  }
}

// Webhook receives lead data and creates database record
app.post('/api/webhook/lead-data', authenticateWebhook, (req, res) => {
  const { phoneNumber, leadData } = req.body;
  
  // Create lead record in PostgreSQL database
  const lead = await createLeadRecord(phoneNumber, leadData);
  
  res.json({ 
    success: true, 
    leadId: lead.id,
    completeness: lead.completeness_level 
  });
});

// Agent fetches lead data when call connects using phone number
const leadData = await getLeadByPhoneNumber(callerPhoneNumber);
```

#### **Lead Data Processing:**
```typescript
class LeadProcessor {
  analyzeCompleteness(data: LeadData): CompletionLevel {
    const required = ['name', 'moveInDate', 'budget', 'yearlyWage', 'occupation', 'contractLength', 'phoneNumber'];
    const present = required.filter(field => data[field] && data[field] !== '');
    
    if (present.length === 7) return 'COMPLETE';
    if (present.length >= 4) return 'PARTIAL';
    return 'MINIMAL';
  }
  
  planQuestions(data: LeadData): Question[] {
    const missing = this.identifyMissing(data);
    return this.optimizeQuestionOrder(missing);
  }
}
```

### **2. Enhanced Agent Prompt**

```typescript
const agentPrompt = `You are a professional property rental assistant for Lobby.

CONTEXT: You have received lead data for this caller: ${JSON.stringify(leadData)}
COMPLETENESS: ${completionLevel}
MISSING FIELDS: ${missingFields.join(', ')}

YOUR TASKS:
1. Greet appropriately based on data completeness
2. Confirm existing data efficiently  
3. Collect missing required fields:
   - name, moveInDate, budget, yearlyWage, occupation, contractLength, phoneNumber
4. Book viewing once all data is complete

CONVERSATION STYLE:
- Be efficient but friendly
- Don't ask for data you already have
- Confirm existing data in batches when possible
- Ask for missing data strategically

EXAMPLE FLOWS:
${generateExampleFlow(completionLevel)}`;
```

### **3. Smart Question Sequencing**

```typescript
class QuestionOptimizer {
  optimizeOrder(missingFields: string[]): Question[] {
    // Group related questions
    const personal = ['name', 'occupation', 'phoneNumber'];
    const financial = ['budget', 'yearlyWage'];
    const timing = ['moveInDate', 'contractLength'];
    
    // Ask in logical groups
    return this.groupAndSequence([personal, financial, timing], missingFields);
  }
}
```

### **4. Confirmation Strategies**

```typescript
class ConfirmationManager {
  batchConfirm(knownData: Partial<LeadData>): string {
    const items = Object.entries(knownData)
      .filter(([key, value]) => value)
      .map(([key, value]) => this.formatForConfirmation(key, value));
    
    return `Let me confirm: ${items.join(', ')}. Is that all correct?`;
  }
  
  formatForConfirmation(field: string, value: any): string {
    switch(field) {
      case 'budget': return `£${value} monthly budget`;
      case 'yearlyWage': return `£${value} annual income`;
      case 'moveInDate': return `moving in ${formatDate(value)}`;
      default: return `${field}: ${value}`;
    }
  }
}
```

---

## 📊 Performance Improvements

### **Conversation Efficiency Metrics:**
- **🟢 Complete Leads:** 30-45 seconds (was 2-3 minutes)
- **🟡 Partial Leads:** 60-90 seconds (was 2-3 minutes)  
- **🔴 Minimal Leads:** 90-120 seconds (same as current)

### **User Experience Improvements:**
- ✅ No redundant questions
- ✅ Faster confirmations
- ✅ Feels more professional
- ✅ Higher conversion rates

---

## 🎯 Step-by-Step Implementation Guide

### **Phase 1: Database Setup**
1. **Install PostgreSQL dependencies**
   - Add `pg`, `sequelize` (or `prisma`), `sequelize-cli` to package.json
   - Install types: `@types/pg`
   - Set up database connection configuration

2. **Create database schema**
   - Create `leads` table with all required fields
   - Add indexes on `phone_number`, `status`, `created_at`
   - Set up database connection and migrations

3. **Database Model Structure**
   - Primary key: `id` (auto-increment)
   - Core fields: `phone_number`, `external_lead_id`, `name`, `move_in_date`, `budget`, etc.
   - Status tracking: `status` (pending/in_progress/completed/failed)
   - Metadata: `completeness_level`, `source`, `call_sid`
   - Timestamps: `created_at`, `call_started_at`, `completed_at`

### **Phase 2: Webhook API**
4. **Create webhook endpoint**
   - Route: `POST /api/webhook/lead-data`
   - Add authentication middleware (Bearer token validation)
   - Input validation and sanitization using Joi/Zod
   - Error handling and comprehensive logging

5. **Lead processing logic**
   - Validate incoming JSON structure against schema
   - Analyze data completeness (Complete/Partial/Minimal)
   - Store in PostgreSQL database with proper indexing
   - Return confirmation response with internal lead ID

### **Phase 3: Agent Integration**
6. **Modify ElevenLabs Session**
   - Add lead data fetching on call connect (by phone number)
   - Pass lead context to agent prompt dynamically
   - Update conversation flow based on completeness level

7. **Enhanced prompting system**
   - Dynamic prompt generation based on available lead data
   - Conversation strategies for different completeness levels
   - Smart question sequencing for missing data collection

### **Phase 4: Call Flow Updates**
8. **Update Twilio handler**
   - Extract caller phone number from Twilio payload
   - Fetch lead data from PostgreSQL database
   - Pass lead context to ElevenLabs session initialization

9. **Conversation logic**
   - Lead found: Use appropriate confirmation strategy
   - No lead found: Use standard qualification flow
   - Update lead status throughout call lifecycle

### **Phase 5: Tracking & Analytics**
10. **Call outcome tracking**
    - Update lead status on call completion
    - Log conversation outcomes and booking results
    - Track data completion improvements and conversion rates

11. **Performance monitoring**
    - Database query performance optimization
    - Lead matching accuracy metrics
    - Response time and throughput monitoring

---

## 🔄 Integration Points

### **1. Database Integration (PostgreSQL):**
```typescript
// PostgreSQL webhook for lead data from CRM/Marketing platforms
app.post('/api/webhook/lead-data', authenticateWebhook, async (req, res) => {
  try {
    const { phoneNumber, leadData } = req.body;
    
    // Validate and sanitize lead data
    const validatedLead = await validateLeadData(leadData);
    
    // Create record in PostgreSQL database
    const lead = await db.leads.create({
      phone_number: phoneNumber,
      external_lead_id: validatedLead.leadId,
      name: validatedLead.name,
      move_in_date: validatedLead.moveInDate,
      budget: validatedLead.budget,
      yearly_wage: validatedLead.yearlyWage,        // e.g., "30k-40k"
      occupation: validatedLead.occupation,         // "employed" or "student"
      contract_length: validatedLead.contractLength,
      email: validatedLead.email,
      preferred_time: validatedLead.preferredTime,
      property_type: validatedLead.propertyType,
              area: validatedLead.area,
        availability: validatedLead.availability,    // Array of time slots
        completeness_level: analyzeCompleteness(validatedLead),
      source: req.headers['x-source'] || 'webhook',
      status: 'pending',
      created_at: new Date()
    });
    
    res.json({ 
      success: true, 
      leadId: lead.id,
      completeness: lead.completeness_level,
      status: 'stored'
    });
    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Lead retrieval during call by phone number
const getLeadForCall = async (phoneNumber: string, callSid: string) => {
  const lead = await db.leads.findOne({
    where: { 
      phone_number: phoneNumber,
      status: ['pending', 'in_progress']
    },
    order: [['created_at', 'DESC']]  // Get most recent lead
  });
  
  if (lead) {
    // Update status to in_progress and log call SID
    await lead.update({
      status: 'in_progress',
      call_sid: callSid,
      call_started_at: new Date()
    });
    
    return lead;
  }
  
  return null;
};
```

### **2. Calendar Integration:**
```typescript
// Enhanced booking with lead context
const bookViewing = async (leadData: LeadData, preferredTime: string) => {
  const booking = await calendar.createBooking({
    name: leadData.name,
    phone: leadData.phoneNumber,
    email: leadData.email,
    budget: leadData.budget,
    moveInDate: leadData.moveInDate,
    preferredTime: preferredTime
  });
  
  await crm.updateLead(leadData.leadId, { status: 'viewing_booked', bookingId: booking.id });
};
```

### **3. Follow-up Automation:**
```typescript
// Automatic follow-up based on conversation outcome
const scheduleFollowUp = (leadData: LeadData, outcome: 'booked' | 'incomplete' | 'not_interested') => {
  switch(outcome) {
    case 'booked':
      emailService.sendViewingConfirmation(leadData);
      smsService.sendViewingReminder(leadData, '1_day_before');
      break;
    case 'incomplete':
      emailService.sendFollowUpForm(leadData);
      scheduleCallback(leadData, '24_hours');
      break;
  }
};
```

---

## 🚀 Implementation Phases

### **Phase 1: Core Lead Integration (Week 1)**
- [ ] Lead data API endpoint
- [ ] Data completeness analysis
- [ ] Basic confirmation strategies
- [ ] Enhanced agent prompts

### **Phase 2: Smart Conversation Flow (Week 2)**
- [ ] Question optimization engine
- [ ] Batch confirmation system
- [ ] Dynamic greeting generation
- [ ] Missing field collection

### **Phase 3: Advanced Features (Week 3)**
- [ ] CRM webhook integration
- [ ] Real-time lead updates
- [ ] Follow-up automation
- [ ] Analytics and optimization

### **Phase 4: Production Optimization (Week 4)**
- [ ] Performance testing
- [ ] Conversation flow optimization
- [ ] Error handling and fallbacks
- [ ] Monitoring and alerts

---

## 🎯 Success Metrics

### **Efficiency Gains:**
- 🕐 **Average call time:** Reduce from 180s to 60s
- 📈 **Conversion rate:** Increase from 65% to 85%
- 🔄 **Data accuracy:** Increase from 80% to 95%
- ⚡ **Agent responsiveness:** Maintain <500ms TTFT

### **Business Impact:**
- 💰 **Cost per lead:** Reduce by 40%
- 📞 **Calls per hour:** Increase by 60%
- 😊 **Customer satisfaction:** Improve perceived professionalism
- 🎯 **Lead qualification:** 100% complete data vs 70% current

---

## 🔧 Technical Requirements

### **New Dependencies:**
```json
{
  "pg": "^8.11.0",                    // PostgreSQL client
  "sequelize": "^6.35.0",             // ORM for database operations
  "sequelize-cli": "^6.6.0",          // Database migrations
  "@types/pg": "^8.10.0",             // TypeScript types
  "joi": "^17.7.0",                   // Data validation
  "moment": "^2.29.0",                // Date formatting
  "libphonenumber-js": "^1.10.0"      // Phone validation
}
```

### **Environment Variables:**
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/elevenlabs_leads
WEBHOOK_SECRET=your_webhook_secret_key
NODE_ENV=development
```

### **PostgreSQL Database Schema:**
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  external_lead_id VARCHAR(100),
  name VARCHAR(255),
  move_in_date DATE,
  budget DECIMAL(10,2),
  yearly_wage VARCHAR(20),          -- Range format: "20k-30k", "30k-40k", etc.
  occupation VARCHAR(20),           -- "employed" or "student"
  contract_length INTEGER,
  email VARCHAR(255),
  preferred_time VARCHAR(100),
  property_type VARCHAR(100),
  area VARCHAR(255),
  availability TEXT[],              -- Array of availability slots
  completeness_level VARCHAR(20) NOT NULL,
  source VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  call_sid VARCHAR(100),
  call_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  call_outcome VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_leads_phone_number ON leads(phone_number);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_external_id ON leads(external_lead_id);
```

---

## 🎨 Example Conversation Flows

### **🟢 Complete Lead Example:**
```
Agent: "Hi John! I'm calling about the property viewing you requested. I have your details here - just need to confirm everything looks correct and book your viewing."

User: "Great, yes."

Agent: "Perfect! I have: John Smith, looking to move in March 15th, budget £1,200 monthly, income in the £30-40k range, employed, 12-month contract. All correct?"

User: "Yes, that's right."

Agent: "Excellent! What day this week works best for your viewing?"

User: "Thursday afternoon?"

Agent: "Perfect! I'll book you for Thursday at 2 PM. You'll receive a confirmation text shortly."
```

### **🟡 Partial Lead Example:**
```
Agent: "Hi John! Thanks for your interest in our properties. I have some details from your enquiry - your name and £1,200 budget. I just need a few more details to book your viewing."

User: "Sure, what do you need?"

Agent: "What's your annual income range - are you in the 20-30k, 30-40k, or 40-50k bracket? And when are you looking to move in?"

User: "I'm in the 30-40k range and looking to move in March."

Agent: "Great! And what type of contract length are you looking for?"

User: "12 months would be good."

Agent: "Perfect! All set. What day works for your viewing?"
```

This implementation will transform your voice agent from a generic conversation bot to an intelligent, data-driven lead confirmation and booking system! 
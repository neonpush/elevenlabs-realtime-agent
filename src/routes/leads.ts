import { Router, Request, Response } from 'express';
import { authenticateWebhook } from '../middleware/auth';
import { LeadService } from '../services/lead.service';
import { CallService } from '../services/call.service';

const router = Router();

// POST /api/webhook/lead-data - Receive lead data from external systems
router.post('/webhook/lead-data', authenticateWebhook, async (req: Request, res: Response) => {
  try {
    console.log('📥 Received lead data webhook:', JSON.stringify(req.body, null, 2));
    
    // Validate and process lead data
    const validatedLead = await LeadService.validateLeadData(req.body);
    
    // Create lead record in database
    const lead = await LeadService.createLead(validatedLead);
    
    console.log(`✅ Lead created successfully:`, {
      id: lead.id,
      phoneNumber: lead.phone_number,
      completeness: lead.completeness_level,
      missingFields: LeadService.identifyMissingFields(validatedLead.data)
    });
    
    // Respond immediately to the webhook
    res.json({
      success: true,
      leadId: lead.id,
      completeness: lead.completeness_level,
      status: 'stored',
      phoneNumber: lead.phone_number,
      willCall: CallService.isConfigured()
    });
    
    // Make the call asynchronously (don't wait for webhook response)
    if (CallService.isConfigured()) {
      console.log('🚀 Initiating automatic outbound call...');
      
      // Add a small delay to ensure webhook response is sent first
      CallService.callLeadWithDelay(lead, 3).then((callResult) => {
        if (callResult.success) {
          console.log(`📞 Call successfully initiated to ${lead.name || 'lead'}: ${callResult.callSid}`);
        } else {
          console.error(`❌ Failed to call ${lead.name || 'lead'}: ${callResult.error}`);
        }
      }).catch((error) => {
        console.error('❌ Unexpected error in call process:', error);
      });
    } else {
      const config = CallService.getConfigStatus();
      console.log('⚠️  Automatic calling disabled - missing configuration:', config);
    }
    
  } catch (error: any) {
    console.error('❌ Error processing lead data:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to process lead data'
    });
  }
});

// GET /api/leads/:phoneNumber - Get lead by phone number (for testing)
router.get('/leads/:phoneNumber', authenticateWebhook, async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const lead = await LeadService.getLeadByPhoneNumber(phoneNumber);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const strategy = LeadService.generateConversationStrategy(lead);
    
    res.json({
      lead: {
        id: lead.id,
        phone_number: lead.phone_number,
        name: lead.name,
        move_in_date: lead.move_in_date,
        budget: lead.budget,
        yearly_wage: lead.yearly_wage,
        occupation: lead.occupation,
        contract_length: lead.contract_length,
        email: lead.email,
        completeness_level: lead.completeness_level,
        status: lead.status,
        created_at: lead.created_at
      },
      strategy
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching lead:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch lead'
    });
  }
});

// POST /api/leads/:leadId/call - Manually trigger a call to a specific lead
router.post('/leads/:leadId/call', authenticateWebhook, async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const lead = await LeadService.getLeadById(parseInt(leadId));
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    if (!CallService.isConfigured()) {
      const config = CallService.getConfigStatus();
      return res.status(400).json({ 
        error: 'Twilio not configured for outbound calls',
        config
      });
    }
    
    const callResult = await CallService.callLead(lead);
    
    if (callResult.success) {
      res.json({
        success: true,
        message: `Call initiated to ${lead.name || 'lead'}`,
        callSid: callResult.callSid,
        leadId: lead.id,
        phoneNumber: lead.phone_number
      });
    } else {
      res.status(400).json({
        success: false,
        error: callResult.error,
        leadId: lead.id
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error initiating manual call:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to initiate call'
    });
  }
});

// GET /api/call-config - Check Twilio configuration status
router.get('/call-config', authenticateWebhook, async (req: Request, res: Response) => {
  const config = CallService.getConfigStatus();
  res.json({
    configured: config.isFullyConfigured,
    details: config,
    message: config.isFullyConfigured 
      ? 'Twilio is properly configured for outbound calls'
      : 'Missing Twilio configuration. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and WEBHOOK_BASE_URL'
  });
});

export default router; 
import twilio from 'twilio';
import { Lead } from '../database/models/Lead';
import { LeadService } from './lead.service';

interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

export class CallService {
  private static twilioClient: twilio.Twilio | null = null;

  private static getTwilioClient(): twilio.Twilio {
    if (!this.twilioClient) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
      }
      
      this.twilioClient = twilio(accountSid, authToken);
    }
    
    return this.twilioClient;
  }

  /**
   * Make an outbound call to a lead
   */
  static async callLead(lead: Lead): Promise<CallResult> {
    try {
      const twilioClient = this.getTwilioClient();
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!fromNumber) {
        throw new Error('TWILIO_PHONE_NUMBER not configured');
      }

      console.log(`📞 Making outbound call to ${lead.name || 'lead'} at ${lead.phone_number}`);
      
      // Construct the webhook URL for the call
      const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL;
      if (!baseUrl) {
        throw new Error('WEBHOOK_BASE_URL or NGROK_URL must be configured for outbound calls');
      }
      
      const webhookUrl = `${baseUrl}/voice`;
      
      // Make the call
      const call = await twilioClient.calls.create({
        to: lead.phone_number,
        from: fromNumber,
        url: webhookUrl,
        method: 'POST'
      });

      console.log(`✅ Call initiated successfully. Call SID: ${call.sid}`);
      
      // Update lead status to reflect that a call was initiated
      await LeadService.updateLeadStatus(lead.id, 'in_progress', 'outbound_call_initiated');
      
      return {
        success: true,
        callSid: call.sid
      };

    } catch (error: any) {
      console.error('❌ Error making outbound call:', error);
      
      // Update lead status to reflect the error
      await LeadService.updateLeadStatus(lead.id, 'failed', `call_failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Call lead with delay (useful for testing or rate limiting)
   */
  static async callLeadWithDelay(lead: Lead, delaySeconds: number = 5): Promise<CallResult> {
    console.log(`⏰ Scheduling call to ${lead.name || 'lead'} in ${delaySeconds} seconds...`);
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await this.callLead(lead);
        resolve(result);
      }, delaySeconds * 1000);
    });
  }

  /**
   * Check if Twilio is properly configured
   */
  static isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER &&
      (process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL)
    );
  }

  /**
   * Get configuration status for debugging
   */
  static getConfigStatus() {
    return {
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      hasWebhookUrl: !!(process.env.WEBHOOK_BASE_URL || process.env.NGROK_URL),
      isFullyConfigured: this.isConfigured()
    };
  }
} 
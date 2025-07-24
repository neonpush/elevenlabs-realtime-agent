import { Lead } from '../database/models/Lead';
import { Op } from 'sequelize';
import * as Joi from 'joi';

// Lead data input interface
export interface LeadDataInput {
  leadId?: string;
  timestamp?: string;
  source?: string;
  data: {
    name?: string;
    moveInDate?: string;
    budget?: number;
    yearlyWage?: string;
    occupation?: string;
    contractLength?: number;
    phoneNumber: string;
    email?: string;
    preferredTime?: string;
    propertyType?: string;
    area?: string;
    availability?: string[];
    // Property-specific fields
    addressLine1?: string;      // The street address
    postcode?: string;          // UK postal code
    bedroomCount?: number;      // Number of bedrooms
    availabilityAt?: string;    // When available (as ISO date string)
    propertyCost?: number;      // Monthly rent in pounds
    [key: string]: any; // Add index signature
  };
}

// Lead validation schema
const leadDataSchema = Joi.object({
  leadId: Joi.string().optional(),
  timestamp: Joi.string().isoDate().optional(),
  source: Joi.string().optional(),
  data: Joi.object({
    name: Joi.string().optional(),
    moveInDate: Joi.string().isoDate().optional(),
    budget: Joi.number().positive().optional(),
    yearlyWage: Joi.string().pattern(/^\d+k-\d+k$/).optional(),
    occupation: Joi.string().valid('employed', 'student').optional(),
    contractLength: Joi.number().integer().positive().optional(),
    phoneNumber: Joi.string().required(),
    email: Joi.string().email().optional(),
    preferredTime: Joi.string().optional(),
    propertyType: Joi.string().optional(),
    area: Joi.string().optional(),
    availability: Joi.array().items(Joi.string()).optional(),
    // Property validation rules
    addressLine1: Joi.string().max(255).optional(),           // Max 255 characters
    postcode: Joi.string().pattern(/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i).optional(), // UK postcode format
    bedroomCount: Joi.number().integer().min(0).max(10).optional(), // 0-10 bedrooms
    availabilityAt: Joi.string().isoDate().optional(),        // Must be valid date
    propertyCost: Joi.number().positive().optional()          // Must be positive number
  }).required()
});

export class LeadService {
  /**
   * Analyzes lead data completeness
   */
  static analyzeCompleteness(data: LeadDataInput['data']): 'COMPLETE' | 'PARTIAL' | 'MINIMAL' {
    const requiredFields = ['name', 'moveInDate', 'budget', 'yearlyWage', 'occupation', 'contractLength', 'phoneNumber'];
    const presentFields = requiredFields.filter(field => data[field as keyof typeof data] && data[field as keyof typeof data] !== '');
    
    if (presentFields.length === 7) return 'COMPLETE';
    if (presentFields.length >= 4) return 'PARTIAL';
    return 'MINIMAL';
  }

  /**
   * Identifies missing required fields
   */
  static identifyMissingFields(data: LeadDataInput['data']): string[] {
    const requiredFields = ['name', 'moveInDate', 'budget', 'yearlyWage', 'occupation', 'contractLength', 'phoneNumber'];
    return requiredFields.filter(field => !data[field as keyof typeof data] || data[field as keyof typeof data] === '');
  }

  /**
   * Validates lead data input
   */
  static async validateLeadData(leadData: any): Promise<LeadDataInput> {
    const { error, value } = leadDataSchema.validate(leadData);
    if (error) {
      throw new Error(`Invalid lead data: ${error.message}`);
    }
    return value;
  }

  /**
   * Creates a new lead record
   */
  static async createLead(leadData: LeadDataInput): Promise<Lead> {
    const completenessLevel = this.analyzeCompleteness(leadData.data);
    
    // Debug: Log incoming property data
    console.log('📦 Incoming property data:', {
      addressLine1: leadData.data.addressLine1,
      postcode: leadData.data.postcode,
      bedroomCount: leadData.data.bedroomCount,
      availabilityAt: leadData.data.availabilityAt,
      propertyCost: leadData.data.propertyCost
    });
    
    const lead = await Lead.create({
      phone_number: leadData.data.phoneNumber,
      external_lead_id: leadData.leadId,
      name: leadData.data.name,
      move_in_date: leadData.data.moveInDate ? new Date(leadData.data.moveInDate) : undefined,
      budget: leadData.data.budget,
      yearly_wage: leadData.data.yearlyWage,
      occupation: leadData.data.occupation,
      contract_length: leadData.data.contractLength,
      email: leadData.data.email,
      preferred_time: leadData.data.preferredTime,
      property_type: leadData.data.propertyType,
      area: leadData.data.area,
      availability: leadData.data.availability,
      // New property fields - these store details about the specific apartment
      address_line_1: leadData.data.addressLine1,
      postcode: leadData.data.postcode,
      bedroom_count: leadData.data.bedroomCount,
      availability_at: leadData.data.availabilityAt ? new Date(leadData.data.availabilityAt) : undefined,
      property_cost: leadData.data.propertyCost,
      completeness_level: completenessLevel,
      source: leadData.source || 'webhook',
      status: 'pending'
    });

    return lead;
  }

  /**
   * Gets lead by phone number
   */
  static async getLeadByPhoneNumber(phoneNumber: string, callSid?: string): Promise<Lead | null> {
    const lead = await Lead.findOne({
      where: { 
        phone_number: phoneNumber,
        status: {
          [Op.in]: ['pending', 'in_progress']
        }
      },
      order: [['created_at', 'DESC']]
    });
    
    if (lead && callSid) {
      // Update status to in_progress and log call SID
      await lead.update({
        status: 'in_progress',
        call_sid: callSid,
        call_started_at: new Date()
      });
    }
    
    return lead;
  }

  /**
   * Gets lead by ID
   */
  static async getLeadById(leadId: number): Promise<Lead | null> {
    const lead = await Lead.findByPk(leadId);
    return lead;
  }

  /**
   * Updates lead status
   */
  static async updateLeadStatus(leadId: number, status: Lead['status'], outcome?: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'completed') {
      updateData.completed_at = new Date();
    }
    
    if (outcome) {
      updateData.call_outcome = outcome;
    }
    
    await Lead.update(updateData, {
      where: { id: leadId }
    });
  }

  /**
   * Generates conversation strategy based on lead data
   */
  static generateConversationStrategy(lead: Lead) {
    const missingFields = this.identifyMissingFields({
      name: lead.name,
      moveInDate: lead.move_in_date?.toISOString(),
      budget: lead.budget,
      yearlyWage: lead.yearly_wage,
      occupation: lead.occupation,
      contractLength: lead.contract_length,
      phoneNumber: lead.phone_number
    });

    return {
      completenessLevel: lead.completeness_level,
      missingFields,
      hasName: !!lead.name,
      hasBudget: !!lead.budget,
      hasMoveInDate: !!lead.move_in_date,
      hasYearlyWage: !!lead.yearly_wage,
      hasOccupation: !!lead.occupation,
      hasContractLength: !!lead.contract_length,
      // Format existing data for confirmation
      existingData: {
        name: lead.name,
        moveInDate: lead.move_in_date ? lead.move_in_date.toLocaleDateString() : null,
        budget: lead.budget ? `£${lead.budget}` : null,
        yearlyWage: lead.yearly_wage ? `£${lead.yearly_wage}` : null,
        occupation: lead.occupation,
        contractLength: lead.contract_length ? `${lead.contract_length} months` : null
      }
    };
  }
} 
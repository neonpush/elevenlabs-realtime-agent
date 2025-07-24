import WebSocket from 'ws';
import { TwilioMediaMessage } from './types/twilio';
import { LeadService } from './services/lead.service';
import { Lead } from './database/models/Lead';

interface ElevenLabsMessage {
  type: string;
  [key: string]: any;
}

interface ConversationMetrics {
  callStartTime: number;
  firstTokenTime?: number;
  audioStartTime?: number;
  totalResponses: number;
  totalAudioBytes: number;
  lastResponseTime?: number;
  totalTokens: number;
}

export class ElevenLabsSession {
  private elevenLabsWs: WebSocket | null = null;
  private twilioWs: WebSocket;
  private callSid: string = '';
  private streamSid: string = '';
  private phoneNumber: string = '';
  private lead: Lead | null = null;
  private conversationStrategy: any = null;
  private isConnected: boolean = false;
  private hasStartedConversation: boolean = false;
  private lastConnectionWarning?: number;
  private metrics: ConversationMetrics = {
    callStartTime: 0,
    totalResponses: 0,
    totalAudioBytes: 0,
    totalTokens: 0
  };
  private audioQueue: string[] = [];
  private isProcessingAudio: boolean = false;
  private outputFormat: string = 'pcm_8000'; // Track the actual output format
  private isUserSpeaking: boolean = false;
  private consecutiveSilentChunks: number = 0;
  private silenceThreshold: number = 15; // Number of silent chunks before user is considered not speaking
  private speechStartTime: number = 0;
  private consecutiveSpeechFrames: number = 0;
  private minSpeechFrames: number = 8; // Require 8 consecutive frames of speech before triggering

  constructor(twilioWs: WebSocket) {
    this.twilioWs = twilioWs;
    console.log('🤖 Creating new ElevenLabsSession - waiting for Twilio start event');
  }

  private async initializeElevenLabsConnection(): Promise<void> {
    try {
      const connectionStartTime = Date.now();
      const agentId = process.env.ELEVENLABS_AGENT_ID;
      const apiKey = process.env.ELEVENLABS_API_KEY;

      if (!agentId || !apiKey) {
        throw new Error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY');
      }

      console.log('🔌 Connecting to ElevenLabs Conversational AI...');
      console.log(`🔗 Agent ID: ${agentId}`);
      console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
      
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}&output_format=ulaw_8000`;
      console.log(`🌐 WebSocket URL: ${wsUrl}`);
      
      // Connect to ElevenLabs WebSocket with μ-law 8kHz output (perfect for Twilio!)
      // Note: ElevenLabs uses 'xi-api-key' header, not 'Authorization: Bearer'
      this.elevenLabsWs = new WebSocket(
        wsUrl,
        {
          headers: {
            'xi-api-key': apiKey
          }
        }
      );
      
      console.log('⏳ WebSocket instance created, waiting for connection...');
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('❌ ElevenLabs connection timeout after 10 seconds');
          console.error('❌ Please check:');
          console.error('   1. Your ElevenLabs API key is valid');
          console.error('   2. Your Agent ID is correct');
          console.error('   3. Your network allows WebSocket connections');
          this.elevenLabsWs?.close();
          throw new Error('ElevenLabs connection timeout');
        }
      }, 10000);

      this.setupElevenLabsHandlers();

      this.elevenLabsWs.on('open', () => {
        clearTimeout(connectionTimeout);
        const connectionTime = Date.now() - connectionStartTime;
        console.log(`✅ Connected to ElevenLabs ConvAI in ${connectionTime}ms`);
        this.isConnected = true;
        
        // Prepare initialization data with lead context
        const initData: any = {
          type: 'conversation_initiation_client_data'
        };
        
        // Add lead context if available
        if (this.lead) {
          const conversationContext = this.buildLeadContext();
          
          // Log the full context for debugging
          console.log('📋 Full lead context being sent:');
          console.log(conversationContext);
          
          // Use dynamic_variables to pass lead data (as per ElevenLabs docs)
          // NOTE: Your agent's prompt must reference these variables using {{variable_name}} syntax
          // Example: "You are talking to {{lead_name}} who has a budget of {{lead_budget}}"
          
          // Get missing fields from conversation strategy
          const missingFields = this.conversationStrategy?.missingFields || [];
          const existingData = this.conversationStrategy?.existingData || {};
          
          // Format move-in date nicely
          let formattedMoveInDate = '';
          if (this.lead.move_in_date) {
            const date = new Date(this.lead.move_in_date);
            const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            formattedMoveInDate = date.toLocaleDateString('en-GB', options);
          }
          
          // Ensure all variables are strings, not undefined
          const sanitizeVariable = (value: any): string => {
            if (value === null || value === undefined) return '';
            return String(value);
          };
          
          // Create custom variables that your agent is now expecting
          const custom_greeting = this.lead.name 
            ? `Hi ${this.lead.name}!` 
            : 'Hello!';
          
          // Professional intro that asks permission to proceed
          const custom_intro = `I'm Charlie calling from Lobby about the property you enquired about. Do you have a moment so I can confirm your details and help you book a viewing?`;
          
          initData.dynamic_variables = {
            // Your agent is expecting these custom variables
            custom_greeting: custom_greeting,
            custom_intro: custom_intro,
            // Core lead information - ALWAYS provide these even if empty
            lead_id: sanitizeVariable(this.lead.id),
            lead_name: sanitizeVariable(this.lead.name),
            lead_phone: sanitizeVariable(this.lead.phone_number),
            lead_move_in_date: sanitizeVariable(formattedMoveInDate),
            lead_budget: this.lead.budget ? `£${Number(this.lead.budget).toFixed(0)}` : '',
            lead_yearly_wage: this.lead.yearly_wage ? `£${this.lead.yearly_wage}` : '',
            lead_occupation: sanitizeVariable(this.lead.occupation),
            lead_contract_length: this.lead.contract_length ? `${this.lead.contract_length} months` : '',
            
            // Additional context
            lead_completeness: sanitizeVariable(this.lead.completeness_level),
            lead_email: sanitizeVariable(this.lead.email),
            lead_property_type: sanitizeVariable(this.lead.property_type),
            lead_area: sanitizeVariable(this.lead.area),
            lead_preferred_time: sanitizeVariable(this.lead.preferred_time),
            
            // Missing fields info
            missing_fields: missingFields.join(', ') || 'none',
            has_missing_fields: missingFields.length > 0 ? 'yes' : 'no',
            
            // Property details - these help the agent talk about the specific apartment
            property_address: sanitizeVariable(this.lead.address_line_1),
            property_postcode: sanitizeVariable(this.lead.postcode),
            property_bedrooms: this.lead.bedroom_count ? `${this.lead.bedroom_count} bedroom${this.lead.bedroom_count > 1 ? 's' : ''}` : '',
            property_available_from: this.lead.availability_at ? new Date(this.lead.availability_at).toLocaleDateString('en-GB') : '',
            property_monthly_cost: this.lead.property_cost ? `£${Number(this.lead.property_cost).toFixed(0)}` : '',
            
            // Full context for fallback
            lead_context: conversationContext || '',
            
            // ElevenLabs conditional template support
            // Based on the error and your template structure, try different approaches
            
            // Approach 1: Boolean values
            if_lead_name: !!this.lead.name,
            'if': true,  // Always true to enable conditionals
            'else': true,  // Always true to enable else branches
            
            // Approach 2: The template might expect these to contain the actual content
            // if_lead_name: this.lead.name ? `Hi ${this.lead.name}!` : 'Hello!',
            
            // Approach 3: Simple string flags
            has_lead_name: this.lead.name ? 'true' : 'false',
            
            // Try to match exactly what the template engine might expect
            'true': 'true',
            'false': 'false'
          };
          
          console.log('📋 Initializing conversation with lead context:', {
            leadId: this.lead.id,
            completeness: this.lead.completeness_level,
            hasName: !!this.lead.name,
            missingFields: missingFields
          });
          
          console.log('📊 Dynamic variables being sent to ElevenLabs:');
          Object.entries(initData.dynamic_variables).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
          });
          
          console.log('\n⚠️  Note: If you get "Missing required dynamic variables" errors,');
          console.log('   your agent\'s first message might be using conditional logic like:');
          console.log('   {{if lead_name}}Hello {{lead_name}}!{{else}}Hello!{{/if}}');
          console.log('   Consider simplifying it to: "Hello! I\'m here to help you find your perfect property."');
          console.log('   Or update it in the ElevenLabs dashboard to avoid conditionals.\n');
        }
        
        // Log the full initialization data
        console.log('📤 Full initialization data:', JSON.stringify(initData, null, 2));
        
        // Send initialization data
        this.elevenLabsWs!.send(JSON.stringify(initData));
      });

    } catch (error) {
      console.error('❌ Failed to connect to ElevenLabs:', error);
      this.isConnected = false;
    }
  }

  private setupElevenLabsHandlers(): void {
    if (!this.elevenLabsWs) return;

    this.elevenLabsWs.on('message', (data: WebSocket.Data) => {
      try {
        const message: ElevenLabsMessage = JSON.parse(data.toString());
        this.handleElevenLabsMessage(message);
      } catch (error) {
        console.error('❌ Error parsing ElevenLabs message:', error);
      }
    });

    this.elevenLabsWs.on('error', (error: Error) => {
      console.error('❌ ElevenLabs WebSocket error:', error);
      console.error('❌ Error details:', error.message);
      this.isConnected = false;
    });

          this.elevenLabsWs.on('close', (code: number, reason: Buffer) => {
        this.isConnected = false;
        const reasonStr = reason.toString();
        console.log(`🔌 Disconnected from ElevenLabs ConvAI - Code: ${code}, Reason: ${reasonStr}`);
        
        // Special handling for missing dynamic variables error
        if (code === 1008 && reasonStr.includes('Missing required dynamic variables')) {
          console.error('\n❌ TEMPLATE ERROR: Your agent\'s first message uses conditional logic.');
          console.error('   The ElevenLabs template engine couldn\'t find the required control variables.');
          console.error('\n   SOLUTION: Edit your agent in the ElevenLabs dashboard:');
          console.error('   1. Go to your agent settings');
          console.error('   2. Find the "First Message" field');
          console.error('   3. Remove any conditional logic (if/else statements)');
          console.error('   4. Use a simple message like: "Hello! I\'m Charlie from Lobby..."');
          console.error('\n   The current template appears to be using:');
          console.error('   {{if lead_name}}...personalized greeting...{{else}}...generic greeting...{{/if}}');
          console.error('   This syntax requires special variables that are hard to provide correctly.\n');
        }
      });
  }

  private handleElevenLabsMessage(message: ElevenLabsMessage): void {
    const timestamp = Date.now();

    switch (message.type) {
      case 'conversation_initiation_metadata':
        console.log('✅ ElevenLabs conversation initialized');
        const outputFormat = message.conversation_initiation_metadata_event?.agent_output_audio_format;
        console.log(`📊 Agent output format: ${outputFormat}`);
        console.log(`🎤 User input format: ${message.conversation_initiation_metadata_event?.user_input_audio_format}`);
        
        // Store the actual output format
        if (outputFormat) {
          this.outputFormat = outputFormat;
        }
        break;

      case 'ping':
        // Handle ping events to keep connection alive
        const pingMs = message.ping_event?.ping_ms || 0;
        setTimeout(() => {
          if (this.elevenLabsWs) {
            this.elevenLabsWs.send(JSON.stringify({
              type: 'pong',
              event_id: message.ping_event?.event_id
            }));
          }
        }, pingMs);
        break;

      case 'audio':
        if (message.audio_event?.audio_base_64) {
          if (!this.metrics.firstTokenTime) {
            this.metrics.firstTokenTime = timestamp;
            const ttft = timestamp - this.metrics.callStartTime;
            console.log(`🚀 TTFT (Time To First Token): ${ttft}ms`);
          }

          // Track audio bytes and update last response time
          const audioBytes = Buffer.from(message.audio_event.audio_base_64, 'base64').length;
          this.metrics.totalAudioBytes += audioBytes;
          this.metrics.lastResponseTime = timestamp;
          
          // Queue audio for processing
          this.audioQueue.push(message.audio_event.audio_base_64);
          this.processAudioQueue();
        }
        break;

      case 'agent_response':
        console.log('🤖 Agent:', message.agent_response_event?.agent_response);
        this.metrics.totalResponses++;
        // Estimate tokens (rough approximation: ~4 characters per token)
        const responseText = message.agent_response_event?.agent_response || '';
        this.metrics.totalTokens += Math.ceil(responseText.length / 4);
        break;

      case 'user_transcript':
        console.log('👤 User:', message.user_transcription_event?.user_transcript);
        break;

      case 'interruption':
        console.log('🛑 Interruption detected - clearing audio');
        // Clear all audio immediately
        this.audioQueue = [];
        this.isProcessingAudio = false; // Stop processing immediately
        
        // Tell Twilio to clear its audio buffer
        this.clearTwilioAudio();
        break;

      case 'ping':
        // Respond to ping to keep connection alive
        if (message.ping_event) {
          setTimeout(() => {
            this.elevenLabsWs?.send(JSON.stringify({
              type: 'pong',
              event_id: message.ping_event.event_id
            }));
          }, message.ping_event.ping_ms || 0);
        }
        break;

      case 'vad_score':
        // Voice Activity Detection score
        if (message.vad_score_event?.vad_score > 0.8) {
          console.log('🎤 User is speaking');
        }
        break;
    }
  }

  private async processAudioQueue(): Promise<void> {
    if (this.isProcessingAudio || this.audioQueue.length === 0) return;
    
    this.isProcessingAudio = true;
    
    while (this.audioQueue.length > 0) {
      const audioBase64 = this.audioQueue.shift()!;
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      
      // Check if we need to convert based on the output format
      if (this.outputFormat.includes('ulaw')) {
        // If ElevenLabs sends μ-law, send directly to Twilio - no conversion needed!
        // Log quality occasionally
        if (Math.random() < 0.01) {
          console.log(`📊 Agent Audio Quality - Direct μ-law passthrough (${audioBuffer.length} bytes)`);
        }
        this.sendAudioToTwilio(audioBase64);
      } else if (this.outputFormat.includes('pcm')) {
        // Convert PCM to μ-law for Twilio
        // Log PCM quality before conversion
        if (Math.random() < 0.01) {
          const pcmSamples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
          this.logAudioQuality('Agent Audio (PCM)', pcmSamples);
        }
        const ulawBuffer = this.convertPCMToMulaw(audioBuffer);
        const ulawBase64 = ulawBuffer.toString('base64');
        this.sendAudioToTwilio(ulawBase64);
      } else {
        console.warn(`⚠️ Unknown output format: ${this.outputFormat}, assuming PCM`);
        const ulawBuffer = this.convertPCMToMulaw(audioBuffer);
        const ulawBase64 = ulawBuffer.toString('base64');
        this.sendAudioToTwilio(ulawBase64);
      }
      
      // Minimal pacing for μ-law (10ms for better responsiveness)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.isProcessingAudio = false;
  }



  private convertPCMToMulaw(pcmBuffer: Buffer): Buffer {
    // Convert PCM 16-bit 8kHz to mulaw 8-bit 8kHz
    const pcm16bit = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    const mulaw = new Uint8Array(pcm16bit.length);
    
    // Apply slight gain reduction to prevent clipping
    for (let i = 0; i < pcm16bit.length; i++) {
      // Reduce volume by 10% to prevent distortion
      const sample = Math.floor(pcm16bit[i] * 0.9);
      mulaw[i] = this.linearToMulaw(sample);
    }
    
    return Buffer.from(mulaw);
  }

  private linearToMulaw(sample: number): number {
    // Convert 16-bit linear PCM to 8-bit mulaw
    const BIAS = 0x84;
    const CLIP = 32635;
    
    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    
    sample += BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const mulaw = ~(sign | (exponent << 4) | mantissa);
    
    return mulaw & 0xFF;
  }

  private convertMulawToPCM(mulawBuffer: Buffer): Buffer {
    // Convert μ-law 8-bit 8kHz to PCM 16-bit 16kHz with better interpolation
    const mulawSamples = new Uint8Array(mulawBuffer);
    const pcm8k = new Int16Array(mulawSamples.length);
    
    // First decode μ-law to PCM 8kHz
    for (let i = 0; i < mulawSamples.length; i++) {
      pcm8k[i] = this.mulawToLinear(mulawSamples[i]);
    }
    
    // Apply adaptive gain to boost quiet audio
    // Calculate the current RMS to determine how much gain to apply
    let sum = 0;
    for (let i = 0; i < pcm8k.length; i++) {
      sum += pcm8k[i] * pcm8k[i];
    }
    const rms = Math.sqrt(sum / pcm8k.length);
    
    // Adaptive gain: more gain for quieter audio, less for louder audio
    let gainFactor = 1;
    if (rms < 50) {
      gainFactor = 4; // Very quiet audio (like silence) gets 4x gain
    } else if (rms < 200) {
      gainFactor = 3; // Quiet audio gets 3x gain  
    } else if (rms < 500) {
      gainFactor = 2; // Normal quiet speech gets 2x gain
    } else if (rms < 1000) {
      gainFactor = 1.5; // Louder speech gets 1.5x gain
    }
    // Else gainFactor stays at 1 for already loud audio
    
    // Apply the adaptive gain with soft clipping protection
    for (let i = 0; i < pcm8k.length; i++) {
      let amplified = pcm8k[i] * gainFactor;
      
      // Soft clipping: gradually compress as we approach the limits
      if (amplified > 28000) {
        // Compress the top range to prevent harsh clipping
        amplified = 28000 + (amplified - 28000) * 0.3;
      } else if (amplified < -28000) {
        // Compress the bottom range
        amplified = -28000 + (amplified + 28000) * 0.3;
      }
      
      // Hard limit to prevent overflow
      pcm8k[i] = Math.max(-32768, Math.min(32767, amplified));
    }
    
    // Better upsampling using linear interpolation
    const pcm16k = new Int16Array(pcm8k.length * 2);
    for (let i = 0; i < pcm8k.length - 1; i++) {
      // Current sample
      pcm16k[i * 2] = pcm8k[i];
      // Interpolated sample (average between current and next)
      pcm16k[i * 2 + 1] = Math.round((pcm8k[i] + pcm8k[i + 1]) / 2);
    }
    // Handle last sample
    pcm16k[(pcm8k.length - 1) * 2] = pcm8k[pcm8k.length - 1];
    pcm16k[(pcm8k.length - 1) * 2 + 1] = pcm8k[pcm8k.length - 1];
    
    // Log audio quality metrics every 100th chunk
    if (Math.random() < 0.01) {
      this.logAudioQuality('User Audio (μ-law → PCM + Gain)', pcm16k);
    }
    
    return Buffer.from(pcm16k.buffer);
  }

  private detectSpeech(pcmBuffer: Buffer): boolean {
    // More sophisticated VAD with multiple checks
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    
    // Calculate RMS (Root Mean Square) energy
    let sum = 0;
    let maxAmplitude = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
      maxAmplitude = Math.max(maxAmplitude, Math.abs(samples[i]));
    }
    const rms = Math.sqrt(sum / samples.length);
    
    // Multiple thresholds for better detection (increased to reduce false positives)
    const rmsThreshold = 1200; // RMS threshold (increased for less sensitivity)
    const peakThreshold = 3500; // Peak amplitude threshold (increased for less sensitivity)
    
    // Speech detected if either RMS or peak exceeds threshold
    return rms > rmsThreshold || maxAmplitude > peakThreshold;
  }

  private logAudioQuality(label: string, samples: Int16Array): void {
    // Calculate audio quality metrics
    let sum = 0;
    let maxAmplitude = 0;
    let minAmplitude = 32767;
    let zeroCrossings = 0;
    let previousSample = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      sum += Math.abs(sample);
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
      minAmplitude = Math.min(minAmplitude, Math.abs(sample));
      
      // Count zero crossings (indicates frequency content)
      if (i > 0 && ((previousSample >= 0 && sample < 0) || (previousSample < 0 && sample >= 0))) {
        zeroCrossings++;
      }
      previousSample = sample;
    }
    
    const avgAmplitude = sum / samples.length;
    const dynamicRange = maxAmplitude - minAmplitude;
    const zeroCrossingRate = zeroCrossings / samples.length;
    
    console.log(`📊 Audio Quality - ${label}:`);
    console.log(`   Avg Amplitude: ${avgAmplitude.toFixed(0)} (healthy: 1000-5000)`);
    console.log(`   Max Amplitude: ${maxAmplitude} (max: 32767)`);
    console.log(`   Dynamic Range: ${dynamicRange}`);
    console.log(`   Zero Crossing Rate: ${(zeroCrossingRate * 100).toFixed(2)}%`);
    console.log(`   Clipping Risk: ${maxAmplitude > 30000 ? '⚠️ HIGH' : '✅ LOW'}`);
  }

  private mulawToLinear(mulaw: number): number {
    // Convert 8-bit μ-law to 16-bit linear PCM
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;
    const exp_lut = [0,132,396,924,1980,4092,8316,16764];
    
    mulaw = ~mulaw;
    const sign = (mulaw & 0x80);
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;
    
    let sample = exp_lut[exponent] + (mantissa << (exponent + 3));
    sample = sample - MULAW_BIAS;
    
    return sign !== 0 ? -sample : sample;
  }

  private sendAudioToTwilio(audioBase64: string): void {
    const audioMessage = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audioBase64
      }
    };
    
    this.twilioWs.send(JSON.stringify(audioMessage));
  }

  private clearTwilioAudio(): void {
    // Send a clear event to Twilio to stop all audio immediately
    const clearMessage = {
      event: 'clear',
      streamSid: this.streamSid
    };
    
    console.log('🛑 Sending clear command to Twilio');
    this.twilioWs.send(JSON.stringify(clearMessage));
  }

  private buildLeadContext(): string {
    if (!this.lead || !this.conversationStrategy) return '';
    
    const { completenessLevel, missingFields, existingData } = this.conversationStrategy;
    
    let context = `LEAD CONTEXT:
Lead ID: ${this.lead.id}
Completeness: ${completenessLevel}
Phone Number: ${this.lead.phone_number}

`;
    
    // Add existing data
    if (existingData.name) context += `Name: ${existingData.name}\n`;
    if (existingData.moveInDate) context += `Move-in Date: ${existingData.moveInDate}\n`;
    if (existingData.budget) context += `Budget: ${existingData.budget} monthly\n`;
    if (existingData.yearlyWage) context += `Annual Income: ${existingData.yearlyWage}\n`;
    if (existingData.occupation) context += `Occupation: ${existingData.occupation}\n`;
    if (existingData.contractLength) context += `Contract Length: ${existingData.contractLength}\n`;
    
    // Add property details if available
    if (this.lead.address_line_1 || this.lead.postcode || this.lead.bedroom_count || this.lead.property_cost) {
      context += `\nPROPERTY DETAILS:\n`;
      if (this.lead.address_line_1) context += `Address: ${this.lead.address_line_1}\n`;
      if (this.lead.postcode) context += `Postcode: ${this.lead.postcode}\n`;
      if (this.lead.bedroom_count) context += `Bedrooms: ${this.lead.bedroom_count}\n`;
      if (this.lead.availability_at) {
        const availDate = new Date(this.lead.availability_at);
        context += `Available From: ${availDate.toLocaleDateString('en-GB')}\n`;
      }
      if (this.lead.property_cost) context += `Monthly Rent: £${this.lead.property_cost}\n`;
    }
    
    // Add missing fields
    if (missingFields.length > 0) {
      context += `\nMISSING REQUIRED FIELDS: ${missingFields.join(', ')}\n`;
    }
    
    // Add conversation instructions based on completeness
    context += `\nCONVERSATION STRATEGY:
    
IMPORTANT: After your initial greeting and request to confirm details, WAIT for the person to give permission before proceeding. If they say yes, proceed with confirming details. If they're busy, offer to call back later.

VIEWING HOURS: Viewings can ONLY be booked between 9:00 AM and 5:00 PM on weekdays (Monday-Friday). Do not offer or accept viewing times outside these hours.

`;
    if (completenessLevel === 'COMPLETE') {
      context += `- This lead has all required information
- Once they agree to proceed, quickly confirm their details: move-in date, budget, area
- Then immediately offer viewing times
- Be efficient and professional`;
    } else if (completenessLevel === 'PARTIAL') {
      context += `- This lead has some information
- Once they agree to proceed, confirm existing data first
- Then collect missing fields: ${missingFields.join(', ')}
- Ask for missing data strategically before booking`;
    } else {
      context += `- This lead has minimal information
- Once they agree to proceed, use standard qualification flow
- Collect all required fields systematically
- Essential: move-in date, budget, area, occupation`;
    }
    
    return context;
  }

  private async loadLeadData(): Promise<void> {
    if (!this.phoneNumber) return;
    
    try {
      console.log(`🔍 Looking up lead data for ${this.phoneNumber}`);
      this.lead = await LeadService.getLeadByPhoneNumber(this.phoneNumber, this.callSid);
      
      if (this.lead) {
        this.conversationStrategy = LeadService.generateConversationStrategy(this.lead);
        console.log('✅ Lead data loaded:', {
          leadId: this.lead.id,
          completeness: this.lead.completeness_level,
          missingFields: this.conversationStrategy.missingFields
        });
      } else {
        console.log('ℹ️ No lead data found for this phone number');
      }
    } catch (error) {
      console.error('❌ Error loading lead data:', error);
    }
  }

  handleMessage(data: Buffer): void {
    try {
      const message: TwilioMediaMessage = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'start':
          console.log('📞 Twilio stream started');
          if (message.start) {
            this.callSid = message.start.callSid;
            this.streamSid = message.start.streamSid;
            this.phoneNumber = message.start.customParameters?.from || '';
            
            console.log('📞 Call details:', {
              callSid: this.callSid,
              streamSid: this.streamSid,
              phoneNumber: this.phoneNumber,
              customParameters: message.start.customParameters
            });
            
            // Load lead data before connecting to ensure it's available immediately
            if (this.phoneNumber) {
              this.loadLeadData().then(() => {
                // Small delay to ensure lead data is fully processed
                setTimeout(() => {
                  this.initializeElevenLabsConnection();
                }, 100);
              }).catch(error => {
                console.error('❌ Error loading lead data:', error);
                // Continue without lead data
                this.initializeElevenLabsConnection();
              });
            } else {
              this.initializeElevenLabsConnection();
            }
            
            this.metrics.callStartTime = Date.now();
          }
          break;
          
        case 'connected':
          console.log('🔗 Twilio media stream connected');
          break;
          
        case 'media':
          if (message.media && this.elevenLabsWs && this.isConnected) {
            if (!this.metrics.audioStartTime) {
              this.metrics.audioStartTime = Date.now();
              const audioLatency = this.metrics.audioStartTime - this.metrics.callStartTime;
              console.log(`🎤 First audio received after ${audioLatency}ms`);
            }
            
            // Convert Twilio μ-law to PCM for ElevenLabs
            const mulawBuffer = Buffer.from(message.media.payload, 'base64');
            const pcmBuffer = this.convertMulawToPCM(mulawBuffer);
            
            // Simple VAD: Check if audio contains speech
            const isSpeech = this.detectSpeech(pcmBuffer);
            
            if (isSpeech) {
              this.consecutiveSilentChunks = 0;
              this.consecutiveSpeechFrames++;
              
              // Check if user just started speaking (after minimum consecutive frames)
              if (!this.isUserSpeaking && this.consecutiveSpeechFrames >= this.minSpeechFrames) {
                this.isUserSpeaking = true;
                this.speechStartTime = Date.now();
                
                // Send user_activity to interrupt the agent
                this.elevenLabsWs.send(JSON.stringify({
                  type: 'user_activity'
                }));
                console.log('🎤 User started speaking - interrupting agent');
                
                // Clear any queued audio on our side
                this.audioQueue = [];
                this.isProcessingAudio = false;
                
                // Tell Twilio to immediately stop playing audio
                this.clearTwilioAudio();
              }
            } else {
              this.consecutiveSilentChunks++;
              this.consecutiveSpeechFrames = 0; // Reset speech frames on silence
              
              // User stopped speaking after enough silent chunks
              if (this.isUserSpeaking && this.consecutiveSilentChunks >= this.silenceThreshold) {
                this.isUserSpeaking = false;
                const speechDuration = Date.now() - this.speechStartTime;
                console.log(`🔇 User stopped speaking (duration: ${speechDuration}ms)`);
              }
            }
            
            // Always send audio to ElevenLabs
            const pcmBase64 = pcmBuffer.toString('base64');
            this.elevenLabsWs.send(JSON.stringify({
              user_audio_chunk: pcmBase64
            }));
          } else if (!this.isConnected) {
            // Don't spam logs, just log once every second
            if (!this.lastConnectionWarning || Date.now() - this.lastConnectionWarning > 1000) {
              console.log('⏳ Waiting for ElevenLabs connection...');
              this.lastConnectionWarning = Date.now();
            }
          }
          break;
          
        case 'stop':
          console.log('🛑 Call ended');
          this.logFinalMetrics();
          this.cleanup();
          break;
      }
    } catch (error) {
      console.error('❌ Error handling Twilio message:', error);
    }
  }

  private logFinalMetrics(): void {
    const duration = Date.now() - this.metrics.callStartTime;
    const durationSeconds = duration / 1000;
    
    console.log('🏁 Final Call Metrics:');
    console.log(`   📞 Call Duration: ${duration}ms (${durationSeconds.toFixed(1)}s)`);
    console.log(`   🎤 Audio Setup Time: ${this.metrics.audioStartTime ? this.metrics.audioStartTime - this.metrics.callStartTime : 'N/A'}ms`);
    console.log(`   🚀 TTFT: ${this.metrics.firstTokenTime ? this.metrics.firstTokenTime - this.metrics.callStartTime : 'N/A'}ms`);
    console.log(`   💬 Total Responses: ${this.metrics.totalResponses}`);
    console.log(`   📊 Total Audio: ${(this.metrics.totalAudioBytes / 1024).toFixed(1)}KB`);
    
    // Calculate average TPS (Tokens Per Second)
    if (this.metrics.firstTokenTime && this.metrics.lastResponseTime && this.metrics.totalTokens > 0) {
      const responseWindow = (this.metrics.lastResponseTime - this.metrics.firstTokenTime) / 1000;
      const avgTPS = responseWindow > 0 ? (this.metrics.totalTokens / responseWindow).toFixed(1) : 'N/A';
      console.log(`   ⚡ Average TPS: ${avgTPS} tokens/second`);
    }
    
    // Calculate audio bitrate
    if (durationSeconds > 0) {
      const bitrate = ((this.metrics.totalAudioBytes * 8) / durationSeconds / 1000).toFixed(1);
      console.log(`   📡 Audio Bitrate: ${bitrate} kbps`);
    }
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ElevenLabsSession');
    if (this.elevenLabsWs) {
      this.elevenLabsWs.close();
      this.elevenLabsWs = null;
    }
    this.isConnected = false;
  }
} 
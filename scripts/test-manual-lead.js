const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhook/lead-data';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
const LEADS_FILE = path.join(__dirname, '..', 'test-leads.json');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function loadLeads() {
  try {
    const data = fs.readFileSync(LEADS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(colorize('❌ Error loading test-leads.json:', 'red'), error.message);
    process.exit(1);
  }
}

async function sendLead(leadData) {
  try {
    console.log(colorize('\n📤 Sending lead data to webhook...', 'cyan'));
    
    const response = await axios.post(WEBHOOK_URL, leadData, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(colorize('✅ Lead created successfully:', 'green'));
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.error(colorize('❌ Error sending lead:', 'red'));
    console.error(error.response?.data || error.message);
    return null;
  }
}

async function lookupLead(phoneNumber) {
  try {
    console.log(colorize(`\n🔍 Looking up lead data for ${phoneNumber}...`, 'cyan'));
    
    const lookupUrl = WEBHOOK_URL.replace('/webhook/lead-data', '') + '/leads/' + encodeURIComponent(phoneNumber);
    const response = await axios.get(lookupUrl, {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_SECRET}`
      }
    });
    
    console.log(colorize('📊 Lead strategy:', 'blue'));
    console.log(JSON.stringify(response.data.strategy, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.error(colorize('❌ Error looking up lead:', 'red'));
    console.error(error.response?.data || error.message);
    return null;
  }
}

function showLeadContext(lead, strategy) {
  if (!lead || !strategy) return;
  
  const { completenessLevel, missingFields, existingData } = strategy;
  
  let context = `\n${colorize('🤖 CONTEXT THAT GETS SENT TO ELEVENLABS:', 'magenta')}\n`;
  context += colorize('═'.repeat(50), 'magenta') + '\n';
  context += `LEAD CONTEXT:
Lead ID: ${lead.id}
Completeness: ${completenessLevel}
Phone Number: ${lead.phone_number}

`;
  
  // Add existing data
  if (existingData.name) context += `Name: ${existingData.name}\n`;
  if (existingData.moveInDate) context += `Move-in Date: ${existingData.moveInDate}\n`;
  if (existingData.budget) context += `Budget: ${existingData.budget} monthly\n`;
  if (existingData.yearlyWage) context += `Annual Income: ${existingData.yearlyWage}\n`;
  if (existingData.occupation) context += `Occupation: ${existingData.occupation}\n`;
  if (existingData.contractLength) context += `Contract Length: ${existingData.contractLength}\n`;
  
  // Add property details
  if (lead.address_line_1 || lead.postcode || lead.bedroom_count || lead.property_cost) {
    context += `\nPROPERTY DETAILS:\n`;
    if (lead.address_line_1) context += `Address: ${lead.address_line_1}\n`;
    if (lead.postcode) context += `Postcode: ${lead.postcode}\n`;
    if (lead.bedroom_count) context += `Bedrooms: ${lead.bedroom_count}\n`;
    if (lead.availability_at) context += `Available From: ${new Date(lead.availability_at).toLocaleDateString('en-GB')}\n`;
    if (lead.property_cost) context += `Monthly Rent: £${lead.property_cost}\n`;
  } else {
    context += `\n${colorize('⚠️ NO PROPERTY DETAILS FOUND IN DATABASE', 'yellow')}\n`;
  }
  
  // Add missing fields
  if (missingFields.length > 0) {
    context += `\nMISSING REQUIRED FIELDS: ${missingFields.join(', ')}\n`;
  }
  
  // Add conversation instructions
  context += `\nCONVERSATION STRATEGY:`;
  if (completenessLevel === 'COMPLETE') {
    context += `
- This lead has all required information
- Quickly confirm the details in a batch
- Focus on booking the viewing
- Be efficient and professional`;
  } else if (completenessLevel === 'PARTIAL') {
    context += `
- This lead has some information
- Confirm existing data first
- Then collect missing fields: ${missingFields.join(', ')}
- Ask for missing data strategically`;
  } else {
    context += `
- This lead has minimal information
- Use standard qualification flow
- Collect all required fields systematically`;
  }
  
  console.log(context);
  context += colorize('\n═'.repeat(50), 'magenta');
  console.log(context);
}

function displayMenu(leads) {
  console.log(colorize('\n🚀 Lead Integration Test Script', 'bright'));
  console.log(colorize('=' .repeat(40), 'cyan'));
  console.log(colorize(`📍 Webhook URL: ${WEBHOOK_URL}`, 'blue'));
  console.log(colorize(`🔑 Webhook Secret: ${WEBHOOK_SECRET === 'default-webhook-secret' ? 'DEFAULT (insecure!)' : 'CUSTOM'}`, 'blue'));
  
  console.log(colorize('\n📋 Available Test Leads:', 'yellow'));
  leads.leads.forEach((lead, index) => {
    const completeness = getCompletenessLevel(lead.data.data);
    const emoji = completeness === 'COMPLETE' ? '🟢' : completeness === 'PARTIAL' ? '🟡' : '🔴';
    console.log(`${emoji} ${index + 1}. ${colorize(lead.name, 'bright')} - ${lead.description}`);
    console.log(`   Phone: ${lead.data.data.phoneNumber} | Completeness: ${completeness}`);
  });
  
  console.log(colorize('\n0. Exit', 'red'));
  console.log(colorize('\nEnter your choice (1-' + leads.leads.length + '): ', 'yellow'));
}

function getCompletenessLevel(data) {
  const requiredFields = ['name', 'moveInDate', 'budget', 'yearlyWage', 'occupation', 'contractLength', 'phoneNumber'];
  const presentFields = requiredFields.filter(field => data[field] && data[field] !== '');
  
  if (presentFields.length === 7) return 'COMPLETE';
  if (presentFields.length >= 4) return 'PARTIAL';
  return 'MINIMAL';
}

async function processChoice(choice, leads) {
  if (choice === '0') {
    console.log(colorize('\n👋 Goodbye!', 'green'));
    process.exit(0);
  }
  
  const index = parseInt(choice) - 1;
  if (index < 0 || index >= leads.leads.length) {
    console.log(colorize('❌ Invalid choice. Please try again.', 'red'));
    return;
  }
  
  const selectedLead = leads.leads[index];
  console.log(colorize(`\n🎯 Selected: ${selectedLead.name}`, 'bright'));
  console.log(colorize(`📝 Description: ${selectedLead.description}`, 'blue'));
  
  // Send the lead data
  const result = await sendLead(selectedLead.data);
  if (!result) return;
  
  // Look up the lead
  const lookupResult = await lookupLead(selectedLead.data.data.phoneNumber);
  if (!lookupResult) return;
  
  // Show the context that would be sent to ElevenLabs
  showLeadContext(lookupResult.lead, lookupResult.strategy);
  
  console.log(colorize('\n✅ Test completed! Press Enter to continue...', 'green'));
}

async function main() {
  const leads = await loadLeads();
  
  // Check call configuration
  try {
    const configResponse = await axios.get(WEBHOOK_URL.replace('/webhook/lead-data', '') + '/call-config', {
      headers: { 'Authorization': `Bearer ${WEBHOOK_SECRET}` }
    });
    
    console.log(colorize('\n📞 Call Configuration Status:', 'cyan'));
    if (configResponse.data.configured) {
      console.log(colorize('✅ Automatic calling is ENABLED', 'green'));
      console.log(colorize('   → Leads will be called automatically after storage', 'blue'));
    } else {
      console.log(colorize('⚠️  Automatic calling is DISABLED', 'yellow'));
      console.log(colorize('   → Configure Twilio credentials to enable automatic calling', 'blue'));
    }
  } catch (error) {
    console.log(colorize('\n⚠️  Could not check call configuration', 'yellow'));
  }
  
  // Import readline for interactive input
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };
  
  while (true) {
    displayMenu(leads);
    const choice = await askQuestion('');
    await processChoice(choice.trim(), leads);
    
    if (choice.trim() !== '0') {
      await askQuestion(''); // Wait for Enter
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n👋 Goodbye!', 'green'));
  process.exit(0);
});

main().catch(console.error); 
const twilio = require('twilio');
require('dotenv').config();

// Use environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const userPhoneNumber = process.env.USER_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber || !userPhoneNumber) {
  console.error('❌ Missing required environment variables');
  console.log('Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function makeTestCall() {
  try {
    console.log('📞 Initiating test call with ElevenLabs...');
    console.log(`From: ${twilioPhoneNumber}`);
    console.log(`To: ${userPhoneNumber}`);
    console.log('Webhook URL: https://full-moles-yell.loca.lt/voice');
    
    const call = await client.calls.create({
      url: 'https://full-moles-yell.loca.lt/voice',
      to: userPhoneNumber,
      from: twilioPhoneNumber,
      timeout: 30
    });

    console.log('✅ Call initiated successfully!');
    console.log(`📋 Call SID: ${call.sid}`);
    console.log(`📊 Status: ${call.status}`);
    console.log('🎯 Answer the call to test the ElevenLabs AI agent');
    
    // Monitor call status
    setTimeout(async () => {
      try {
        const updatedCall = await client.calls(call.sid).fetch();
        console.log(`📈 Call status update: ${updatedCall.status}`);
        console.log(`⏱️  Duration: ${updatedCall.duration || 0} seconds`);
      } catch (error) {
        console.log('Could not fetch call status update');
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Failed to initiate call:');
    console.error(error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
  }
}

makeTestCall(); 
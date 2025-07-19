const autocannon = require('autocannon');

async function runLoadTest() {
  console.log('🚀 Starting Load Test...');
  
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    duration: 30,
    requests: [
      {
        method: 'POST',
        path: '/voice',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'From=%2B1234567890&To=%2B18508096281&CallSid=TEST123&AccountSid=AC123'
      }
    ]
  });

  console.log('📊 Load Test Results:');
  console.log(`💥 Requests: ${result.requests.total}`);
  console.log(`⚡ RPS: ${result.requests.average}`);
  console.log(`🕐 Latency (avg): ${result.latency.average}ms`);
  console.log(`🕐 Latency (p99): ${result.latency.p99}ms`);
  console.log(`❌ Errors: ${result.errors}`);
  console.log(`⏱️  Duration: ${result.duration}s`);
  
  // Performance scoring
  const score = calculatePerformanceScore(result);
  console.log(`📈 Performance Score: ${score}/100`);
  
  return result;
}

function calculatePerformanceScore(result) {
  let score = 100;
  
  // Deduct points for high latency
  if (result.latency.average > 100) score -= 20;
  if (result.latency.average > 200) score -= 20;
  if (result.latency.p99 > 500) score -= 30;
  
  // Deduct points for low RPS
  if (result.requests.average < 100) score -= 20;
  if (result.requests.average < 50) score -= 30;
  
  // Deduct points for errors
  score -= (result.errors / result.requests.total) * 100;
  
  return Math.max(0, Math.round(score));
}

if (require.main === module) {
  runLoadTest().catch(console.error);
}

module.exports = { runLoadTest }; 
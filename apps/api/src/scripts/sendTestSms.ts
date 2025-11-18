import { sendTestSms } from '../services/notificationService.js';

const recipient = process.argv[2];
const message = process.argv[3] || 'Test message from Bookly - SMS integration is working! 🎉';

if (!recipient) {
  console.error('Usage: tsx src/scripts/sendTestSms.ts +1234567890 [optional message]');
  console.error('Example: tsx src/scripts/sendTestSms.ts +187777804236');
  process.exit(1);
}

sendTestSms(recipient, message)
  .then((result) => {
    console.log('✅ SMS sent successfully!');
    console.log('Message SID:', result.sid);
    console.log('Status:', result.status);
    console.log('To:', result.to);
    console.log('From:', result.from);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to send SMS:', error.message);
    if (error instanceof Error && 'code' in error) {
      console.error('Twilio Error Code:', (error as { code?: number }).code);
    }
    process.exit(1);
  });


import { sendEmail } from '../services/emailService.js';
import { bookingConfirmationHtml } from '../templates/email/bookingConfirmation.js';
import { bookingConfirmationText } from '../templates/email/bookingReceivedText.js';

const recipient = process.argv[2];

if (!recipient) {
  console.error('Usage: tsx src/scripts/sendTestEmail.ts recipient@example.com');
  process.exit(1);
}

const payload = {
  businessName: 'Bookly Demo Studio',
  serviceName: 'Sample Pilates Experience',
  date: 'Monday, Jan 20',
  time: '10:30 AM',
  location: 'Downtown Dubai, Studio 4',
};

sendEmail({
  to: recipient,
  subject: `Booking received · ${payload.businessName}`,
  text: bookingConfirmationText(payload),
  html: bookingConfirmationHtml(payload),
})
  .then(() => {
    console.log('Sample email sent to', recipient);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to send sample email', error);
    process.exit(1);
  });


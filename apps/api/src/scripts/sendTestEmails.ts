import { Resend } from 'resend';
import { config } from 'dotenv';
import { welcomeEmailHtml, welcomeEmailText } from '../templates/email/welcome.js';
import { emailVerificationHtml, emailVerificationText } from '../templates/email/emailVerification.js';
import { passwordResetHtml, passwordResetText } from '../templates/email/passwordReset.js';
import { bookingConfirmationHtml } from '../templates/email/bookingConfirmation.js';
import { bookingConfirmationText } from '../templates/email/bookingReceivedText.js';
import { portalMagicLinkHtml, portalMagicLinkText } from '../templates/email/portalMagicLink.js';
import { env } from '../config/env.js';

config();

const TEST_EMAIL = 'ahmadhasnain6145@gmail.com';
const APP_BASE_URL = env.APP_BASE_URL || 'http://localhost:5173';

async function sendTestEmails() {
  if (!env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set in environment variables');
    process.exit(1);
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.EMAIL_FROM || 'Bookly <no-reply@bookly.app>';

  console.log('📧 Sending test emails to:', TEST_EMAIL);
  console.log('📤 From:', from);
  console.log('');

  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  // 1. Welcome Email
  try {
    console.log('1️⃣ Sending Welcome Email...');
    const dashboardLink = `${APP_BASE_URL}/dashboard`;
    await resend.emails.send({
      from,
      to: TEST_EMAIL,
      subject: '[TEST] Welcome to Bookly, Ahmad! 🎉',
      html: welcomeEmailHtml('Ahmad', 'Test Studio', dashboardLink),
      text: welcomeEmailText('Ahmad', 'Test Studio', dashboardLink),
    });
    console.log('   ✅ Welcome email sent successfully');
    results.push({ name: 'Welcome Email', success: true });
  } catch (error: any) {
    console.error('   ❌ Failed to send welcome email:', error.message);
    results.push({ name: 'Welcome Email', success: false, error: error.message });
  }

  // 2. Email Verification
  try {
    console.log('2️⃣ Sending Email Verification...');
    const verificationLink = `${APP_BASE_URL}/verify-email?token=test_verification_token_12345`;
    await resend.emails.send({
      from,
      to: TEST_EMAIL,
      subject: '[TEST] Verify Your Email · Bookly',
      html: emailVerificationHtml(verificationLink),
      text: emailVerificationText(verificationLink),
    });
    console.log('   ✅ Email verification sent successfully');
    results.push({ name: 'Email Verification', success: true });
  } catch (error: any) {
    console.error('   ❌ Failed to send email verification:', error.message);
    results.push({ name: 'Email Verification', success: false, error: error.message });
  }

  // 3. Password Reset
  try {
    console.log('3️⃣ Sending Password Reset...');
    const resetLink = `${APP_BASE_URL}/reset-password?token=test_reset_token_12345`;
    await resend.emails.send({
      from,
      to: TEST_EMAIL,
      subject: '[TEST] Reset Your Password · Bookly',
      html: passwordResetHtml(resetLink),
      text: passwordResetText(resetLink),
    });
    console.log('   ✅ Password reset email sent successfully');
    results.push({ name: 'Password Reset', success: true });
  } catch (error: any) {
    console.error('   ❌ Failed to send password reset:', error.message);
    results.push({ name: 'Password Reset', success: false, error: error.message });
  }

  // 4. Booking Confirmation
  try {
    console.log('4️⃣ Sending Booking Confirmation...');
    await resend.emails.send({
      from,
      to: TEST_EMAIL,
      subject: '[TEST] Booking confirmed · Test Studio',
      html: bookingConfirmationHtml({
        businessName: 'Test Studio',
        serviceName: 'Pilates Reformer Session',
        date: 'Monday, January 15, 2024',
        time: '10:00 AM',
        location: '123 Fitness Street, Dubai, UAE',
      }),
      text: bookingConfirmationText({
        businessName: 'Test Studio',
        serviceName: 'Pilates Reformer Session',
        date: 'Monday, January 15, 2024',
        time: '10:00 AM',
        location: '123 Fitness Street, Dubai, UAE',
      }),
    });
    console.log('   ✅ Booking confirmation sent successfully');
    results.push({ name: 'Booking Confirmation', success: true });
  } catch (error: any) {
    console.error('   ❌ Failed to send booking confirmation:', error.message);
    results.push({ name: 'Booking Confirmation', success: false, error: error.message });
  }

  // 5. Portal Magic Link
  try {
    console.log('5️⃣ Sending Portal Magic Link...');
    const portalUrl = `${APP_BASE_URL}/portal/verify?token=test_portal_token_12345`;
    await resend.emails.send({
      from,
      to: TEST_EMAIL,
      subject: '[TEST] Test Studio · Secure client portal link',
      html: portalMagicLinkHtml({
        portalUrl,
        businessName: 'Test Studio',
      }),
      text: portalMagicLinkText({
        portalUrl,
        businessName: 'Test Studio',
      }),
    });
    console.log('   ✅ Portal magic link sent successfully');
    results.push({ name: 'Portal Magic Link', success: true });
  } catch (error: any) {
    console.error('   ❌ Failed to send portal magic link:', error.message);
    results.push({ name: 'Portal Magic Link', success: false, error: error.message });
  }

  // Summary
  console.log('');
  console.log('📊 Summary:');
  console.log('═══════════════════════════════════════');
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('');
  console.log(`Total: ${results.length} emails`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('');
    console.log('⚠️  Some emails failed to send. Please check:');
    console.log('   1. RESEND_API_KEY is set correctly');
    console.log('   2. Email domain is verified in Resend');
    console.log('   3. EMAIL_FROM is set correctly (or using default)');
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All test emails sent successfully!');
    console.log(`📬 Check your inbox at ${TEST_EMAIL}`);
  }
}

sendTestEmails().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


export const passwordResetHtml = (resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    <p style="font-size: 16px; margin-bottom: 20px;">We received a request to reset your password for your Bookly account.</p>
    <p style="font-size: 16px; margin-bottom: 30px;">Click the button below to reset your password. This link will expire in 1 hour.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
    </div>
    <p style="font-size: 14px; color: #666; margin-top: 30px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
    <p style="font-size: 14px; color: #666; margin-top: 10px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #999; word-break: break-all; margin-top: 10px;">${resetLink}</p>
  </div>
  <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Bookly. All rights reserved.</p>
  </div>
</body>
</html>
`;

export const passwordResetText = (resetLink: string) => `
Reset Your Password

We received a request to reset your password for your Bookly account.

Click the link below to reset your password. This link will expire in 1 hour.

${resetLink}

If you didn't request this, you can safely ignore this email. Your password will not be changed.
`;


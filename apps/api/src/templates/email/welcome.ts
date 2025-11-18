export const welcomeEmailHtml = (firstName: string | null, businessName: string, dashboardLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Bookly</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">Welcome to Bookly! 🎉</h1>
  </div>
  <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <p style="font-size: 18px; margin-bottom: 20px; font-weight: 600;">Hello ${firstName || 'there'},</p>
    <p style="font-size: 16px; margin-bottom: 20px;">Welcome to Bookly! We're thrilled to have you and <strong>${businessName}</strong> on board.</p>
    <p style="font-size: 16px; margin-bottom: 20px;">You're all set to start managing your bookings, scheduling appointments, and growing your business.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="font-size: 14px; color: #666; margin: 0 0 10px 0; font-weight: 600;">What's next?</p>
      <ul style="font-size: 14px; color: #666; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Complete your onboarding to set up services and staff</li>
        <li style="margin-bottom: 8px;">Create your first booking page</li>
        <li style="margin-bottom: 8px;">Start accepting appointments from your clients</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardLink}" style="display: inline-block; background: #6366f1; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <strong>Important:</strong> Please verify your email address to ensure you receive important notifications about your bookings and account.
    </p>
  </div>
  <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Bookly. All rights reserved.</p>
    <p style="margin-top: 10px;">
      <a href="${dashboardLink}" style="color: #6366f1; text-decoration: none;">Visit your dashboard</a> | 
      <a href="${dashboardLink}/settings" style="color: #6366f1; text-decoration: none;">Account settings</a>
    </p>
  </div>
</body>
</html>
`;

export const welcomeEmailText = (firstName: string | null, businessName: string, dashboardLink: string) => `
Welcome to Bookly!

Hello ${firstName || 'there'},

Welcome to Bookly! We're thrilled to have you and ${businessName} on board.

You're all set to start managing your bookings, scheduling appointments, and growing your business.

What's next?
- Complete your onboarding to set up services and staff
- Create your first booking page
- Start accepting appointments from your clients

Go to your dashboard: ${dashboardLink}

Important: Please verify your email address to ensure you receive important notifications about your bookings and account.

© ${new Date().getFullYear()} Bookly. All rights reserved.
`;


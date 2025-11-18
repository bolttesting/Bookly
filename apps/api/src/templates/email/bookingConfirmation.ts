export const bookingConfirmationHtml = ({
  businessName,
  serviceName,
  date,
  time,
  location,
}: {
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  location?: string | null;
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${businessName} · Booking Received</title>
    <style>
      body {
        background: #f5f6fb;
        margin: 0;
        padding: 32px 16px;
        font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
        color: #0f172a;
      }
      .container {
        max-width: 520px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 28px;
        padding: 32px;
        box-shadow: 0 35px 120px rgba(15, 23, 42, 0.12);
      }
      .badge {
        display: inline-flex;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        background: #eef2ff;
        color: #4338ca;
        font-weight: 600;
      }
      .title {
        font-size: 28px;
        font-weight: 600;
        margin: 20px 0 12px;
      }
      .card {
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        padding: 20px;
        margin: 24px 0;
        background: linear-gradient(135deg, #ffffff, #f8fafc);
      }
      .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 15px;
      }
      .label {
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        font-size: 11px;
        margin-bottom: 6px;
      }
      .cta {
        display: inline-flex;
        padding: 12px 28px;
        border-radius: 999px;
        background: #4338ca;
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
        margin-top: 16px;
      }
      .footer {
        text-align: center;
        color: #94a3b8;
        font-size: 12px;
        margin-top: 28px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <span class="badge">Booking Received</span>
      <h1 class="title">Thanks for booking ${serviceName}</h1>
      <p style="color: #475569; line-height: 1.6;">
        Hi there! We just received your request and locked the time slot. One of our team members
        will confirm shortly—keep an eye on your inbox for updates.
      </p>
      <div class="card">
        <div class="row">
          <div>
            <p class="label">Date</p>
            <p style="margin: 0; font-weight: 600;">${date}</p>
          </div>
          <div>
            <p class="label">Time</p>
            <p style="margin: 0; font-weight: 600;">${time}</p>
          </div>
        </div>
        <div class="row">
          <div>
            <p class="label">Business</p>
            <p style="margin: 0; font-weight: 600;">${businessName}</p>
          </div>
          <div>
            <p class="label">Location</p>
            <p style="margin: 0; font-weight: 600;">${location ?? 'See confirmation email for details'}</p>
          </div>
        </div>
      </div>
      <p style="color: #475569; line-height: 1.6;">
        Need to adjust the time or have questions? Just reply to this email and our team will help you out.
      </p>
      <div class="footer">
        ${businessName} · Powered by Bookly<br />
        This email was sent automatically—no need to reply unless you have a question.
      </div>
    </div>
  </body>
</html>
`;


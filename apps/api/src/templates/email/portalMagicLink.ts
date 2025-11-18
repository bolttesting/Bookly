export const portalMagicLinkHtml = ({
  portalUrl,
  businessName,
}: {
  portalUrl: string;
  businessName: string;
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${businessName} · Client Portal</title>
    <style>
      body {
        background: #0f172a;
        margin: 0;
        padding: 32px 16px;
        font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
        color: #f8fafc;
      }
      .container {
        max-width: 520px;
        margin: 0 auto;
        background: linear-gradient(145deg, #1e1b4b, #312e81);
        border-radius: 32px;
        padding: 36px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.45);
      }
      .brand {
        font-size: 12px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: #c7d2fe;
        font-weight: 600;
      }
      h1 {
        font-size: 28px;
        margin: 16px 0;
      }
      p {
        color: #e2e8f0;
        line-height: 1.6;
      }
      a.button {
        display: inline-block;
        margin-top: 24px;
        padding: 14px 28px;
        border-radius: 999px;
        background: #f5f3ff;
        color: #312e81;
        text-decoration: none;
        font-weight: 600;
      }
      .footer {
        margin-top: 28px;
        font-size: 12px;
        color: #94a3b8;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <p class="brand">${businessName}</p>
      <h1>Access your client portal</h1>
      <p>
        Tap the button below to manage bookings, packages, and profile details. This link stays active
        for the next 30 minutes and can only be used once.
      </p>
      <a class="button" href="${portalUrl}" target="_blank" rel="noopener noreferrer">
        Open my client portal
      </a>
      <p class="footer">
        Didn’t request this? It’s safe to ignore—no changes will be made without your confirmation.
      </p>
    </div>
  </body>
</html>
`;

export const portalMagicLinkText = ({
  portalUrl,
  businessName,
}: {
  portalUrl: string;
  businessName: string;
}) => `Hi there,

Use the secure link below to open your ${businessName} client portal. It expires in 30 minutes and can only be used once:
${portalUrl}

If you didn’t request this link, you can safely ignore this email.

— ${businessName}`;


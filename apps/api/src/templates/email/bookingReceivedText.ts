export const bookingConfirmationText = ({
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
}) => `Hi there,

Thanks for booking ${serviceName} with ${businessName}.

• Date: ${date}
• Time: ${time}
• Location: ${location ?? 'See confirmation email for details'}

We’ll send another note once the team confirms everything. Need to make a change? Just reply to this email and we’ll help right away.

— ${businessName} · Powered by Bookly`;


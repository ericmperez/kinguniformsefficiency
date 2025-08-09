# SendGrid Migration Guide for King Uniforms

## Why SendGrid?
- ✅ 100 emails/day free (vs Gmail's ~60)
- ✅ Easy integration with existing code
- ✅ Excellent deliverability rates
- ✅ Built-in analytics and tracking
- ✅ No SMTP authentication issues

## Migration Steps

### 1. Install SendGrid
```bash
npm install @sendgrid/mail
```

### 2. Update Environment Variables
Add to your `.env` and Vercel environment variables:
```
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@kinguniforms.net
```

### 3. Create SendGrid Email Service
Create `src/services/sendgridService.ts`:
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const sendEmailWithSendGrid = async (
  to: string,
  subject: string,
  text: string,
  html?: string,
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
  }>
) => {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@kinguniforms.net',
      subject,
      text,
      html,
      attachments
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { success: false, error };
  }
};
```

### 4. Update API Endpoints
Replace Gmail SMTP calls with SendGrid in:
- `api/send-invoice.js`
- `api/send-test-email.js`

### 5. Benefits for King Uniforms
- **Reliable delivery** for invoice notifications
- **PDF attachments** for signed delivery tickets
- **Email analytics** to track delivery success
- **No daily limits** (within plan)
- **Professional sender reputation**

## Cost Analysis
- Current: Gmail (limited to ~60/day)
- SendGrid Free: 100 emails/day = $0
- SendGrid Paid: 50K emails/month = $19.95
- For 200 emails/day: Still within $19.95 plan

## Implementation Timeline
- Setup: 30 minutes
- Testing: 15 minutes  
- Deployment: 15 minutes
- **Total: 1 hour to migrate**

import nodemailer from 'nodemailer';

// Helper function to send email via real SMTP or Ethereal test account fallback
export async function sendEmail(mailOptions: nodemailer.SendMailOptions): Promise<void> {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail(mailOptions);
      console.log(`[email] ✅ Email sent via ${process.env.SMTP_HOST} to ${mailOptions.to}`);
      return;
    } catch (err) {
      console.warn('[email] ⚠️  Real SMTP failed, falling back to Ethereal test account:', (err as Error).message);
    }
  }

  // Fallback: generate a free Ethereal test account and send there
  const testAccount = await nodemailer.createTestAccount();
  const devTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const info = await devTransporter.sendMail(mailOptions);
  console.log(`[email] ✅ Ethereal test email sent`);
  console.log(`[email] 👉 Preview URL (click to view): ${nodemailer.getTestMessageUrl(info)}`);
}

export async function sendCancellationEmail(to: string, userName: string, itemName: string, amount: number) {
  const mailOptions = {
    from: '"PlaySphere Support" <support@playsphere.com>',
    to,
    subject: 'Booking Cancelled & Refund Initiated',
    text: `Hello ${userName},\n\nYour booking for ${itemName} has been cancelled.\nA full refund of ₹${amount} has been initiated to your original payment method.\n\nThank you for using PlaySphere!`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Booking Cancelled</h2>
        <p>Hello ${userName},</p>
        <p>Your booking for <strong>${itemName}</strong> has been cancelled.</p>
        <p>A full refund of <strong>₹${amount}</strong> has been initiated to your original payment method. It may take 2-3 business days to reflect in your account.</p>
        <br/>
        <p>Thank you for using PlaySphere!</p>
      </div>
    `,
  };

  await sendEmail(mailOptions);
}

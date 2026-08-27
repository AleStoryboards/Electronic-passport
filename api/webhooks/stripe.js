import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export const config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const rawBody = await buffer(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object;

    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      const email = customer.email;

      if (!email) {
        console.error('No email found on customer');
        return res.status(200).json({ received: true });
      }

      const token = randomBytes(24).toString('hex');

      const { error: dbError } = await supabase.from('subscribers').insert({
        email,
        token,
        subscription_id: subscription.id,
      });

      if (dbError) {
        console.error('Supabase error:', dbError);
        return res.status(500).json({ error: 'Database error' });
      }

      const accessLink = `https://electronicpassport.live/api/members/${token}`;

      await resend.emails.send({
        from: 'Electronic Passport <hello@electronicpassport.live>',
        to: email,
        subject: 'Welcome to Electronic Passport 🛂',
        html: `
          <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;">
            <h1 style="color:#C8FF3D;">Welcome to Electronic Passport</h1>
            <p>Your subscription is active. Click below to access your members area:</p>
            <a href="${accessLink}" style="display:inline-block;background:#C8FF3D;color:#000;padding:14px 28px;text-decoration:none;font-weight:bold;border-radius:4px;margin-top:16px;">
              Enter Members Area
            </a>
            <p style="margin-top:24px;color:#888;font-size:12px;">Keep this email — this link is your personal access.</p>
          </div>
        `,
      });

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Error processing subscription:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  return res.status(200).json({ received: true });
}

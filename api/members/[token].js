import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { token } = req.query;

  const { data, error } = await supabase
    .from('subscribers')
    .select('email')
    .eq('token', token)
    .single();

  if (error || !data) {
    res.status(404).send(`
      <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
        <h1 style="color:#C8FF3D;">Invalid or expired link</h1>
        <p>Please check your email for the correct access link.</p>
      </div>
    `);
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;">
      <h1 style="color:#C8FF3D;">Welcome back, member.</h1>
      <p>This is your private Electronic Passport members area.</p>
    </div>
  `);
}

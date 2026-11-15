import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.OPPORTUNITIES_ADMIN_PASSWORD;
const email = 'opportunities@futolife.app';

if (!url || !serviceKey || !password) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPPORTUNITIES_ADMIN_PASSWORD in .env first.');
}
if (password.length < 12) throw new Error('OPPORTUNITIES_ADMIN_PASSWORD must be at least 12 characters.');

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: users, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let user = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
if (user) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
const { error: roleError } = await supabase.from('user_roles').upsert({ user_id: user.id, role: 'opportunities_admin' });
if (roleError) throw roleError;
console.log(`Seeded ${email} with the opportunities_admin role.`);

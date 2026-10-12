import { createClient } from '@supabase/supabase-js';
const url = 'https://ilhwpwfmoobasbnouaim.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaHdwd2Ztb29iYXNibm91YWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzAxMDIsImV4cCI6MjEwNjI0NjEwMn0.Nu1yS4dhfnmMEDGpvJ8IOHkV34DlTezdrSAUiyldazI';
const manager = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  await manager.auth.signInWithPassword({ email: 'manager.flow.test@gymly.test', password: 'ManagerNuovo123!' });
  for (let i = 0; i < 16; i++) {
    const { data: row } = await manager.from('checkins').select('checkout_at').eq('id', 15).single();
    console.log(`[t+${i * 30}s] row 15 checkout_at=${row?.checkout_at ?? 'null'}`);
    if (row?.checkout_at) { console.log('\nCHIUSA dal cron reale.'); return; }
    await sleep(30_000);
  }
  console.log('\nTIMEOUT — ancora aperta dopo 8 min aggiuntivi.');
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });

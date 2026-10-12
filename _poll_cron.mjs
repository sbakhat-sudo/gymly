import { createClient } from '@supabase/supabase-js';

const url = 'https://ilhwpwfmoobasbnouaim.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaHdwd2Ztb29iYXNibm91YWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzAxMDIsImV4cCI6MjEwNjI0NjEwMn0.Nu1yS4dhfnmMEDGpvJ8IOHkV34DlTezdrSAUiyldazI';
const manager = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await manager.auth.signInWithPassword({ email: 'manager.flow.test@gymly.test', password: 'ManagerNuovo123!' });

  for (let i = 0; i < 20; i++) {
    const { data: rows } = await manager.from('checkins').select('id, kind, checkout_at').in('id', [12, 15]);
    const r12 = rows.find((r) => r.id === 12);
    const r14 = rows.find((r) => r.id === 15);
    console.log(`[t+${i * 30}s] coach id=12 checkout_at=${r12?.checkout_at ?? 'null'} | client id=14 checkout_at=${r14?.checkout_at ?? 'null'}`);
    if (r12?.checkout_at && r14?.checkout_at) {
      console.log('\nENTRAMBE CHIUSE dal cron reale. Test riuscito.');
      return;
    }
    await sleep(30_000);
  }
  console.log('\nTIMEOUT dopo 10 minuti — una o entrambe le righe non sono state chiuse.');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

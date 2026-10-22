// First Edge Function in this project — the ONLY place that creates an account on behalf of
// someone else (an Owner adding a new Manager). This genuinely needs Supabase's privileged
// service-role powers (auth.admin.createUser), which must never live in the RN app. `withSupabase`
// (npm:@supabase/server) hands the handler both a caller-scoped client (`supabase`, respects RLS,
// `auth.uid()` = the calling Owner — same as every RPC in owner_role.sql) and an admin client
// (`supabaseAdmin`, service-role, bypasses RLS) in one call, keyed off the platform's own managed
// key, so no secret is read/stored by hand here. See CLAUDE.md's "Deliberate, explicit exception"
// entry for this function.
import { withSupabase } from 'npm:@supabase/server@1';

// Same alphabet/technique as src/lib/domain/redemption-code.ts and generateTempPassword() in
// src/features/manager/manager-api.ts — duplicated here because a Deno Edge Function can't import
// from the RN app's src/ tree. Keep this literal in sync with src/schemas/points.ts's
// REDEMPTION_CODE_ALPHABET if that ever changes.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateTempPassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += PASSWORD_ALPHABET.charAt(b & 31); // 256 % 32 === 0, unbiased
  return out;
}

interface AddManagerBody {
  fullName: string;
  email: string;
  siteName: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

function isValidBody(v: unknown): v is AddManagerBody {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.fullName === 'string' &&
    b.fullName.trim().length > 0 &&
    typeof b.email === 'string' &&
    b.email.includes('@') &&
    typeof b.siteName === 'string' &&
    b.siteName.trim().length > 0 &&
    typeof b.address === 'string' &&
    (b.phone === undefined || typeof b.phone === 'string') &&
    (b.lat === undefined || typeof b.lat === 'number') &&
    (b.lng === undefined || typeof b.lng === 'number')
  );
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const caller = ctx.userClaims;
    if (!caller?.id) {
      return Response.json({ message: 'unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: 'invalid body' }, { status: 400 });
    }
    if (!isValidBody(body)) {
      return Response.json({ message: 'missing or invalid fields' }, { status: 400 });
    }

    // Defense in depth: owner_create_manager_record() (called below, with the caller's own JWT)
    // already re-checks is_owner() server-side — this request never proceeds to the privileged
    // auth.admin.createUser call for a non-Owner caller even if that check were ever removed there.
    const { data: profile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', caller.id)
      .maybeSingle();
    if (!profile || profile.role !== 'owner' || profile.status !== 'active') {
      return Response.json({ message: 'not authorized' }, { status: 403 });
    }

    const password = generateTempPassword();
    const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: body.email.trim(),
      password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      return Response.json({ message: createError?.message ?? 'account creation failed' }, { status: 400 });
    }

    // Called with the OWNER's own client (not supabaseAdmin) so auth.uid() inside the RPC resolves
    // to the owner, exactly like every other owner_* RPC in owner_role.sql.
    const { data: siteId, error: rpcError } = await ctx.supabase.rpc('owner_create_manager_record', {
      p_manager_user_id: created.user.id,
      p_full_name: body.fullName.trim(),
      p_site_name: body.siteName.trim(),
      p_address: body.address.trim(),
      p_lat: body.lat ?? null,
      p_lng: body.lng ?? null,
      p_phone: body.phone?.trim() || null,
    });
    if (rpcError) {
      // The auth user now exists with no profile/site — clean it up so a retry doesn't collide.
      await ctx.supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return Response.json({ message: rpcError.message }, { status: 400 });
    }

    return Response.json({ email: body.email.trim(), tempPassword: password, managerId: created.user.id, siteId });
  }),
};

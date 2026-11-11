/**
 * Server-side account and vault storage.
 *
 * The database holds three things per account: the data key wrapped by the
 * password, the data key wrapped by the recovery code, and the encrypted
 * payroll itself. It never holds a password, a plaintext key or a readable
 * payslip.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * False when the build has no credentials, which is the state of a fresh clone.
 * The app then explains what is missing instead of throwing on the first click.
 */
export const isCloudConfigured = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient = createClient(
  isCloudConfigured ? url : "https://unconfigured.supabase.co",
  isCloudConfigured ? anonKey : "unconfigured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No magic links or OAuth redirects are used, so nothing to detect.
      detectSessionInUrl: false,
    },
  }
);

/** One row of `public.vaults`, as returned by the anon-readable recovery RPC. */
export type RecoveryBlob = {
  rec_iv: string;
  rec_ct: string;
};

export type VaultRow = {
  user_id: string;
  email: string;
  display_name: string;
  pw_iv: string;
  pw_ct: string;
  rec_iv: string;
  rec_ct: string;
  data_iv: string | null;
  data_ct: string | null;
  updated_at: string;
};

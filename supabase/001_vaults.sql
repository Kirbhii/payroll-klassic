-- Payroll Klassic — server-side vault
--
-- Run this once, in a brand-new Supabase project, from the SQL Editor.
-- It creates one table and two functions. Nothing here stores a password,
-- an unwrapped key, or a readable payslip.

create extension if not exists pgcrypto with schema extensions;

/* ------------------------------------------------------------------ table */

create table if not exists public.vaults (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  display_name   text not null default '',

  -- The random data key, wrapped by a key derived from the password.
  pw_iv          text not null,
  pw_ct          text not null,

  -- The same data key, wrapped by a key derived from the recovery code.
  rec_iv         text not null,
  rec_ct         text not null,

  -- Write-only input: the trigger below replaces it with a bcrypt hash.
  recovery_proof text,
  recovery_hash  text not null,

  -- The encrypted payroll itself.
  data_iv        text,
  data_ct        text,

  updated_at     timestamptz not null default now()
);

/* ---------------------------------------------------------------- trigger */

-- Turns the caller-supplied proof into a bcrypt hash and clears the input, so
-- the plaintext proof is never stored. On a later update that omits the proof,
-- the existing hash is left alone.
create or replace function public.vaults_hash_proof()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.recovery_proof is not null and length(new.recovery_proof) > 0 then
    new.recovery_hash  := crypt(new.recovery_proof, gen_salt('bf'));
    new.recovery_proof := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vaults_hash_proof_trg on public.vaults;
create trigger vaults_hash_proof_trg
before insert or update on public.vaults
for each row execute function public.vaults_hash_proof();

/* -------------------------------------------------------------------- RLS */

alter table public.vaults enable row level security;

drop policy if exists vaults_owner_select on public.vaults;
create policy vaults_owner_select on public.vaults
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists vaults_owner_insert on public.vaults;
create policy vaults_owner_insert on public.vaults
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists vaults_owner_update on public.vaults;
create policy vaults_owner_update on public.vaults
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ---------------------------------------------------------------- grants */

-- `anon` never reads the table directly. The recovery lookup goes through
-- vault_recovery_blob(), which is security definer and returns only ciphertext.
-- Signed-in users get row access, and RLS still pins them to their own row.
revoke all on public.vaults from anon;
grant select, insert, update on public.vaults to authenticated;

/* --------------------------------------------------------------- recovery */

-- Returns only the recovery-wrapped key. It is ciphertext: useless without the
-- 30-character code, which is never sent anywhere.
create or replace function public.vault_recovery_blob(p_email text)
returns table (rec_iv text, rec_ct text)
language sql
security definer
set search_path = public
as $$
  select v.rec_iv, v.rec_ct
  from public.vaults v
  where lower(v.email) = lower(p_email)
  limit 1;
$$;

grant execute on function public.vault_recovery_blob(text) to anon, authenticated;

-- Swaps the sign-in credential, but only for a caller who can prove they hold
-- the recovery code. The proof is a 256-bit HMAC, so it cannot be guessed and
-- cannot be turned back into the code.
create or replace function public.reset_password_with_recovery(
  p_email      text,
  p_proof      text,
  p_new_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_hash    text;
begin
  select v.user_id, v.recovery_hash
    into v_user_id, v_hash
  from public.vaults v
  where lower(v.email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    return false;
  end if;

  if crypt(p_proof, v_hash) <> v_hash then
    return false;
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_secret, gen_salt('bf')),
         updated_at         = now()
   where id = v_user_id;

  return true;
end;
$$;

grant execute on function public.reset_password_with_recovery(text, text, text) to anon, authenticated;

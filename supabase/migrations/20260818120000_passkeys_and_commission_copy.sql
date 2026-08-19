-- Task: (1) passkey / WebAuthn sign-in, (2) fully editable Commission page.
-- Additive and idempotent — safe to run more than once, changes nothing visually
-- until the owner sets values.

-- ── 1) Passkeys ─────────────────────────────────────────────────────────────
-- One row per registered authenticator (Face ID, Touch ID, Windows Hello,
-- Android fingerprint, hardware key). The WebAuthn challenge is NOT stored here
-- — it lives in a short-lived signed HttpOnly cookie, so no second table.
create table if not exists webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  -- base64url credential id from the authenticator (globally unique).
  credential_id text not null unique,
  public_key    text not null,
  -- Signature counter for cloned-authenticator detection.
  counter       bigint not null default 0,
  transports    text[] default '{}',
  device_label  text,
  created_at    timestamptz default now(),
  last_used_at  timestamptz
);

create index if not exists webauthn_credentials_user_idx
  on webauthn_credentials (user_id);

alter table webauthn_credentials enable row level security;

-- No public policies at all: every read/write goes through server routes using
-- the service key. Anonymous and even authenticated clients get nothing, so a
-- stolen publishable key cannot enumerate or register credentials.
drop policy if exists "public read webauthn_credentials" on webauthn_credentials;
drop policy if exists "auth all webauthn_credentials"   on webauthn_credentials;

-- ── 2) Commission page copy ─────────────────────────────────────────────────
-- The intro paragraph is already editable (commission_intro); these add the
-- small caps label and the heading above it.
alter table settings add column if not exists commission_eyebrow text;
alter table settings add column if not exists commission_heading text;

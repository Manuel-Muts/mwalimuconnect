create table public.auth_email_otp_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  code_hash text not null,
  session_ciphertext text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  last_sent_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 5),
  resend_count integer not null default 0 check (resend_count between 0 and 5),
  consumed_at timestamptz
);

create index auth_email_otp_challenges_email_created_idx
  on public.auth_email_otp_challenges (lower(email), created_at desc);

alter table public.auth_email_otp_challenges enable row level security;
revoke all on public.auth_email_otp_challenges from anon, authenticated;
grant all on public.auth_email_otp_challenges to service_role;

create or replace function public.create_auth_email_otp_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_email text,
  p_code_hash text,
  p_session_ciphertext text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));

  delete from public.auth_email_otp_challenges
    where expires_at < now() - interval '1 day';

  if exists (
    select 1
      from public.auth_email_otp_challenges
      where lower(email) = v_email
        and created_at > now() - interval '1 minute'
  ) or (
    select count(*)
      from public.auth_email_otp_challenges
      where lower(email) = v_email
        and created_at > now() - interval '1 hour'
  ) >= 5 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.auth_email_otp_challenges (
    id, user_id, email, code_hash, session_ciphertext
  ) values (
    p_challenge_id, p_user_id, v_email, p_code_hash, p_session_ciphertext
  );
  return jsonb_build_object('status', 'created', 'challenge_id', p_challenge_id);
end;
$$;

create or replace function public.resend_auth_email_otp_challenge(
  p_challenge_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.auth_email_otp_challenges%rowtype;
begin
  select *
    into v_challenge
    from public.auth_email_otp_challenges
    where id = p_challenge_id
    for update;

  if not found or v_challenge.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('status', 'already_used');
  end if;
  if v_challenge.last_sent_at > now() - interval '1 minute' then
    return jsonb_build_object('status', 'too_soon');
  end if;
  if v_challenge.resend_count >= 5 or (
    select count(*)
      from public.auth_email_otp_challenges
      where lower(email) = lower(v_challenge.email)
        and created_at > now() - interval '1 hour'
  ) >= 10 then
    return jsonb_build_object('status', 'too_many_requests');
  end if;

  update public.auth_email_otp_challenges
    set code_hash = p_code_hash,
        expires_at = now() + interval '10 minutes',
        last_sent_at = now(),
        resend_count = resend_count + 1,
        attempts = 0
    where id = p_challenge_id;
  return jsonb_build_object('status', 'resent', 'email', v_challenge.email);
end;
$$;

create or replace function public.consume_auth_email_otp_challenge(
  p_challenge_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.auth_email_otp_challenges%rowtype;
begin
  select *
    into v_challenge
    from public.auth_email_otp_challenges
    where id = p_challenge_id
    for update;

  if not found or v_challenge.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_challenge.consumed_at is not null then
    return jsonb_build_object('status', 'already_used');
  end if;
  if v_challenge.attempts >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  update public.auth_email_otp_challenges
    set attempts = attempts + 1
    where id = p_challenge_id;

  if v_challenge.code_hash is distinct from p_code_hash then
    return jsonb_build_object(
      'status',
      case when v_challenge.attempts + 1 >= 5 then 'too_many_attempts' else 'invalid_code' end
    );
  end if;

  update public.auth_email_otp_challenges
    set consumed_at = now(),
        session_ciphertext = ''
    where id = p_challenge_id;

  return jsonb_build_object('status', 'verified', 'session_ciphertext', v_challenge.session_ciphertext);
end;
$$;

revoke all on function public.create_auth_email_otp_challenge(uuid, uuid, text, text, text) from public;
revoke all on function public.resend_auth_email_otp_challenge(uuid, text) from public;
revoke all on function public.consume_auth_email_otp_challenge(uuid, text) from public;
grant execute on function public.create_auth_email_otp_challenge(uuid, uuid, text, text, text) to service_role;
grant execute on function public.resend_auth_email_otp_challenge(uuid, text) to service_role;
grant execute on function public.consume_auth_email_otp_challenge(uuid, text) to service_role;

-- M1b (05-13): email_outbox, enqueue_email, claim_outbox, finish_outbox, sweep_outbox.
-- Threats T-05-13-01, T-05-13-02, T-05-13-03, T-05-13-04. Writes are rolled back at the end.

-- Tables: RLS on, no policies, no browser-role privileges, service_role holds them.
do $$
declare t text;
begin
  foreach t in array array['email_outbox', 'notification_sends', 'digest_runs'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'FAIL % RLS on: row level security is off', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'FAIL % has no policies: a policy exists', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'select')
       or has_table_privilege('authenticated', 'public.' || t, 'select')
       or has_table_privilege('authenticated', 'public.' || t, 'insert')
       or has_table_privilege('authenticated', 'public.' || t, 'update') then
      raise exception 'FAIL % privileges: anon or authenticated holds a table privilege', t;
    end if;
    if not has_table_privilege('service_role', 'public.' || t, 'select')
       or not has_table_privilege('service_role', 'public.' || t, 'insert') then
      raise exception 'FAIL % service_role: missing select or insert', t;
    end if;
  end loop;
end $$;

-- Functions: security definer, search_path '', EXECUTE for service_role only.
do $$
declare
  f text;
  r record;
begin
  foreach f in array array[
    'public.enqueue_email(text,text,uuid,text,boolean,jsonb,text,text)',
    'public.claim_welcome(uuid,text)',
    'public.claim_outbox(uuid[])',
    'public.finish_outbox(jsonb)',
    'public.sweep_outbox(integer)',
    'public.build_digest(timestamptz)'
  ] loop
    select p.prosecdef, p.proconfig into r from pg_proc p where p.oid = f::regprocedure;
    if not r.prosecdef then
      raise exception 'FAIL % security definer: it is security invoker', f;
    end if;
    if r.proconfig is null or not ('search_path=""' = any(r.proconfig)) then
      raise exception 'FAIL % search_path empty: proconfig %', f, r.proconfig;
    end if;
    if has_function_privilege('anon', f, 'execute')
       or has_function_privilege('authenticated', f, 'execute')
       or has_function_privilege('public', f, 'execute') then
      raise exception 'FAIL % execute: a browser role or PUBLIC can execute it', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'FAIL % execute: service_role cannot execute it', f;
    end if;
  end loop;
end $$;

-- Test users: a confirmed viewer (profile locale ar), an unconfirmed viewer, two admins.
do $$
declare
  v_conf uuid := gen_random_uuid();
  v_unconf uuid := gen_random_uuid();
  v_a1 uuid := gen_random_uuid();
  v_a2 uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
  values (v_conf, 'm1b-confirmed@clickit.local', 'authenticated', 'authenticated', now(), now(), now()),
         (v_unconf, 'm1b-unconfirmed@clickit.local', 'authenticated', 'authenticated', null, now(), now()),
         (v_a1, 'm1b-admin1@clickit.local', 'authenticated', 'authenticated', now(), now(), now()),
         (v_a2, 'm1b-admin2@clickit.local', 'authenticated', 'authenticated', now(), now(), now());
  update public.profiles set locale = 'ar' where id in (v_conf, v_a1);
  perform set_config('m1b.conf', v_conf::text, true);
  perform set_config('m1b.unconf', v_unconf::text, true);
  perform set_config('m1b.a1', v_a1::text, true);
  perform set_config('m1b.a2', v_a2::text, true);
end $$;

-- enqueue twice with the same key: one row, queued then duplicate.
do $$
declare
  v_id1 uuid; v_out1 text; v_id2 uuid; v_out2 text; n bigint;
begin
  select e.id, e.outcome into v_id1, v_out1
  from public.enqueue_email('welcome', 'm1b:same-key', current_setting('m1b.conf')::uuid, null, false, '{}'::jsonb, 'en', null) e;
  select e.id, e.outcome into v_id2, v_out2
  from public.enqueue_email('welcome', 'm1b:same-key', current_setting('m1b.conf')::uuid, null, false, '{}'::jsonb, 'en', null) e;
  select count(*) into n from public.email_outbox where idempotency_key = 'm1b:same-key';
  if v_out1 <> 'queued' or v_id1 is null then
    raise exception 'FAIL enqueue first call: outcome % id %', v_out1, v_id1;
  end if;
  if v_out2 <> 'duplicate' or v_id2 is not null then
    raise exception 'FAIL enqueue same key: outcome % id %', v_out2, v_id2;
  end if;
  if n <> 1 then
    raise exception 'FAIL enqueue same key one row: % rows', n;
  end if;
  if (select status from public.email_outbox where id = v_id1) <> 'pending' then
    raise exception 'FAIL enqueue status pending';
  end if;
  perform set_config('m1b.welcome_row', v_id1::text, true);
end $$;

-- enqueue with no recipient raises; a non-object payload raises.
do $$
begin
  begin
    perform public.enqueue_email('support_ack', 'm1b:nobody', null, '  ', false, '{}'::jsonb, 'en', null);
    raise exception 'FAIL enqueue no recipient: no error';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform public.enqueue_email('support_ack', 'm1b:arr', null, 'x@clickit.local', false, '[]'::jsonb, 'en', null);
    raise exception 'FAIL enqueue array payload: no error';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- support_ack: 3 per address per 24 h (address normalised), the 4th is capped;
-- rows older than 24 h do not count.
do $$
declare
  v_out text; v_id uuid; i int; n bigint;
begin
  for i in 1..3 loop
    select e.outcome into v_out
    from public.enqueue_email('support_ack', 'm1b:ack:' || i, null,
      case i when 1 then 'Visitor@Clickit.Local' when 2 then ' visitor@clickit.local ' else 'VISITOR@clickit.local' end,
      false, '{}'::jsonb, 'en', null) e;
    if v_out <> 'queued' then
      raise exception 'FAIL support_ack % queued: got %', i, v_out;
    end if;
  end loop;
  select e.id, e.outcome into v_id, v_out
  from public.enqueue_email('support_ack', 'm1b:ack:4', null, 'visitor@clickit.local', false, '{}'::jsonb, 'en', null) e;
  if v_out <> 'capped' or v_id is not null then
    raise exception 'FAIL support_ack 4th capped: outcome % id %', v_out, v_id;
  end if;
  select count(*) into n from public.email_outbox where kind = 'support_ack' and to_email = 'visitor@clickit.local';
  if n <> 3 then
    raise exception 'FAIL support_ack normalised address: % rows with the lower-case address', n;
  end if;
  -- Another address is not capped.
  select e.outcome into v_out
  from public.enqueue_email('support_ack', 'm1b:ack:other', null, 'other@clickit.local', false, '{}'::jsonb, 'en', null) e;
  if v_out <> 'queued' then
    raise exception 'FAIL support_ack other address: got %', v_out;
  end if;
  -- After 24 h the cap resets.
  update public.email_outbox set created_at = now() - interval '25 hours'
  where kind = 'support_ack' and to_email = 'visitor@clickit.local';
  select e.outcome into v_out
  from public.enqueue_email('support_ack', 'm1b:ack:5', null, 'visitor@clickit.local', false, '{}'::jsonb, 'en', null) e;
  if v_out <> 'queued' then
    raise exception 'FAIL support_ack after 24 h: got %', v_out;
  end if;
end $$;

-- newsletter_confirm: 1 per address per 10 min.
do $$
declare v_out text; v_id uuid;
begin
  select e.outcome into v_out
  from public.enqueue_email('newsletter_confirm', 'm1b:nl:1', null, 'reader@clickit.local', false,
    jsonb_build_object('subscriber_id', gen_random_uuid()), 'ar', null) e;
  if v_out <> 'queued' then
    raise exception 'FAIL newsletter_confirm first: got %', v_out;
  end if;
  select e.id, e.outcome into v_id, v_out
  from public.enqueue_email('newsletter_confirm', 'm1b:nl:2', null, 'Reader@clickit.local', false,
    jsonb_build_object('subscriber_id', gen_random_uuid()), 'ar', null) e;
  if v_out <> 'capped' or v_id is not null then
    raise exception 'FAIL newsletter_confirm 2nd within 10 min capped: outcome % id %', v_out, v_id;
  end if;
  update public.email_outbox set created_at = now() - interval '11 minutes' where idempotency_key = 'm1b:nl:1';
  select e.outcome into v_out
  from public.enqueue_email('newsletter_confirm', 'm1b:nl:3', null, 'reader@clickit.local', false,
    jsonb_build_object('subscriber_id', gen_random_uuid()), 'ar', null) e;
  if v_out <> 'queued' then
    raise exception 'FAIL newsletter_confirm after 10 min: got %', v_out;
  end if;
  if (select locale from public.email_outbox where idempotency_key = 'm1b:nl:3') <> 'ar' then
    raise exception 'FAIL newsletter_confirm row locale';
  end if;
end $$;

-- admin_all with zero admins rows: zero rows returned, nothing inserted, no error.
do $$
declare n_ret bigint; n_rows bigint;
begin
  if (select count(*) from public.admins) <> 0 then
    raise exception 'FAIL setup: admins not empty';
  end if;
  select count(*) into n_ret
  from public.enqueue_email('support_admin', 'm1b:admins-empty', null, null, true,
    jsonb_build_object('message_id', gen_random_uuid()), 'en', null) e;
  select count(*) into n_rows from public.email_outbox where idempotency_key like 'm1b:admins-empty%';
  if n_ret <> 0 or n_rows <> 0 then
    raise exception 'FAIL admin_all no admins: returned % rows, inserted %', n_ret, n_rows;
  end if;
end $$;

-- admin_all with two admins rows: two rows, distinct keys, each admin's locale, reply_to without CR/LF.
do $$
declare
  v_msg uuid;
  n_q bigint;
  r record;
begin
  insert into public.admins (user_id, display_name)
  values (current_setting('m1b.a1')::uuid, 'Admin One'),
         (current_setting('m1b.a2')::uuid, 'Admin Two');
  insert into public.support_messages (name, email, subject, message)
  values ('Visitor', 'visitor@clickit.local', 'Hello', 'A question')
  returning id into v_msg;
  perform set_config('m1b.msg', v_msg::text, true);

  select count(*) filter (where e.outcome = 'queued' and e.id is not null) into n_q
  from public.enqueue_email('support_admin', 'm1b:admin:' || v_msg, null, null, true,
    jsonb_build_object('message_id', v_msg, 'name', 'Visitor', 'email', 'visitor@clickit.local',
                       'subject', 'Hello', 'message', 'A question'),
    'en', E'visitor@clickit.local\r\nBcc: x@clickit.local') e;
  if n_q <> 2 then
    raise exception 'FAIL admin_all two admins: % queued', n_q;
  end if;
  for r in select * from public.email_outbox where idempotency_key like 'm1b:admin:' || v_msg || ':%' loop
    if r.idempotency_key <> 'm1b:admin:' || v_msg || ':' || r.to_user then
      raise exception 'FAIL admin_all key per admin: %', r.idempotency_key;
    end if;
    if r.locale <> (case when r.to_user = current_setting('m1b.a1')::uuid then 'ar' else 'en' end) then
      raise exception 'FAIL admin_all admin locale: % for %', r.locale, r.to_user;
    end if;
    if r.reply_to ~ '[\r\n]' then
      raise exception 'FAIL admin_all reply_to CR/LF stripped';
    end if;
    if r.to_email is not null then
      raise exception 'FAIL admin_all targets users only';
    end if;
  end loop;
  if (select count(distinct to_user) from public.email_outbox where idempotency_key like 'm1b:admin:' || v_msg || ':%') <> 2 then
    raise exception 'FAIL admin_all distinct admins';
  end if;
  -- Calling again: both duplicate.
  select count(*) filter (where e.outcome = 'duplicate') into n_q
  from public.enqueue_email('support_admin', 'm1b:admin:' || v_msg, null, null, true,
    jsonb_build_object('message_id', v_msg), 'en', null) e;
  if n_q <> 2 then
    raise exception 'FAIL admin_all again duplicate: % duplicates', n_q;
  end if;
end $$;

-- claim_outbox: once, not again within the lease, again after the lease expires (attempts 2).
do $$
declare
  v_id uuid := current_setting('m1b.welcome_row')::uuid;
  r record;
  v_first timestamptz;
  n bigint;
begin
  select * into r from public.claim_outbox(array[v_id]);
  if r.id is distinct from v_id or r.attempts <> 1 or r.first_attempt_at is null then
    raise exception 'FAIL claim first: id % attempts % first %', r.id, r.attempts, r.first_attempt_at;
  end if;
  if r.to_address is distinct from 'm1b-confirmed@clickit.local' then
    raise exception 'FAIL claim confirmed address: %', r.to_address;
  end if;
  if r.locale <> 'ar' then
    raise exception 'FAIL claim profile locale wins: %', r.locale;
  end if;
  if r.kind <> 'welcome' or r.idempotency_key <> 'm1b:same-key' or r.to_user <> current_setting('m1b.conf')::uuid then
    raise exception 'FAIL claim row shape';
  end if;
  v_first := r.first_attempt_at;
  if (select status from public.email_outbox where id = v_id) <> 'sending'
     or (select lease_until from public.email_outbox where id = v_id) <= now() then
    raise exception 'FAIL claim leases the row';
  end if;

  select count(*) into n from public.claim_outbox(array[v_id]);
  if n <> 0 then
    raise exception 'FAIL claim within lease: % rows', n;
  end if;

  update public.email_outbox set lease_until = now() - interval '1 second' where id = v_id;
  select * into r from public.claim_outbox(array[v_id]);
  if r.id is distinct from v_id or r.attempts <> 2 then
    raise exception 'FAIL claim after lease: id % attempts %', r.id, r.attempts;
  end if;
  if r.first_attempt_at <> v_first then
    raise exception 'FAIL claim first_attempt_at set once';
  end if;
end $$;

-- claim_outbox: an unconfirmed user's row returns to_address null; an email row returns its address.
do $$
declare
  v_u uuid; v_e uuid; r record;
begin
  select e.id into v_u
  from public.enqueue_email('welcome', 'm1b:unconf', current_setting('m1b.unconf')::uuid, null, false, '{}'::jsonb, 'en', null) e;
  select o.id into v_e from public.email_outbox o where o.idempotency_key = 'm1b:ack:other';
  for r in select * from public.claim_outbox(array[v_u, v_e]) loop
    if r.id = v_u and r.to_address is not null then
      raise exception 'FAIL claim unconfirmed address null: %', r.to_address;
    end if;
    if r.id = v_u and r.locale <> 'en' then
      raise exception 'FAIL claim locale fallback: %', r.locale;
    end if;
    if r.id = v_e and r.to_address is distinct from 'other@clickit.local' then
      raise exception 'FAIL claim email row address: %', r.to_address;
    end if;
  end loop;
  if (select count(*) from public.email_outbox where id in (v_u, v_e) and status = 'sending') <> 2 then
    raise exception 'FAIL claim two rows leased';
  end if;
  perform set_config('m1b.unconf_row', v_u::text, true);
  perform set_config('m1b.ack_row', v_e::text, true);
end $$;

-- finish_outbox: sent sets sent_at and provider_id and clears the lease; only 'sending' rows change;
-- retrying keeps next_attempt_at; error cut to 200.
do $$
declare
  v_w uuid := current_setting('m1b.welcome_row')::uuid;
  v_u uuid := current_setting('m1b.unconf_row')::uuid;
  v_e uuid := current_setting('m1b.ack_row')::uuid;
  n int;
  r record;
begin
  n := public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_w, 'status', 'sent', 'provider_id', 'prov-1'),
    jsonb_build_object('id', v_u, 'status', 'skipped', 'error', 'no_confirmed_address'),
    jsonb_build_object('id', v_e, 'status', 'retrying', 'error', repeat('x', 300),
                       'next_attempt_at', (now() + interval '2 minutes')::text)
  ));
  if n <> 3 then
    raise exception 'FAIL finish count: %', n;
  end if;
  select * into r from public.email_outbox where id = v_w;
  if r.status <> 'sent' or r.sent_at is null or r.provider_id <> 'prov-1' or r.lease_until is not null then
    raise exception 'FAIL finish sent: status % sent_at % provider % lease %', r.status, r.sent_at, r.provider_id, r.lease_until;
  end if;
  select * into r from public.email_outbox where id = v_u;
  if r.status <> 'skipped' or r.last_error <> 'no_confirmed_address' or r.sent_at is not null then
    raise exception 'FAIL finish skipped: % %', r.status, r.last_error;
  end if;
  select * into r from public.email_outbox where id = v_e;
  if r.status <> 'retrying' or char_length(r.last_error) <> 200
     or r.next_attempt_at <> now() + interval '2 minutes' or r.lease_until is not null then
    raise exception 'FAIL finish retrying: % % % %', r.status, char_length(r.last_error), r.next_attempt_at, r.lease_until;
  end if;

  -- A row that is no longer 'sending' does not change; an unknown status is ignored.
  n := public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_w, 'status', 'failed', 'error', 'late'),
    jsonb_build_object('id', v_e, 'status', 'bogus')
  ));
  if n <> 0 or (select status from public.email_outbox where id = v_w) <> 'sent' then
    raise exception 'FAIL finish only sending rows: % updated', n;
  end if;
  if public.finish_outbox('[]'::jsonb) <> 0 or public.finish_outbox(null) <> 0 then
    raise exception 'FAIL finish empty input';
  end if;
end $$;

-- finish_outbox mirrors support_admin results into support_messages.notification_status.
do $$
declare
  v_msg uuid := current_setting('m1b.msg')::uuid;
  v_ids uuid[];
  v_a1_row uuid;
  v_a2_row uuid;
  v_msg2 uuid;
  v_f uuid;
  r record;
begin
  select array_agg(o.id) into v_ids from public.email_outbox o where o.idempotency_key like 'm1b:admin:' || v_msg || ':%';
  select o.id into v_a1_row from public.email_outbox o
  where o.idempotency_key = 'm1b:admin:' || v_msg || ':' || current_setting('m1b.a1');
  select o.id into v_a2_row from public.email_outbox o
  where o.idempotency_key = 'm1b:admin:' || v_msg || ':' || current_setting('m1b.a2');
  perform public.claim_outbox(v_ids);

  -- A retry does not touch the message.
  perform public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_a1_row, 'status', 'retrying', 'error', 'rate_limited')));
  if (select notification_status from public.support_messages where id = v_msg) <> 'pending' then
    raise exception 'FAIL mirror retrying leaves pending';
  end if;

  -- One copy sent: the message is 'sent'.
  perform public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_a2_row, 'status', 'sent', 'provider_id', 'prov-2')));
  select * into r from public.support_messages where id = v_msg;
  if r.notification_status <> 'sent' then
    raise exception 'FAIL mirror sent: %', r.notification_status;
  end if;

  -- The other copy fails later: the message stays 'sent'.
  perform public.claim_outbox(array[v_a1_row]);
  perform public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_a1_row, 'status', 'failed', 'error', 'http_400')));
  if (select notification_status from public.support_messages where id = v_msg) <> 'sent' then
    raise exception 'FAIL mirror never downgrades sent';
  end if;

  -- A message whose only copy fails is 'failed' with the reason.
  insert into public.support_messages (name, email, subject, message)
  values ('Visitor', 'visitor@clickit.local', 'Again', 'Second question')
  returning id into v_msg2;
  delete from public.admins where user_id = current_setting('m1b.a2')::uuid;
  select e.id into v_f
  from public.enqueue_email('support_admin', 'm1b:admin2:' || v_msg2, null, null, true,
    jsonb_build_object('message_id', v_msg2), 'en', null) e;
  perform public.claim_outbox(array[v_f]);
  perform public.finish_outbox(jsonb_build_array(
    jsonb_build_object('id', v_f, 'status', 'failed', 'error', 'max_attempts:server_error')));
  select * into r from public.support_messages where id = v_msg2;
  if r.notification_status <> 'failed' or r.notification_error <> 'max_attempts:server_error' then
    raise exception 'FAIL mirror failed: % %', r.notification_status, r.notification_error;
  end if;
end $$;

-- sweep_outbox: fails rows first attempted over 23 h ago; returns pending > 15 min,
-- retrying past next_attempt_at and sending with an expired lease; skips fresh and leased rows.
do $$
declare
  v_stale uuid; v_old uuid; v_new uuid; v_due uuid; v_later uuid; v_crash uuid; v_leased uuid;
  v_ret uuid[];
  r record;
begin
  insert into public.email_outbox (kind, idempotency_key, to_email, status, attempts, first_attempt_at, next_attempt_at)
  values ('support_ack', 'm1b:sw:stale', 'sw@clickit.local', 'retrying', 2, now() - interval '24 hours', now() - interval '1 hour')
  returning id into v_stale;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, created_at)
  values ('support_ack', 'm1b:sw:old', 'sw@clickit.local', 'pending', now() - interval '16 minutes')
  returning id into v_old;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, created_at)
  values ('support_ack', 'm1b:sw:new', 'sw@clickit.local', 'pending', now() - interval '5 minutes')
  returning id into v_new;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, attempts, first_attempt_at, next_attempt_at)
  values ('support_ack', 'm1b:sw:due', 'sw@clickit.local', 'retrying', 1, now() - interval '1 hour', now() - interval '1 minute')
  returning id into v_due;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, attempts, first_attempt_at, next_attempt_at)
  values ('support_ack', 'm1b:sw:later', 'sw@clickit.local', 'retrying', 1, now() - interval '1 hour', now() + interval '10 minutes')
  returning id into v_later;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, attempts, first_attempt_at, lease_until)
  values ('support_ack', 'm1b:sw:crash', 'sw@clickit.local', 'sending', 1, now() - interval '1 hour', now() - interval '1 minute')
  returning id into v_crash;
  insert into public.email_outbox (kind, idempotency_key, to_email, status, attempts, first_attempt_at, lease_until, created_at)
  values ('support_ack', 'm1b:sw:leased', 'sw@clickit.local', 'sending', 1, now(), now() + interval '4 minutes', now() - interval '30 minutes')
  returning id into v_leased;

  select array_agg(s) into v_ret from public.sweep_outbox(1000) s;

  select * into r from public.email_outbox where id = v_stale;
  if r.status <> 'failed' or r.last_error <> 'stale_over_23h' then
    raise exception 'FAIL sweep fails 24 h old first attempt: % %', r.status, r.last_error;
  end if;
  if v_stale = any(v_ret) then
    raise exception 'FAIL sweep does not return the failed row';
  end if;
  if not (v_old = any(v_ret)) then
    raise exception 'FAIL sweep returns 16-minute-old pending row';
  end if;
  if v_new = any(v_ret) then
    raise exception 'FAIL sweep skips 5-minute-old pending row';
  end if;
  if not (v_due = any(v_ret)) then
    raise exception 'FAIL sweep returns retrying past next_attempt_at';
  end if;
  if v_later = any(v_ret) then
    raise exception 'FAIL sweep skips retrying before next_attempt_at';
  end if;
  if not (v_crash = any(v_ret)) then
    raise exception 'FAIL sweep returns sending with an expired lease';
  end if;
  if v_leased = any(v_ret) then
    raise exception 'FAIL sweep skips a leased row';
  end if;
  if (select status from public.email_outbox where id = v_old) <> 'pending' then
    raise exception 'FAIL sweep leaves returned rows unchanged';
  end if;
  if (select count(*) from public.sweep_outbox(1)) <> 1 then
    raise exception 'FAIL sweep limit';
  end if;
end $$;

-- anon and authenticated: reading the tables and executing each function is denied.
do $$
declare
  v_role text;
  v_sql text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_sql in array array[
      'select 1 from public.email_outbox',
      'select 1 from public.notification_sends',
      'select 1 from public.digest_runs',
      'select public.enqueue_email(''support_ack'', ''m1b:deny'', null, ''deny@clickit.local'', false, ''{}''::jsonb, ''en'', null)',
      'select public.claim_welcome(gen_random_uuid(), ''en'')',
      'select public.claim_outbox(array[gen_random_uuid()])',
      'select public.finish_outbox(''[]''::jsonb)',
      'select public.sweep_outbox(10)',
      'select public.build_digest(now())'
    ] loop
      execute format('set local role %I', v_role);
      perform set_config('request.jwt.claims',
        json_build_object('sub', current_setting('m1b.conf'), 'role', v_role)::text, true);
      begin
        execute v_sql;
        reset role;
        raise exception 'FAIL % denied: % succeeded', v_role, v_sql;
      exception when insufficient_privilege then
        reset role;
      end;
    end loop;
  end loop;
end $$;

rollback;

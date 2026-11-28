begin;

-- Private OAuth state. The public RPC below is the only access path; every action
-- validates its own credentials because the REST endpoint is publicly reachable.
create table public.mcp_clients (
 id text primary key, name text not null, redirect_uris jsonb not null,
 created_at timestamptz not null default now(), fingerprint text not null unique
);
create table public.mcp_requests (
 id uuid primary key default gen_random_uuid(), client_id text not null references public.mcp_clients(id),
 redirect_uri text not null, challenge text not null, resource text not null, state text not null,
 expires_at timestamptz not null default now()+interval '10 minutes', code_hash text unique,
 user_id uuid references public.candidate_accounts(id) on delete cascade, decided boolean not null default false,
 consumed boolean not null default false
);
create table public.mcp_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.candidate_accounts(id) on delete cascade,
 client_id text not null references public.mcp_clients(id), resource text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days',
 revoked_at timestamptz
);
create table public.mcp_tokens (
 hash text primary key, connection_id uuid not null references public.mcp_connections(id) on delete cascade,
 kind text not null check(kind in ('access','refresh')), expires_at timestamptz not null, used_at timestamptz
);
create table public.mcp_rate_windows (bucket text not null, minute timestamptz not null, n int not null, primary key(bucket,minute));
create index mcp_requests_expiry on public.mcp_requests(expires_at);
create index mcp_connections_owner on public.mcp_connections(user_id,created_at desc);
create index mcp_tokens_expiry on public.mcp_tokens(expires_at);
alter table public.mcp_clients enable row level security;
alter table public.mcp_requests enable row level security;
alter table public.mcp_connections enable row level security;
alter table public.mcp_tokens enable row level security;
alter table public.mcp_rate_windows enable row level security;
revoke all on public.mcp_clients,public.mcp_requests,public.mcp_connections,public.mcp_tokens,public.mcp_rate_windows from public,anon,authenticated;
grant all on public.mcp_clients,public.mcp_requests,public.mcp_connections,public.mcp_tokens,public.mcp_rate_windows to service_role;

create function public.mcp_oauth(p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid; client public.mcp_clients%rowtype; req public.mcp_requests%rowtype;
 conn public.mcp_connections%rowtype; tok public.mcp_tokens%rowtype;
 identifier text; raw_code text; access_value text; refresh_value text; verifier text;
 redirect_value text; resource_value text; item text; result jsonb; hits int; rate_limit int;
 now_value timestamptz := now();
begin
 if p_action not in ('register','authorize','pending','approve','deny','exchange','refresh','validate','connections','disconnect','revoke')
   or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>16000 then return jsonb_build_object('error','invalid_request');end if;
 -- A bounded pilot-wide budget protects the private database, including direct RPC calls.
 rate_limit:=case when p_action='register' then 20 when p_action='validate' then 600 else 120 end;
 insert into public.mcp_rate_windows(bucket,minute,n) values(p_action,date_trunc('minute',now_value),1)
 on conflict(bucket,minute) do update set n=public.mcp_rate_windows.n+1 returning n into hits;
 if hits>rate_limit then return jsonb_build_object('error','slow_down');end if;
 insert into public.mcp_rate_windows(bucket,minute,n) values(p_action||':day',date_trunc('day',now_value),1) on conflict(bucket,minute) do update set n=public.mcp_rate_windows.n+1 returning n into hits;
 if hits>(case when p_action='validate' then 10000 when p_action='register' then 100 else 600 end) then return jsonb_build_object('error','slow_down');end if;

 if p_action='register' then
   if length(coalesce(p_input->>'client_name','')) not between 1 and 100 or jsonb_typeof(p_input->'redirect_uris')<>'array'
     or jsonb_array_length(p_input->'redirect_uris') not between 1 and 5
     or coalesce(p_input->>'token_endpoint_auth_method','none')<>'none'
     or exists(select 1 from jsonb_array_elements_text(coalesce(p_input->'grant_types','["authorization_code","refresh_token"]')) x where x not in ('authorization_code','refresh_token'))
     or exists(select 1 from jsonb_array_elements_text(coalesce(p_input->'response_types','["code"]')) x where x<>'code')
     then return jsonb_build_object('error','invalid_client_metadata');end if;
   for item in select jsonb_array_elements_text(p_input->'redirect_uris') loop
     if length(item)>2048 or item ~ '[[:space:]@#]' or not (
       item ~ '^https://([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:[0-9]{1,5})?(/[^[:space:]@#]*)?$' or
       item ~ '^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]{1,5})?(/[^[:space:]@#]*)?$'
     ) then return jsonb_build_object('error','invalid_redirect_uri');end if;
   end loop;
   delete from public.mcp_requests where id in (select id from public.mcp_requests where expires_at<now_value-interval '1 day' limit 100);
   delete from public.mcp_tokens where hash in (select hash from public.mcp_tokens where expires_at<now_value limit 100);
   delete from public.mcp_rate_windows where (bucket,minute) in (select bucket,minute from public.mcp_rate_windows where minute<now_value-interval '1 day' limit 100);
   select * into client from public.mcp_clients where fingerprint=encode(sha256(convert_to(jsonb_build_array(p_input->>'client_name',p_input->'redirect_uris')::text,'UTF8')),'hex');
   if client.id is null then
     if (select count(*) from (select id from public.mcp_clients limit 1000) capped)>=1000 then return jsonb_build_object('error','slow_down');end if;
     identifier:='cr_'||gen_random_uuid()::text;
     insert into public.mcp_clients(id,name,redirect_uris,fingerprint) values(identifier,p_input->>'client_name',p_input->'redirect_uris',encode(sha256(convert_to(jsonb_build_array(p_input->>'client_name',p_input->'redirect_uris')::text,'UTF8')),'hex')) on conflict(fingerprint) do update set name=excluded.name returning id into identifier;
   else identifier:=client.id;end if;
   return jsonb_build_object('client_id',identifier,'client_name',p_input->>'client_name','redirect_uris',p_input->'redirect_uris',
     'token_endpoint_auth_method','none','grant_types',jsonb_build_array('authorization_code','refresh_token'),'response_types',jsonb_build_array('code'));
 end if;

 if p_action='authorize' then
   select * into client from public.mcp_clients where id=p_input->>'client_id';
   redirect_value:=p_input->>'redirect_uri';resource_value:=p_input->>'resource';
   if client.id is null or not(client.redirect_uris ? coalesce(redirect_value,'')) then return jsonb_build_object('error','invalid_client');end if;
   if p_input->>'response_type' is distinct from 'code' or p_input->>'code_challenge_method' is distinct from 'S256'
     or coalesce(p_input->>'code_challenge','') !~ '^[A-Za-z0-9_-]{43}$'
     or coalesce(p_input->>'scope','catalogue:read')<>'catalogue:read'
     or length(coalesce(p_input->>'state',''))>1024
     or length(coalesce(resource_value,'')) not between 8 and 300
     then return jsonb_build_object('error','invalid_request');end if;
   insert into public.mcp_requests(client_id,redirect_uri,challenge,resource,state)
     values(client.id,redirect_value,p_input->>'code_challenge',resource_value,coalesce(p_input->>'state','')) returning * into req;
   return jsonb_build_object('request_id',req.id);
 end if;

 if p_action in ('pending','approve','deny','connections','disconnect') then
   owner_id:=public.current_candidate_id();
   if owner_id is null then return jsonb_build_object('error','login_required');end if;
   if p_action='connections' then
     select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
       select c.id,k.name as client_name,c.created_at,c.expires_at from public.mcp_connections c
       join public.mcp_clients k on k.id=c.client_id
       where c.user_id=owner_id and c.revoked_at is null and c.expires_at>now_value
       order by c.created_at desc limit 50
     ) x;return jsonb_build_object('connections',result);
   end if;
   if p_action='disconnect' then
     update public.mcp_connections set revoked_at=coalesce(revoked_at,now_value) where id=(p_input->>'connection_id')::uuid and user_id=owner_id;
     return jsonb_build_object('ok',true);
   end if;
   select * into req from public.mcp_requests where id=(p_input->>'request_id')::uuid for update;
   if req.id is null or req.decided or req.expires_at<=now_value then return jsonb_build_object('error','request_expired');end if;
   select * into client from public.mcp_clients where id=req.client_id;
   if p_action='pending' then return jsonb_build_object('client_name',client.name,'redirect_uri',req.redirect_uri,
     'scope','catalogue:read','expires_at',req.expires_at);end if;
   if p_action='deny' then
     update public.mcp_requests set decided=true where id=req.id;
     return jsonb_build_object('redirect_uri',req.redirect_uri,'state',req.state,'denied',true);
   end if;
   raw_code:=encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
   update public.mcp_requests set decided=true,user_id=owner_id,code_hash=encode(sha256(convert_to(raw_code,'UTF8')),'hex'),expires_at=now_value+interval '90 seconds' where id=req.id;
   return jsonb_build_object('redirect_uri',req.redirect_uri,'state',req.state,'code',raw_code);
 end if;

 if p_action='exchange' then
   verifier:=p_input->>'code_verifier';
   if coalesce(verifier,'') !~ '^[A-Za-z0-9._~-]{43,128}$' or length(coalesce(p_input->>'code',''))<>64 then return jsonb_build_object('error','invalid_grant');end if;
   select * into req from public.mcp_requests where code_hash=encode(sha256(convert_to(p_input->>'code','UTF8')),'hex') for update;
   if req.id is null or req.user_id is null or not req.decided or req.consumed or req.expires_at<=now_value
     or req.client_id is distinct from p_input->>'client_id' or req.redirect_uri is distinct from p_input->>'redirect_uri'
     or req.resource is distinct from p_input->>'resource'
     or req.challenge<>rtrim(translate(encode(sha256(convert_to(verifier,'UTF8')),'base64'),'+/','-_'),'=')
     then return jsonb_build_object('error','invalid_grant');end if;
   update public.mcp_requests set consumed=true where id=req.id;
   insert into public.mcp_connections(user_id,client_id,resource) values(req.user_id,req.client_id,req.resource) returning * into conn;
 elsif p_action in ('refresh','validate','revoke') then
   identifier:=case when p_action='refresh' then p_input->>'refresh_token' else p_input->>'token' end;
   if length(coalesce(identifier,''))<>64 then return jsonb_build_object('error','invalid_token');end if;
   select * into tok from public.mcp_tokens where hash=encode(sha256(convert_to(identifier,'UTF8')),'hex') for update;
   select * into conn from public.mcp_connections where id=tok.connection_id for update;
   if tok.hash is null or conn.id is null or conn.revoked_at is not null or conn.expires_at<=now_value or tok.expires_at<=now_value then return jsonb_build_object('error','invalid_token');end if;
   if p_action='revoke' then
     if conn.client_id=p_input->>'client_id' then update public.mcp_connections set revoked_at=now_value where id=conn.id;end if;
     return jsonb_build_object('ok',true);
   end if;
   if conn.resource is distinct from p_input->>'resource' then return jsonb_build_object('error','invalid_token');end if;
   if p_action='validate' then
     if tok.kind<>'access' then return jsonb_build_object('error','invalid_token');end if;
     return jsonb_build_object('user_id',conn.user_id,'connection_id',conn.id,'client_id',conn.client_id,'scope','catalogue:read');
   end if;
   if tok.kind<>'refresh' or conn.client_id is distinct from p_input->>'client_id' then return jsonb_build_object('error','invalid_grant');end if;
   if tok.used_at is not null then
     update public.mcp_connections set revoked_at=now_value where id=conn.id;
     return jsonb_build_object('error','invalid_grant');
   end if;
   update public.mcp_tokens set used_at=now_value where hash=tok.hash;
 else return jsonb_build_object('error','invalid_request');
 end if;

 access_value:=encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
 refresh_value:=encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
 insert into public.mcp_tokens(hash,connection_id,kind,expires_at) values
   (encode(sha256(convert_to(access_value,'UTF8')),'hex'),conn.id,'access',now_value+interval '15 minutes'),
   (encode(sha256(convert_to(refresh_value,'UTF8')),'hex'),conn.id,'refresh',least(now_value+interval '7 days',conn.expires_at));
 return jsonb_build_object('access_token',access_value,'refresh_token',refresh_value,'token_type','Bearer','expires_in',900,'scope','catalogue:read');
exception when invalid_text_representation or invalid_parameter_value or check_violation or foreign_key_violation or not_null_violation then
 return jsonb_build_object('error','invalid_request');
end $$;
revoke all on function public.mcp_oauth(text,jsonb) from public;
grant execute on function public.mcp_oauth(text,jsonb) to anon,authenticated;
comment on function public.mcp_oauth(text,jsonb) is 'OAuth public protocol entry: validates PKCE, exact redirect/resource binding and authenticated owner actions; no direct table grants.';
commit;

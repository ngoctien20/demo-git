// Emit a read-only PostgreSQL fixture replay using the SELECT from the candidate RPC.
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./owner-inbox.candidate.sql',import.meta.url),'utf8');
const query=source.split('$inbox$')[1].replace(/(?:public|tien404_r1_qa)\.(\w+)/g,'$1')
  .replaceAll('auth.uid()','trial.viewer').replace('s.id=p_store','s.id=trial.store');
console.log(`WITH
stores(id,tenant_id,store_key) AS (VALUES ('A','T','a'),('B','T','b')),
store_memberships(store_id,tenant_id,user_id,active,role) AS
  (VALUES ('A','T','Alice',true,'owner'),('B','T','Bob',true,'owner'),('A','T','Staff',true,'staff')),
tenant_identity_map(auth_tenant_id,tenant_key,store_key,bot_key) AS
  (VALUES ('T','qa','a','bot-a'),('T','qa','b','bot-b')),
shop_bots AS (SELECT m.*, 'synthetic_qa' identity_status,'dry_run' enabled_mode FROM tenant_identity_map m),
owner_bindings AS (SELECT b.*, 'paired' status, now()+interval '1 hour' expires_at, now()-interval '1 hour' paired_at,
  bot_key confirmed_challenge_id, bot_key owner_ref, bot_key recipient_ref FROM shop_bots b),
owner_pairing_challenges AS (SELECT p.*, bot_key challenge_id,now() used_at,
  CASE store_key WHEN 'a' THEN 'Alice' ELSE 'Bob' END requester_user_id FROM owner_bindings p),
sandbox_orders AS (SELECT p.*, bot_key||suffix order_key,'A001' sku,2 quantity,
  CASE store_key WHEN 'a' THEN 200000 ELSE 260000 END total_vnd,
  CASE suffix WHEN '-old' THEN now()-interval '2 hours' ELSE now() END created_at
  FROM owner_bindings p CROSS JOIN (VALUES ('-ok'),('-old'),('-other')) f(suffix)),
owner_outbox AS (SELECT o.tenant_key,o.store_key,o.bot_key,o.order_key,o.owner_ref recipient_owner_ref,
  CASE WHEN o.order_key LIKE '%-other' THEN 'elsewhere' ELSE o.recipient_ref END recipient_ref FROM sandbox_orders o),
trials(viewer,store,expected) AS (VALUES ('Alice','A','bot-a-ok'),('Alice','B',''),('Bob','B','bot-b-ok'),
  ('Bob','A',''),('Staff','A',''),(NULL,'A',''))
SELECT trial.viewer,trial.store,coalesce(string_agg(result.order_key,','),'')=trial.expected AS ok
FROM trials trial LEFT JOIN LATERAL (${query}) result ON true GROUP BY trial.viewer,trial.store,trial.expected;`);

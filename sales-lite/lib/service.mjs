import { createProofs, isVerified, parseOrder, parseOwner, codePattern, money, reject } from './protocol.mjs';
import { ownerNotice } from './owner-notice.mjs';
import { revenue, formatRevenue } from './report.mjs';

const scopeClause = '(tenant,store,bot)=($1,$2,$3)';
const route = (e) => [e.tenant, e.store, e.bot];
const exposed = 'code,sku,product_label,quantity,unit_vnd::text,total_vnd::text,status,created_at,revision';
const asSafe = (v) => {
  if (!/^[1-9]\d*$/.test(String(v)) || !Number.isSafeInteger(Number(v))) reject('PRICE_UNVERIFIED');
  return Number(v);
};
export function createSalesLite({ poolFor, proofKey, clock = Date.now }) {
  const proofs = createProofs(proofKey, clock);
  async function transaction(e, fn) {
    if (!isVerified(e)) reject('UNVERIFIED_INPUT');
    const db = await poolFor(e).connect();
    let broken = false;
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout='8s'");
      const access = await db.query(
        `SELECT a.alerts,a.access_until FROM sales_lite_qa.shop_access a JOIN tien404_r1_qa.shop_bots b
        ON (b.tenant_key,b.store_key,b.bot_key)=(a.tenant,a.store,a.bot)
        WHERE (a.tenant,a.store,a.bot)=($1,$2,$3) AND a.enabled AND a.access_until>clock_timestamp()
        AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'`,
        route(e)
      );
      if (access.rowCount !== 1) reject('SHOP_UNAVAILABLE');
      const result = await fn(db, access.rows[0]);
      await db.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await db.query('ROLLBACK');
      } catch {
        broken = true;
      }
      throw err;
    } finally {
      db.release(broken);
    }
  }
  async function binding(db, e) {
    const { rows } = await db.query(
      `SELECT tenant,store,bot,owner_ref,recipient_ref,binding_id,owner_user_id,auth_tenant_id FROM sales_lite_qa.verified_owners WHERE (tenant,store,bot)=($1,$2,$3)`,
      route(e)
    );
    return rows.length === 1 ? rows[0] : null;
  }
  async function owner(db, e) {
    const b = await binding(db, e);
    if (!b || (e.source==='dashboard_session' ? b.owner_user_id!==e.ownerUserId : b.recipient_ref!==e.recipientRef)) reject('OWNER_REQUIRED');
    if (e.authTenant && b.auth_tenant_id !== e.authTenant) reject('OWNER_REQUIRED');
    return b;
  }
  async function product(db, e, sku, quantity) {
    const { rows } = await db.query(
      `SELECT product_name,price_vnd,stock FROM tien404_r1_qa.catalog
      WHERE (tenant_key,store_key,bot_key)=($1,$2,$3) AND sku=$4`,
      [...route(e), sku]
    );
    if (rows.length !== 1) reject('PRODUCT_NOT_FOUND');
    const p = rows[0],
      price = asSafe(p.price_vnd);
    if (!Number.isInteger(p.stock) || p.stock < 0) reject('STOCK_UNVERIFIED');
    if (quantity > p.stock) reject('INSUFFICIENT_STOCK');
    if (
      typeof p.product_name !== 'string' ||
      !p.product_name.trim() ||
      p.product_name.length > 120 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e]/u.test(p.product_name)
    )
      reject('CATALOG_INVALID');
    const total = price * quantity;
    if (!Number.isSafeInteger(total)) reject('TOTAL_INVALID');
    return { sku, name: p.product_name, quantity, unitVnd: price, totalVnd: total, stock: p.stock };
  }
  async function previewIn(db, e) {
    const parsed = parseOrder(e.text);
    if (!parsed) return { state: 'NEEDS_DETAILS', message: 'Gửi mã hàng và số lượng, ví dụ A002 x 2.' };
    const p = await product(db, e, parsed.sku, parsed.quantity);
    return {
      state: 'AWAITING_CUSTOMER',
      ...p,
      message:
        p.sku + ' × ' + p.quantity + ' = ' + money(p.totalVnd) + '. Bạn xác nhận gửi yêu cầu đến chủ shop?',
      proof: proofs.issue('quote', e, {
        origin: e.eventHash,
        sku: p.sku,
        quantity: p.quantity,
        price: p.unitVnd
      })
    };
  }
  const preview = (e) => transaction(e, (db) => previewIn(db, e));
  async function saveIn(db, access, e, proof, confirmation = e.text) {
    if (confirmation.trim().toLocaleLowerCase('vi') !== 'xác nhận') reject('EXPLICIT_CONFIRMATION_REQUIRED');
    const q = proofs.read('quote', e, proof),
      params = [...route(e), e.source, e.eventHash, q.origin];
    if (q.origin === e.eventHash) reject('SEPARATE_CONFIRMATION_REQUIRED');
    async function existing() {
      const { rows } = await db.query(
        `SELECT ${exposed},actor_hash,quote_event FROM sales_lite_qa.requests WHERE ${scopeClause}
          AND source=$4 AND (event_hash=$5 OR quote_event=$6)`,
        params
      );
      if (!rows.length) return null;
      if (rows.length !== 1 || rows[0].actor_hash !== e.actorHash || rows[0].quote_event !== q.origin)
        reject('EVENT_CONFLICT');
      const { actor_hash, quote_event, ...request } = rows[0];
      return { state: 'ALREADY_SAVED', request };
    }
    const prior = await existing();
    if (prior) return prior;
    if (q.expired) reject('QUOTE_EXPIRED');
    const p = await product(db, e, q.sku, q.quantity);
    if (p.unitVnd !== q.price) reject('PRICE_CHANGED');
    for (let attempt = 0; attempt < 3; attempt++) {
      const saved = await db.query(
        `INSERT INTO sales_lite_qa.requests
          (tenant,store,bot,source,event_hash,quote_event,actor_hash,sku,product_label,quantity,unit_vnd)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING RETURNING id,${exposed}`,
        [...params, e.actorHash, p.sku, p.name, p.quantity, p.unitVnd]
      );
      if (!saved.rowCount) {
        const found = await existing();
        if (found) return found;
        continue;
      }
      const { id, ...request } = saved.rows[0];
      const b = access.alerts ? await binding(db, e) : null;
      await db.query(
        `INSERT INTO sales_lite_qa.owner_alerts(tenant,store,bot,request_id,owner_ref,recipient_ref,binding_id)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [...route(e), id, b?.owner_ref ?? null, b?.recipient_ref ?? null,b?.binding_id??null]
      );
      return { state: 'SAVED', request };
    }
    reject('CODE_COLLISION_RETRY');
  }
  const save = (e, proof) => transaction(e, (db, access) => saveIn(db, access, e, proof));
  async function findRequest(db, e, code, lock = false) {
    if (!codePattern.test(code)) reject('REQUEST_NOT_FOUND');
    const { rows } = await db.query(
      `SELECT id,source,${exposed} FROM sales_lite_qa.requests WHERE ${scopeClause} AND code=$4 ${lock ? 'FOR UPDATE' : ''}`,
      [...route(e), code]
    );
    if (rows.length !== 1) reject('REQUEST_NOT_FOUND');
    return rows[0];
  }
  async function commandIn(db, e, actionProof = null, text = e.text) {
    const currentOwner=await owner(db,e);
    const c = parseOwner(text);
    if (!c) reject('UNKNOWN_COMMAND');
    if (['revenue', 'summary'].includes(c.action)) {
      const report = await revenue(db, route(e), c.period, new Date(clock()));
      return { state: 'REPORT', report, message: formatRevenue(report) };
    }
    if (c.action === 'new') {
      const { rows } = await db.query(
        `SELECT ${exposed} FROM sales_lite_qa.requests WHERE ${scopeClause} AND status='NEW_PENDING_OWNER' ORDER BY created_at DESC,id DESC LIMIT 50`,
        route(e)
      );
      const lines = rows
        .slice(0, 8)
        .map((r) => r.code + ' · ' + r.sku + ' × ' + r.quantity + ' · ' + money(r.total_vnd));
      const message = lines.length
        ? [
            'Yêu cầu chờ xác nhận',
            ...lines,
            ...(rows.length > 8 ? ['Mở Đơn mới trên Dashboard để xem tiếp.'] : [])
          ].join('\n')
        : 'Chưa có yêu cầu chờ xác nhận.';
      return { state: 'LIST', requests: rows, message };
    }
    const req = await findRequest(db, e, c.code, Boolean(actionProof));
    const { id, ...request } = req;
    if (c.action === 'detail') {
      const labels = {
        NEW_PENDING_OWNER: 'Chờ chủ shop xác nhận',
        OWNER_CONFIRMED: 'Đã xác nhận',
        CANCELLED: 'Đã từ chối',
        PAID: 'Đã thanh toán'
      };
      return {
        state: 'DETAIL',
        request,
        message: [
          req.code,
          req.sku + ' × ' + req.quantity + ' · ' + money(req.total_vnd),
          labels[req.status]
        ].join('\n')
      };
    }
    if (!actionProof) {
      if (req.status !== 'NEW_PENDING_OWNER') reject('INVALID_STATE');
      return {
        state: 'OWNER_CONFIRMATION_REQUIRED',
        request,
        action: c.action,
        proof: proofs.issue('owner', e, {
          action: c.action,
          code: req.code,
          revision: req.revision,
          bindingId: currentOwner.binding_id,
          origin: e.eventHash
        })
      };
    }
    const q = proofs.read('owner', e, actionProof);
    if (q.bindingId!==currentOwner.binding_id || q.action !== c.action || q.code !== c.code || q.origin === e.eventHash)
      reject('INVALID_CONFIRMATION');
    const check = await db.query(
      `SELECT request_id,decision,owner_hash FROM sales_lite_qa.decisions WHERE ${scopeClause} AND event_hash=$4`,
      [...route(e), e.eventHash]
    );
    if (check.rowCount) {
      const old = check.rows[0];
      if (old.request_id !== id || old.decision !== c.action || old.owner_hash !== e.actorHash)
        reject('EVENT_CONFLICT');
      return { state: 'ALREADY_DECIDED', request };
    }
    if (q.expired) reject('CONFIRMATION_EXPIRED');
    if (q.revision !== req.revision || req.status !== 'NEW_PENDING_OWNER') reject('STALE_DECISION');
    if (c.action === 'confirm') {
      // QA stock is a fixed baseline. Serialize owner reservations per shop/SKU; the provider stock remains untouched.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        JSON.stringify([...route(e), req.sku])
      ]);
      const p = await product(db, e, req.sku, req.quantity);
      if (BigInt(p.unitVnd) !== BigInt(req.unit_vnd)) reject('PRICE_CHANGED');
      const {
        rows: [{ used }]
      } = await db.query(
        `SELECT coalesce(sum(quantity),0)::text AS used FROM sales_lite_qa.requests
          WHERE ${scopeClause} AND sku=$4 AND status IN ('OWNER_CONFIRMED','PAID')`,
        [...route(e), req.sku]
      );
      if (BigInt(p.stock) - BigInt(used) < BigInt(req.quantity)) reject('INSUFFICIENT_STOCK');
    }
    const next = c.action === 'confirm' ? 'OWNER_CONFIRMED' : 'CANCELLED';
    await db.query(
      `INSERT INTO sales_lite_qa.decisions(tenant,store,bot,request_id,decision,owner_hash,event_hash,was,became)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [...route(e), id, c.action, e.actorHash, e.eventHash, req.status, next]
    );
    const changed = await db.query(
      `UPDATE sales_lite_qa.requests SET status=$5,revision=revision+1 WHERE ${scopeClause} AND id=$4 RETURNING ${exposed}`,
      [...route(e), id, next]
    );
    return { state: 'DECIDED', request: changed.rows[0] };
  }
  const command = (e, proof) => transaction(e, (db) => commandIn(db, e, proof));
  async function dashboard(e, { tab = 'new', period = 'today', before = null } = {}) {
    return transaction(e, async (db, access) => {
      await owner(db, e);
      if (tab === 'revenue') return { report: await revenue(db, route(e), period, new Date(clock())) };
      if (tab === 'settings')
        return {
          shop: e.store,
          botPaired: true,
          alertsEnabled: access.alerts,
          mode: 'SHADOW',
          subscription: 'ACTIVE_QA',
          accessUntil: access.access_until
        };
      if (!['new', 'orders'].includes(tab)) reject('INVALID_TAB');
      if (before !== null && !codePattern.test(before)) reject('INVALID_CURSOR');
      const { rows } = await db.query(
        `SELECT ${exposed} FROM sales_lite_qa.requests r WHERE ${scopeClause}
        AND ($4::text='orders' OR status='NEW_PENDING_OWNER')
        AND ($5::text IS NULL OR (r.created_at,r.id)<(SELECT x.created_at,x.id FROM sales_lite_qa.requests x
        WHERE (x.tenant,x.store,x.bot)=($1,$2,$3) AND x.code=$5)) ORDER BY created_at DESC,id DESC LIMIT 26`,
        [...route(e), tab, before]
      );
      const list = rows.slice(0, 25);
      return { requests: list, next: rows.length > 25 ? list.at(-1).code : null };
    });
  }
  async function setAlerts(e, enabled) {
    if (typeof enabled !== 'boolean') reject('INVALID_SETTING');
    return transaction(e, async (db) => {
      await owner(db, e);
      const written = await db.query(
        `INSERT INTO sales_lite_qa.settings_audit(tenant,store,bot,event_hash,owner_hash,alerts)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING alerts`,
        [...route(e), e.eventHash, e.actorHash, enabled]
      );
      if (!written.rowCount) {
        const {
          rows: [old]
        } = await db.query(
          `SELECT alerts,owner_hash FROM sales_lite_qa.settings_audit WHERE ${scopeClause} AND event_hash=$4`,
          [...route(e), e.eventHash]
        );
        if (old?.alerts !== enabled || old.owner_hash !== e.actorHash) reject('EVENT_CONFLICT');
        return { state: 'ALREADY_APPLIED' };
      }
      await db.query(`UPDATE sales_lite_qa.shop_access SET alerts=$4 WHERE ${scopeClause}`, [
        ...route(e),
        enabled
      ]);
      return { state: 'APPLIED', outbound: false };
    });
  }
  // This path has no transport. Only explicit synthetic provider outcomes can be recorded.
  async function shadow(e, code, outcome = 'PREVIEW') {
    return transaction(e, async (db, access) => {
      const bindingNow = await owner(db, e),
        req = await findRequest(db, e, code);
      const {
        rows: [a]
      } = await db.query(
        `SELECT * FROM sales_lite_qa.owner_alerts WHERE ${scopeClause} AND request_id=$4 FOR UPDATE`,
        [...route(e), req.id]
      );
      if(!a||a.binding_id!==bindingNow.binding_id)reject('RECIPIENT_UNAVAILABLE');
      const message = ownerNotice(
        { ...req, tenant: e.tenant, store: e.store, bot: e.bot, source: req.source },
        a,
        bindingNow,
        access.alerts
      );
      if (outcome === 'PREVIEW')
        return { state: a.state, message, attempts: a.attempt_count, sent: 0, read: false };
      const mapping = {
        API_ACCEPTED: 'SIM_ACCEPTED',
        TIMEOUT: 'SIM_UNKNOWN',
        NOT_ACCEPTED_RETRYABLE: 'SIM_RETRYABLE',
        REJECTED: 'SIM_REJECTED'
      };
      if (!Object.hasOwn(mapping, outcome)) reject('UNSUPPORTED_OUTCOME');
      const prior = await db.query(
        `SELECT request_id,outcome FROM sales_lite_qa.alert_attempts WHERE ${scopeClause} AND event_hash=$4`,
        [...route(e), e.eventHash]
      );
      if (prior.rowCount) {
        if (prior.rows[0].request_id !== req.id || prior.rows[0].outcome !== outcome)
          reject('EVENT_CONFLICT');
        return { state: a.state, attempts: a.attempt_count, sent: 0, read: false };
      }
      if (!['HELD', 'SIM_RETRYABLE'].includes(a.state) || a.attempt_count >= 3)
        return { state: a.state, attempts: a.attempt_count, sent: 0, read: false };
      if (req.status !== 'NEW_PENDING_OWNER') reject('REQUEST_NO_LONGER_PENDING');
      if (a.retry_after && a.retry_after.getTime() > clock())
        return { state: 'WAIT_BACKOFF', attempts: a.attempt_count, sent: 0, read: false };
      const next =
        a.attempt_count === 2 && outcome === 'NOT_ACCEPTED_RETRYABLE' ? 'SIM_REJECTED' : mapping[outcome];
      const n = a.attempt_count + 1;
      await db.query(
        `INSERT INTO sales_lite_qa.alert_attempts(tenant,store,bot,request_id,event_hash,attempt_no,outcome)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [...route(e), req.id, e.eventHash, n, outcome]
      );
      await db.query(
        `UPDATE sales_lite_qa.owner_alerts SET state=$5,attempt_count=$6,last_outcome=$7,retry_after=$8
        WHERE ${scopeClause} AND request_id=$4`,
        [
          ...route(e),
          req.id,
          next,
          n,
          outcome,
          next === 'SIM_RETRYABLE' ? new Date(clock() + 30000 * n) : null
        ]
      );
      return { state: next, attempts: n, sent: 0, read: false };
    });
  }
  // An ingress event can be delivered to this adapter more than once. Serialize a conversation
  // across database connections and commit its receipt together with any business write.
  async function receive(e) {
    return transaction(e, async (db, access) => {
      const text = e.text.trim(),
        lane = text.startsWith('/') ? 'owner' : 'customer';
      if (lane === 'owner') await owner(db, e);
      const scope = [...route(e), e.actorHash, lane];
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(scope)]);
      const receipt = await db.query(
        `SELECT actor_hash,payload_hash,lane,code FROM sales_lite_qa.channel_receipts
        WHERE ${scopeClause} AND event_hash=$4`,
        [...route(e), e.eventHash]
      );
      if (receipt.rowCount) {
        const old = receipt.rows[0];
        if (old.actor_hash !== e.actorHash || old.lane !== lane || old.payload_hash !== e.payloadHash)
          reject('EVENT_CONFLICT');
        if (!old.code) return { state: 'REPLAY_IGNORED' };
        const { id, ...request } = await findRequest(db, e, old.code);
        return { state: lane === 'customer' ? 'ALREADY_SAVED' : 'ALREADY_DECIDED', request };
      }
      const session = (
        await db.query(
          `SELECT last_ms,pending,until_at,last_code FROM sales_lite_qa.chat_sessions
        WHERE ${scopeClause} AND actor_hash=$4 AND lane=$5`,
          scope
        )
      ).rows[0];
      if (session && e.receivedAt < Number(session.last_ms)) reject('OUT_OF_ORDER');
      const valid = session?.until_at && Number(session.until_at) > clock();
      let pending = null,
        until = null,
        code = null,
        response;
      if (lane === 'owner') {
        const choice = text.toUpperCase().match(/^\/DONGY (T404-[0-9A-F]{16})$/);
        if (choice) {
          if (!valid || session.pending?.code !== choice[1]) reject('CONFIRMATION_EXPIRED');
          const facts = session.pending;
          const proof = proofs.issue('owner', e, { ...facts, until: Number(session.until_at) });
          response = await commandIn(
            db,
            e,
            proof,
            (facts.action === 'confirm' ? '/xacnhan ' : '/tuchoi ') + facts.code
          );
          code = response.request.code;
        } else {
          response = await commandIn(db, e);
          if (response.proof) {
            const p = proofs.read('owner', e, response.proof);
            pending = { action: p.action, code: p.code, revision: p.revision, origin: p.origin,bindingId:p.bindingId };
            until = p.until;
            response.message =
              'Gửi /dongy ' +
              p.code +
              ' để ' +
              (p.action === 'confirm' ? 'xác nhận' : 'từ chối') +
              ' yêu cầu này trong 5 phút.';
          }
        }
      } else if (/^xác nhận(?:$|\s)/iu.test(text)) {
        const details = text.slice('xác nhận'.length).trim();
        const selected = details ? parseOrder(details) : null;
        if (!valid) reject('QUOTE_EXPIRED');
        if (
          (details || session.pending?.changed) &&
          (!selected ||
            !session.pending ||
            session.pending.sku !== selected.sku ||
            session.pending.quantity !== selected.quantity)
        )
          reject('QUOTE_SELECTION_REQUIRED');
        if (session.last_code) {
          const { id, ...request } = await findRequest(db, e, session.last_code);
          response = { state: 'ALREADY_SAVED', request };
        } else {
          if (!session.pending) reject('EXPLICIT_CONFIRMATION_REQUIRED');
          const proof = proofs.issue('quote', e, { ...session.pending, until: Number(session.until_at) });
          response = await saveIn(db, access, e, proof, 'xác nhận');
        }
        code = response.request.code;
        until = Number(session.until_at);
      } else {
        try {
          response = await previewIn(db, e);
        } catch (error) {
          if (
            ![
              'PRODUCT_NOT_FOUND',
              'INSUFFICIENT_STOCK',
              'PRICE_UNVERIFIED',
              'STOCK_UNVERIFIED',
              'TOTAL_INVALID',
              'CATALOG_INVALID'
            ].includes(error.code)
          )
            throw error;
          response = {
            state: 'NEEDS_DETAILS',
            reason: error.code,
            message: 'Chưa thể báo giá yêu cầu này. Vui lòng kiểm tra mã hàng và số lượng.'
          };
        }
        if (response.proof) {
          const p = proofs.read('quote', e, response.proof);
          const changed = Boolean(
            valid &&
              session.pending &&
              (session.pending.changed ||
                p.sku !== session.pending.sku ||
                p.quantity !== session.pending.quantity)
          );
          pending = { origin: p.origin, sku: p.sku, quantity: p.quantity, price: p.price, changed };
          until = p.until;
          if (changed)
            response.message =
              'Yêu cầu mới ' +
              p.sku +
              ' × ' +
              p.quantity +
              ' = ' +
              money(response.totalVnd) +
              '. Gửi “xác nhận ' +
              p.sku +
              ' x ' +
              p.quantity +
              '” để chọn yêu cầu này.';
        }
      }
      if (lane === 'customer' && code)
        response.message = 'Đã lưu yêu cầu ' + code + '. Bạn có thể dùng mã này khi liên hệ cửa hàng.';
      const { proof, ...visible } = response;
      await db.query(
        `INSERT INTO sales_lite_qa.chat_sessions(tenant,store,bot,actor_hash,lane,last_ms,pending,until_at,last_code)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant,store,bot,actor_hash,lane) DO UPDATE
        SET last_ms=EXCLUDED.last_ms,pending=EXCLUDED.pending,until_at=EXCLUDED.until_at,last_code=EXCLUDED.last_code`,
        [...scope, e.receivedAt, pending, until, code]
      );
      await db.query(
        `INSERT INTO sales_lite_qa.channel_receipts(tenant,store,bot,event_hash,actor_hash,payload_hash,lane,code)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [...route(e), e.eventHash, e.actorHash, e.payloadHash, lane, code]
      );
      return visible;
    });
  }
  return Object.freeze({ receive, preview, save, command, dashboard, shadow, setAlerts });
}

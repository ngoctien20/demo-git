# V18.3.6D — Tenant / Store Membership Contract

## 1. Authority separation

| Scope | Source of truth | Purpose |
|---|---|---|
| User identity | Supabase Auth verified subject | Who is acting |
| Tenant role | `public.tenant_memberships` | Organization administration |
| Store role | `public.store_memberships` | Store data access and operations |
| Channel authority | Private verified installation registry | Provider-originated Store context |
| Commerce ownership | `tenant_id + store_id` on every business row | Data boundary |

A Tenant role is not a Store role. A Store role is not a provider installation. No layer may infer the next layer from a user-supplied ID.

## 2. Role contract

### Tenant Owner

Allowed:
- create, suspend and archive Stores in the Tenant;
- appoint/revoke Store Owners;
- manage Tenant settings, subscription and billing;
- view Store registry and membership administration metadata.

Not automatically allowed:
- read Store customer, order, inventory, conversation or message rows;
- send messages as a Store;
- access a Store's provider secret.

To operate/read a Store's Commerce data, the Tenant Owner must also have an explicit active Store membership. A separate cross-Store reporting capability may be designed later with aggregation and audit; it is not implied by Tenant ownership.

### Store Owner

Allowed within their Store:
- read and manage catalog, inventory, customers, orders and support operations;
- connect/revoke that Store's provider installations;
- invite, suspend and revoke Managers/Staff;
- review Store audit and notification status.

Not allowed:
- read or administer another Store;
- change Tenant billing/ownership;
- create a new Store;
- appoint another Store Owner without Tenant Owner approval;
- access raw provider credentials or secret material.

### Manager

Allowed within their Store:
- read operational records;
- manage catalog, price rules and inventory through approved operations;
- create/manage orders and support work;
- see channel connection status and delivery diagnostics.

Not allowed:
- Tenant billing;
- Store lifecycle;
- Store Owner promotion;
- membership administration unless explicitly delegated in a future permission;
- raw credentials or unrestricted secret references.

### Staff

Allowed within their Store:
- read the catalog;
- view Store orders needed for day-to-day fulfilment;
- create orders through the atomic order operation;
- read permitted conversation context and send a response through the trusted channel runtime.

Not allowed by direct table DML:
- change product price or inventory;
- enumerate the Store customer directory;
- change owner/manager membership;
- physically delete records;
- directly rewrite order totals, Tenant IDs or Store IDs.

Staff order status changes, if required, use a narrow transition operation with allowed state transitions and audit. They do not receive broad `UPDATE orders` table permission.

## 3. Default access matrix

| Resource / capability | Tenant Owner without Store membership | Store Owner | Manager | Staff |
|---|---|---|---|---|
| Tenant settings / billing | Manage | No | No | No |
| Store registry | Manage all Tenant Stores | Read own Store | Read own Store metadata | Minimal own Store metadata |
| Store membership roster | Manage | Manage Manager/Staff in own Store | No | Own membership only |
| Products | No Commerce rows | Full Store read/write | Read/write | Read |
| Customers | No Commerce rows | Full Store read/write | Read/write | No directory access |
| Orders | No Commerce rows | Full Store operations | Full operational management | Read + create via command; limited transition via command |
| Order items | No Commerce rows | Read + transactional writes | Read + transactional writes | Read + transactional create only |
| Conversations / messages | No Commerce rows | Full Store operations | Operational read/write | Limited read/reply via trusted command |
| Provider installation status | Tenant-level roster metadata only | Manage own Store | Read status | No |
| Provider secrets | No | Never raw secret | Never raw secret | Never raw secret |
| Physical DELETE | No | No direct delete | No | No |

All roles remain subject to the Store RLS boundary. A Tenant Owner who is also a Store Owner must have a separate explicit Store membership for each Store they access.

## 4. Membership lifecycle

Allowed states:
- `invited`
- `active`
- `suspended`
- `revoked`
- `expired`

State changes:
- `invited → active`: invite accepted and required approval recorded.
- `active → suspended`: temporary access hold; no Store data access.
- `active → revoked`: immediate access removal.
- `active → expired`: expiry reached; access denied even if cleanup job has not run.
- `suspended → active`: authorized reactivation with audit.
- `revoked` is terminal; create a new membership row only through a reviewed re-invitation flow if the schema later supports history rows.

The current design stores one current row per `tenant_id + store_id + user_id`; append all state transitions to a private, append-only authority audit table. Never delete the membership row to revoke access.

## 5. Who may grant what

| Actor | Grant Staff | Grant Manager | Grant Store Owner | Revoke self | Revoke other Store Owner |
|---|---:|---:|---:|---:|---:|
| Tenant Owner | Yes | Yes | Yes | By separate tenant owner action | Yes, with replacement owner in same transaction |
| Store Owner | Yes | Yes | No | No if it would leave Store without owner | No |
| Manager | No | No | No | No | No |
| Staff | No | No | No | No | No |

No actor may remove/demote the final active Store Owner while the Store remains active. Owner transfer must be atomic: appoint replacement, verify active membership, then revoke/demote prior owner in the same transaction.

## 6. Channel installation contract

- A verified provider installation is bound to exactly one Tenant + Store.
- The installation itself receives only the capabilities explicitly approved for that provider and Store.
- The channel sender/customer ID is not a Store authority.
- A provider signature must be validated before mapping the external account ID.
- Replayed event IDs are rejected by installation-scoped idempotency.
- Revoked/suspended installation or missing capability fails closed.
- No secret is returned to a browser, chat transcript, n8n DataTable, GitHub artifact or execution log.

## 7. Session and identity rules

- Use `auth.uid()` for the signed-in actor inside database policies.
- Do not authorize from `user_metadata`, customer messages, query parameters or browser-supplied Store IDs.
- For sensitive owner changes, require a recent/active server-verified session according to the project's Auth session revocation policy.
- Do not paste JWTs, refresh tokens, cookies, raw session IDs or customer PII into QA evidence.
- A deleted or disabled Auth user must not retain effective Store membership; revoke memberships and transfer Store ownership before deletion.

## 8. Fail-closed cases

Deny if any of these is true:
- no Auth actor or invalid/expired session;
- no active Store membership;
- membership suspended, revoked or expired;
- Store suspended or archived;
- Tenant ID does not match Store's Tenant ID;
- Store membership is for a different Store;
- provider installation missing, duplicate, unverified, revoked or mismatched;
- capability not granted;
- request context is missing, expired, replayed or has a mismatched authority version;
- attempted Tenant/Store reassignment on an existing row.

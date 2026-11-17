// Snapshot of existing live Zalo staging EXT03 marker before V17.19 patch.
// Source: n8n yIJk8LvJoLF40Z62 Published version 776486b2-092f-49ec-a7c4-f74ec8b60f07
// Node: Build EXT03 Sanitized Markers V12.3. Do NOT execute as production code.
const e=$('Bind Trusted Staging Bot Identity V12.3').first()?.json||{};
if(e.stage!=='READ_ONLY'||e.accepted!==true||e.text!=='TIEN404 EXT 03')return [];
const result=$input.first()?.json||{};
const ok=result.status==='PUBLIC_CUSTOMER_EVENT_ACCEPTED'&&result.route==='CUSTOMER'&&result.qa_ext03_match===true&&result.external_sends===0&&result.orders_written===0;
const t=new Date().toISOString();
return [{json:{slot:'v123_ext03_ingress',outcome:'SEEN_AUTHENTICATED_WEBHOOK',observed_at:t}},{json:{slot:'v123_ext03_customer',outcome:ok?'CUSTOMER_ROUTE_ELIGIBLE':'NOT_ACCEPTED_BY_CUSTOMER_ROUTER',observed_at:t}}];

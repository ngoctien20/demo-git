# TIEN404 — V17.9 Staff Commercial Google Sheet Template (no Dashboard)
**Date:** 2026-11-17 JST. **Owner instruction:** Do not build Dashboard yet; deliver actual simple commercial staff entry Sheet.

## IMPLEMENTED — native Google Sheet, separate from all DEMO and QA
- [TIEN404 COMMERCE - MAU NHAP LIEU NHAN SU - CHUA KET NOI LIVE](https://docs.google.com/spreadsheets/d/1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw/edit).
- Native Google Sheets ID: `1siR8y7lxrYch8w6P1CVn5ta6XdWpYX9NJ384Yb1kujw`. Created as a blank, not-shared merchant staff entry template. **No real/synthetic commercial records retained**. Independent of published Messenger DEMO and legacy QA Sheet IDs.
- Exactly four tabs: `BAT_DAU` (plain Vietnamese operating steps, security note), `SAN_PHAM` (SKU/name, retail price, stock, status, unit, image; wholesale price/minimum quantity columns hidden but preserved), `DON_HANG` (one order row: customer info optional and blank, status, channel, confirmation, payment, staff, calculated total), `CHI_TIET_DON` (one line per SKU per order, fixed agreed unit price, subtotal, retail/wholesale indicator).
- Separate order headers and items for multi-SKU orders; no invented fake orders or customers. Validation dropdowns for status/channel/confirmation/payment, numeric validation, frozen headers, filters, money formatted vi_VN; formula ranges: `DON_HANG!K2:K201`, `CHI_TIET_DON!F2:F501`, with warning-only formula protection.
- No duplicate `price`/`price_clean` fields visible to staff; enter integer VND in one price field. No tenant UUID/store_id credentials in the merchant spreadsheet. No separate Customer data tab to minimize PII duplication.

## TESTED — in native Google Sheets, not an Excel-only assumption
- Connected Sheets readback: exactly four expected native tabs, empty Products/Orders/Items; locale `vi_VN`, spreadsheet file `shared=false`.
- Detected and corrected formula parser errors caused by Vietnamese locale: semicolon-separated functions now correctly parsed. Explicit row references were applied for all 200 order totals and 500 line subtotals.
- On the actual new Sheet, entered temporary synthetic test order `__QA_TEMP_ONLY__` with two items (2 × 159000 and 1 × 25000); before adding lines, order total reported `THIẾU MẶT HÀNG`; after adding, line totals 318000 and 25000, order sum exactly **343000 VND**.
- All synthetic test values cleared in a `finally` action; readback verified no remaining synthetic order/product records, formula cells remain.
- Existing legacy workflows and published Messenger were not modified, no real order/payment made, no Meta/Zalo send, Auth or Supabase hosted migration.

## SECURITY / COMMERCE NO-GO
This is a **CANDIDATE TEMPLATE** not a production data store. Google Sheets file-level sharing does NOT provide per-role/per-tenant Store isolation; staff sharing and real customer/order data intake remain prohibited until permissions and privacy requirements pass. Recommended eventual system-of-record is Store-protected backend; Sheet per shop may be used as optional import/temporary controlled manual pilot after authorization and data protection acceptance. Never use the Sheet's labels or users' typed Shop IDs as trusted backend authority. No automatic stock deduction, customer-confirmation enforcement or durable order transaction implemented by this file; preserve established M0/M1/M3/JWT gates and separate approval. Do not promote by renaming the file.

## Decision, rollback and next
- **VERIFIED:** a new private native spreadsheet exists, unrelated to old DEMO/QA.
- **IMPLEMENTED:** four minimal role-friendly tabs, calculated money, input validations; no dashboard.
- **TESTED:** real native formula and cleanup QA succeeded; **not** production concurrency, multi-employee permission, live bot or restore acceptance.
- **BLOCKED:** per-Shop actual role access, real PII handling, order-commit workflow, Store JWT/RLS and M0 independent recovery.
- **ROLLBACK:** safe to archive or delete this new candidate only after user approval; original DEMO/QA/backup untouched. Git PR #251 remains Draft.

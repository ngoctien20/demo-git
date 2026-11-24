-- Rollback for 0002_keys_shared_flow.sql. First deploy the previous Worker and disconnect every 'shared' row
-- (POST /v1/admin/disconnect): the previous Worker has no shared flow and would forward them nowhere.
ALTER TABLE zh_connections DROP COLUMN flow_mode;
ALTER TABLE zh_connections DROP COLUMN inbound_key_sealed;

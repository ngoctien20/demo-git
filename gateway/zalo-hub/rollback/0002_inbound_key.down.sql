-- Rollback for 0002_inbound_key.sql (deploy the previous Worker first; rows fall back to the forward_key header).
ALTER TABLE zh_connections DROP COLUMN inbound_key_sealed;

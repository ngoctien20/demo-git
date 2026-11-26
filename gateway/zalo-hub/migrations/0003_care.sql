-- Private customer inbox. Store/connection are resolved by authenticated ingress.
CREATE TABLE zh_care_contacts(store TEXT PRIMARY KEY, phone TEXT NOT NULL, zalo TEXT NOT NULL);
CREATE TABLE zh_care_controls(
 id INTEGER PRIMARY KEY, store TEXT NOT NULL, conn TEXT NOT NULL, chat TEXT NOT NULL,
 paused INTEGER NOT NULL CHECK(paused IN (0,1)), actor TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX zh_care_scope ON zh_care_controls(store,conn,chat,id DESC);
CREATE TABLE zh_care_messages(
 id INTEGER PRIMARY KEY, store TEXT NOT NULL, conn TEXT NOT NULL, chat TEXT NOT NULL,
 event TEXT NOT NULL, name TEXT, content TEXT NOT NULL, at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', reply TEXT, UNIQUE(conn,event)
);
CREATE INDEX zh_care_history ON zh_care_messages(store,conn,chat,id);
CREATE TRIGGER zh_care_ingress AFTER INSERT ON zh_care_messages
WHEN COALESCE((SELECT paused FROM zh_care_controls WHERE store=NEW.store AND conn='' AND chat='' ORDER BY id DESC LIMIT 1),0)
 OR COALESCE((SELECT paused FROM zh_care_controls WHERE store=NEW.store AND conn=NEW.conn AND chat=NEW.chat ORDER BY id DESC LIMIT 1),0)
BEGIN UPDATE zh_care_messages SET state='suppressed' WHERE id=NEW.id; END;
-- A pause is acknowledged only once any provider request already in flight has settled.
CREATE TRIGGER zh_care_pause BEFORE INSERT ON zh_care_controls WHEN NEW.paused=1
BEGIN
 SELECT RAISE(ABORT,'SEND_IN_FLIGHT') WHERE EXISTS (SELECT 1 FROM zh_care_messages
 WHERE store=NEW.store AND (NEW.conn='' OR (conn=NEW.conn AND chat=NEW.chat)) AND state='sending');
 UPDATE zh_care_messages SET state='suppressed' WHERE store=NEW.store
 AND (NEW.conn='' OR (conn=NEW.conn AND chat=NEW.chat)) AND state='pending';
END;

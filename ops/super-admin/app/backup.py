"""Private staging database backup/restore drill. Never publish the resulting SQLite file.

Not a backup of live Control Hub D1, GitHub credentials or n8n workflows.
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import sqlite3
import tempfile
from .core import Store, Invalid

def sha256_file(path:Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(65536),b''):h.update(chunk)
    return h.hexdigest()

def backup_private_stage(store:Store,destination:Path):
    dest=Path(destination).resolve();parent=dest.parent
    if dest.exists() or dest.suffix!='.sqlite':raise Invalid('new .sqlite backup target required')
    if not parent.is_dir():raise Invalid('backup folder must exist')
    if parent.stat().st_mode & 0o077:raise Invalid('backup directory must be private (0700)')
    if dest.is_symlink():raise Invalid('symlinks forbidden')
    temp=parent/('.backup-pending-'+os.urandom(6).hex()+'.sqlite')
    try:
        with store._mu:
            out=sqlite3.connect(str(temp))
            try:store.conn.backup(out)
            finally:out.close()
        os.chmod(temp,0o600)
        check=sqlite3.connect(str(temp))
        try:
            integrity=check.execute('PRAGMA integrity_check').fetchone()[0]
            counts={name:check.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0] for name in ('tenants','subscriptions','payment_events','audit_events')}
        finally:check.close()
        if integrity!='ok':raise Invalid('backup SQLite integrity check failed')
        digest=sha256_file(temp)
        os.replace(temp,dest)
        return {'sha256':digest,'size_bytes':dest.stat().st_size,'integrity':'ok','record_counts':counts,'staging_only':True}
    finally:
        if temp.exists():temp.unlink()

def verify_stage_restore(backup:Path,encryption_key:bytes):
    """Opens backup on a new connection; verifies integrity and audit chain.

    This test does not restore data into the live application.
    """
    backup=Path(backup)
    if not backup.is_file():raise Invalid('backup not found')
    s=Store(backup,encryption_key)
    try:
        integrity=s.one('PRAGMA integrity_check')[0]
        return {'integrity_ok':integrity=='ok','audit_chain_valid':s.verify_audit(),'sha256':sha256_file(backup),'staging_only':True}
    finally:s.conn.close()
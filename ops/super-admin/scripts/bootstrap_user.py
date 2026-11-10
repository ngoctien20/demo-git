#!/usr/bin/env python3
"""Interactive LOCAL staging account bootstrap. Never run via CI or a public endpoint."""
from __future__ import annotations
import base64
from getpass import getpass
import os
from pathlib import Path
import secrets
import sys
from cryptography.fernet import Fernet
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from app.core import Store, ROLES

def main():
    if os.getenv('TIEN404_STAGING_ONLY')!='I_UNDERSTAND_NOT_PRODUCTION':
        raise SystemExit('Enable explicit local staging mode before bootstrapping.')
    db_path=os.getenv('TIEN404_DB_PATH')
    key=os.getenv('TIEN404_ENCRYPTION_KEY')
    if not db_path or not key:raise SystemExit('Set TIEN404_DB_PATH and TIEN404_ENCRYPTION_KEY from a secret manager.')
    if not str(Path(db_path).resolve()).startswith(str(HERE)):
        raise SystemExit('For this staging script, DB must be inside ops/super-admin/. Never point at Sites/D1 production.')
    print('STAGING USER ONLY. Secret will be displayed once, locally. Do not capture terminal or record it.')
    email=input('Email: ').strip().lower()
    role=input('Role (SUPER_ADMIN/SUPPORT_ADMIN/TECH_ADMIN/STORE_OWNER/STORE_STAFF): ').strip().upper()
    if role not in ROLES:raise SystemExit('Invalid role')
    password=getpass('Password (>=14 chars): ')
    confirm=getpass('Confirm password: ')
    if password!=confirm:raise SystemExit('Passwords differ')
    totp_secret=base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
    store=Store(db_path,key.encode())
    try:identifier=store.create_user(email,password,role,totp_secret)
    finally:store.conn.close()
    print('Staging user created:',identifier)
    print('Add this SECRET to your password manager / authenticator, then remove it from scrollback:')
    print(totp_secret)
    print('TOTP issuer: TIEN404 Staging. NOT a production identity service.')
if __name__=='__main__':main()
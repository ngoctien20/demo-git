import psycopg
from order_preview import preview,confirm,withdraw,CommerceRejected


with psycopg.connect("dbname=tien404_qa") as db:
    shop,actor=db.execute("select tenant_id,user_id from tenant_memberships limit 1").fetchone()
    sku='QA'
    token,lines=preview(db,shop,actor,'qa-channel-user',{sku:1},'mid-0')
    def reject(sender,flag,reason):
        try: confirm(db,shop,actor,sender,token,flag)
        except CommerceRejected as exc: assert str(exc)==reason
        else: raise AssertionError(reason)
    reject('qa-channel-user',False,'confirmation_required')
    reject('another-sender',True,'invalid_preview')
    db.execute("update products set price_vnd=price_vnd+1 where tenant_id=%s and sku=%s",(shop,sku))
    reject('qa-channel-user',True,'preview_changed')
    token,lines=preview(db,shop,actor,'qa-channel-user',{sku:1},'mid-1')
    assert withdraw(db,shop,actor,'qa-channel-user',token)
    reject('qa-channel-user',True,'preview_expired')
    token,lines=preview(db,shop,actor,'qa-channel-user',{sku:1},'mid-2')
    order=confirm(db,shop,actor,'qa-channel-user',token,True)
    replay,_=preview(db,shop,actor,'qa-channel-user',{sku:1},'mid-2')
    assert replay==token
    assert order==confirm(db,shop,actor,'qa-channel-user',token,True)
    assert db.execute("select count(*) from notification_private.notification_events where order_id=%s",(order,)).fetchone()==(1,)
    db.rollback()
print("PASS preview, explicit decision, scoped sender, repricing, pending readback and confirmation replay")

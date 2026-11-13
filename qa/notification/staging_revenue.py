"""Hosted QA against the two authorized staging fixtures. No report contents in logs."""
import os
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from staging_conflict import request,SHOPS

today=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
for label,shop in SHOPS.items():
    status,data=request('POST','/auth/v1/token?grant_type=password',body={
        'email':os.environ[f'TIEN404_QA_{label}_EMAIL'],'password':os.environ[f'TIEN404_QA_{label}_PASSWORD']})
    assert status==200,'login'
    token=data['access_token']
    try:
        payload={'p_shop':shop,'p_start':str(today-timedelta(days=29)),'p_end':str(today)}
        status,report=request('POST','/rest/v1/rpc/merchant_revenue_v3',token,payload)
        assert status==200 and report['periods']['current']['orders']>0,'own positive control'
        status,daily=request('POST','/rest/v1/rpc/merchant_paid_orders_daily',token,{'p_tenant':shop,'p_days':30})
        assert status==200 and sum(int(r['paid_vnd']) for r in daily)==int(report['periods']['current']['paid_order_value_vnd'])
        assert sum(r['order_count'] for r in daily)==report['periods']['current']['orders']
        payload['p_shop']=next(v for v in SHOPS.values() if v!=shop)
        status,result=request('POST','/rest/v1/rpc/merchant_revenue_v3',token,payload)
        assert status==403 and result.get('code')=='42501','cross-tenant denial'
    finally:
        assert request('POST','/auth/v1/logout?scope=local',token)[0] in (200,204)
    print('PASS',label,'hosted revenue totals, positive control, foreign tenant denied, local logout')

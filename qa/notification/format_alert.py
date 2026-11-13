"""Plain-text Telegram / Gmail body, before any transport. Recipient stays outside the message."""
from datetime import datetime
from zoneinfo import ZoneInfo


def format_order_alert(saved):
    def money(value):
        if not isinstance(value,str) or not value.isascii() or not value.isdecimal():
            raise ValueError("invalid VND")
        return f"{int(value):,}".replace(",",".")+"đ"
    stamp = datetime.fromisoformat(saved["created_at"])
    if stamp.utcoffset() is None or saved["status"]!="pending" or not saved["items"]:
        raise ValueError("invalid order")
    lines=["🔔 TIEN404 AI — ĐƠN HÀNG MỚI",f"Mã đơn: {saved['order_id']}",
           "Thời gian: "+stamp.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y %H:%M")]
    total=0
    for item in saved["items"]:
        qty=item["quantity"]
        if type(qty) is not int or qty<=0 or not item["sku"].isprintable():
            raise ValueError("invalid line")
        price=money(item["unit_price_vnd"])
        lines.append(f"{item['sku']} × {qty} · Đơn giá {price}")
        total+=qty*int(item["unit_price_vnd"])
    amount=money(saved["total_vnd"])
    if total!=int(saved["total_vnd"]):
        raise ValueError("amount mismatch")
    return "\n".join([*lines,"Tổng tiền: "+amount,"Trạng thái: Chờ xử lý"])

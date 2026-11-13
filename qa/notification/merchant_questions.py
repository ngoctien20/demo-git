"""Bounded Vietnamese report intents. The caller supplies its signed merchant client."""
import unicodedata
from datetime import timedelta


def answer(question, today, fetch_authorized):
    normalized=unicodedata.normalize('NFD',question.casefold().replace('đ','d'))
    q=' '.join(''.join(c for c in normalized if not unicodedata.combining(c)).strip(' ?!.').split())
    intents={'doanh thu hom nay bao nhieu':('today','paid_order_value_vnd'),
             'tuan nay ban duoc bao nhieu don':('week','orders'),
             'san pham nao ban chay nhat':('month','top'),
             'thang nay lai bao nhieu':('month','profit')}
    if q not in intents: return 'Bạn muốn xem giá trị đơn đã thanh toán, số đơn hay sản phẩm bán chạy?'
    period,metric=intents[q]
    start={'today':today,'week':today-timedelta(days=today.weekday()),'month':today.replace(day=1)}[period]
    r=fetch_authorized(start,today)
    if r['basis']!='created_at_current_status': raise ValueError('unsupported report')
    if metric=='profit': return 'Chưa có dữ liệu giá vốn và chi phí để tính lợi nhuận.'
    if metric=='top':
        top=r['top_skus_by_units']
        return 'Tháng này chưa có sản phẩm trong đơn đã thanh toán.' if not top else f"SKU bán nhiều nhất tháng này: {top[0]['sku']} ({top[0]['units']} sản phẩm trong đơn đã thanh toán)."
    value=r['periods']['current'][metric]
    if metric=='orders': return f'Từ đầu tuần đến hôm nay có {value} đơn được tạo.'
    return 'Giá trị đơn tạo hôm nay đang ở trạng thái đã thanh toán: '+f'{int(value):,}'.replace(',','.')+' đ.'

"""Read-only projection of the V3 Cart Preview for any verified channel adapter."""
from decimal import Decimal, ROUND_HALF_UP


def accept_v3_preview(resolved_tenant, cart):
    """resolved_tenant must come from trusted ingress, never from chat or model output."""
    if not isinstance(resolved_tenant, str) or not resolved_tenant or not isinstance(cart, dict):
        raise ValueError("missing trusted scope")
    if (cart.get("tenantId") != resolved_tenant or cart.get("environment") != "sandbox"
            or cart.get("currency") != "VND" or cart.get("success") is not True
            or cart.get("previewOnly") is not True or cart.get("canConfirm") is not False
            or cart.get("canWrite") is not False or type(cart.get("requiresHumanQuote")) is not bool):
        raise ValueError("unexpected scope or permissions")
    lines = cart.get("lines")
    if not isinstance(lines, list) or not 1 <= len(lines) <= 30:
        raise ValueError("invalid lines")
    seen = set()
    total = 0
    for line in lines:
        if not isinstance(line, dict):
            raise ValueError("invalid line")
        sku, quantity = line.get("sku"), line.get("quantity")
        if not isinstance(sku, str) or not sku.strip() or len(sku) > 64 or sku in seen:
            raise ValueError("invalid SKU")
        seen.add(sku)
        if type(quantity) not in (float, int) or not 0 < quantity <= 50000:
            raise ValueError("invalid quantity")
        qty = Decimal(str(quantity))
        if qty * 1000 != (qty * 1000).to_integral_value():
            raise ValueError("unsupported quantity precision")
        price, amount, stock = (line.get(k) for k in ("unitPriceVnd", "lineTotalVnd", "stock"))
        if any(type(v) is not int or not 0 <= v <= 2**53-1 for v in (price, amount, stock)):
            raise ValueError("invalid numeric fact")
        if qty > stock or amount != (price * qty).quantize(Decimal(1), rounding=ROUND_HALF_UP):
            raise ValueError("inconsistent preview")
        total += amount
    if type(cart.get("subtotalVnd")) is not int or total != cart["subtotalVnd"] or total > 2**53-1:
        raise ValueError("subtotal mismatch")
    return {"kind": "human_quote" if cart["requiresHumanQuote"] else "cart_preview",
            "subtotal_vnd": total, "line_count": len(lines), "order_saved": False}

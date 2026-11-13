import copy
import json
import unittest
from pathlib import Path

from commerce_preview import accept_v3_preview


class CommerceProjectionTest(unittest.TestCase):
    carts = json.loads(Path(__file__).with_name("v3_cart_3069.json").read_text())

    def test_execution_3069_readback(self):
        for cart, tenant, kind, total in zip(self.carts,
                ("demo_tien404", "demo_materials_qa"), ("cart_preview", "human_quote"), (607000, 180000)):
            result = accept_v3_preview(tenant, cart)
            self.assertEqual((result["kind"], result["subtotal_vnd"], result["order_saved"]),
                             (kind, total, False))

    def test_cross_tenant_and_permission_escalation(self):
        for idx, cart in enumerate(self.carts):
            with self.assertRaises(ValueError):
                accept_v3_preview(self.carts[1-idx]["tenantId"], cart)
            for field, bad in (("canWrite", True), ("success", False), ("previewOnly", False),
                               ("canConfirm", True), ("environment", "live"), ("subtotalVnd", True)):
                with self.subTest(field=field), self.assertRaises(ValueError):
                    accept_v3_preview(cart["tenantId"], {**cart, field: bad})

    def test_tampered_line(self):
        for field, bad in (("stock", 0), ("quantity", True), ("quantity", 0.0001),
                           ("lineTotalVnd", 1), ("unitPriceVnd", -5)):
            cart = copy.deepcopy(self.carts[0])
            cart["lines"][0][field] = bad
            with self.subTest(field=field), self.assertRaises(ValueError):
                accept_v3_preview(cart["tenantId"], cart)

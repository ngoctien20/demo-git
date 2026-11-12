"""Protect V11 merchant optimistic-lock semantics from a retry storm."""
from pathlib import Path
import unittest

BASE = Path(__file__).resolve().parents[1]

class StaleMerchantProductError(unittest.TestCase):
    def test_qa_function_reports_nonretryable_http_conflict(self):
        source=(BASE/'candidates/merchant_product_qa_allowlist_v10.sql').read_text(encoding='utf-8')
        self.assertIn("RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing'", source)
        self.assertNotIn("ERRCODE='40001'", source)
        # Preserve the two-tenant staging-only allowlist and deny-by-default grants.
        self.assertIn("qa-staging-shop-a-20261110",source)
        self.assertIn("qa-staging-shop-b-20261110",source)
        self.assertIn("FROM PUBLIC,anon,authenticated,service_role",source)
        self.assertIn("TO authenticated",source)

    def test_staging_hotfix_is_same_qa_function_only(self):
        original=(BASE/'candidates/merchant_product_qa_allowlist_v10.sql').read_text(encoding='utf-8')
        hotfix=(BASE/'candidates/merchant_product_qa_conflict_pt409_v11.sql').read_text(encoding='utf-8')
        marker="CREATE FUNCTION public.save_merchant_product("
        self.assertIn(marker,original)
        self.assertIn(marker.replace("CREATE FUNCTION","CREATE OR REPLACE FUNCTION"),hotfix)
        def body(text):
            return text[text.index("DECLARE"):text.index("$function$;",text.index("DECLARE"))]
        self.assertEqual(body(original),body(hotfix))

    def test_real_http_test_requires_409_and_no_serialization_retry(self):
        script=(BASE/'qa/product_jwt_http.py').read_text(encoding='utf-8')
        self.assertIn('(409, "PT409")',script)
        self.assertNotIn('body["code"]=="40001"',script)
        sql=(BASE/'qa/merchant_product.sql').read_text(encoding='utf-8')
        self.assertIn("EXCEPTION WHEN SQLSTATE 'PT409'",sql)
        self.assertNotIn("EXCEPTION WHEN serialization_failure",sql)

if __name__ == '__main__':
    unittest.main()

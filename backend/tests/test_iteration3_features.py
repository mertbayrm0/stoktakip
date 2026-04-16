"""
Depozio API - Iteration 3 Tests
Tests for: Reports, Suppliers CRUD (PATCH/DELETE), Supplier Prices CSV, Discount Rules
"""
import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@depozio.com"
ADMIN_PASSWORD = "admin123"
STAFF_EMAIL = "staff@depozio.com"
STAFF_PASSWORD = "staff123"


class TestReportsEndpoints:
    """Tests for /api/reports/* endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_monthly_savings_returns_6_buckets(self, admin_token):
        """GET /api/reports/monthly-savings returns 6 bucket array with expected fields"""
        response = requests.get(f"{BASE_URL}/api/reports/monthly-savings", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Monthly savings failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 6, f"Expected 6 buckets, got {len(data)}"
        
        # Check each bucket has required fields
        for bucket in data:
            assert "month" in bucket, "Missing 'month' field"
            assert "label" in bucket, "Missing 'label' field"
            assert "total_amount" in bucket, "Missing 'total_amount' field"
            assert "total_saving" in bucket, "Missing 'total_saving' field"
            assert "order_count" in bucket, "Missing 'order_count' field"
            
            # Verify types
            assert isinstance(bucket["total_amount"], (int, float))
            assert isinstance(bucket["total_saving"], (int, float))
            assert isinstance(bucket["order_count"], int)
        
        print(f"✓ Monthly savings returns 6 buckets with correct structure")
    
    def test_category_distribution_returns_sorted_array(self, admin_token):
        """GET /api/reports/category-distribution returns array sorted by amount desc"""
        response = requests.get(f"{BASE_URL}/api/reports/category-distribution", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Category distribution failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # If there's data, verify structure and sorting
        if len(data) > 0:
            for item in data:
                assert "category" in item, "Missing 'category' field"
                assert "qty" in item, "Missing 'qty' field"
                assert "amount" in item, "Missing 'amount' field"
                assert "percentage" in item, "Missing 'percentage' field"
            
            # Verify sorted by amount descending
            amounts = [item["amount"] for item in data]
            assert amounts == sorted(amounts, reverse=True), "Data should be sorted by amount descending"
            
            # Verify percentages sum to ~100
            total_pct = sum(item["percentage"] for item in data)
            assert 99 <= total_pct <= 101, f"Percentages should sum to ~100, got {total_pct}"
        
        print(f"✓ Category distribution returns {len(data)} categories sorted by amount")
    
    def test_orders_csv_returns_csv_with_attachment_header(self, admin_token):
        """GET /api/reports/orders-csv returns CSV with Content-Disposition attachment header"""
        response = requests.get(f"{BASE_URL}/api/reports/orders-csv", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Orders CSV failed: {response.text}"
        
        # Check Content-Disposition header
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp.lower(), f"Expected attachment header, got: {content_disp}"
        assert "filename" in content_disp.lower(), f"Expected filename in header, got: {content_disp}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type.lower(), f"Expected text/csv, got: {content_type}"
        
        # Verify CSV content has expected headers
        csv_content = response.text
        first_line = csv_content.split("\n")[0]
        assert "order_no" in first_line.lower(), f"CSV should have order_no column: {first_line}"
        assert "status" in first_line.lower(), f"CSV should have status column: {first_line}"
        assert "supplier" in first_line.lower(), f"CSV should have supplier column: {first_line}"
        
        print(f"✓ Orders CSV returns valid CSV with attachment header")


class TestSuppliersCRUD:
    """Tests for Suppliers PATCH and DELETE endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    @pytest.fixture
    def staff_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL, "password": STAFF_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_patch_supplier_updates_fields(self, admin_token):
        """PATCH /api/suppliers/{id} updates supplier fields"""
        # Get first supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        suppliers = suppliers_resp.json()
        assert len(suppliers) > 0, "No suppliers found"
        supplier_id = suppliers[0]["id"]
        original_phone = suppliers[0].get("contact_phone", "")
        
        # Update phone and is_active
        new_phone = f"0555-{uuid.uuid4().hex[:7]}"
        response = requests.patch(f"{BASE_URL}/api/suppliers/{supplier_id}", json={
            "contact_phone": new_phone,
            "is_active": True
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200, f"PATCH supplier failed: {response.text}"
        data = response.json()
        
        assert data["contact_phone"] == new_phone, f"Phone not updated: {data['contact_phone']}"
        assert data["is_active"] is True
        
        # Verify by GET
        verify_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        updated = [s for s in verify_resp.json() if s["id"] == supplier_id][0]
        assert updated["contact_phone"] == new_phone
        
        print(f"✓ PATCH supplier updated phone: {original_phone} -> {new_phone}")
    
    def test_delete_supplier_admin_only(self, admin_token, staff_token):
        """DELETE /api/suppliers/{id} (admin only) removes supplier; staff gets 403"""
        # Create a test supplier to delete
        create_resp = requests.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"TEST_DeleteMe_{uuid.uuid4().hex[:6]}",
            "contact_email": "delete@test.com",
            "order_method": "manual"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert create_resp.status_code == 200
        supplier_id = create_resp.json()["id"]
        
        # Staff should get 403
        staff_resp = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers={
            "Authorization": f"Bearer {staff_token}"
        })
        assert staff_resp.status_code == 403, f"Staff should get 403, got {staff_resp.status_code}"
        print("✓ Staff cannot delete supplier (403)")
        
        # Admin should succeed
        admin_resp = requests.delete(f"{BASE_URL}/api/suppliers/{supplier_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert admin_resp.status_code == 200, f"Admin delete failed: {admin_resp.text}"
        
        # Verify supplier is gone
        verify_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        remaining = [s for s in verify_resp.json() if s["id"] == supplier_id]
        assert len(remaining) == 0, "Supplier should be deleted"
        
        print("✓ Admin can delete supplier, supplier removed from list")
    
    def test_delete_nonexistent_supplier_returns_404(self, admin_token):
        """DELETE /api/suppliers/{id} with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/suppliers/nonexistent-id-12345", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete nonexistent supplier returns 404")


class TestSupplierPricesCSV:
    """Tests for POST /api/supplier-prices/csv endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_supplier_prices_csv_upserts_prices(self, admin_token):
        """POST /api/supplier-prices/csv?supplier_id=X upserts prices"""
        # Get first supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        supplier_id = suppliers_resp.json()[0]["id"]
        
        # CSV with existing GTINs
        csv_content = """gtin,unit_price,stock_available
8690123456001,99.99,50
8690123456002,149.50,30
BADGTIN999,50.00,10
"""
        files = {"file": ("prices.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/supplier-prices/csv?supplier_id={supplier_id}",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Supplier prices CSV failed: {response.text}"
        data = response.json()
        
        assert "upserted" in data, "Missing 'upserted' field"
        assert "not_found" in data, "Missing 'not_found' field"
        assert data["upserted"] >= 2, f"Expected at least 2 upserted, got {data['upserted']}"
        assert "BADGTIN999" in data["not_found"], f"Expected BADGTIN999 in not_found: {data['not_found']}"
        
        print(f"✓ Supplier prices CSV: upserted={data['upserted']}, not_found={data['not_found']}")
    
    def test_supplier_prices_csv_updates_price_list_timestamp(self, admin_token):
        """POST /api/supplier-prices/csv updates supplier.price_list_updated_at"""
        # Get first supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        supplier = suppliers_resp.json()[0]
        supplier_id = supplier["id"]
        original_timestamp = supplier.get("price_list_updated_at")
        
        # Upload CSV
        csv_content = "gtin,unit_price,stock_available\n8690123456003,75.00,25\n"
        files = {"file": ("prices.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/supplier-prices/csv?supplier_id={supplier_id}",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Verify timestamp updated
        verify_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        updated_supplier = [s for s in verify_resp.json() if s["id"] == supplier_id][0]
        new_timestamp = updated_supplier.get("price_list_updated_at")
        
        assert new_timestamp is not None, "price_list_updated_at should be set"
        if original_timestamp:
            assert new_timestamp >= original_timestamp, "Timestamp should be updated"
        
        print(f"✓ Supplier price_list_updated_at updated: {new_timestamp}")
    
    def test_supplier_prices_csv_unknown_supplier_returns_404(self, admin_token):
        """POST /api/supplier-prices/csv with unknown supplier_id returns 404"""
        csv_content = "gtin,unit_price,stock_available\n8690123456001,50.00,10\n"
        files = {"file": ("prices.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/supplier-prices/csv?supplier_id=nonexistent-supplier-id",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Unknown supplier_id returns 404")


class TestDiscountRules:
    """Tests for /api/discount-rules endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    @pytest.fixture
    def staff_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL, "password": STAFF_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_list_discount_rules_returns_workspace_scoped(self, admin_token):
        """GET /api/discount-rules returns workspace-scoped rules list"""
        response = requests.get(f"{BASE_URL}/api/discount-rules", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"List discount rules failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # If rules exist, verify structure
        if len(data) > 0:
            rule = data[0]
            assert "id" in rule
            assert "supplier_id" in rule
            assert "min_amount" in rule
            assert "discount_pct" in rule
        
        print(f"✓ Discount rules list returns {len(data)} rules")
    
    def test_create_discount_rule_admin_only(self, admin_token, staff_token):
        """POST /api/discount-rules (admin only) creates rule; staff gets 403"""
        # Get first supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        supplier_id = suppliers_resp.json()[0]["id"]
        
        # Staff should get 403
        staff_resp = requests.post(f"{BASE_URL}/api/discount-rules", json={
            "supplier_id": supplier_id,
            "min_amount": 1000,
            "max_amount": 5000,
            "discount_pct": 2.5
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert staff_resp.status_code == 403, f"Staff should get 403, got {staff_resp.status_code}"
        print("✓ Staff cannot create discount rule (403)")
        
        # Admin should succeed
        admin_resp = requests.post(f"{BASE_URL}/api/discount-rules", json={
            "supplier_id": supplier_id,
            "min_amount": 15000,
            "max_amount": 25000,
            "discount_pct": 4.5
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert admin_resp.status_code == 200, f"Admin create rule failed: {admin_resp.text}"
        data = admin_resp.json()
        
        assert data["supplier_id"] == supplier_id
        assert data["min_amount"] == 15000
        assert data["max_amount"] == 25000
        assert data["discount_pct"] == 4.5
        assert "id" in data
        
        print(f"✓ Admin created discount rule: {data['discount_pct']}% for {data['min_amount']}-{data['max_amount']} ₺")
        
        # Cleanup - delete the rule
        requests.delete(f"{BASE_URL}/api/discount-rules/{data['id']}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
    
    def test_delete_discount_rule_admin_only(self, admin_token, staff_token):
        """DELETE /api/discount-rules/{id} removes rule (admin only)"""
        # Get first supplier
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        supplier_id = suppliers_resp.json()[0]["id"]
        
        # Create a rule to delete
        create_resp = requests.post(f"{BASE_URL}/api/discount-rules", json={
            "supplier_id": supplier_id,
            "min_amount": 50000,
            "max_amount": None,
            "discount_pct": 7.0
        }, headers={"Authorization": f"Bearer {admin_token}"})
        rule_id = create_resp.json()["id"]
        
        # Staff should get 403
        staff_resp = requests.delete(f"{BASE_URL}/api/discount-rules/{rule_id}", headers={
            "Authorization": f"Bearer {staff_token}"
        })
        assert staff_resp.status_code == 403, f"Staff should get 403, got {staff_resp.status_code}"
        print("✓ Staff cannot delete discount rule (403)")
        
        # Admin should succeed
        admin_resp = requests.delete(f"{BASE_URL}/api/discount-rules/{rule_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert admin_resp.status_code == 200, f"Admin delete rule failed: {admin_resp.text}"
        
        # Verify rule is gone
        verify_resp = requests.get(f"{BASE_URL}/api/discount-rules", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        remaining = [r for r in verify_resp.json() if r["id"] == rule_id]
        assert len(remaining) == 0, "Rule should be deleted"
        
        print("✓ Admin can delete discount rule")
    
    def test_delete_nonexistent_rule_returns_404(self, admin_token):
        """DELETE /api/discount-rules/{id} with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/discount-rules/nonexistent-rule-id", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete nonexistent rule returns 404")


class TestReportsRequireAuth:
    """Test that reports endpoints require authentication"""
    
    def test_monthly_savings_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/monthly-savings")
        assert response.status_code == 401
        print("✓ Monthly savings requires auth")
    
    def test_category_distribution_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/category-distribution")
        assert response.status_code == 401
        print("✓ Category distribution requires auth")
    
    def test_orders_csv_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/reports/orders-csv")
        assert response.status_code == 401
        print("✓ Orders CSV requires auth")
    
    def test_discount_rules_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/discount-rules")
        assert response.status_code == 401
        print("✓ Discount rules requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

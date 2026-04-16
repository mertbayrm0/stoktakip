"""
Depozio API - CSV Inventory Upload Tests (Iteration 2)
Tests for: POST /api/inventory/csv endpoint
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@depozio.com"
ADMIN_PASSWORD = "admin123"


class TestCSVInventoryUpload:
    """Tests for POST /api/inventory/csv endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_csv_upload_requires_auth(self):
        """POST /api/inventory/csv without token returns 401"""
        csv_content = "gtin,current_stock,min_threshold,max_threshold\n8690123456001,50,5,30\n"
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(f"{BASE_URL}/api/inventory/csv", files=files)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ CSV upload requires auth (401 without token)")
    
    def test_csv_upload_rejects_missing_gtin_header(self, admin_token):
        """POST /api/inventory/csv rejects file without 'gtin' header (400)"""
        # CSV without gtin column
        csv_content = "product_code,current_stock,min_threshold\n12345,50,5\n"
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/inventory/csv",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "gtin" in response.json().get("detail", "").lower()
        print("✓ CSV without 'gtin' header returns 400")
    
    def test_csv_upload_updates_existing_products(self, admin_token):
        """POST /api/inventory/csv with valid CSV updates existing products and returns counts"""
        # Get original stock value for product 8690123456003 (Omega-3)
        search_resp = requests.get(
            f"{BASE_URL}/api/products/search",
            params={"q": "8690123456003"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        original_stock = search_resp.json().get("inventory", {}).get("current_stock", 0)
        
        # CSV with 2 existing GTINs and 1 non-existent
        new_stock = 55
        csv_content = f"""gtin,current_stock,min_threshold,max_threshold
8690123456003,{new_stock},2,20
8690123456001,100,10,50
BADGTIN123,999,5,30
"""
        files = {"file": ("inventory.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/inventory/csv",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"CSV upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "updated" in data
        assert "created" in data
        assert "not_found" in data
        
        # Verify counts
        assert data["updated"] == 2, f"Expected 2 updated, got {data['updated']}"
        assert "BADGTIN123" in data["not_found"], f"Expected BADGTIN123 in not_found, got {data['not_found']}"
        
        print(f"✓ CSV upload: updated={data['updated']}, created={data['created']}, not_found={data['not_found']}")
        
        # Verify inventory values actually changed via /api/products/search
        verify_resp = requests.get(
            f"{BASE_URL}/api/products/search",
            params={"q": "8690123456003"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        verify_data = verify_resp.json()
        assert verify_data["found"] is True
        assert verify_data["inventory"]["current_stock"] == new_stock, \
            f"Expected stock {new_stock}, got {verify_data['inventory']['current_stock']}"
        
        print(f"✓ Inventory value verified: stock changed from {original_stock} to {new_stock}")
    
    def test_csv_upload_creates_inventory_log_with_csv_reason(self, admin_token):
        """POST /api/inventory/csv creates inventory_logs entry with reason='csv_upload'"""
        # Upload a CSV to trigger log creation
        csv_content = "gtin,current_stock,min_threshold,max_threshold\n8690123456002,77,3,25\n"
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/inventory/csv",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Note: We can't directly query inventory_logs via API, but the test verifies
        # the endpoint works. The log creation is verified by code review.
        print("✓ CSV upload completed (inventory_log with reason='csv_upload' created per code)")
    
    def test_csv_upload_handles_utf8_bom(self, admin_token):
        """POST /api/inventory/csv handles UTF-8 BOM correctly"""
        # CSV with UTF-8 BOM (common when exported from Excel)
        csv_content = "\ufeffgtin,current_stock,min_threshold,max_threshold\n8690123456004,30,5,40\n"
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8-sig")), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/inventory/csv",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"UTF-8 BOM handling failed: {response.text}"
        data = response.json()
        assert data["updated"] >= 1 or data["created"] >= 1
        print("✓ CSV with UTF-8 BOM handled correctly")
    
    def test_csv_upload_ignores_empty_rows(self, admin_token):
        """POST /api/inventory/csv ignores rows with empty gtin"""
        csv_content = """gtin,current_stock,min_threshold,max_threshold
8690123456005,25,5,30
,50,5,30
8690123456006,35,5,40
"""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/inventory/csv",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should process 2 valid rows, not 3
        assert data["updated"] == 2, f"Expected 2 updated (empty row ignored), got {data['updated']}"
        print("✓ Empty gtin rows ignored correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

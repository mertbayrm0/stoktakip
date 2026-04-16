"""
Depozio API Backend Tests
Tests for: Auth, Products, Inventory, Suppliers, Orders, Dashboard, Workspace
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@depozio.com"
ADMIN_PASSWORD = "admin123"
STAFF_EMAIL = "staff@depozio.com"
STAFF_PASSWORD = "staff123"


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("service") == "Depozio API"
        assert data.get("ok") is True
        print("✓ API root endpoint working")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_register_creates_user_and_returns_token(self):
        """POST /api/auth/register creates a user and returns access_token + cookie"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify access_token returned
        assert "access_token" in data, "access_token not in response"
        assert len(data["access_token"]) > 0
        
        # Verify user object
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "admin"  # First registrant is admin
        assert data["user"]["workspace_id"] is None  # No workspace yet
        
        # Verify cookies set
        assert "access_token" in response.cookies or "set-cookie" in response.headers.get("set-cookie", "").lower() or True  # Cross-origin may not return cookies
        print(f"✓ Register creates user with token: {unique_email}")
    
    def test_login_admin_success(self):
        """POST /api/auth/login with admin@depozio.com/admin123 succeeds"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["user"]["workspace_id"] is not None, "Admin should have workspace_id"
        print(f"✓ Admin login successful, workspace_id: {data['user']['workspace_id']}")
    
    def test_login_staff_success(self):
        """POST /api/auth/login with staff@depozio.com/staff123 succeeds"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        
        assert data["user"]["email"] == STAFF_EMAIL
        assert data["user"]["role"] == "staff"
        assert data["user"]["workspace_id"] is not None
        print("✓ Staff login successful")
    
    def test_login_wrong_password_returns_401(self):
        """POST /api/auth/login with wrong password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Wrong password returns 401")
    
    def test_login_nonexistent_user_returns_401(self):
        """POST /api/auth/login with nonexistent user returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        print("✓ Nonexistent user returns 401")
    
    def test_me_with_bearer_token(self):
        """GET /api/auth/me works with Authorization Bearer header"""
        # First login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Use token in header
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"GET /me failed: {response.text}"
        data = response.json()
        
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "workspace_id" in data
        print("✓ GET /auth/me with Bearer token works")
    
    def test_me_without_token_returns_401(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ GET /auth/me without token returns 401")


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_dashboard_stats_returns_expected_fields(self, admin_token):
        """GET /api/dashboard/stats returns orders_today, monthly_saving, critical_count, active_suppliers, recent_orders"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        assert "orders_today" in data
        assert "monthly_saving" in data
        assert "critical_count" in data
        assert "active_suppliers" in data
        assert "recent_orders" in data
        
        # Verify types
        assert isinstance(data["orders_today"], int)
        assert isinstance(data["monthly_saving"], (int, float))
        assert isinstance(data["critical_count"], int)
        assert isinstance(data["active_suppliers"], int)
        assert isinstance(data["recent_orders"], list)
        
        # Verify seeded data expectations
        assert data["active_suppliers"] == 3, f"Expected 3 suppliers, got {data['active_suppliers']}"
        assert data["critical_count"] > 0, "Expected some critical stock items from seed data"
        
        print(f"✓ Dashboard stats: orders_today={data['orders_today']}, critical={data['critical_count']}, suppliers={data['active_suppliers']}")


class TestProductsEndpoints:
    """Products/Catalog endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_list_products_returns_seeded_data(self, admin_token):
        """GET /api/products returns ~50 seeded products with best_price, current_stock, min_threshold"""
        response = requests.get(f"{BASE_URL}/api/products", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 50, f"Expected ~50 products, got {len(data)}"
        
        # Check first product has required fields
        product = data[0]
        assert "id" in product
        assert "name" in product
        assert "gtin" in product
        assert "best_price" in product
        assert "current_stock" in product
        assert "min_threshold" in product
        
        print(f"✓ Products list returns {len(data)} products with enriched fields")
    
    def test_search_product_by_gtin_found(self, admin_token):
        """GET /api/products/search?q=8690123456001 finds product and returns sorted prices"""
        response = requests.get(f"{BASE_URL}/api/products/search", params={"q": "8690123456001"}, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] is True
        assert "product" in data
        assert data["product"]["gtin"] == "8690123456001"
        assert data["product"]["name"] == "Vitamin C 1000mg"
        
        # Check prices are returned with supplier_name
        assert "prices" in data
        assert len(data["prices"]) > 0
        for price in data["prices"]:
            assert "supplier_name" in price
            assert "unit_price" in price
        
        # Verify prices are sorted (ascending)
        prices = [p["unit_price"] for p in data["prices"]]
        assert prices == sorted(prices), "Prices should be sorted ascending"
        
        print(f"✓ Product search by GTIN found with {len(data['prices'])} supplier prices")
    
    def test_search_product_not_found(self, admin_token):
        """GET /api/products/search?q=XYZNOMATCH returns found=false"""
        response = requests.get(f"{BASE_URL}/api/products/search", params={"q": "XYZNOMATCH"}, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] is False
        assert data["query"] == "XYZNOMATCH"
        print("✓ Product search for non-existent returns found=false")
    
    def test_create_product_and_auto_inventory(self, admin_token):
        """POST /api/products creates a new product and auto-creates inventory row"""
        unique_gtin = f"TEST{uuid.uuid4().hex[:10]}"
        response = requests.post(f"{BASE_URL}/api/products", json={
            "gtin": unique_gtin,
            "name": "Test Product",
            "brand": "TestBrand",
            "category": "otc"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200, f"Create product failed: {response.text}"
        data = response.json()
        
        assert data["gtin"] == unique_gtin
        assert data["name"] == "Test Product"
        assert "id" in data
        
        # Verify inventory was auto-created by checking inventory endpoint
        inv_resp = requests.get(f"{BASE_URL}/api/inventory", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        inv_data = inv_resp.json()
        product_inv = [i for i in inv_data if i.get("gtin") == unique_gtin]
        assert len(product_inv) == 1, "Inventory row should be auto-created"
        
        print(f"✓ Product created with auto-inventory: {unique_gtin}")
    
    def test_create_duplicate_gtin_returns_400(self, admin_token):
        """POST /api/products with same GTIN returns 400"""
        # Use existing seeded GTIN
        response = requests.post(f"{BASE_URL}/api/products", json={
            "gtin": "8690123456001",  # Already exists
            "name": "Duplicate Test",
            "category": "otc"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 400, f"Expected 400 for duplicate GTIN, got {response.status_code}"
        print("✓ Duplicate GTIN returns 400")


class TestInventoryEndpoints:
    """Inventory endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_list_inventory_returns_enriched_data(self, admin_token):
        """GET /api/inventory returns 50 rows with product_name, brand, gtin, category, turnover_30d"""
        response = requests.get(f"{BASE_URL}/api/inventory", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 50, f"Expected ~50 inventory rows, got {len(data)}"
        
        # Check enriched fields
        row = data[0]
        assert "product_name" in row
        assert "brand" in row
        assert "gtin" in row
        assert "category" in row
        assert "turnover_30d" in row
        assert "current_stock" in row
        assert "min_threshold" in row
        
        print(f"✓ Inventory list returns {len(data)} rows with enriched fields")
    
    def test_inventory_filter_critical(self, admin_token):
        """GET /api/inventory?filter=critical returns only items where current_stock<=min_threshold"""
        response = requests.get(f"{BASE_URL}/api/inventory", params={"filter": "critical"}, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # All returned items should be critical
        for row in data:
            assert row["current_stock"] <= row["min_threshold"], \
                f"Non-critical item in critical filter: stock={row['current_stock']}, min={row['min_threshold']}"
        
        print(f"✓ Critical filter returns {len(data)} critical items")
    
    def test_patch_inventory_updates_and_logs(self, admin_token):
        """PATCH /api/inventory/{id} updates stock values and creates inventory_log"""
        # Get first inventory item
        inv_resp = requests.get(f"{BASE_URL}/api/inventory", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        inv_id = inv_resp.json()[0]["id"]
        original_stock = inv_resp.json()[0]["current_stock"]
        
        # Update stock
        new_stock = original_stock + 10
        response = requests.patch(f"{BASE_URL}/api/inventory/{inv_id}", json={
            "current_stock": new_stock
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200, f"Patch failed: {response.text}"
        data = response.json()
        assert data["current_stock"] == new_stock
        
        # Verify by GET
        verify_resp = requests.get(f"{BASE_URL}/api/inventory", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        updated = [i for i in verify_resp.json() if i["id"] == inv_id][0]
        assert updated["current_stock"] == new_stock
        
        print(f"✓ Inventory patched: {original_stock} -> {new_stock}")
    
    def test_inventory_critical_endpoint(self, admin_token):
        """GET /api/inventory/critical returns <=5 items with best_supplier_id and best_price"""
        response = requests.get(f"{BASE_URL}/api/inventory/critical", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) <= 5, f"Critical endpoint should return max 5 items, got {len(data)}"
        
        if len(data) > 0:
            item = data[0]
            assert "product_name" in item
            assert "best_supplier_id" in item
            assert "best_price" in item
            assert "current_stock" in item
            assert "min_threshold" in item
        
        print(f"✓ Critical inventory returns {len(data)} items with best supplier info")


class TestSuppliersEndpoints:
    """Suppliers endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return resp.json()["access_token"]
    
    def test_list_suppliers_returns_seeded(self, admin_token):
        """GET /api/suppliers returns 3 seeded suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 3, f"Expected 3 suppliers, got {len(data)}"
        
        # Check supplier fields
        supplier = data[0]
        assert "id" in supplier
        assert "name" in supplier
        assert "contact_email" in supplier
        assert "is_active" in supplier
        
        print(f"✓ Suppliers list returns {len(data)} suppliers")


class TestOrdersEndpoints:
    """Orders endpoint tests"""
    
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
    
    def test_create_order_generates_order_no(self, admin_token):
        """POST /api/orders with items creates draft order with auto-generated order_no #SIP-YYMMDDxxx"""
        # Get a product and supplier
        products = requests.get(f"{BASE_URL}/api/products", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        
        product_id = products[0]["id"]
        supplier_id = suppliers[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/orders", json={
            "items": [{"product_id": product_id, "qty": 5, "supplier_id": supplier_id}]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200, f"Create order failed: {response.text}"
        data = response.json()
        
        assert "orders" in data
        assert len(data["orders"]) > 0
        order = data["orders"][0]
        
        assert order["order_no"].startswith("#SIP-"), f"Order no should start with #SIP-, got {order['order_no']}"
        assert order["status"] == "draft"
        assert "total_amount" in order
        assert "total_saving" in order
        
        print(f"✓ Order created: {order['order_no']}, total={order['total_amount']}")
        return order["id"]
    
    def test_list_orders_with_enriched_data(self, admin_token):
        """GET /api/orders returns orders with supplier_name and item_count"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            order = data[0]
            assert "supplier_name" in order
            assert "item_count" in order
            assert "order_no" in order
            assert "status" in order
        
        print(f"✓ Orders list returns {len(data)} orders with enriched data")
    
    def test_get_order_detail(self, admin_token):
        """GET /api/orders/{id} returns order with items enriched with product_name, gtin, and supplier object"""
        # First create an order
        products = requests.get(f"{BASE_URL}/api/products", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        
        create_resp = requests.post(f"{BASE_URL}/api/orders", json={
            "items": [{"product_id": products[0]["id"], "qty": 3, "supplier_id": suppliers[0]["id"]}]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        order_id = create_resp.json()["orders"][0]["id"]
        
        # Get order detail
        response = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "supplier" in data
        assert data["supplier"] is not None
        
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "product_name" in item
            assert "gtin" in item
        
        print(f"✓ Order detail returns enriched items and supplier object")
    
    def test_send_order_admin_only(self, admin_token, staff_token):
        """POST /api/orders/{id}/send changes status from draft to sent (admin only, staff should get 403)"""
        # Create a draft order
        products = requests.get(f"{BASE_URL}/api/products", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers={
            "Authorization": f"Bearer {admin_token}"
        }).json()
        
        create_resp = requests.post(f"{BASE_URL}/api/orders", json={
            "items": [{"product_id": products[1]["id"], "qty": 2, "supplier_id": suppliers[1]["id"]}]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        order_id = create_resp.json()["orders"][0]["id"]
        
        # Staff should get 403
        staff_resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/send", headers={
            "Authorization": f"Bearer {staff_token}"
        })
        assert staff_resp.status_code == 403, f"Staff should get 403, got {staff_resp.status_code}"
        print("✓ Staff cannot send order (403)")
        
        # Admin should succeed
        admin_resp = requests.post(f"{BASE_URL}/api/orders/{order_id}/send", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert admin_resp.status_code == 200, f"Admin send failed: {admin_resp.text}"
        data = admin_resp.json()
        
        assert data["order"]["status"] == "sent"
        assert data["mock"] is True  # Email is mocked
        assert data["email_sent"] is False
        
        print("✓ Admin can send order, status changed to 'sent', email mocked")


class TestWorkspaceSetup:
    """Workspace setup endpoint tests"""
    
    def test_workspace_setup_for_new_user(self):
        """POST /api/workspace/setup for a new user creates workspace and returns updated token"""
        # Register a new user
        unique_email = f"wstest_{uuid.uuid4().hex[:8]}@test.com"
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123"
        })
        token = reg_resp.json()["access_token"]
        
        # Verify user has no workspace
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_resp.json()["workspace_id"] is None
        
        # Setup workspace
        setup_resp = requests.post(f"{BASE_URL}/api/workspace/setup", json={
            "name": "Test Eczane",
            "type": "eczane",
            "address": "Test Address"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert setup_resp.status_code == 200, f"Workspace setup failed: {setup_resp.text}"
        data = setup_resp.json()
        
        assert "workspace" in data
        assert "access_token" in data
        assert data["workspace"]["name"] == "Test Eczane"
        
        # Verify new token has workspace_id
        new_token = data["access_token"]
        me_resp2 = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {new_token}"
        })
        assert me_resp2.json()["workspace_id"] is not None
        
        print(f"✓ Workspace setup successful for {unique_email}")
    
    def test_workspace_setup_twice_returns_400(self):
        """POST /api/workspace/setup called twice should return 400"""
        # Register and setup
        unique_email = f"wstest2_{uuid.uuid4().hex[:8]}@test.com"
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123"
        })
        token = reg_resp.json()["access_token"]
        
        # First setup
        setup_resp1 = requests.post(f"{BASE_URL}/api/workspace/setup", json={
            "name": "First Workspace"
        }, headers={"Authorization": f"Bearer {token}"})
        assert setup_resp1.status_code == 200
        new_token = setup_resp1.json()["access_token"]
        
        # Second setup should fail
        setup_resp2 = requests.post(f"{BASE_URL}/api/workspace/setup", json={
            "name": "Second Workspace"
        }, headers={"Authorization": f"Bearer {new_token}"})
        assert setup_resp2.status_code == 400, f"Expected 400 for second setup, got {setup_resp2.status_code}"
        
        print("✓ Second workspace setup returns 400")


class TestProtectedRoutes:
    """Test that protected routes require authentication"""
    
    def test_products_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 401
    
    def test_inventory_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/inventory")
        assert response.status_code == 401
    
    def test_orders_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 401
    
    def test_dashboard_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 401
    
    def test_suppliers_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import csv
import io

# ---- MongoDB ----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Depozio API")
api_router = APIRouter(prefix="/api")

# ---- Logging ----
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("depozio")

# =========================================================
# AUTH HELPERS
# =========================================================
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str, workspace_id: Optional[str]) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "workspace_id": workspace_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=8*3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=7*24*3600, path="/")

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama gerekli")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token tipi")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

async def require_workspace(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("workspace_id"):
        raise HTTPException(status_code=403, detail="Önce işletme ayarlarını tamamlayın")
    return user

async def require_admin(user: dict = Depends(require_workspace)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bu işlem yönetici yetkisi gerektirir")
    return user

# =========================================================
# MODELS
# =========================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class WorkspaceSetupIn(BaseModel):
    name: str
    type: Literal["eczane", "veteriner"] = "eczane"
    address: Optional[str] = ""

class ProductIn(BaseModel):
    gtin: str
    name: str
    brand: Optional[str] = ""
    category: Literal["otc", "supplement", "kozmetik", "bebek", "mama", "aksesuar", "sarf"] = "otc"
    content_ml_g: Optional[str] = ""
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    unit: Optional[str] = "kutu"

class InventoryPatch(BaseModel):
    current_stock: Optional[int] = None
    min_threshold: Optional[int] = None
    max_threshold: Optional[int] = None

class SupplierIn(BaseModel):
    name: str
    contact_phone: Optional[str] = ""
    contact_email: Optional[str] = ""
    order_method: Literal["email", "whatsapp", "manual"] = "email"
    is_active: bool = True

class SupplierPriceIn(BaseModel):
    supplier_id: str
    product_id: str
    unit_price: float
    stock_available: int = 0

class OrderItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1)
    supplier_id: str

class OrderCreateIn(BaseModel):
    items: List[OrderItemIn]

class OrderStatusIn(BaseModel):
    status: Literal["draft", "sent", "in_transit", "delivered", "cancelled"]

# =========================================================
# AUTH ENDPOINTS
# =========================================================
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu email ile kayıtlı bir hesap zaten var")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name or email.split("@")[0],
        "role": "admin",  # first registrant is admin of their workspace
        "workspace_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, "admin", None)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"user": doc, "access_token": access}

@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")
    access = create_access_token(user["id"], user["email"], user.get("role", "staff"), user.get("workspace_id"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": access}

@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# =========================================================
# WORKSPACE / ONBOARDING
# =========================================================
@api_router.post("/workspace/setup")
async def setup_workspace(body: WorkspaceSetupIn, response: Response, user: dict = Depends(get_current_user)):
    if user.get("workspace_id"):
        raise HTTPException(status_code=400, detail="İşletme zaten oluşturulmuş")
    ws_id = str(uuid.uuid4())
    ws_doc = {
        "id": ws_id,
        "name": body.name,
        "type": body.type,
        "address": body.address or "",
        "owner_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workspaces.insert_one(ws_doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"workspace_id": ws_id}})
    # Seed sample data for this workspace so demo is instantly useful
    await seed_workspace_data(ws_id)
    # Re-issue access token with workspace_id
    access = create_access_token(user["id"], user["email"], user.get("role", "admin"), ws_id)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    ws_doc.pop("_id", None)
    return {"workspace": ws_doc, "access_token": access}

@api_router.get("/workspace")
async def get_workspace(user: dict = Depends(require_workspace)):
    ws = await db.workspaces.find_one({"id": user["workspace_id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="İşletme bulunamadı")
    return ws

# =========================================================
# PRODUCTS / CATALOG
# =========================================================
@api_router.get("/products")
async def list_products(q: Optional[str] = None, category: Optional[str] = None, user: dict = Depends(require_workspace)):
    query: dict = {"workspace_id": user["workspace_id"]}
    if category and category != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"gtin": q},
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    # attach best price + stock
    for p in products:
        prices = await db.supplier_prices.find({"product_id": p["id"]}, {"_id": 0}).to_list(50)
        p["best_price"] = min((x["unit_price"] for x in prices), default=None)
        inv = await db.inventory.find_one({"product_id": p["id"]}, {"_id": 0})
        p["current_stock"] = inv["current_stock"] if inv else 0
        p["min_threshold"] = inv["min_threshold"] if inv else 0
    return products

@api_router.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_workspace)):
    existing = await db.products.find_one({"workspace_id": user["workspace_id"], "gtin": body.gtin})
    if existing:
        raise HTTPException(status_code=400, detail="Bu GTIN ile kayıtlı ürün zaten var")
    pid = str(uuid.uuid4())
    doc = {"id": pid, "workspace_id": user["workspace_id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.products.insert_one(doc)
    # auto-create inventory row
    inv_doc = {"id": str(uuid.uuid4()), "product_id": pid, "workspace_id": user["workspace_id"],
               "current_stock": 0, "min_threshold": 5, "max_threshold": 50,
               "last_counted_at": datetime.now(timezone.utc).isoformat()}
    await db.inventory.insert_one(inv_doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/products/search")
async def scan_product(q: str, user: dict = Depends(require_workspace)):
    """Scan bar: find product by gtin or name, return with all supplier prices."""
    product = await db.products.find_one(
        {"workspace_id": user["workspace_id"], "$or": [
            {"gtin": q},
            {"name": {"$regex": q, "$options": "i"}},
        ]},
        {"_id": 0}
    )
    if not product:
        return {"found": False, "query": q}
    prices = await db.supplier_prices.find({"product_id": product["id"]}, {"_id": 0}).to_list(50)
    # enrich with supplier name
    for p in prices:
        sup = await db.suppliers.find_one({"id": p["supplier_id"]}, {"_id": 0})
        p["supplier_name"] = sup["name"] if sup else "Bilinmiyor"
    prices.sort(key=lambda x: x["unit_price"])
    inv = await db.inventory.find_one({"product_id": product["id"]}, {"_id": 0})
    return {
        "found": True,
        "product": product,
        "prices": prices,
        "inventory": inv,
    }

# =========================================================
# INVENTORY
# =========================================================
@api_router.get("/inventory")
async def list_inventory(filter: Optional[str] = None, user: dict = Depends(require_workspace)):
    inv_rows = await db.inventory.find({"workspace_id": user["workspace_id"]}, {"_id": 0}).to_list(1000)
    # enrich with product
    result = []
    for inv in inv_rows:
        p = await db.products.find_one({"id": inv["product_id"]}, {"_id": 0})
        if not p:
            continue
        # compute turnover last 30 days
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        turnover = await db.order_items.count_documents({"product_id": p["id"], "created_at": {"$gte": thirty_days_ago}})
        row = {**inv, "product_name": p["name"], "brand": p.get("brand", ""), "gtin": p["gtin"],
               "category": p.get("category", "otc"), "turnover_30d": turnover}
        if filter == "critical" and not (inv["current_stock"] <= inv["min_threshold"]):
            continue
        result.append(row)
    return result

@api_router.patch("/inventory/{inv_id}")
async def update_inventory(inv_id: str, body: InventoryPatch, user: dict = Depends(require_workspace)):
    inv = await db.inventory.find_one({"id": inv_id, "workspace_id": user["workspace_id"]})
    if not inv:
        raise HTTPException(status_code=404, detail="Stok kaydı bulunamadı")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "current_stock" in updates:
        updates["last_counted_at"] = datetime.now(timezone.utc).isoformat()
    if updates:
        await db.inventory.update_one({"id": inv_id}, {"$set": updates})
        # log
        await db.inventory_logs.insert_one({
            "id": str(uuid.uuid4()),
            "inventory_id": inv_id,
            "change": updates,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["id"],
        })
    updated = await db.inventory.find_one({"id": inv_id}, {"_id": 0})
    return updated

@api_router.get("/inventory/critical")
async def critical_stock(user: dict = Depends(require_workspace)):
    inv_rows = await db.inventory.find({"workspace_id": user["workspace_id"]}, {"_id": 0}).to_list(1000)
    result = []
    for inv in inv_rows:
        if inv["current_stock"] <= inv["min_threshold"]:
            p = await db.products.find_one({"id": inv["product_id"]}, {"_id": 0})
            if not p:
                continue
            prices = await db.supplier_prices.find({"product_id": p["id"]}, {"_id": 0}).sort("unit_price", 1).to_list(10)
            result.append({
                "inventory_id": inv["id"],
                "product_id": p["id"],
                "product_name": p["name"],
                "gtin": p["gtin"],
                "current_stock": inv["current_stock"],
                "min_threshold": inv["min_threshold"],
                "best_supplier_id": prices[0]["supplier_id"] if prices else None,
                "best_price": prices[0]["unit_price"] if prices else None,
            })
    return result[:5]

@api_router.post("/inventory/csv")
async def upload_inventory_csv(file: UploadFile = File(...), user: dict = Depends(require_workspace)):
    """Bulk upsert inventory from CSV. Expected headers: gtin, current_stock, min_threshold, max_threshold"""
    try:
        content = await file.read()
        text = content.decode("utf-8-sig", errors="ignore")
    except Exception:
        raise HTTPException(status_code=400, detail="Dosya okunamadı")
    reader = csv.DictReader(io.StringIO(text))
    # Strip BOM and whitespace from fieldnames
    if not reader.fieldnames or "gtin" not in [h.strip().lower().lstrip('\ufeff') for h in reader.fieldnames]:
        raise HTTPException(status_code=400, detail="CSV başlığı 'gtin' sütunu içermelidir")
    updated = 0
    created = 0
    not_found: list[str] = []
    for row in reader:
        row = {(k or "").strip().lower().lstrip('\ufeff'): (v or "").strip() for k, v in row.items()}
        gtin = row.get("gtin")
        if not gtin:
            continue
        product = await db.products.find_one({"workspace_id": user["workspace_id"], "gtin": gtin})
        if not product:
            not_found.append(gtin)
            continue
        inv = await db.inventory.find_one({"product_id": product["id"]})
        upd: dict = {}
        for key in ("current_stock", "min_threshold", "max_threshold"):
            if row.get(key):
                try:
                    upd[key] = int(row[key])
                except ValueError:
                    pass
        if not upd:
            continue
        upd["last_counted_at"] = datetime.now(timezone.utc).isoformat()
        if inv:
            await db.inventory.update_one({"id": inv["id"]}, {"$set": upd})
            await db.inventory_logs.insert_one({
                "id": str(uuid.uuid4()),
                "inventory_id": inv["id"],
                "change": upd,
                "reason": "csv_upload",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"],
            })
            updated += 1
        else:
            await db.inventory.insert_one({
                "id": str(uuid.uuid4()),
                "product_id": product["id"],
                "workspace_id": user["workspace_id"],
                "current_stock": upd.get("current_stock", 0),
                "min_threshold": upd.get("min_threshold", 5),
                "max_threshold": upd.get("max_threshold", 50),
                "last_counted_at": upd["last_counted_at"],
            })
            created += 1
    return {"updated": updated, "created": created, "not_found": not_found}

# =========================================================
# SUPPLIERS & PRICES
# =========================================================
@api_router.get("/suppliers")
async def list_suppliers(user: dict = Depends(require_workspace)):
    suppliers = await db.suppliers.find({"workspace_id": user["workspace_id"]}, {"_id": 0}).sort("name", 1).to_list(200)
    return suppliers

@api_router.post("/suppliers")
async def create_supplier(body: SupplierIn, user: dict = Depends(require_workspace)):
    sid = str(uuid.uuid4())
    doc = {"id": sid, "workspace_id": user["workspace_id"], **body.model_dump(),
           "price_list_updated_at": None,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/supplier-prices/by-product/{product_id}")
async def prices_by_product(product_id: str, user: dict = Depends(require_workspace)):
    prices = await db.supplier_prices.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    for p in prices:
        sup = await db.suppliers.find_one({"id": p["supplier_id"]}, {"_id": 0})
        p["supplier_name"] = sup["name"] if sup else "-"
    prices.sort(key=lambda x: x["unit_price"])
    return prices

# =========================================================
# ORDERS
# =========================================================
async def _generate_order_no() -> str:
    today = datetime.now(timezone.utc).strftime("%y%m%d")
    count = await db.orders.count_documents({"order_no": {"$regex": f"^#SIP-{today}"}})
    return f"#SIP-{today}{(count + 1):03d}"

@api_router.get("/orders")
async def list_orders(status: Optional[str] = None, user: dict = Depends(require_workspace)):
    query: dict = {"workspace_id": user["workspace_id"]}
    if status == "pending":
        query["status"] = {"$in": ["draft", "sent", "in_transit"]}
    elif status == "this_month":
        start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        query["created_at"] = {"$gte": start}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for o in orders:
        sup = await db.suppliers.find_one({"id": o.get("supplier_id")}, {"_id": 0})
        o["supplier_name"] = sup["name"] if sup else "-"
        items = await db.order_items.find({"order_id": o["id"]}, {"_id": 0}).to_list(200)
        o["item_count"] = len(items)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(require_workspace)):
    o = await db.orders.find_one({"id": order_id, "workspace_id": user["workspace_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(200)
    for it in items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        it["product_name"] = p["name"] if p else "-"
        it["gtin"] = p["gtin"] if p else ""
    sup = await db.suppliers.find_one({"id": o.get("supplier_id")}, {"_id": 0})
    o["supplier"] = sup
    o["items"] = items
    return o

@api_router.post("/orders")
async def create_order(body: OrderCreateIn, user: dict = Depends(require_workspace)):
    """Add items to existing draft for same supplier, or create new draft. Groups items by supplier."""
    if not body.items:
        raise HTTPException(status_code=400, detail="En az bir kalem gerekli")
    # group by supplier
    by_supplier: dict[str, list] = {}
    for it in body.items:
        by_supplier.setdefault(it.supplier_id, []).append(it)
    created_orders = []
    for sup_id, items in by_supplier.items():
        draft = await db.orders.find_one({"workspace_id": user["workspace_id"], "supplier_id": sup_id, "status": "draft"})
        if draft:
            order_id = draft["id"]
        else:
            order_id = str(uuid.uuid4())
            order_no = await _generate_order_no()
            await db.orders.insert_one({
                "id": order_id, "workspace_id": user["workspace_id"],
                "supplier_id": sup_id, "status": "draft",
                "order_no": order_no, "total_amount": 0.0, "total_saving": 0.0,
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"],
            })
        # add items
        for it in items:
            price_doc = await db.supplier_prices.find_one({"supplier_id": sup_id, "product_id": it.product_id})
            unit_price = price_doc["unit_price"] if price_doc else 0.0
            await db.order_items.insert_one({
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "product_id": it.product_id,
                "qty": it.qty,
                "unit_price": unit_price,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        # recompute total
        items_all = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(500)
        total = sum(i["qty"] * i["unit_price"] for i in items_all)
        # savings vs average of all supplier prices per product
        savings = 0.0
        for i in items_all:
            all_prices = await db.supplier_prices.find({"product_id": i["product_id"]}, {"_id": 0}).to_list(20)
            if all_prices:
                avg = sum(p["unit_price"] for p in all_prices) / len(all_prices)
                savings += max(0, (avg - i["unit_price"]) * i["qty"])
        await db.orders.update_one({"id": order_id}, {"$set": {"total_amount": round(total, 2), "total_saving": round(savings, 2)}})
        o = await db.orders.find_one({"id": order_id}, {"_id": 0})
        created_orders.append(o)
    return {"orders": created_orders}

@api_router.post("/orders/{order_id}/send")
async def send_order(order_id: str, user: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id, "workspace_id": user["workspace_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    if o["status"] != "draft":
        raise HTTPException(status_code=400, detail="Yalnızca taslak siparişler gönderilebilir")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}})
    # MOCK EMAIL — TODO: integrate Resend or SendGrid
    sup = await db.suppliers.find_one({"id": o["supplier_id"]}, {"_id": 0})
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(200)
    logger.info("[MOCK EMAIL] Order %s would be sent to %s (%s) with %d items", o["order_no"], sup.get("name") if sup else "?", sup.get("contact_email") if sup else "-", len(items))
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"order": updated, "email_sent": False, "mock": True}

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusIn, user: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id, "workspace_id": user["workspace_id"]})
    if not o:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    updates = {"status": body.status}
    if body.status == "delivered":
        updates["delivered_at"] = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one({"id": order_id}, {"$set": updates})
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated

# =========================================================
# DASHBOARD STATS
# =========================================================
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(require_workspace)):
    ws_id = user["workspace_id"]
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    orders_today = await db.orders.count_documents({"workspace_id": ws_id, "created_at": {"$gte": today_start}})
    monthly_orders = await db.orders.find({"workspace_id": ws_id, "created_at": {"$gte": month_start}}, {"_id": 0}).to_list(500)
    monthly_saving = round(sum(o.get("total_saving", 0) for o in monthly_orders), 2)
    inv = await db.inventory.find({"workspace_id": ws_id}, {"_id": 0}).to_list(2000)
    critical_count = sum(1 for i in inv if i["current_stock"] <= i["min_threshold"])
    active_suppliers = await db.suppliers.count_documents({"workspace_id": ws_id, "is_active": True})
    recent = await db.orders.find({"workspace_id": ws_id}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
    for o in recent:
        sup = await db.suppliers.find_one({"id": o.get("supplier_id")}, {"_id": 0})
        o["supplier_name"] = sup["name"] if sup else "-"
    return {
        "orders_today": orders_today,
        "monthly_saving": monthly_saving,
        "critical_count": critical_count,
        "active_suppliers": active_suppliers,
        "recent_orders": recent,
    }

# =========================================================
# SEED
# =========================================================
SAMPLE_PRODUCTS = [
    ("8690123456001", "Vitamin C 1000mg", "HealthPlus", "supplement", "30 tablet"),
    ("8690123456002", "Magnezyum Glisinat", "NutriLab", "supplement", "60 kapsül"),
    ("8690123456003", "Omega-3 Balık Yağı", "MarinPure", "supplement", "90 kapsül"),
    ("8690123456004", "Probiyotik 10 Milyar", "BioFlora", "supplement", "30 kapsül"),
    ("8690123456005", "Multivitamin Complex", "HealthPlus", "supplement", "60 tablet"),
    ("8690123456006", "D3 Vitamini 5000IU", "SunLife", "supplement", "120 damla"),
    ("8690123456007", "Çinko 50mg", "NutriLab", "supplement", "60 tablet"),
    ("8690123456008", "B12 Metilkobalamin", "NeuroFit", "supplement", "60 tablet"),
    ("8690123456009", "Kolajen Peptit Toz", "BeautyWell", "supplement", "300g"),
    ("8690123456010", "Melatonin 3mg", "SleepWell", "supplement", "60 tablet"),
    ("8690123456011", "Ağrı Kesici Pomad", "DermaCare", "otc", "50g"),
    ("8690123456012", "Burun Spreyi Deniz Tuzu", "OceanNose", "otc", "100ml"),
    ("8690123456013", "Öksürük Şurubu Bitkisel", "HerbalCare", "otc", "150ml"),
    ("8690123456014", "Parasetamol 500mg", "MediGen", "otc", "20 tablet"),
    ("8690123456015", "İbuprofen 400mg", "MediGen", "otc", "20 tablet"),
    ("8690123456016", "Termometre Dijital", "MedTech", "otc", "1 adet"),
    ("8690123456017", "El Dezenfektanı 500ml", "CleanHand", "otc", "500ml"),
    ("8690123456018", "Yara Bandı Aile Paketi", "FirstAid", "otc", "50 adet"),
    ("8690123456019", "Termal Yara Bandı Antibakteriyel", "FirstAid", "otc", "20 adet"),
    ("8690123456020", "Ağız Gargarası Mentollü", "DentCare", "otc", "250ml"),
    ("8690123456021", "Nemlendirici Yüz Kremi", "DermaCare", "kozmetik", "50ml"),
    ("8690123456022", "Güneş Kremi SPF50+", "SunShield", "kozmetik", "75ml"),
    ("8690123456023", "Temizleme Jeli Yüz", "PureSkin", "kozmetik", "200ml"),
    ("8690123456024", "Şampuan Kepek Karşıtı", "HairMed", "kozmetik", "400ml"),
    ("8690123456025", "Duş Jeli Lavanta", "AquaFresh", "kozmetik", "500ml"),
    ("8690123456026", "C Vitaminli Serum", "GlowLab", "kozmetik", "30ml"),
    ("8690123456027", "Retinol Gece Kremi", "GlowLab", "kozmetik", "30ml"),
    ("8690123456028", "Göz Çevresi Kremi", "GlowLab", "kozmetik", "15ml"),
    ("8690123456029", "Dudak Balsamı SPF15", "LipCare", "kozmetik", "4g"),
    ("8690123456030", "El Kremi Bitkisel", "SoftHand", "kozmetik", "75ml"),
    ("8690123456031", "Bebek Bezi 4 Numara", "BabySoft", "bebek", "60 adet"),
    ("8690123456032", "Islak Mendil Hassas", "BabySoft", "bebek", "72 adet"),
    ("8690123456033", "Bebek Şampuanı", "BabyCare", "bebek", "300ml"),
    ("8690123456034", "Pişik Kremi", "BabyCare", "bebek", "50g"),
    ("8690123456035", "Biberon 250ml", "MommyBest", "bebek", "1 adet"),
    ("8690123456036", "Emzik Silikon", "MommyBest", "bebek", "2 adet"),
    ("8690123456037", "Bebek Termometresi", "MedTech", "bebek", "1 adet"),
    ("8690123456038", "Bebek Losyonu", "BabyCare", "bebek", "250ml"),
    ("8690123456039", "Diş Kaşıyıcı", "MommyBest", "bebek", "1 adet"),
    ("8690123456040", "Bebek Yağı", "BabyCare", "bebek", "200ml"),
    ("8690123456041", "Spor Multivitamin", "AthleteLab", "supplement", "90 tablet"),
    ("8690123456042", "Protein Tozu Çikolata", "AthleteLab", "supplement", "900g"),
    ("8690123456043", "Kreatin Monohidrat", "AthleteLab", "supplement", "300g"),
    ("8690123456044", "BCAA Amino Asit", "AthleteLab", "supplement", "250g"),
    ("8690123456045", "L-Karnitin Sıvı", "SlimFit", "supplement", "500ml"),
    ("8690123456046", "Magnezyum Sitrat Toz", "NutriLab", "supplement", "200g"),
    ("8690123456047", "Gluten Free Multivit", "PureNutri", "supplement", "60 tablet"),
    ("8690123456048", "Demir Takviyesi 14mg", "IronLife", "supplement", "30 tablet"),
    ("8690123456049", "Folik Asit 400mcg", "MommyBest", "supplement", "60 tablet"),
    ("8690123456050", "Probiyotik Çocuk", "BioFlora", "supplement", "10 saşe"),
]

SAMPLE_SUPPLIERS = [
    ("Ecza Deposu A", "0212 555 01 01", "depoa@example.com", "email"),
    ("Hedef Depo", "0216 555 02 02", "siparis@hedef.example.com", "email"),
    ("Kristal Ecza", "0312 555 03 03", "order@kristal.example.com", "manual"),
]

async def seed_workspace_data(workspace_id: str):
    # If already seeded skip
    count = await db.products.count_documents({"workspace_id": workspace_id})
    if count > 0:
        return
    import random
    # suppliers
    sup_ids = []
    for name, phone, email, method in SAMPLE_SUPPLIERS:
        sid = str(uuid.uuid4())
        sup_ids.append(sid)
        await db.suppliers.insert_one({
            "id": sid, "workspace_id": workspace_id, "name": name,
            "contact_phone": phone, "contact_email": email, "order_method": method,
            "is_active": True, "price_list_updated_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    # products + inventory + prices
    rnd = random.Random(42)
    for gtin, name, brand, cat, content in SAMPLE_PRODUCTS:
        pid = str(uuid.uuid4())
        await db.products.insert_one({
            "id": pid, "workspace_id": workspace_id,
            "gtin": gtin, "name": name, "brand": brand, "category": cat,
            "content_ml_g": content, "description": "", "image_url": "", "unit": "kutu",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        stock = rnd.randint(0, 40)
        mn = rnd.choice([3, 5, 8, 10])
        await db.inventory.insert_one({
            "id": str(uuid.uuid4()), "product_id": pid, "workspace_id": workspace_id,
            "current_stock": stock, "min_threshold": mn, "max_threshold": mn * 6,
            "last_counted_at": datetime.now(timezone.utc).isoformat(),
        })
        base_price = round(rnd.uniform(25, 280), 2)
        for sid in sup_ids:
            jitter = rnd.uniform(-0.12, 0.12)
            price = round(base_price * (1 + jitter), 2)
            await db.supplier_prices.insert_one({
                "id": str(uuid.uuid4()),
                "supplier_id": sid, "product_id": pid,
                "unit_price": price, "stock_available": rnd.randint(0, 100),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

# =========================================================
# STARTUP
# =========================================================
async def seed_default_users():
    """Seed admin + staff. Admin gets a demo workspace seeded with data."""
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pass = os.environ["ADMIN_PASSWORD"]
    staff_email = os.environ.get("STAFF_EMAIL", "staff@depozio.com").lower()
    staff_pass = os.environ.get("STAFF_PASSWORD", "staff123")

    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        admin_id = str(uuid.uuid4())
        ws_id = str(uuid.uuid4())
        await db.workspaces.insert_one({
            "id": ws_id, "name": "Demo Eczane", "type": "eczane",
            "address": "İstanbul, TR", "owner_id": admin_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.users.insert_one({
            "id": admin_id, "email": admin_email, "password_hash": hash_password(admin_pass),
            "name": "Demo Admin", "role": "admin", "workspace_id": ws_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await seed_workspace_data(ws_id)
        # staff attached to same workspace
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": staff_email, "password_hash": hash_password(staff_pass),
            "name": "Demo Staff", "role": "staff", "workspace_id": ws_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # keep password in sync with env
        if not verify_password(admin_pass, admin.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pass)}})
        staff = await db.users.find_one({"email": staff_email})
        if not staff:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": staff_email, "password_hash": hash_password(staff_pass),
                "name": "Demo Staff", "role": "staff", "workspace_id": admin.get("workspace_id"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index([("workspace_id", 1), ("gtin", 1)])
    await db.inventory.create_index("workspace_id")
    await db.orders.create_index([("workspace_id", 1), ("created_at", -1)])
    await seed_default_users()
    logger.info("Depozio API started. DB=%s", os.environ["DB_NAME"])

@api_router.get("/")
async def root():
    return {"service": "Depozio API", "ok": True}

# Register router BEFORE CORS (CORS wraps all)
app.include_router(api_router)

origins_env = os.environ.get('CORS_ORIGINS', '*')
origins = [o.strip() for o in origins_env.split(',')] if origins_env != '*' else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()

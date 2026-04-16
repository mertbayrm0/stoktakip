import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
    Search,
    ShoppingCart,
    Package,
    TrendingUp,
    AlertTriangle,
    Truck,
    ArrowRight,
    Loader2,
    Camera,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import StatusBadge from "../components/shared/StatusBadge";
import BarcodeScanner from "../components/shared/BarcodeScanner";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

function StatCard({ icon: Icon, label, value, sub, tone = "neutral" }) {
    const toneBg = {
        neutral: "bg-white",
        primary: "bg-[#1a6b4a]/5",
        danger: "bg-rose-50/60",
    }[tone];
    return (
        <div
            data-testid={`stat-card-${label}`}
            className={`rounded-2xl border border-slate-200/60 shadow-depozio p-5 ${toneBg} hover:-translate-y-0.5 transition-transform`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="h-10 w-10 rounded-xl bg-[#1a6b4a]/10 text-[#14553b] grid place-items-center">
                    <Icon size={18} strokeWidth={2} />
                </div>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                {label}
            </div>
            <div className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                {value}
            </div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
    );
}

export default function Dashboard() {
    const nav = useNavigate();
    const [stats, setStats] = useState(null);
    const [critical, setCritical] = useState([]);
    const [query, setQuery] = useState("");
    const [scanResult, setScanResult] = useState(null);
    const [qty, setQty] = useState(1);
    const [scanning, setScanning] = useState(false);
    const [ordering, setOrdering] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);

    useEffect(() => {
        api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
        api.get("/inventory/critical").then((r) => setCritical(r.data)).catch(() => {});
    }, []);

    const runScan = async (e) => {
        e?.preventDefault?.();
        if (!query.trim()) return;
        setScanning(true);
        try {
            const { data } = await api.get("/products/search", { params: { q: query.trim() } });
            setScanResult(data);
            if (!data.found) toast.warning("Ürün kataloğunuzda bulunamadı");
        } catch (e) {
            toast.error("Arama başarısız");
        } finally {
            setScanning(false);
        }
    };

    const runScanWith = async (value) => {
        setQuery(value);
        setScanning(true);
        try {
            const { data } = await api.get("/products/search", { params: { q: value } });
            setScanResult(data);
            if (!data.found) toast.warning("Ürün kataloğunuzda bulunamadı");
            else toast.success(`Barkod okundu: ${value}`);
        } catch {
            toast.error("Arama başarısız");
        } finally {
            setScanning(false);
        }
    };

    const orderBest = async () => {
        if (!scanResult?.found || !scanResult.prices?.length) return;
        setOrdering(true);
        try {
            const best = scanResult.prices[0];
            await api.post("/orders", {
                items: [
                    { product_id: scanResult.product.id, qty: Math.max(1, qty), supplier_id: best.supplier_id },
                ],
            });
            toast.success("Taslak siparişe eklendi");
            // refresh stats
            api.get("/dashboard/stats").then((r) => setStats(r.data));
        } catch (e) {
            toast.error("Sipariş oluşturulamadı");
        } finally {
            setOrdering(false);
        }
    };

    const quickOrderCritical = async (row) => {
        if (!row.best_supplier_id) return toast.error("Bu ürün için tedarikçi fiyatı yok");
        try {
            await api.post("/orders", {
                items: [{ product_id: row.product_id, qty: row.min_threshold || 5, supplier_id: row.best_supplier_id }],
            });
            toast.success(`${row.product_name} taslağa eklendi`);
            api.get("/dashboard/stats").then((r) => setStats(r.data));
        } catch {
            toast.error("Sipariş oluşturulamadı");
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Kontrol paneli
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                    Günaydın
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Eczane operasyonlarınız bugün nasıl gidiyor?
                </p>
            </div>

            {/* Scan Bar */}
            <form
                onSubmit={runScan}
                className="relative bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-2 pl-5 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#1a6b4a]/30 transition-all"
            >
                <Search className="text-[#1a6b4a] shrink-0" size={20} />
                <Input
                    data-testid="dashboard-scan-input"
                    placeholder="Barkod (GTIN) veya ürün adı tarayın..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="border-0 shadow-none focus-visible:ring-0 h-12 text-base px-0"
                />
                <Button
                    type="button"
                    data-testid="dashboard-camera-btn"
                    onClick={() => setCameraOpen(true)}
                    variant="outline"
                    className="rounded-xl border-slate-200 h-11 px-4"
                    title="Kamerayla tara"
                >
                    <Camera size={16} />
                    <span className="ml-2 hidden sm:inline">Kamera</span>
                </Button>
                <Button
                    data-testid="dashboard-scan-btn"
                    type="submit"
                    disabled={scanning}
                    className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white h-11 px-6"
                >
                    {scanning ? <Loader2 className="animate-spin" size={16} /> : "Tara"}
                </Button>
            </form>

            <BarcodeScanner
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetected={(code) => {
                    setCameraOpen(false);
                    runScanWith(code);
                }}
            />

            {/* Scan result */}
            {scanResult && (
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6 animate-in-up">
                    {scanResult.found ? (
                        <div>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-[#1a6b4a]">
                                        Eşleşti
                                    </div>
                                    <div className="font-display text-2xl font-bold text-slate-900 mt-1">
                                        {scanResult.product.name}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        {scanResult.product.brand} · GTIN {scanResult.product.gtin}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500">Mevcut stok</div>
                                    <div className="font-display text-2xl font-bold">
                                        {scanResult.inventory?.current_stock ?? 0}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200/60">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-semibold">Tedarikçi</th>
                                            <th className="text-right px-4 py-2 font-semibold">Birim fiyat</th>
                                            <th className="text-right px-4 py-2 font-semibold">Stok</th>
                                            <th className="text-right px-4 py-2 font-semibold"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scanResult.prices.map((p, idx) => (
                                            <tr
                                                key={p.supplier_id}
                                                className={`border-t border-slate-100 ${idx === 0 ? "bg-[#1a6b4a]/5" : ""}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-slate-900">
                                                    {p.supplier_name}
                                                    {idx === 0 && (
                                                        <span className="ml-2 inline-block text-[10px] font-bold uppercase tracking-wider text-[#14553b] bg-[#1a6b4a]/15 px-1.5 py-0.5 rounded">
                                                            En iyi
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums">
                                                    {p.unit_price.toFixed(2)} ₺
                                                </td>
                                                <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                                    {p.stock_available}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {idx === 0 && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Input
                                                                data-testid="scan-qty-input"
                                                                type="number"
                                                                min={1}
                                                                value={qty}
                                                                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                                                                className="w-20 rounded-lg h-9"
                                                            />
                                                            <Button
                                                                data-testid="scan-order-btn"
                                                                onClick={orderBest}
                                                                disabled={ordering}
                                                                className="rounded-lg bg-[#1a6b4a] hover:bg-[#14553b] text-white h-9"
                                                            >
                                                                Sipariş ver
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                <Package className="text-slate-400" size={22} />
                            </div>
                            <div className="font-display text-lg font-semibold text-slate-900">
                                "{scanResult.query}" bulunamadı
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                                Kataloğa yeni ürün ekleyerek başlayın.
                            </div>
                            <Button
                                onClick={() => nav("/katalog")}
                                className="mt-4 rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white"
                                data-testid="add-to-catalog-btn"
                            >
                                Kataloga ekle
                                <ArrowRight className="ml-2" size={14} />
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={ShoppingCart}
                    label="Bugünkü sipariş"
                    value={stats?.orders_today ?? "—"}
                    sub="Son 24 saat"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Aylık tasarruf"
                    value={stats ? `${stats.monthly_saving.toFixed(0)} ₺` : "—"}
                    sub="Ortalama fiyat üzerinden"
                    tone="primary"
                />
                <StatCard
                    icon={AlertTriangle}
                    label="Kritik stok"
                    value={stats?.critical_count ?? "—"}
                    sub="Eşik altındaki ürünler"
                    tone={stats?.critical_count > 0 ? "danger" : "neutral"}
                />
                <StatCard
                    icon={Truck}
                    label="Aktif tedarikçi"
                    value={stats?.active_suppliers ?? "—"}
                    sub="Fiyat listeli"
                />
            </div>

            {/* Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Critical stock */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-display text-lg font-semibold text-slate-900">
                                Kritik stok
                            </h3>
                            <p className="text-xs text-slate-500">
                                Eşiğin altındaki ürünler — hızlı sipariş
                            </p>
                        </div>
                        <button
                            onClick={() => nav("/stok")}
                            className="text-xs font-semibold text-[#14553b] hover:underline"
                            data-testid="go-inventory-btn"
                        >
                            Tümünü gör
                        </button>
                    </div>
                    {critical.length === 0 ? (
                        <div className="text-sm text-slate-500 py-6 text-center">
                            Kritik ürün yok. Stoğunuz sağlıklı.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {critical.map((c) => (
                                <li
                                    key={c.inventory_id}
                                    className="py-3 flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-slate-900 truncate">
                                            {c.product_name}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Stok: {c.current_stock} / Eşik: {c.min_threshold}
                                        </div>
                                    </div>
                                    <Button
                                        data-testid={`quick-order-${c.product_id}`}
                                        onClick={() => quickOrderCritical(c)}
                                        size="sm"
                                        className="rounded-lg bg-[#1a6b4a] hover:bg-[#14553b] text-white"
                                    >
                                        Sipariş
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Recent orders */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-display text-lg font-semibold text-slate-900">
                                Son siparişler
                            </h3>
                            <p className="text-xs text-slate-500">
                                En yeni 3 kayıt
                            </p>
                        </div>
                        <button
                            onClick={() => nav("/siparis")}
                            className="text-xs font-semibold text-[#14553b] hover:underline"
                            data-testid="go-orders-btn"
                        >
                            Tümünü gör
                        </button>
                    </div>
                    {(stats?.recent_orders || []).length === 0 ? (
                        <div className="text-sm text-slate-500 py-6 text-center">
                            Henüz sipariş yok. Scan bar ile başlayın.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {stats.recent_orders.map((o) => (
                                <li
                                    key={o.id}
                                    className="py-3 flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-900">
                                            {o.order_no}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {o.supplier_name} · {format(new Date(o.created_at), "d MMM", { locale: tr })}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-semibold tabular-nums">
                                            {(o.total_amount || 0).toFixed(2)} ₺
                                        </div>
                                        <StatusBadge status={o.status} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

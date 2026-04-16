import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "../components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "../components/ui/dialog";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../components/ui/select";
import { CategoryPill } from "../components/shared/StatusBadge";
import { Search, Plus, Package } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
    { value: "all", label: "Tümü" },
    { value: "otc", label: "OTC" },
    { value: "supplement", label: "Supplement" },
    { value: "kozmetik", label: "Kozmetik" },
    { value: "bebek", label: "Bebek" },
    { value: "sarf", label: "Sarf" },
];

export default function Catalog() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState(searchParams.get("q") || "");
    const [category, setCategory] = useState("all");
    const [selected, setSelected] = useState(null);
    const [selectedPrices, setSelectedPrices] = useState([]);
    const [openAdd, setOpenAdd] = useState(false);
    const [newProduct, setNewProduct] = useState({
        gtin: "", name: "", brand: "", category: "otc", content_ml_g: "", unit: "kutu",
    });

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/products", { params: { q: q || undefined, category } });
            setProducts(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);

    const onSearch = (e) => {
        e.preventDefault();
        load();
    };

    const openDetail = async (p) => {
        setSelected(p);
        try {
            const { data } = await api.get(`/supplier-prices/by-product/${p.id}`);
            setSelectedPrices(data);
        } catch {
            setSelectedPrices([]);
        }
    };

    const createProduct = async (e) => {
        e.preventDefault();
        try {
            await api.post("/products", newProduct);
            toast.success("Ürün eklendi");
            setOpenAdd(false);
            setNewProduct({ gtin: "", name: "", brand: "", category: "otc", content_ml_g: "", unit: "kutu" });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Eklenemedi");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Katalog
                    </div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                        Ürün kataloğu
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {products.length} ürün · fiyat karşılaştırma ve stok özeti
                    </p>
                </div>
                <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                    <DialogTrigger asChild>
                        <Button
                            data-testid="catalog-add-btn"
                            className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white"
                        >
                            <Plus size={16} className="mr-2" /> Ürün ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                        <form onSubmit={createProduct}>
                            <DialogHeader>
                                <DialogTitle className="font-display">Yeni ürün</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="col-span-2 space-y-2">
                                    <Label>GTIN (Barkod)</Label>
                                    <Input
                                        data-testid="new-product-gtin"
                                        required
                                        value={newProduct.gtin}
                                        onChange={(e) => setNewProduct({ ...newProduct, gtin: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label>Ürün adı</Label>
                                    <Input
                                        data-testid="new-product-name"
                                        required
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Marka</Label>
                                    <Input
                                        value={newProduct.brand}
                                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kategori</Label>
                                    <Select
                                        value={newProduct.category}
                                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                                                <SelectItem key={c.value} value={c.value}>
                                                    {c.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>İçerik (ml/g)</Label>
                                    <Input
                                        value={newProduct.content_ml_g}
                                        onChange={(e) => setNewProduct({ ...newProduct, content_ml_g: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Birim</Label>
                                    <Select
                                        value={newProduct.unit}
                                        onValueChange={(v) => setNewProduct({ ...newProduct, unit: v })}
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="kutu">Kutu</SelectItem>
                                            <SelectItem value="adet">Adet</SelectItem>
                                            <SelectItem value="ml">ml</SelectItem>
                                            <SelectItem value="g">g</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter className="mt-6">
                                <Button type="submit" data-testid="new-product-submit" className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white">
                                    Ekle
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-5">
                <div className="flex items-center gap-3 flex-wrap">
                    <form onSubmit={onSearch} className="flex-1 min-w-[240px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            data-testid="catalog-search-input"
                            placeholder="Ürün adı veya marka..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="pl-9 rounded-xl"
                        />
                    </form>
                    <div className="flex gap-1.5 flex-wrap">
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.value}
                                data-testid={`catalog-cat-${c.value}`}
                                onClick={() => setCategory(c.value)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                    category === c.value
                                        ? "bg-[#1a6b4a] text-white border-[#1a6b4a]"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-5 py-3 font-semibold">Ürün</th>
                            <th className="text-left px-5 py-3 font-semibold">GTIN</th>
                            <th className="text-left px-5 py-3 font-semibold">Kategori</th>
                            <th className="text-right px-5 py-3 font-semibold">En iyi fiyat</th>
                            <th className="text-right px-5 py-3 font-semibold">Stok</th>
                            <th className="text-right px-5 py-3 font-semibold"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-slate-500">
                                    Yükleniyor...
                                </td>
                            </tr>
                        )}
                        {!loading && products.length === 0 && (
                            <tr>
                                <td colSpan="6" className="py-16 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                        <Package className="text-slate-400" size={22} />
                                    </div>
                                    <div className="font-display text-base font-semibold text-slate-900">
                                        Ürün bulunamadı
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Filtreyi sıfırlayın veya yeni ürün ekleyin.
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && products.map((p) => (
                            <tr
                                key={p.id}
                                data-testid={`catalog-row-${p.id}`}
                                onClick={() => openDetail(p)}
                                className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                            >
                                <td className="px-5 py-3">
                                    <div className="font-medium text-slate-900">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.brand}</div>
                                </td>
                                <td className="px-5 py-3 text-slate-500 tabular-nums">{p.gtin}</td>
                                <td className="px-5 py-3"><CategoryPill category={p.category} /></td>
                                <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#14553b]">
                                    {p.best_price ? `${p.best_price.toFixed(2)} ₺` : "—"}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    {p.current_stock}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSearchParams({ q: p.name });
                                            window.location.href = `/dashboard?q=${encodeURIComponent(p.name)}`;
                                        }}
                                        className="text-xs font-semibold text-[#14553b] hover:underline"
                                        data-testid={`catalog-compare-${p.id}`}
                                    >
                                        Fiyat karşılaştır
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
                <SheetContent className="sm:max-w-md rounded-l-2xl">
                    {selected && (
                        <>
                            <SheetHeader>
                                <div className="mb-2"><CategoryPill category={selected.category} /></div>
                                <SheetTitle className="font-display text-2xl">
                                    {selected.name}
                                </SheetTitle>
                                <SheetDescription>
                                    {selected.brand} · GTIN {selected.gtin}
                                </SheetDescription>
                            </SheetHeader>
                            <div className="mt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                                            Mevcut stok
                                        </div>
                                        <div className="font-display text-2xl font-bold">
                                            {selected.current_stock}
                                        </div>
                                    </div>
                                    <div className="bg-[#1a6b4a]/5 rounded-xl p-4">
                                        <div className="text-xs text-[#14553b] uppercase tracking-wider font-semibold mb-1">
                                            Min eşik
                                        </div>
                                        <div className="font-display text-2xl font-bold">
                                            {selected.min_threshold}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                        Tedarikçi fiyatları
                                    </div>
                                    <div className="border border-slate-200/60 rounded-xl overflow-hidden">
                                        {selectedPrices.length === 0 && (
                                            <div className="px-4 py-6 text-sm text-slate-500 text-center">
                                                Fiyat listesi yok
                                            </div>
                                        )}
                                        {selectedPrices.map((p, idx) => (
                                            <div
                                                key={p.supplier_id}
                                                className={`flex items-center justify-between px-4 py-3 text-sm ${idx === 0 ? "bg-[#1a6b4a]/5" : ""} ${idx > 0 ? "border-t border-slate-100" : ""}`}
                                            >
                                                <div className="font-medium text-slate-900">
                                                    {p.supplier_name}
                                                    {idx === 0 && <span className="ml-2 text-[10px] font-bold uppercase text-[#14553b]">En iyi</span>}
                                                </div>
                                                <div className="tabular-nums font-semibold">
                                                    {p.unit_price.toFixed(2)} ₺
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

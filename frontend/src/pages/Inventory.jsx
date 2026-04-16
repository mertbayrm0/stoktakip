import { useEffect, useRef, useState } from "react";
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
    DialogDescription,
    DialogFooter,
} from "../components/ui/dialog";
import { StockChip, CategoryPill } from "../components/shared/StatusBadge";
import { Pencil, AlertTriangle, Boxes, Upload, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
    { key: "all", label: "Tüm ürünler" },
    { key: "critical", label: "Kritik stok" },
    { key: "recent", label: "Son 7 gün hareketi" },
];

export default function Inventory() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("all");
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [csvOpen, setCsvOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [csvResult, setCsvResult] = useState(null);
    const fileRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/inventory", {
                params: tab === "critical" ? { filter: "critical" } : {},
            });
            let out = data;
            if (tab === "recent") out = data.filter((r) => r.turnover_30d > 0);
            setRows(out);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const openEdit = (row) => {
        setEditing(row);
        setForm({
            current_stock: row.current_stock,
            min_threshold: row.min_threshold,
            max_threshold: row.max_threshold,
        });
    };

    const saveEdit = async () => {
        if (!editing) return;
        try {
            await api.patch(`/inventory/${editing.id}`, form);
            toast.success("Stok güncellendi");
            setEditing(null);
            load();
        } catch {
            toast.error("Güncelleme başarısız");
        }
    };

    const downloadTemplate = () => {
        const csv =
            "gtin,current_stock,min_threshold,max_threshold\n" +
            "8690123456001,20,5,30\n" +
            "8690123456002,15,5,30\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "depozio-stok-sablon.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const uploadCsv = async (file) => {
        if (!file) return;
        setUploading(true);
        setCsvResult(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const { data } = await api.post("/inventory/csv", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCsvResult(data);
            toast.success(`${data.updated + data.created} satır işlendi`);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "CSV yüklenemedi");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                        Stok takibi
                    </div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                        Envanter
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Eşikler, devir hızı ve renkli stok durumu
                    </p>
                </div>
                <Button
                    data-testid="inventory-csv-btn"
                    variant="outline"
                    className="rounded-xl border-slate-200"
                    onClick={() => setCsvOpen(true)}
                >
                    <Upload size={16} className="mr-2" />
                    CSV ile yükle
                </Button>
            </div>

            <div className="border-b border-slate-200">
                <div className="flex gap-6">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            data-testid={`inv-tab-${t.key}`}
                            onClick={() => setTab(t.key)}
                            className={`py-3 -mb-px text-sm font-medium border-b-2 transition-colors ${
                                tab === t.key
                                    ? "border-[#1a6b4a] text-[#14553b]"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-5 py-3 font-semibold">Ürün</th>
                            <th className="text-left px-5 py-3 font-semibold">Kategori</th>
                            <th className="text-center px-5 py-3 font-semibold">Mevcut</th>
                            <th className="text-center px-5 py-3 font-semibold">Min</th>
                            <th className="text-center px-5 py-3 font-semibold">Max</th>
                            <th className="text-center px-5 py-3 font-semibold">30g devir</th>
                            <th className="text-right px-5 py-3 font-semibold"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-slate-500">
                                    Yükleniyor...
                                </td>
                            </tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan="7" className="py-16 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 grid place-items-center mx-auto mb-3">
                                        <Boxes className="text-emerald-500" size={22} />
                                    </div>
                                    <div className="font-display text-base font-semibold text-slate-900">
                                        {tab === "critical" ? "Kritik ürün yok. Stoğunuz sağlıklı." : "Stok kaydı yok"}
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && rows.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100">
                                <td className="px-5 py-3">
                                    <div className="font-medium text-slate-900">{r.product_name}</div>
                                    <div className="text-xs text-slate-500">{r.brand} · {r.gtin}</div>
                                </td>
                                <td className="px-5 py-3">
                                    <CategoryPill category={r.category} />
                                </td>
                                <td className="px-5 py-3 text-center">
                                    <StockChip stock={r.current_stock} min={r.min_threshold} />
                                </td>
                                <td className="px-5 py-3 text-center tabular-nums text-slate-600">
                                    {r.min_threshold}
                                </td>
                                <td className="px-5 py-3 text-center tabular-nums text-slate-600">
                                    {r.max_threshold}
                                </td>
                                <td className="px-5 py-3 text-center tabular-nums text-slate-600">
                                    {r.turnover_30d}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <Button
                                        data-testid={`inv-edit-${r.id}`}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openEdit(r)}
                                        className="rounded-lg h-8"
                                    >
                                        <Pencil size={14} className="mr-1.5" />
                                        Düzenle
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
                <SheetContent className="sm:max-w-md rounded-l-2xl">
                    {editing && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="font-display">
                                    {editing.product_name}
                                </SheetTitle>
                                <SheetDescription>Stok bilgilerini düzenle</SheetDescription>
                            </SheetHeader>
                            <div className="mt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>Mevcut stok</Label>
                                    <Input
                                        data-testid="inv-edit-stock"
                                        type="number"
                                        value={form.current_stock}
                                        onChange={(e) =>
                                            setForm({ ...form, current_stock: parseInt(e.target.value) || 0 })
                                        }
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Minimum eşik</Label>
                                    <Input
                                        data-testid="inv-edit-min"
                                        type="number"
                                        value={form.min_threshold}
                                        onChange={(e) =>
                                            setForm({ ...form, min_threshold: parseInt(e.target.value) || 0 })
                                        }
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Maksimum eşik</Label>
                                    <Input
                                        data-testid="inv-edit-max"
                                        type="number"
                                        value={form.max_threshold}
                                        onChange={(e) =>
                                            setForm({ ...form, max_threshold: parseInt(e.target.value) || 0 })
                                        }
                                        className="rounded-xl"
                                    />
                                </div>
                                {form.current_stock <= form.min_threshold && (
                                    <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <div>Bu stok kritik eşikte. Dashboard'dan hızlı sipariş oluşturabilirsiniz.</div>
                                    </div>
                                )}
                                <Button
                                    data-testid="inv-edit-save"
                                    onClick={saveEdit}
                                    className="w-full rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white h-11"
                                >
                                    Kaydet
                                </Button>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={csvOpen} onOpenChange={(v) => { setCsvOpen(v); if (!v) setCsvResult(null); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display">CSV ile toplu stok yükleme</DialogTitle>
                        <DialogDescription>
                            Başlıklar: <code className="text-xs bg-slate-100 px-1 rounded">gtin, current_stock, min_threshold, max_threshold</code>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            data-testid="csv-template-btn"
                            className="w-full flex items-center gap-2 text-sm text-[#14553b] hover:underline font-medium"
                        >
                            <FileDown size={14} /> Örnek şablonu indir
                        </button>
                        <label
                            htmlFor="csv-upload-input"
                            className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1a6b4a] bg-slate-50 hover:bg-[#1a6b4a]/5 p-8 text-center cursor-pointer transition-colors"
                        >
                            {uploading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin text-[#1a6b4a]" size={24} />
                                    <div className="text-sm text-slate-600">Yükleniyor...</div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="text-[#1a6b4a]" size={24} />
                                    <div className="text-sm font-medium text-slate-900">Dosya seç</div>
                                    <div className="text-xs text-slate-500">.csv · UTF-8</div>
                                </div>
                            )}
                        </label>
                        <input
                            ref={fileRef}
                            id="csv-upload-input"
                            data-testid="csv-upload-input"
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => uploadCsv(e.target.files?.[0])}
                        />

                        {csvResult && (
                            <div className="rounded-xl bg-[#1a6b4a]/5 border border-[#1a6b4a]/15 p-4 text-sm space-y-1">
                                <div className="font-semibold text-slate-900">Sonuç</div>
                                <div className="text-slate-700">
                                    Güncellenen: <span className="font-semibold">{csvResult.updated}</span> ·
                                    Oluşturulan: <span className="font-semibold">{csvResult.created}</span>
                                </div>
                                {csvResult.not_found?.length > 0 && (
                                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                                        Kataloğda bulunmayan {csvResult.not_found.length} barkod atlandı
                                        {csvResult.not_found.length <= 5 && `: ${csvResult.not_found.join(", ")}`}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCsvOpen(false)} className="rounded-xl">
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

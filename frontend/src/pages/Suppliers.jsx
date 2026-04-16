import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "../components/ui/dialog";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../components/ui/select";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "../components/ui/alert-dialog";
import {
    Plus,
    Mail,
    Phone,
    Upload,
    FileDown,
    Trash2,
    Pencil,
    CheckCircle2,
    Circle,
    Truck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "../context/AuthContext";

const METHOD_LABEL = { email: "Email", whatsapp: "WhatsApp", manual: "Manuel" };

export default function Suppliers() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        name: "", contact_phone: "", contact_email: "", order_method: "email", is_active: true,
    });
    const [priceCsvFor, setPriceCsvFor] = useState(null);
    const [csvResult, setCsvResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const fileRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/suppliers");
            setRows(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", contact_phone: "", contact_email: "", order_method: "email", is_active: true });
        setOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setForm({
            name: row.name,
            contact_phone: row.contact_phone || "",
            contact_email: row.contact_email || "",
            order_method: row.order_method,
            is_active: row.is_active,
        });
        setOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.patch(`/suppliers/${editing.id}`, form);
                toast.success("Tedarikçi güncellendi");
            } else {
                await api.post("/suppliers", form);
                toast.success("Tedarikçi eklendi");
            }
            setOpen(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "İşlem başarısız");
        }
    };

    const removeSupplier = async () => {
        if (!toDelete) return;
        try {
            await api.delete(`/suppliers/${toDelete.id}`);
            toast.success(`${toDelete.name} silindi`);
            setToDelete(null);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Silinemedi");
        }
    };

    const downloadTemplate = () => {
        const csv = "gtin,unit_price,stock_available\n8690123456001,45.50,100\n8690123456002,120.00,50\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "depozio-fiyat-listesi-sablon.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const uploadPriceCsv = async (file) => {
        if (!file || !priceCsvFor) return;
        setUploading(true);
        setCsvResult(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const { data } = await api.post(`/supplier-prices/csv?supplier_id=${priceCsvFor.id}`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCsvResult(data);
            toast.success(`${data.upserted} ürün için fiyat yüklendi`);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Yüklenemedi");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Tedarikçiler</div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Toptancı ağı</h1>
                    <p className="text-slate-500 text-sm mt-1">{rows.length} tedarikçi · fiyat listesi yönetimi</p>
                </div>
                <Button data-testid="supplier-add-btn" onClick={openCreate} className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white">
                    <Plus size={16} className="mr-2" /> Tedarikçi ekle
                </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="text-left px-5 py-3 font-semibold">Ad</th>
                            <th className="text-left px-5 py-3 font-semibold">İletişim</th>
                            <th className="text-left px-5 py-3 font-semibold">Sipariş yöntemi</th>
                            <th className="text-left px-5 py-3 font-semibold">Fiyat listesi</th>
                            <th className="text-center px-5 py-3 font-semibold">Durum</th>
                            <th className="text-right px-5 py-3 font-semibold"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan="6" className="text-center py-10 text-slate-500">Yükleniyor...</td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan="6" className="py-16 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                        <Truck className="text-slate-400" size={22} />
                                    </div>
                                    <div className="font-display text-base font-semibold text-slate-900">Tedarikçi yok</div>
                                </td>
                            </tr>
                        )}
                        {!loading && rows.map((s) => (
                            <tr key={s.id} className="border-t border-slate-100">
                                <td className="px-5 py-3 font-semibold text-slate-900">{s.name}</td>
                                <td className="px-5 py-3 text-xs">
                                    {s.contact_email && (
                                        <div className="flex items-center gap-1.5 text-slate-600"><Mail size={12} />{s.contact_email}</div>
                                    )}
                                    {s.contact_phone && (
                                        <div className="flex items-center gap-1.5 text-slate-500 mt-0.5"><Phone size={12} />{s.contact_phone}</div>
                                    )}
                                </td>
                                <td className="px-5 py-3"><span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">{METHOD_LABEL[s.order_method]}</span></td>
                                <td className="px-5 py-3 text-xs text-slate-500">
                                    {s.price_list_updated_at ? format(new Date(s.price_list_updated_at), "d MMM yyyy", { locale: tr }) : "—"}
                                </td>
                                <td className="px-5 py-3 text-center">
                                    {s.is_active ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={12} />Aktif</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Circle size={12} />Pasif</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button data-testid={`supplier-csv-${s.id}`} onClick={() => { setPriceCsvFor(s); setCsvResult(null); }} size="sm" variant="ghost" className="rounded-lg h-8" title="Fiyat listesi yükle">
                                            <Upload size={14} />
                                        </Button>
                                        <Button data-testid={`supplier-edit-${s.id}`} onClick={() => openEdit(s)} size="sm" variant="ghost" className="rounded-lg h-8">
                                            <Pencil size={14} />
                                        </Button>
                                        {isAdmin && (
                                            <Button data-testid={`supplier-del-${s.id}`} onClick={() => setToDelete(s)} size="sm" variant="ghost" className="rounded-lg h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="rounded-2xl">
                    <form onSubmit={save}>
                        <DialogHeader>
                            <DialogTitle className="font-display">{editing ? "Tedarikçi düzenle" : "Yeni tedarikçi"}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Ad</Label>
                                <Input data-testid="supplier-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefon</Label>
                                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="rounded-xl" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Sipariş yöntemi</Label>
                                <Select value={form.order_method} onValueChange={(v) => setForm({ ...form, order_method: v })}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="manual">Manuel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="mt-6">
                            <Button type="submit" data-testid="supplier-save-btn" className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white">
                                {editing ? "Kaydet" : "Ekle"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!priceCsvFor} onOpenChange={(v) => { if (!v) { setPriceCsvFor(null); setCsvResult(null); } }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display">Fiyat listesi yükle</DialogTitle>
                        <DialogDescription>
                            {priceCsvFor?.name} — Başlıklar: <code className="text-xs bg-slate-100 px-1 rounded">gtin, unit_price, stock_available</code>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <button type="button" onClick={downloadTemplate} className="w-full flex items-center gap-2 text-sm text-[#14553b] hover:underline font-medium">
                            <FileDown size={14} /> Örnek şablonu indir
                        </button>
                        <label htmlFor="sup-csv" className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1a6b4a] bg-slate-50 hover:bg-[#1a6b4a]/5 p-8 text-center cursor-pointer transition-colors">
                            {uploading ? <div className="text-sm text-slate-600">Yükleniyor...</div> : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="text-[#1a6b4a]" size={24} />
                                    <div className="text-sm font-medium text-slate-900">Dosya seç</div>
                                    <div className="text-xs text-slate-500">.csv · UTF-8</div>
                                </div>
                            )}
                        </label>
                        <input ref={fileRef} id="sup-csv" data-testid="supplier-csv-input" type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => uploadPriceCsv(e.target.files?.[0])} />
                        {csvResult && (
                            <div className="rounded-xl bg-[#1a6b4a]/5 border border-[#1a6b4a]/15 p-4 text-sm">
                                <div className="font-semibold text-slate-900 mb-1">Sonuç</div>
                                <div className="text-slate-700">Yüklenen fiyat: <span className="font-semibold">{csvResult.upserted}</span></div>
                                {csvResult.not_found?.length > 0 && (
                                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">Bulunamayan {csvResult.not_found.length} barkod atlandı</div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tedarikçiyi sil?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-semibold">{toDelete?.name}</span> tedarikçisi ve ilişkili fiyat listesi silinecek. Mevcut siparişler etkilenmez.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel>
                        <AlertDialogAction data-testid="confirm-del-supplier" onClick={removeSupplier} className="rounded-xl bg-rose-600 hover:bg-rose-700">Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

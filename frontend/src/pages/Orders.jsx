import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
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
    DialogFooter,
} from "../components/ui/dialog";
import StatusBadge from "../components/shared/StatusBadge";
import { Send, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "../context/AuthContext";

const TABS = [
    { key: "all", label: "Tümü" },
    { key: "pending", label: "Bekleyen" },
    { key: "this_month", label: "Bu ay" },
];

export default function Orders() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("all");
    const [selected, setSelected] = useState(null);
    const [confirmSend, setConfirmSend] = useState(false);
    const [sending, setSending] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/orders", { params: tab !== "all" ? { status: tab } : {} });
            setOrders(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const openDetail = async (id) => {
        try {
            const { data } = await api.get(`/orders/${id}`);
            setSelected(data);
        } catch {
            toast.error("Sipariş açılamadı");
        }
    };

    const sendOrder = async () => {
        if (!selected) return;
        setSending(true);
        try {
            const { data } = await api.post(`/orders/${selected.id}/send`);
            toast.success("Sipariş gönderildi (email mock)");
            setConfirmSend(false);
            setSelected(data.order);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Gönderilemedi");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Siparişler
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                    Satın alma
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Taslak → gönder → yolda → teslim edildi
                </p>
            </div>

            <div className="border-b border-slate-200">
                <div className="flex gap-6">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            data-testid={`orders-tab-${t.key}`}
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
                            <th className="text-left px-5 py-3 font-semibold">Sipariş no</th>
                            <th className="text-left px-5 py-3 font-semibold">Tedarikçi</th>
                            <th className="text-left px-5 py-3 font-semibold">Tarih</th>
                            <th className="text-center px-5 py-3 font-semibold">Kalem</th>
                            <th className="text-right px-5 py-3 font-semibold">Tutar</th>
                            <th className="text-right px-5 py-3 font-semibold">Tasarruf</th>
                            <th className="text-left px-5 py-3 font-semibold">Durum</th>
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
                        {!loading && orders.length === 0 && (
                            <tr>
                                <td colSpan="7" className="py-16 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                        <ClipboardList className="text-slate-400" size={22} />
                                    </div>
                                    <div className="font-display text-base font-semibold text-slate-900">
                                        Sipariş yok
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Dashboard scan bar ile ilk siparişinizi oluşturun.
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && orders.map((o) => (
                            <tr
                                key={o.id}
                                data-testid={`order-row-${o.id}`}
                                onClick={() => openDetail(o.id)}
                                className="border-t border-slate-100 hover:bg-slate-50/70 cursor-pointer"
                            >
                                <td className="px-5 py-3 font-semibold text-slate-900">{o.order_no}</td>
                                <td className="px-5 py-3 text-slate-700">{o.supplier_name}</td>
                                <td className="px-5 py-3 text-slate-500">
                                    {format(new Date(o.created_at), "d MMM yyyy", { locale: tr })}
                                </td>
                                <td className="px-5 py-3 text-center tabular-nums">{o.item_count}</td>
                                <td className="px-5 py-3 text-right tabular-nums font-semibold">
                                    {(o.total_amount || 0).toFixed(2)} ₺
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums text-[#14553b] font-semibold">
                                    {(o.total_saving || 0).toFixed(2)} ₺
                                </td>
                                <td className="px-5 py-3">
                                    <StatusBadge status={o.status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
                <SheetContent className="sm:max-w-lg rounded-l-2xl overflow-y-auto">
                    {selected && (
                        <>
                            <SheetHeader>
                                <div className="mb-2"><StatusBadge status={selected.status} /></div>
                                <SheetTitle className="font-display text-2xl">
                                    {selected.order_no}
                                </SheetTitle>
                                <SheetDescription>
                                    {selected.supplier?.name} ·{" "}
                                    {format(new Date(selected.created_at), "d MMM yyyy · HH:mm", { locale: tr })}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="mt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl p-4">
                                        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Toplam</div>
                                        <div className="font-display text-2xl font-bold">
                                            {(selected.total_amount || 0).toFixed(2)} ₺
                                        </div>
                                    </div>
                                    <div className="bg-[#1a6b4a]/5 rounded-xl p-4">
                                        <div className="text-xs uppercase tracking-wider font-semibold text-[#14553b] mb-1">Tasarruf</div>
                                        <div className="font-display text-2xl font-bold text-[#14553b]">
                                            {(selected.total_saving || 0).toFixed(2)} ₺
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                        Kalemler
                                    </div>
                                    <div className="border border-slate-200/60 rounded-xl overflow-hidden">
                                        {(selected.items || []).map((it, idx) => (
                                            <div
                                                key={it.id}
                                                className={`px-4 py-3 flex items-center justify-between text-sm ${idx > 0 ? "border-t border-slate-100" : ""}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-900 truncate">{it.product_name}</div>
                                                    <div className="text-xs text-slate-500">{it.gtin} · {it.qty} × {it.unit_price.toFixed(2)} ₺</div>
                                                </div>
                                                <div className="font-semibold tabular-nums">
                                                    {(it.qty * it.unit_price).toFixed(2)} ₺
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selected.status === "draft" && isAdmin && (
                                    <Button
                                        data-testid="order-send-btn"
                                        onClick={() => setConfirmSend(true)}
                                        className="w-full rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white h-11"
                                    >
                                        <Send size={16} className="mr-2" />
                                        Tedarikçiye gönder
                                    </Button>
                                )}
                                {selected.status === "draft" && !isAdmin && (
                                    <div className="text-xs text-slate-500 text-center">
                                        Yalnızca yönetici siparişi gönderebilir.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-display">Siparişi gönder</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-slate-600">
                        {selected?.order_no} numaralı sipariş{" "}
                        <span className="font-semibold text-slate-900">
                            {selected?.supplier?.name}
                        </span>{" "}
                        tedarikçisine email olarak gönderilecek.
                        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                            Email altyapısı henüz bağlı değil — bu gönderim sonraki aşamada Resend/SendGrid ile aktifleşecek.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmSend(false)}>İptal</Button>
                        <Button
                            data-testid="confirm-send-btn"
                            onClick={sendOrder}
                            disabled={sending}
                            className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white"
                        >
                            {sending ? "Gönderiliyor..." : "Onayla ve gönder"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

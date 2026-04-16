import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { FileDown, TrendingUp } from "lucide-react";
import { CategoryPill } from "../components/shared/StatusBadge";
import { toast } from "sonner";

export default function Reports() {
    const [monthly, setMonthly] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/reports/monthly-savings").then((r) => r.data).catch(() => []),
            api.get("/reports/category-distribution").then((r) => r.data).catch(() => []),
        ]).then(([m, c]) => {
            setMonthly(m);
            setCategories(c);
            setLoading(false);
        });
    }, []);

    const totalSaving = monthly.reduce((a, b) => a + (b.total_saving || 0), 0);
    const totalAmount = monthly.reduce((a, b) => a + (b.total_amount || 0), 0);

    const downloadOrdersCsv = async () => {
        try {
            const { data } = await api.get("/reports/orders-csv", { responseType: "blob" });
            const blob = new Blob([data], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "depozio-siparisler.csv";
            a.click();
            URL.revokeObjectURL(url);
            toast.success("İndirme başladı");
        } catch {
            toast.error("İndirme başarısız");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Raporlar</div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Performans</h1>
                    <p className="text-slate-500 text-sm mt-1">Son 6 ay · tasarruf ve kategori dağılımı</p>
                </div>
                <Button data-testid="reports-csv-btn" onClick={downloadOrdersCsv} variant="outline" className="rounded-xl border-slate-200">
                    <FileDown size={16} className="mr-2" /> Siparişleri CSV indir
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Toplam ciro (6 ay)</div>
                    <div className="font-display text-3xl font-bold tabular-nums">{totalAmount.toFixed(0)} ₺</div>
                </div>
                <div className="bg-[#1a6b4a]/5 rounded-2xl border border-[#1a6b4a]/15 shadow-depozio p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#14553b] mb-1">Toplam tasarruf (6 ay)</div>
                    <div className="font-display text-3xl font-bold text-[#14553b] tabular-nums">{totalSaving.toFixed(0)} ₺</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Toplam sipariş</div>
                    <div className="font-display text-3xl font-bold tabular-nums">{monthly.reduce((a, b) => a + (b.order_count || 0), 0)}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                <div className="flex items-center gap-2 mb-5">
                    <TrendingUp size={18} className="text-[#1a6b4a]" />
                    <h3 className="font-display text-lg font-semibold text-slate-900">Aylık tasarruf</h3>
                </div>
                {loading ? (
                    <div className="h-80 grid place-items-center text-slate-500 text-sm">Yükleniyor...</div>
                ) : (
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthly} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} ₺`} />
                                <Tooltip
                                    cursor={{ fill: "rgba(26, 107, 74, 0.06)" }}
                                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                                    formatter={(v, n) => [`${v.toFixed(2)} ₺`, n === "total_saving" ? "Tasarruf" : "Ciro"]}
                                />
                                <Bar dataKey="total_saving" fill="#1a6b4a" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                <h3 className="font-display text-lg font-semibold text-slate-900 mb-5">Kategori dağılımı</h3>
                {loading ? (
                    <div className="text-sm text-slate-500">Yükleniyor...</div>
                ) : categories.length === 0 ? (
                    <div className="text-sm text-slate-500 py-6 text-center">Henüz sipariş verisi yok.</div>
                ) : (
                    <div className="space-y-4">
                        {categories.map((c) => (
                            <div key={c.category} data-testid={`cat-row-${c.category}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <CategoryPill category={c.category} />
                                    <div className="text-sm tabular-nums">
                                        <span className="font-semibold">{c.amount.toFixed(2)} ₺</span>
                                        <span className="text-slate-400 ml-2">· {c.percentage}%</span>
                                    </div>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full bg-[#1a6b4a] transition-all" style={{ width: `${c.percentage}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

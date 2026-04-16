import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "../components/ui/dialog";
import { Percent, Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Discount() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const [suppliers, setSuppliers] = useState([]);
    const [rules, setRules] = useState([]);
    const [supplierId, setSupplierId] = useState("");
    const [revenue, setRevenue] = useState("");
    const [openRule, setOpenRule] = useState(false);
    const [ruleForm, setRuleForm] = useState({ supplier_id: "", min_amount: 0, max_amount: "", discount_pct: 0 });

    const load = async () => {
        const [s, r] = await Promise.all([
            api.get("/suppliers").then((x) => x.data).catch(() => []),
            api.get("/discount-rules").then((x) => x.data).catch(() => []),
        ]);
        setSuppliers(s);
        setRules(r);
        if (s.length && !supplierId) setSupplierId(s[0].id);
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const supplierRules = useMemo(
        () => rules.filter((r) => r.supplier_id === supplierId).sort((a, b) => a.min_amount - b.min_amount),
        [rules, supplierId],
    );

    const activeRule = useMemo(() => {
        const amt = parseFloat(revenue);
        if (isNaN(amt)) return null;
        return supplierRules.find(
            (r) => amt >= r.min_amount && (r.max_amount == null || amt < r.max_amount),
        );
    }, [revenue, supplierRules]);

    const discountAmount = activeRule ? (parseFloat(revenue) * activeRule.discount_pct) / 100 : 0;
    const finalAmount = activeRule ? parseFloat(revenue) - discountAmount : parseFloat(revenue) || 0;

    const saveRule = async (e) => {
        e.preventDefault();
        try {
            const body = {
                supplier_id: ruleForm.supplier_id,
                min_amount: parseFloat(ruleForm.min_amount) || 0,
                max_amount: ruleForm.max_amount === "" ? null : parseFloat(ruleForm.max_amount),
                discount_pct: parseFloat(ruleForm.discount_pct) || 0,
            };
            await api.post("/discount-rules", body);
            toast.success("Kural eklendi");
            setOpenRule(false);
            setRuleForm({ supplier_id: "", min_amount: 0, max_amount: "", discount_pct: 0 });
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Eklenemedi");
        }
    };

    const removeRule = async (id) => {
        try {
            await api.delete(`/discount-rules/${id}`);
            toast.success("Kural silindi");
            load();
        } catch {
            toast.error("Silinemedi");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">İskonto hesabı</div>
                    <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Ciro iskontosu</h1>
                    <p className="text-slate-500 text-sm mt-1">Tedarikçi kırılımlarına göre ciro bazlı iskonto hesaplaması</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <Calculator size={18} className="text-[#1a6b4a]" />
                            <h3 className="font-display text-lg font-semibold text-slate-900">Hesapla</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tedarikçi</Label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger data-testid="discount-supplier-select" className="rounded-xl"><SelectValue placeholder="Seçin" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ciro (₺)</Label>
                                <Input data-testid="discount-revenue-input" type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="rounded-xl" placeholder="Örn: 10000" />
                            </div>
                        </div>
                    </div>

                    {revenue && !isNaN(parseFloat(revenue)) && (
                        <div className="bg-[#1a6b4a]/5 rounded-2xl border border-[#1a6b4a]/15 p-6 animate-in-up">
                            <div className="text-xs font-semibold uppercase tracking-wider text-[#14553b] mb-2">Sonuç</div>
                            {activeRule ? (
                                <>
                                    <div className="text-slate-700 text-sm">Uygulanan iskonto:</div>
                                    <div className="font-display text-4xl font-bold text-[#14553b] mt-1">%{activeRule.discount_pct}</div>
                                    <div className="mt-4 space-y-1 text-sm">
                                        <div className="flex justify-between"><span className="text-slate-500">Ciro</span><span className="tabular-nums">{parseFloat(revenue).toFixed(2)} ₺</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">İskonto tutarı</span><span className="tabular-nums text-rose-600">-{discountAmount.toFixed(2)} ₺</span></div>
                                        <div className="flex justify-between border-t border-[#1a6b4a]/15 mt-2 pt-2 font-semibold"><span>Net tutar</span><span className="tabular-nums">{finalAmount.toFixed(2)} ₺</span></div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-slate-600">Bu ciro dilimi için tanımlı kural yok.</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Percent size={18} className="text-[#1a6b4a]" />
                            <h3 className="font-display text-lg font-semibold text-slate-900">İskonto kuralları</h3>
                        </div>
                        {isAdmin && (
                            <Dialog open={openRule} onOpenChange={setOpenRule}>
                                <DialogTrigger asChild>
                                    <Button data-testid="add-rule-btn" size="sm" className="rounded-lg bg-[#1a6b4a] hover:bg-[#14553b] text-white h-8">
                                        <Plus size={14} className="mr-1" /> Kural ekle
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-2xl">
                                    <form onSubmit={saveRule}>
                                        <DialogHeader><DialogTitle className="font-display">Yeni iskonto kuralı</DialogTitle></DialogHeader>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div className="col-span-2 space-y-2">
                                                <Label>Tedarikçi</Label>
                                                <Select value={ruleForm.supplier_id} onValueChange={(v) => setRuleForm({ ...ruleForm, supplier_id: v })}>
                                                    <SelectTrigger className="rounded-xl" data-testid="rule-supplier-select"><SelectValue placeholder="Seçin" /></SelectTrigger>
                                                    <SelectContent>
                                                        {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Min ciro (₺)</Label>
                                                <Input type="number" required value={ruleForm.min_amount} onChange={(e) => setRuleForm({ ...ruleForm, min_amount: e.target.value })} className="rounded-xl" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Max ciro (₺) — opsiyonel</Label>
                                                <Input type="number" value={ruleForm.max_amount} onChange={(e) => setRuleForm({ ...ruleForm, max_amount: e.target.value })} className="rounded-xl" />
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <Label>İskonto yüzdesi (%)</Label>
                                                <Input type="number" required min="0" max="100" step="0.1" value={ruleForm.discount_pct} onChange={(e) => setRuleForm({ ...ruleForm, discount_pct: e.target.value })} className="rounded-xl" />
                                            </div>
                                        </div>
                                        <DialogFooter className="mt-6">
                                            <Button type="submit" data-testid="rule-save-btn" className="rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white" disabled={!ruleForm.supplier_id}>Ekle</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>

                    {supplierRules.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                            Bu tedarikçi için tanımlı kural yok.
                            {isAdmin && <div className="text-xs mt-1">Yönetici olarak yukarıdan ekleyebilirsiniz.</div>}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200/60">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 font-semibold">Min ciro</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Max ciro</th>
                                        <th className="text-right px-4 py-2.5 font-semibold">İskonto</th>
                                        {isAdmin && <th className="w-10 px-4"></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierRules.map((r) => (
                                        <tr key={r.id} className={`border-t border-slate-100 ${activeRule?.id === r.id ? "bg-[#1a6b4a]/5" : ""}`}>
                                            <td className="px-4 py-2.5 tabular-nums">{r.min_amount.toFixed(2)} ₺</td>
                                            <td className="px-4 py-2.5 tabular-nums text-slate-500">{r.max_amount != null ? `${r.max_amount.toFixed(2)} ₺` : "∞"}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-[#14553b]">%{r.discount_pct}</td>
                                            {isAdmin && (
                                                <td className="px-4 py-2.5 text-right">
                                                    <button onClick={() => removeRule(r.id)} className="text-rose-500 hover:text-rose-700" data-testid={`rule-del-${r.id}`}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

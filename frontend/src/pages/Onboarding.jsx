import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Pill, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
    const { user, workspace, setupWorkspace } = useAuth();
    const nav = useNavigate();
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);

    if (user === false) return <Navigate to="/login" replace />;
    if (workspace) return <Navigate to="/dashboard" replace />;

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const res = await setupWorkspace({ name, type: "eczane", address });
        setLoading(false);
        if (res.ok) {
            toast.success("İşletme hazır — demo veriler yüklendi.");
            nav("/dashboard");
        } else {
            toast.error(res.error || "Kurulum başarısız");
        }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-[#F9FAF9] px-6 py-12">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-depozio border border-slate-200/60 p-8 animate-in-up">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-[#1a6b4a] grid place-items-center">
                        <Pill className="text-white" size={20} />
                    </div>
                    <div className="font-display font-bold text-xl">Depozio</div>
                </div>

                <div className="text-xs font-semibold uppercase tracking-wider text-[#1a6b4a] mb-2">
                    Adım 1 / 1
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-slate-900">
                    Eczanenizi kuralım
                </h1>
                <p className="text-sm text-slate-500 mb-8">
                    İşletme bilgilerinizi girin — demo kataloğunuz otomatik
                    yüklensin.
                </p>

                <form onSubmit={onSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="ws-name">Eczane adı</Label>
                        <Input
                            id="ws-name"
                            data-testid="onboarding-name-input"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Örn: Merkez Eczanesi"
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ws-addr">Adres</Label>
                        <Textarea
                            id="ws-addr"
                            data-testid="onboarding-address-input"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Mahalle, ilçe, şehir"
                            className="rounded-xl min-h-[80px]"
                        />
                    </div>

                    <div className="rounded-xl bg-[#1a6b4a]/5 border border-[#1a6b4a]/15 p-4 text-sm text-slate-700 flex gap-3">
                        <CheckCircle2 className="text-[#1a6b4a] shrink-0 mt-0.5" size={18} />
                        <div>
                            <div className="font-semibold text-slate-900 mb-0.5">
                                Demo veri paketi
                            </div>
                            <div className="text-slate-600 text-xs leading-relaxed">
                                50 örnek ürün, 3 tedarikçi ve rastgele fiyat
                                listesi otomatik yüklenir.
                            </div>
                        </div>
                    </div>

                    <Button
                        data-testid="onboarding-submit-btn"
                        type="submit"
                        disabled={loading || !name}
                        className="w-full rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white h-11"
                    >
                        {loading ? "Hazırlanıyor..." : "Panele gir"}
                    </Button>
                </form>
            </div>
        </div>
    );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Pill, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState("admin@depozio.com");
    const [password, setPassword] = useState("admin123");
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const res = await login(email, password);
        setLoading(false);
        if (res.ok) {
            toast.success("Giriş başarılı");
            nav(res.user?.workspace_id ? "/dashboard" : "/onboarding");
        } else {
            toast.error(res.error || "Giriş başarısız");
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-white">
            <div className="relative hidden lg:block">
                <img
                    alt="Eczane"
                    src="https://images.unsplash.com/photo-1775210727551-42bc213b2c44?w=1200"
                    className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a6b4a]/70 via-[#1a6b4a]/40 to-[#14553b]/70" />
                <div className="absolute inset-0 bg-grid-soft opacity-30" />
                <div className="relative h-full flex flex-col justify-between p-12 text-white">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
                            <Pill size={20} />
                        </div>
                        <div className="font-display font-bold text-xl">Depozio</div>
                    </div>
                    <div className="max-w-md">
                        <h1 className="font-display text-4xl font-bold leading-tight mb-4">
                            Eczaneniz için akıllı satın alma
                        </h1>
                        <p className="text-white/80 text-base leading-relaxed">
                            OTC, supplement ve kozmetik kategorilerinde fiyat
                            karşılaştırma, stok takibi ve tedarikçi yönetimi —
                            tek yerden.
                        </p>
                    </div>
                    <div className="text-xs text-white/60">© 2026 Depozio</div>
                </div>
            </div>

            <div className="flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-sm animate-in-up">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="h-10 w-10 rounded-xl bg-[#1a6b4a] grid place-items-center">
                            <Pill className="text-white" size={20} />
                        </div>
                        <div className="font-display font-bold text-xl">Depozio</div>
                    </div>

                    <h2 className="font-display text-3xl font-bold tracking-tight mb-2 text-slate-900">
                        Tekrar hoş geldiniz
                    </h2>
                    <p className="text-sm text-slate-500 mb-8">
                        Eczane hesabınıza giriş yapın.
                    </p>

                    <form onSubmit={onSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-posta</Label>
                            <Input
                                data-testid="login-email-input"
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Şifre</Label>
                            <Input
                                data-testid="login-password-input"
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="rounded-xl"
                            />
                        </div>

                        <Button
                            data-testid="login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-[#1a6b4a] hover:bg-[#14553b] text-white h-11"
                        >
                            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
                            {!loading && <ArrowRight className="ml-2" size={16} />}
                        </Button>
                    </form>

                    <div className="mt-6 text-sm text-slate-500">
                        Hesabınız yok mu?{" "}
                        <Link to="/register" className="text-[#1a6b4a] font-semibold hover:underline" data-testid="goto-register">
                            Kayıt olun
                        </Link>
                    </div>

                    <div className="mt-10 rounded-xl bg-slate-50 border border-slate-200/60 p-4 text-xs text-slate-600">
                        <div className="font-semibold text-slate-700 mb-1">Demo hesabı</div>
                        admin@depozio.com / admin123
                    </div>
                </div>
            </div>
        </div>
    );
}

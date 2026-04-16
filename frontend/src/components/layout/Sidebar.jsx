import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    PackageSearch,
    Boxes,
    ClipboardList,
    Percent,
    BarChart3,
    Truck,
    Plug,
    LogOut,
    Pill,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const active = "bg-[#1a6b4a]/10 text-[#14553b] font-semibold";
const idle = "text-slate-600 hover:bg-slate-100";

const mainItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Kontrol paneli", testId: "nav-dashboard" },
    { to: "/katalog", icon: PackageSearch, label: "Katalog", testId: "nav-catalog" },
    { to: "/stok", icon: Boxes, label: "Stok takibi", testId: "nav-inventory" },
    { to: "/siparis", icon: ClipboardList, label: "Siparişler", testId: "nav-orders" },
    { to: "/tedarikci", icon: Truck, label: "Tedarikçiler", testId: "nav-suppliers" },
    { to: "/iskonto", icon: Percent, label: "İskonto hesabı", testId: "nav-discount" },
    { to: "/raporlar", icon: BarChart3, label: "Raporlar", testId: "nav-reports" },
    { to: "/entegrasyon", icon: Plug, label: "Entegrasyonlar", testId: "nav-integrations" },
];

const placeholders = [];

export default function Sidebar() {
    const { user, workspace, logout } = useAuth();
    const nav = useNavigate();

    return (
        <aside
            data-testid="app-sidebar"
            className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-[#F9FAF9] border-r border-slate-200/70 px-5 py-6 gap-6 z-30"
        >
            <div className="flex items-center gap-3 px-1">
                <div className="h-10 w-10 rounded-xl bg-[#1a6b4a] grid place-items-center shadow-depozio">
                    <Pill className="text-white" size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <div className="font-display font-bold text-lg text-slate-900 leading-none">
                        Depozio
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {workspace?.name || "Eczane"}
                    </div>
                </div>
            </div>

            <nav className="flex flex-col gap-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-1">
                    Ana menü
                </div>
                {mainItems.map((it) => (
                    <NavLink
                        key={it.to}
                        to={it.to}
                        data-testid={it.testId}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                                isActive ? active : idle
                            }`
                        }
                    >
                        <it.icon size={18} strokeWidth={2} />
                        <span>{it.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="mt-auto border-t border-slate-200/70 pt-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1a6b4a] to-[#14553b] grid place-items-center text-white font-semibold text-sm">
                        {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                            {user?.name || "Kullanıcı"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {user?.role === "admin" ? "Yönetici" : "Personel"}
                        </div>
                    </div>
                    <button
                        data-testid="logout-btn"
                        onClick={async () => {
                            await logout();
                            nav("/login");
                        }}
                        className="p-2 text-slate-500 hover:text-[#14553b] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Çıkış yap"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </aside>
    );
}

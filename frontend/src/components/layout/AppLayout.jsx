import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout() {
    const { user, workspace } = useAuth();

    if (user === null) {
        return (
            <div className="min-h-screen grid place-items-center">
                <div className="text-slate-500 text-sm">Yükleniyor...</div>
            </div>
        );
    }
    if (user === false) return <Navigate to="/login" replace />;
    if (!workspace) return <Navigate to="/onboarding" replace />;

    return (
        <div className="min-h-screen bg-[#F9FAF9]">
            <Sidebar />
            <main className="lg:pl-64 min-h-screen">
                <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

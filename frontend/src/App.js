import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Discount from "./pages/Discount";
import Integrations from "./pages/Integrations";
import { Toaster } from "./components/ui/sonner";

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/onboarding" element={<Onboarding />} />

                        <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/katalog" element={<Catalog />} />
                            <Route path="/stok" element={<Inventory />} />
                            <Route path="/siparis" element={<Orders />} />
                            <Route path="/iskonto" element={<Discount />} />
                            <Route path="/raporlar" element={<Reports />} />
                            <Route path="/tedarikci" element={<Suppliers />} />
                            <Route path="/entegrasyon" element={<Integrations />} />
                        </Route>

                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
                <Toaster position="top-right" richColors />
            </AuthProvider>
        </div>
    );
}

export default App;

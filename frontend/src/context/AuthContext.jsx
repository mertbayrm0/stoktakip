import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null=checking, false=logged out, obj=logged in
    const [workspace, setWorkspace] = useState(null);

    const loadMe = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
            if (data?.workspace_id) {
                try {
                    const ws = await api.get("/workspace");
                    setWorkspace(ws.data);
                } catch {
                    setWorkspace(null);
                }
            } else {
                setWorkspace(null);
            }
        } catch {
            setUser(false);
            setWorkspace(null);
        }
    }, []);

    useEffect(() => {
        loadMe();
    }, [loadMe]);

    const login = async (email, password) => {
        try {
            const { data } = await api.post("/auth/login", { email, password });
            if (data?.access_token) localStorage.setItem("depozio_token", data.access_token);
            setUser(data.user);
            if (data.user?.workspace_id) {
                const ws = await api.get("/workspace");
                setWorkspace(ws.data);
            }
            return { ok: true, user: data.user };
        } catch (e) {
            return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
        }
    };

    const register = async (email, password, name) => {
        try {
            const { data } = await api.post("/auth/register", { email, password, name });
            if (data?.access_token) localStorage.setItem("depozio_token", data.access_token);
            setUser(data.user);
            return { ok: true, user: data.user };
        } catch (e) {
            return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
        }
    };

    const setupWorkspace = async (payload) => {
        try {
            const { data } = await api.post("/workspace/setup", payload);
            if (data?.access_token) localStorage.setItem("depozio_token", data.access_token);
            setWorkspace(data.workspace);
            await loadMe();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
        }
    };

    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            /* ignore */
        }
        localStorage.removeItem("depozio_token");
        setUser(false);
        setWorkspace(null);
    };

    return (
        <AuthContext.Provider value={{ user, workspace, login, register, logout, setupWorkspace, reload: loadMe }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

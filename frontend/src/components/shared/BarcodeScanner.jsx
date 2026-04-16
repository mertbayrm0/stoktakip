import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "../ui/dialog";
import { Camera, AlertCircle } from "lucide-react";

export default function BarcodeScanner({ open, onClose, onDetected }) {
    const scannerRef = useRef(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState("Kameraya erişiliyor...");

    useEffect(() => {
        if (!open) return undefined;
        let scanner = null;
        let cancelled = false;

        const boot = async () => {
            try {
                // Ensure DOM element exists
                await new Promise((r) => setTimeout(r, 50));
                const el = document.getElementById("depozio-barcode-reader");
                if (!el) {
                    setError("Tarayıcı alanı yüklenemedi");
                    return;
                }
                scanner = new Html5Qrcode("depozio-barcode-reader", { verbose: false });
                scannerRef.current = scanner;
                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 260, height: 140 },
                        aspectRatio: 1.6,
                    },
                    (decodedText) => {
                        if (cancelled) return;
                        cancelled = true;
                        onDetected?.(decodedText);
                        scanner
                            .stop()
                            .then(() => scanner.clear())
                            .catch(() => {});
                    },
                    () => {},
                );
                setStatus("Barkodu kare içine yerleştirin");
            } catch (e) {
                const msg = e?.message || String(e);
                if (/permission|not allowed|denied/i.test(msg)) {
                    setError("Kamera izni reddedildi. Tarayıcıdan izin verin.");
                } else if (/not found|NotFoundError/i.test(msg)) {
                    setError("Kamera bulunamadı. Masaüstünde kamera bağlı değil olabilir.");
                } else {
                    setError(msg);
                }
            }
        };
        boot();

        return () => {
            cancelled = true;
            if (scannerRef.current) {
                try {
                    scannerRef.current
                        .stop()
                        .then(() => scannerRef.current.clear())
                        .catch(() => {});
                } catch {
                    /* ignore */
                }
                scannerRef.current = null;
            }
        };
    }, [open, onDetected]);

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) onClose?.();
            }}
        >
            <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                        <Camera size={18} /> Barkod tara
                    </DialogTitle>
                    <DialogDescription>
                        Kamerayı ürün barkoduna tutun — otomatik algılanır.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-3">
                    {error ? (
                        <div className="flex gap-3 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <div className="font-semibold mb-0.5">Kamera kullanılamıyor</div>
                                <div className="text-xs">{error}</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                id="depozio-barcode-reader"
                                data-testid="barcode-reader"
                                className="w-full rounded-xl overflow-hidden bg-slate-900 aspect-[16/10]"
                            />
                            <div className="text-xs text-slate-500 text-center mt-3">
                                {status}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

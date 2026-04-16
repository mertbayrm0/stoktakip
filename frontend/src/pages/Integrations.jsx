import { Plug, Barcode, Stethoscope, MessageCircle, Mail, Link2, ShoppingBag } from "lucide-react";

const INTEGRATIONS = [
    {
        key: "gs1",
        name: "GS1 Türkiye Verified",
        description: "Barkod tarandığında ürün adı, marka ve içerik otomatik çekilir. Kataloga manuel giriş ortadan kalkar.",
        icon: Barcode,
        status: "pasif",
        category: "Veri",
    },
    {
        key: "eczanem",
        name: "Eczanem / İlon",
        description: "Eczane otomasyon yazılımı ile stok senkronizasyonu (SOAP API). Mevcut sistemle paralel çalışır.",
        icon: Plug,
        status: "pasif",
        category: "Otomasyon",
    },
    {
        key: "bulutvet",
        name: "BulutVet",
        description: "Veteriner klinik otomasyonu — stok okuma ve sipariş eşleştirme.",
        icon: Stethoscope,
        status: "planlı",
        category: "Otomasyon",
    },
    {
        key: "resend",
        name: "Resend / SendGrid",
        description: "Tedarikçiye sipariş emaili gönderimi. Şu an mock logging — bağlandığında otomatik iletilir.",
        icon: Mail,
        status: "pasif",
        category: "İletişim",
    },
    {
        key: "whatsapp",
        name: "WhatsApp Business",
        description: "Email yerine/ek olarak WhatsApp üzerinden sipariş iletimi.",
        icon: MessageCircle,
        status: "planlı",
        category: "İletişim",
    },
    {
        key: "supplier-stock",
        name: "Toptancı stok API",
        description: "Tedarikçilerin gerçek zamanlı stok bilgisi — fiyat listesi CSV yerine otomatik güncelleme.",
        icon: Link2,
        status: "planlı",
        category: "Tedarikçi",
    },
    {
        key: "trendyol",
        name: "Trendyol / Hepsiburada",
        description: "Online platform fiyat karşılaştırması — scraper veya affiliate API.",
        icon: ShoppingBag,
        status: "planlı",
        category: "Fiyat",
    },
];

const statusStyle = {
    pasif: "bg-slate-100 text-slate-600 border-slate-200",
    planlı: "bg-amber-50 text-amber-700 border-amber-200",
    aktif: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function Integrations() {
    const grouped = INTEGRATIONS.reduce((acc, it) => {
        (acc[it.category] = acc[it.category] || []).push(it);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Entegrasyonlar</div>
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Dış sistemler</h1>
                <p className="text-slate-500 text-sm mt-1 max-w-xl">
                    Depozio tek başına çalışır — isteğe bağlı entegrasyonlar eklenerek katalog, stok ve sipariş iletimi otomatikleşir.
                </p>
            </div>

            {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{cat}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {items.map((i) => (
                            <div
                                key={i.key}
                                data-testid={`integration-${i.key}`}
                                className="bg-white rounded-2xl border border-slate-200/60 shadow-depozio p-5 hover:-translate-y-0.5 transition-transform"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="h-11 w-11 rounded-xl bg-[#1a6b4a]/10 text-[#14553b] grid place-items-center">
                                        <i.icon size={20} strokeWidth={2} />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${statusStyle[i.status]}`}>
                                        {i.status}
                                    </span>
                                </div>
                                <div className="font-display font-semibold text-slate-900 mb-1">{i.name}</div>
                                <p className="text-xs text-slate-500 leading-relaxed">{i.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <div className="text-sm text-slate-600 mb-2">Başka bir entegrasyon ihtiyacınız var mı?</div>
                <div className="text-xs text-slate-500">destek@depozio.com adresinden talep iletebilirsiniz.</div>
            </div>
        </div>
    );
}

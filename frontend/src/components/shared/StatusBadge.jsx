import { cn } from "../../lib/utils";

const MAP = {
    draft: { label: "Taslak", cls: "bg-slate-100 text-slate-700 border-slate-200" },
    sent: { label: "Gönderildi", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    in_transit: { label: "Yolda", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    delivered: { label: "Teslim edildi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "İptal", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function StatusBadge({ status }) {
    const s = MAP[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
    return (
        <span
            data-testid={`status-badge-${status}`}
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                s.cls,
            )}
        >
            {s.label}
        </span>
    );
}

const CAT = {
    otc: "OTC",
    supplement: "Supplement",
    kozmetik: "Kozmetik",
    bebek: "Bebek",
    mama: "Mama",
    aksesuar: "Aksesuar",
    sarf: "Sarf",
};

export function CategoryPill({ category }) {
    const label = CAT[category] || category;
    return (
        <span className="inline-flex items-center rounded-full bg-[#1a6b4a]/8 text-[#14553b] border border-[#1a6b4a]/15 px-2.5 py-0.5 text-xs font-medium">
            {label}
        </span>
    );
}

export function StockChip({ stock, min }) {
    let cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (stock <= min) cls = "bg-rose-50 text-rose-700 border-rose-200";
    else if (stock <= min * 1.5) cls = "bg-amber-50 text-amber-700 border-amber-200";
    return (
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums", cls)}>
            {stock}
        </span>
    );
}

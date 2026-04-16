import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Hammer, ArrowLeft } from "lucide-react";

export default function ComingSoon({ title, description }) {
    return (
        <div className="min-h-[60vh] grid place-items-center">
            <div className="max-w-md text-center">
                <div className="h-16 w-16 rounded-2xl bg-[#1a6b4a]/8 grid place-items-center mx-auto mb-5">
                    <Hammer className="text-[#1a6b4a]" size={26} strokeWidth={2} />
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#1a6b4a] mb-2">
                    Sonraki aşama
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mb-3">
                    {title}
                </h1>
                <p className="text-sm text-slate-500 mb-6">{description}</p>
                <Button asChild variant="outline" className="rounded-xl border-slate-200">
                    <Link to="/dashboard">
                        <ArrowLeft size={14} className="mr-2" /> Panele dön
                    </Link>
                </Button>
            </div>
        </div>
    );
}

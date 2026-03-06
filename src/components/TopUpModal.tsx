import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatRupiah } from '../utils/currency';
import { useToast } from './ui/ToastProvider';

declare global {
    interface Window { snap?: any; }
}

const PACKAGES = [
    { credits: 5, price: 25000 },
    { credits: 10, price: 50000 },
    { credits: 25, price: 125000 },
    { credits: 50, price: 250000 },
];

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { toast } = useToast();
    const [selected, setSelected] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const isProd = import.meta.env.VITE_MIDTRANS_IS_PROD === 'true';
        if (document.querySelector('script[src*="snap.js"]')) return;
        const script = document.createElement('script');
        script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
        script.async = true;
        document.head.appendChild(script);
    }, [isOpen]);

    const handlePurchase = async () => {
        const pkg = PACKAGES[selected];
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                toast({ type: 'error', title: 'Error', description: 'Sesi login expired. Silakan login ulang.' });
                setLoading(false);
                return;
            }

            const resp = await fetch('/api/topup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ creditsQty: pkg.credits }),
            });

            const result = await resp.json();
            if (!resp.ok) {
                toast({ type: 'error', title: 'Gagal', description: result.error });
                setLoading(false);
                return;
            }

            if (window.snap) {
                window.snap.pay(result.snapToken, {
                    onSuccess: () => { toast({ type: 'success', title: 'Berhasil!', description: `${pkg.credits} credits ditambahkan.` }); onSuccess(); onClose(); },
                    onPending: () => { toast({ type: 'info', title: 'Menunggu Pembayaran', description: 'Credits akan ditambahkan setelah pembayaran.' }); onClose(); },
                    onError: () => { toast({ type: 'error', title: 'Gagal', description: 'Pembayaran gagal.' }); setLoading(false); },
                    onClose: () => { setLoading(false); },
                });
            }
        } catch {
            toast({ type: 'error', title: 'Error', description: 'Gagal memproses.' });
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1c1c1e] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6" onClick={e => e.stopPropagation()}
                style={{ animation: 'fadeInDown 0.2s ease-out' }}>

                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white tracking-tight">Top Up Credits</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="text-xs text-gray-500 mb-3">1 credit = {formatRupiah(5000)}</div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    {PACKAGES.map((pkg, i) => (
                        <button
                            key={i}
                            onClick={() => setSelected(i)}
                            className={`p-4 rounded-2xl border transition-all text-left ${selected === i
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                                }`}
                        >
                            <div className="text-xl font-bold text-white">{pkg.credits}</div>
                            <div className="text-xs text-gray-400">credits</div>
                            <div className="text-sm font-semibold text-white mt-2">{formatRupiah(pkg.price)}</div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={handlePurchase}
                    disabled={loading}
                    className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2
                    ${loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-lg shadow-blue-600/20'} text-white`}
                >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Beli ${PACKAGES[selected].credits} Credits`}
                </button>
            </div>
            <style>{`@keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </div>
    );
};

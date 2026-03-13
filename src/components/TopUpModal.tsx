import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatRupiah } from '../utils/currency';
import { useToast } from './ui/ToastProvider';
import { X, ChevronRight } from 'lucide-react';

declare global {
    interface Window { snap?: any; }
}

const PRESET_PACKAGES = [
    { credits: 129, price: 25000 },
    { credits: 257, price: 50000 },
    { credits: 513, price: 100000 },
    { credits: 1026, price: 200000 },
    { credits: 2565, price: 500000 },
];

const PRICE_PER_CREDIT = 195;

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { toast } = useToast();
    const [selectedPkg, setSelectedPkg] = useState<number | 'custom'>(1);
    const [customAmountStr, setCustomAmountStr] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const isProd = import.meta.env.VITE_MIDTRANS_IS_PROD === 'true';
        const clientKey = isProd
            ? (import.meta.env.VITE_MIDTRANS_CLIENT_KEY_PROD || import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '')
            : (import.meta.env.VITE_MIDTRANS_CLIENT_KEY_SANDBOX || import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
        if (document.querySelector('script[src*="snap.js"]')) return;
        const script = document.createElement('script');
        script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', clientKey);
        script.async = true;
        document.head.appendChild(script);
    }, [isOpen]);

    const getCreditsToBuy = () => {
        if (selectedPkg === 'custom') {
            const amount = parseInt(customAmountStr);
            return isNaN(amount) || amount < 10000 ? 0 : Math.ceil(amount / PRICE_PER_CREDIT);
        }
        return PRESET_PACKAGES[selectedPkg].credits;
    };

    const getTotalPrice = () => {
        if (selectedPkg === 'custom') {
            const amount = parseInt(customAmountStr);
            return isNaN(amount) ? 0 : amount;
        }
        return PRESET_PACKAGES[selectedPkg].price;
    };

    const handlePurchase = async () => {
        const credits = getCreditsToBuy();
        if (credits < 1) return;

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
                body: JSON.stringify({ creditsQty: credits, amount: getTotalPrice() }),
            });

            const result = await resp.json();
            if (!resp.ok) {
                toast({ type: 'error', title: 'Gagal', description: result.error });
                setLoading(false);
                return;
            }

            if (window.snap) {
                window.snap.pay(result.snapToken, {
                    onSuccess: () => {
                        toast({ type: 'success', title: 'Berhasil!', description: `${credits} credits ditambahkan.` });
                        onSuccess();
                        onClose();
                    },
                    onPending: () => {
                        toast({ type: 'info', title: 'Menunggu Pembayaran', description: 'Credits akan ditambahkan setelah pembayaran.' });
                        onClose();
                    },
                    onError: () => {
                        toast({ type: 'error', title: 'Gagal', description: 'Pembayaran gagal.' });
                        setLoading(false);
                    },
                    onClose: () => { setLoading(false); },
                });
            }
        } catch {
            toast({ type: 'error', title: 'Error', description: 'Gagal memproses.' });
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const credits = getCreditsToBuy();
    const isValid = credits > 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 transition-opacity" onClick={onClose}>
            <div
                className="bg-[#1c1c1e] w-full sm:max-w-[400px] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/10"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-semibold text-white tracking-tight">Top Up Credits</h3>
                        <p className="text-[13px] text-gray-400 mt-1 font-medium">1 credit = {formatRupiah(PRICE_PER_CREDIT)}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white/70">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pb-8 overflow-y-auto max-h-[70vh] scrollbar-hide">
                    {/* Preset Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {PRESET_PACKAGES.map((pkg, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedPkg(i)}
                                className={`relative p-4 rounded-2xl border transition-all text-left overflow-hidden ${selectedPkg === i
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-white/5 bg-[#2c2c2e] hover:bg-[#3a3a3c]'
                                    }`}
                            >
                                <div className="text-2xl font-semibold text-white tracking-tight">{pkg.credits}</div>
                                <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">Credits</div>
                                <div className="text-sm font-medium text-white/80 mt-3">{formatRupiah(pkg.price)}</div>

                                {selectedPkg === i && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Custom Input */}
                    <div
                        onClick={() => setSelectedPkg('custom')}
                        className={`p-4 rounded-2xl border transition-all ${selectedPkg === 'custom'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/5 bg-[#2c2c2e] hover:bg-[#3a3a3c]'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-medium text-white/90">Custom Amount (Min. Rp10.000)</span>
                            {selectedPkg === 'custom' && (
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min="10000"
                                placeholder="10000"
                                value={customAmountStr}
                                onChange={(e) => {
                                    setCustomAmountStr(e.target.value);
                                    if (selectedPkg !== 'custom') setSelectedPkg('custom');
                                }}
                                className="w-28 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-lg font-semibold text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                            />
                            <div className="flex-1">
                                <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Mendapatkan</div>
                                <div className="text-sm font-medium text-white/80 mt-1">
                                    {selectedPkg === 'custom' && customAmountStr ? `${getCreditsToBuy()} Credits` : '0 Credits'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer / CTA */}
                <div className="p-6 pt-4 bg-[#1c1c1e] border-t border-white/5 mt-auto">
                    <button
                        onClick={handlePurchase}
                        disabled={loading || !isValid}
                        className={`w-full py-4 rounded-2xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2
                        ${(loading || !isValid) ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'}`}
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Beli {isValid ? credits : ''} Credits <ChevronRight size={18} className="opacity-60" />
                            </>
                        )}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes modalSlideUp { 
                    from { opacity: 0; transform: translateY(100%) scale(0.95); } 
                    to { opacity: 1; transform: translateY(0) scale(1); } 
                }
                /* Hide number input arrows */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
};

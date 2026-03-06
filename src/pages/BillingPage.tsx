import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useCredits } from '../lib/credits';
import { formatRupiah } from '../utils/currency';
import { TopUpModal } from '../components/TopUpModal';
import { useNavigate } from 'react-router-dom';

export const BillingPage: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [showTopUp, setShowTopUp] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) { navigate('/'); return; }
            setUser(session.user);
        });
    }, [navigate]);

    const creditState = useCredits(user?.id || null);

    useEffect(() => {
        if (!user?.id) return;
        supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
            .then(({ data }) => setTransactions(data || []));
    }, [user?.id]);

    useEffect(() => {
        const isProd = import.meta.env.VITE_MIDTRANS_IS_PROD === 'true';
        if (document.querySelector('script[src*="snap.js"]')) return;
        const script = document.createElement('script');
        script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
        script.async = true;
        document.head.appendChild(script);
    }, []);

    const handlePayNow = (snapToken: string) => {
        if (window.snap) {
            window.snap.pay(snapToken, {
                onSuccess: () => { window.location.reload(); },
                onPending: () => { window.location.reload(); },
                onError: () => { window.location.reload(); },
                onClose: () => { },
            });
        }
    };

    const statusColor: Record<string, string> = {
        success: 'text-green-400 bg-green-500/10',
        pending: 'text-yellow-400 bg-yellow-500/10',
        failed: 'text-red-400 bg-red-500/10',
        expired: 'text-gray-400 bg-gray-500/10',
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        Kembali
                    </button>
                    <h1 className="text-lg font-bold tracking-tight">Billing</h1>
                    <div className="w-16" />
                </div>

                {/* Credits Card */}
                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-3xl p-6 mb-6">
                    <div className="text-sm text-gray-400 mb-1">Saldo Credits</div>
                    <div className="text-4xl font-bold text-white mb-4">{creditState.credits}</div>
                    <button
                        onClick={() => setShowTopUp(true)}
                        className="bg-white text-black px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
                    >
                        Top Up Credits
                    </button>
                </div>

                {/* Transaction History */}
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Riwayat Transaksi</h2>
                {transactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">Belum ada transaksi.</div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map((tx: any) => (
                            <div key={tx.id} className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {tx.type === 'SIGNUP' ? 'Registrasi Visora' : `Top Up ${tx.credits} Credits`}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-white">{formatRupiah(tx.amount)}</div>
                                        <div className="mt-1 text-right">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[tx.status] || statusColor.expired}`}>
                                                {tx.status?.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    {tx.status === 'pending' && tx.snap_token && (
                                        <button
                                            onClick={() => handlePayNow(tx.snap_token)}
                                            className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all shadow-lg"
                                        >
                                            Bayar Sekarang
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={creditState.refresh} />
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ui/ToastProvider';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, RefreshCw, CreditCard, CheckCircle2 } from 'lucide-react';

export const PaymentPending: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [pendingEmail, setPendingEmail] = useState('');
    const [pendingOrderId, setPendingOrderId] = useState('');
    const [pendingUrl, setPendingUrl] = useState('');
    const [pendingSnapToken, setPendingSnapToken] = useState('');

    useEffect(() => {
        const email = localStorage.getItem('visora_pending_email') || '';
        const orderId = localStorage.getItem('visora_pending_order_id') || new URLSearchParams(window.location.search).get('orderId') || '';
        const url = localStorage.getItem('visora_pending_url') || '';
        const snapToken = localStorage.getItem('visora_pending_snap_token') || '';

        setPendingEmail(email);
        setPendingOrderId(orderId);
        setPendingUrl(url);
        setPendingSnapToken(snapToken);
        
        // Auto-check on load if we have an order id
        if (orderId) {
            checkStatus(orderId, email, true);
        }
    }, []);

    const checkStatus = async (orderIdToCheck: string, emailToCheck: string, isAutoCheck = false) => {
        if (!orderIdToCheck) {
            if (!isAutoCheck) toast({ type: 'warning', title: 'Data Tidak Lengkap', description: 'Order ID tidak ditemukan.' });
            return;
        }

        setIsLoading(true);
        try {
            const resp = await fetch(`/api/payment-status?orderId=${orderIdToCheck}`);
            if (!resp.ok) throw new Error('Failed to fetch');
            
            const data = await resp.json();
            
            if (data.redirectUrl) setPendingUrl(data.redirectUrl);
            if (data.snapToken) setPendingSnapToken(data.snapToken);
            
            if (data.status === 'success' || data.status === 'paid' || data.status === 'settlement') {
                setIsSuccess(true);
                toast({ type: 'success', title: 'Pembayaran Diterima! 🎉', description: 'Memproses login otomatis...' });
                
                const savedPass = localStorage.getItem('visora_pending_pass');
                if (emailToCheck && savedPass) {
                    const { error } = await supabase.auth.signInWithPassword({ email: emailToCheck, password: savedPass });
                    if (!error) {
                        localStorage.removeItem('visora_pending_email');
                        localStorage.removeItem('visora_pending_pass');
                        localStorage.removeItem('visora_pending_url');
                        localStorage.removeItem('visora_pending_order_id');
                        localStorage.removeItem('visora_pending_snap_token');
                        window.location.href = '/dashboard';
                    } else {
                        // If auto-login fails, redirect to dashboard so AuthGate can show login page
                        window.location.href = '/dashboard';
                    }
                } else {
                    // They might already be logged in (e.g. extending infinite plan)
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        window.location.href = '/dashboard';
                    } else {
                        window.location.href = '/dashboard';
                    }
                }
            } else {
                if (!isAutoCheck) {
                    toast({ type: 'info', title: 'Status Pending', description: 'Pembayaran belum diterima. Jika Anda sudah membayar, tunggu 1-2 menit.' });
                }
            }
        } catch (err) {
            console.error('Check status error:', err);
            if (!isAutoCheck) {
                toast({ type: 'error', title: 'Gagal Mengecek', description: 'Terjadi kesalahan saat menghubungi server.' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ── Load Midtrans Snap ──
    useEffect(() => {
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
    }, []);

    const handleContinuePayment = () => {
        if (pendingUrl) {
            window.location.href = pendingUrl;
        } else if (pendingSnapToken && window.snap) {
            window.snap.pay(pendingSnapToken, {
                onSuccess: () => { checkStatus(pendingOrderId, pendingEmail, true); },
                onPending: () => { toast({ type: 'info', title: 'Pembayaran Pending', description: 'Selesaikan pembayaran sebelum batas waktu.' }); },
                onError: () => { toast({ type: 'error', title: 'Pembayaran Gagal', description: 'Silakan coba lagi.' }); },
            });
        } else {
            toast({ type: 'warning', title: 'Link Tidak Ditemukan', description: 'Silakan pesan ulang dari halaman form.' });
            navigate('/formorder');
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col items-center justify-center p-6 font-sans">
            
            {/* Top Back Button */}
            <button 
                onClick={() => {
                    localStorage.removeItem('visora_pending_order_id');
                    localStorage.removeItem('visora_pending_url');
                    localStorage.removeItem('visora_pending_email');
                    localStorage.removeItem('visora_pending_pass');
                    localStorage.removeItem('visora_pending_snap_token');
                    navigate('/formorder');
                }} 
                className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-medium bg-white px-4 py-2 rounded-full shadow-sm"
            >
                <ArrowLeft size={18} /> Kembali
            </button>

            <div className={`max-w-md w-full bg-white p-8 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 ${isSuccess ? 'border-4 border-green-500' : 'border border-gray-100'}`}>
                
                <div className="text-center mb-8">
                    {isSuccess ? (
                        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 transform scale-110 transition-transform">
                            <CheckCircle2 size={40} />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CreditCard size={36} />
                        </div>
                    )}
                    
                    <h1 className="text-2xl font-bold mb-2 tracking-tight">
                        {isSuccess ? 'Pembayaran Berhasil!' : 'Konfirmasi Pembayaran'}
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        {isSuccess 
                            ? 'Akun Anda sedang disiapkan dan Anda akan segera dialihkan ke dashboard.'
                            : 'Silakan lanjutkan pembayaran Anda atau cek status jika sudah mentransfer.'}
                    </p>
                </div>

                {/* Account Details */}
                <div className="bg-gray-50 rounded-xl p-4 mb-8 text-sm">
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-500">Email Akun:</span>
                        <span className="font-semibold text-gray-800">{pendingEmail || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Order ID:</span>
                        <span className="font-mono text-gray-800">{pendingOrderId || '-'}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button 
                        onClick={() => checkStatus(pendingOrderId, pendingEmail, false)} 
                        disabled={isLoading || isSuccess}
                        className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            isSuccess 
                            ? 'bg-green-500 text-white' 
                            : 'bg-[#F5F5F7] text-black hover:bg-[#E5E5EB] border border-gray-200'
                        }`}
                    >
                        {isLoading ? (
                           <RefreshCw size={18} className="animate-spin" />
                        ) : isSuccess ? (
                           <>Terverifikasi</>
                        ) : (
                           <><RefreshCw size={18} /> Cek Status Pembayaran</>
                        )}
                    </button>

                    {!isSuccess && (
                        <button 
                            onClick={handleContinuePayment} 
                            disabled={isLoading}
                            className="w-full bg-[#0071e3] text-white py-4 rounded-xl font-bold text-sm hover:bg-[#005bb5] transition-all shadow-md shadow-blue-500/20"
                        >
                            Lanjutkan Pembayaran
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

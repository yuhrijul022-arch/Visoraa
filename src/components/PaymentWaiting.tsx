import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ui/ToastProvider';
import { supabase } from '../lib/supabaseClient';
import { Loader2, RefreshCw } from 'lucide-react';

export const PaymentWaiting: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isSuccess, setIsSuccess] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Menunggu konfirmasi pembayaran...');
    
    // Use refs to avoid re-triggering useEffect on every change
    const pendingEmail = useRef(localStorage.getItem('visora_pending_email') || '');
    const pendingOrderId = useRef(new URLSearchParams(window.location.search).get('orderId') || localStorage.getItem('visora_pending_order_id') || '');
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!pendingOrderId.current) {
            toast({ type: 'warning', title: 'Data Tidak Lengkap', description: 'Order ID tidak ditemukan.' });
            navigate('/dashboard');
            return;
        }

        const checkStatus = async () => {
            try {
                const resp = await fetch(`/api/payment-status?orderId=${pendingOrderId.current}`);
                if (!resp.ok) return; // Keep trying if network error
                
                const data = await resp.json();
                
                if (data.status === 'success' || data.status === 'paid' || data.status === 'settlement') {
                    setIsSuccess(true);
                    setStatusMessage('Pembayaran Berhasil! Mengalihkan ke dashboard...');
                    
                    if (pollingInterval.current) clearInterval(pollingInterval.current);
                    
                    // Handle auto-login
                    const savedPass = localStorage.getItem('visora_pending_pass');
                    if (pendingEmail.current && savedPass) {
                        const { error } = await supabase.auth.signInWithPassword({ email: pendingEmail.current, password: savedPass });
                        if (!error) {
                            cleanupStorage();
                            window.location.assign('/dashboard');
                        } else {
                            window.location.assign('/dashboard');
                        }
                    } else {
                        window.location.assign('/dashboard');
                    }
                } else if (data.status === 'failed' || data.status === 'expired') {
                    if (pollingInterval.current) clearInterval(pollingInterval.current);
                    toast({ type: 'error', title: 'Pembayaran Gagal', description: 'Silakan coba lagi pembayaran Anda.' });
                    navigate('/pending');
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        };

        // Check immediately
        checkStatus();

        // Check every 2 seconds matching the requirement
        pollingInterval.current = setInterval(checkStatus, 2000);

        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, [navigate, toast]);

    const cleanupStorage = () => {
        localStorage.removeItem('visora_pending_email');
        localStorage.removeItem('visora_pending_pass');
        localStorage.removeItem('visora_pending_url');
        localStorage.removeItem('visora_pending_order_id');
        localStorage.removeItem('visora_pending_snap_token');
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white p-8 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.06)] border border-gray-100 text-center">
                <div className="mb-6 flex justify-center">
                    {isSuccess ? (
                        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center transform scale-110 transition-transform">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                            <RefreshCw size={28} className="animate-pulse" />
                        </div>
                    )}
                </div>
                
                <h1 className="text-2xl font-bold mb-3 tracking-tight text-gray-900">
                    {isSuccess ? 'Pembayaran Berhasil' : 'Sistem Sedang Memproses'}
                </h1>
                
                <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium px-4">
                    {statusMessage}
                </p>

                {!isSuccess && (
                    <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 text-xs text-orange-700 text-left">
                        <p className="font-semibold mb-1">Penting:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Jangan tutup halaman ini.</li>
                            <li>Sistem secara otomatis memeriksa status pembayaran setiap 2 detik.</li>
                            <li>Halaman akan dialihkan sesaat setelah pembayaran Anda dikonfirmasi.</li>
                        </ul>
                    </div>
                )}
                
                {!isSuccess && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/pending')}
                            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                        >
                            Ke Halaman Status Manual
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

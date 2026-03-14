import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/ToastProvider.js';
import { supabase } from '../lib/supabaseClient.js';
import { formatRupiah } from '../utils/currency.js';
import { generateEventId, getFbpFbc, trackAddPaymentInfo, trackInitiateCheckout, trackPageView, initPixel, FB_TEST_EVENT_CODE } from '../lib/metaPixel.js';

export const FormOrderAuth: React.FC = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [showPromo, setShowPromo] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    // ── Plan Selection ──
    const [plan, setPlan] = useState<'basic' | 'pro'>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('plan') === 'pro' ? 'pro' : 'basic';
    });

    useEffect(() => {
        initPixel();
        trackPageView();
        trackInitiateCheckout();
    }, []);

    // ── Auto-resume Pending Payment ──
    useEffect(() => {
        const pendingOrderId = localStorage.getItem('visora_pending_order_id');
        if (pendingOrderId && !window.location.search.includes('orderId')) {
            navigate('/pending');
        }
    }, [navigate]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setSessionToken(session.access_token);
                setEmail(session.user.email || '');
                setName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
            } else {
                // If not logged in, they shouldn't be here, redirect them to login/home
                window.location.href = '/lpform';
            }
        });
    }, []);

    // ── Load Midtrans Snap ──
    useEffect(() => {
        const isProd = import.meta.env.VITE_MIDTRANS_IS_PROD === 'true';
        const clientKey = isProd
            ? (import.meta.env.VITE_MIDTRANS_CLIENT_KEY_PROD || import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '')
            : (import.meta.env.VITE_MIDTRANS_CLIENT_KEY_SANDBOX || import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
        const script = document.createElement('script');
        script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', clientKey);
        script.async = true;
        document.head.appendChild(script);
        return () => { try { document.head.removeChild(script); } catch { } };
    }, []);

    const triggerCapiFallback = async (eventName: string, eventId: string, value: number) => {
        try {
            const { fbp, fbc } = getFbpFbc();
            await fetch('/api/meta-capi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventName,
                    eventId,
                    email,
                    value,
                    sourceUrl: window.location.href,
                    userAgent: navigator.userAgent,
                    fbp, fbc,
                    testEventCode: FB_TEST_EVENT_CODE
                }),
            });
        } catch { /* non-blocking */ }
    };

    const handleSubmit = async () => {
        if (!sessionToken) {
            toast({ type: 'warning', title: 'Sesi Tidak Valid', description: 'Silakan login ulang.' });
            return;
        }

        setIsLoading(true);
        try {
            const resp = await fetch('/api/create-transaction', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ email, username: name, promoCode: promoCode || undefined, planType: plan }),
            });
            const result = await resp.json();
            
            if (!resp.ok) {
                toast({ type: 'error', title: 'Gagal', description: result.error || 'Terjadi kesalahan.' });
                setIsLoading(false);
                return;
            }

            const planValue = plan === 'pro' ? 145000 : 99000;
            const paymentEventId = generateEventId();
            
            const { snapToken, gateway, redirectUrl, orderId } = result.data;
            
            // Save order ID and snapshot token for both gateways to allow status checks & resumes on the /pending page
            localStorage.setItem('visora_pending_order_id', orderId);
            localStorage.setItem('visora_pending_snap_token', snapToken || '');

            if (gateway === 'mayar' && redirectUrl) {
                // Trigger AddPaymentInfo EXACTLY before redirect
                trackAddPaymentInfo(paymentEventId, planValue);
                triggerCapiFallback('AddPaymentInfo', paymentEventId, planValue);
                
                localStorage.setItem('visora_pending_url', redirectUrl);
                window.location.href = redirectUrl;
                return;
            }

            if (window.snap) {
                // Trigger AddPaymentInfo EXACTLY before snap pay overlay opens
                trackAddPaymentInfo(paymentEventId, planValue);
                triggerCapiFallback('AddPaymentInfo', paymentEventId, planValue);
                
                window.snap.pay(snapToken, {
                    onSuccess: () => {
                        toast({ type: 'success', title: 'Pembayaran Berhasil! 🎉', description: 'Akun kamu siap digunakan.' });
                        window.location.href = '/dashboard';
                    },
                    onPending: () => {
                        toast({ type: 'info', title: 'Pembayaran Pending', description: 'Selesaikan pembayaran sebelum batas waktu.' });
                        window.location.href = '/pending';
                    },
                    onError: () => {
                        toast({ type: 'error', title: 'Pembayaran Gagal', description: 'Silakan coba lagi.' });
                        setIsLoading(false);
                    },
                    onClose: () => { setIsLoading(false); },
                });
            } else {
                toast({ type: 'error', title: 'Error', description: 'Gagal memuat sistem pembayaran.' });
                setIsLoading(false);
            }
        } catch {
            toast({ type: 'error', title: 'Error', description: 'Gagal memproses. Coba lagi.' });
            setIsLoading(false);
        }
    };

    return (
        <div style={{ background: '#f5f5f7', color: '#1d1d1f', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', width: '100%', maxWidth: 480 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Selesaikan Pendaftaran</h2>
                    <p style={{ color: '#86868b', fontSize: '0.95rem' }}>Pilih paket untuk mengaktifkan akun <strong>{email}</strong>.</p>
                </div>

                {/* Plan Selection Toggle */}
                <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Pilih Paket:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Basic */}
                        <label style={{ 
                            border: `2px solid ${plan === 'basic' ? '#0071e3' : 'rgba(0,0,0,0.1)'}`, 
                            borderRadius: 16, padding: '16px 14px', cursor: 'pointer',
                            background: plan === 'basic' ? 'rgba(0,113,227,0.05)' : '#fff', transition: 'all 0.2s',
                            display: 'flex', flexDirection: 'column', gap: 4
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: plan === 'basic' ? '5px solid #0071e3' : '2px solid rgba(0,0,0,0.2)', transition: 'all 0.2s' }} />
                                    <strong style={{ fontSize: '1.05rem' }}>Basic</strong>
                                </div>
                                <span style={{ fontWeight: 700 }}>Rp99rb</span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: '#86868b', paddingLeft: 26 }}>Akses semua template dasar<br/>Resolusi 1080p & Desain Promosi</span>
                        </label>

                        {/* Pro */}
                        <label style={{ 
                            border: `2px solid ${plan === 'pro' ? '#0071e3' : 'rgba(0,0,0,0.1)'}`, 
                            borderRadius: 16, padding: '16px 14px', cursor: 'pointer',
                            background: plan === 'pro' ? 'rgba(0,113,227,0.05)' : '#fff', transition: 'all 0.2s',
                            display: 'flex', flexDirection: 'column', gap: 4
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: plan === 'pro' ? '5px solid #0071e3' : '2px solid rgba(0,0,0,0.2)', transition: 'all 0.2s' }} />
                                    <strong style={{ fontSize: '1.05rem' }}>Pro</strong>
                                </div>
                                <span style={{ fontWeight: 700 }}>Rp145rb</span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: '#86868b', paddingLeft: 26 }}>Infinite Generate & 4K Ultra HD<br/>Akses style eksklusif & Priority Server</span>
                            <input type="radio" value="basic" checked={plan === 'basic'} onChange={() => setPlan('basic')} style={{ display: 'none' }} />
                            <input type="radio" value="pro" checked={plan === 'pro'} onChange={() => setPlan('pro')} style={{ display: 'none' }} />
                        </label>
                    </div>
                </div>

                {/* Promo */}
                {!showPromo ? (
                    <button onClick={() => setShowPromo(true)} style={{ fontSize: '0.85rem', color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, display: 'block' }}>
                        Punya kode promo?
                    </button>
                ) : (
                    <input 
                        value={promoCode} 
                        onChange={e => setPromoCode(e.target.value)} 
                        placeholder="Kode Promo" 
                        style={{ width: '100%', background: '#F5F5F7', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(0,0,0,0.06)', outline: 'none', marginBottom: 20 }} 
                    />
                )}

                {/* Order Summary */}
                <div style={{ background: '#F5F5F7', borderRadius: 16, padding: '16px 20px', marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 6 }}>
                        <span style={{ color: '#86868b' }}>Visora - {plan === 'pro' ? 'Pro Plan' : 'Basic Plan'}</span>
                        <span style={{ color: '#86868b', textDecoration: 'line-through', fontSize: '0.85rem' }}>{plan === 'pro' ? 'Rp450.000' : 'Rp350.000'}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#34C759', marginBottom: 8 }}>
                        🎉 Diskon promo 150 user pertama (-{plan === 'pro' ? 'Rp305.000' : 'Rp251.000'})
                    </div>
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Total</span>
                        <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{formatRupiah(plan === 'pro' ? 145000 : 99000)}</span>
                    </div>
                </div>

                {/* Confirm Button */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    style={{
                        width: '100%', padding: '16px 0', borderRadius: 999, fontWeight: 700,
                        fontSize: '1.05rem', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                        background: isLoading ? 'rgba(255,59,48,0.5)' : '#FF3B30',
                        color: '#fff', transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                >
                    {isLoading ? (
                        <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    ) : 'Aktifkan Akun & Bayar'}
                </button>
            </div>
            
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

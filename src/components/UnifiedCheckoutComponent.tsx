import React, { useState, useEffect, useRef } from 'react';
import { useToast } from './ui/ToastProvider';
import { supabase } from '../lib/supabaseClient';
import { formatRupiah } from '../utils/currency';
import {
    getUserCount, incrementUserCount, getUserProgress,
    getNotifIndex, setNotifIndex, setLastNotifTime,
    NOTIF_NAMES, NOTIF_CITIES, NOTIF_TIMING,
    TESTIMONIALS, SHOWCASE_IMAGES, BENEFITS,
} from '../lib/funnelState';
import { initPixel, trackPageView, trackInitiateCheckout, trackAddPaymentInfo, generateEventId, getFbpFbc } from '../lib/metaPixel';

declare global {
    interface Window { snap?: any; }
}

export const UnifiedCheckoutComponent: React.FC = () => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [showPromo, setShowPromo] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showcaseIdx, setShowcaseIdx] = useState(0);
    const [userCount, setUserCount] = useState(getUserCount());
    const [notifData, setNotifData] = useState<{ name: string; city: string } | null>(null);

    // ── Meta Pixel ── fire on load
    useEffect(() => {
        initPixel();
        trackPageView();
        trackInitiateCheckout();
    }, []);

    // ── Load Midtrans Snap ──
    useEffect(() => {
        const isProd = import.meta.env.VITE_MIDTRANS_IS_PROD === 'true';
        const script = document.createElement('script');
        script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
        script.async = true;
        document.head.appendChild(script);
        return () => { try { document.head.removeChild(script); } catch { } };
    }, []);

    // ── Showcase auto-slider (5s) ──
    useEffect(() => {
        const timer = setInterval(() => setShowcaseIdx(p => (p + 1) % SHOWCASE_IMAGES.length), 5000);
        return () => clearInterval(timer);
    }, []);

    // ── Shared fake purchase notifications ──
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let idx = getNotifIndex();

        const showNotif = () => {
            if (getUserCount() >= 145) return;
            const n = NOTIF_NAMES[idx % NOTIF_NAMES.length];
            const c = NOTIF_CITIES[idx % NOTIF_CITIES.length];
            setNotifData({ name: n, city: c });
            incrementUserCount();
            setUserCount(getUserCount());
            idx++;
            setNotifIndex(idx);
            setLastNotifTime(Date.now());

            setTimeout(() => setNotifData(null), 4000);
            timeout = setTimeout(showNotif, NOTIF_TIMING[idx % NOTIF_TIMING.length]);
        };

        timeout = setTimeout(showNotif, 5000);
        return () => clearTimeout(timeout);
    }, []);

    // ── Recovery: auto-login if payment was completed while away ──
    useEffect(() => {
        const savedEmail = localStorage.getItem('visora_pending_email');
        const savedPass = localStorage.getItem('visora_pending_pass');
        if (savedEmail && savedPass) {
            supabase.auth.signInWithPassword({ email: savedEmail, password: savedPass }).then(({ error }) => {
                localStorage.removeItem('visora_pending_email');
                localStorage.removeItem('visora_pending_pass');
                if (!error) window.location.href = '/dashboard';
            });
        }
    }, []);

    const handleSubmit = async () => {
        if (!name || !email || !password) {
            toast({ type: 'warning', title: 'Lengkapi Form', description: 'Semua field wajib diisi.' });
            return;
        }
        if (password.length < 6) {
            toast({ type: 'warning', title: 'Password Terlalu Pendek', description: 'Minimal 6 karakter.' });
            return;
        }
        setIsLoading(true);
        try {
            const resp = await fetch('/api/create-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username: name, password, promoCode: promoCode || undefined }),
            });
            const result = await resp.json();
            if (!resp.ok) {
                toast({ type: 'error', title: 'Gagal', description: result.error || 'Terjadi kesalahan.' });
                setIsLoading(false);
                return;
            }

            // Save credentials for recovery
            localStorage.setItem('visora_pending_email', email);
            localStorage.setItem('visora_pending_pass', password);

            // Fire AddPaymentInfo when Snap opens
            const paymentEventId = generateEventId();
            trackAddPaymentInfo(paymentEventId, 99000);

            // Send CAPI AddPaymentInfo
            try {
                const { fbp, fbc } = getFbpFbc();
                await fetch('/api/meta-capi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventName: 'AddPaymentInfo',
                        eventId: paymentEventId,
                        email,
                        value: 99000,
                        sourceUrl: window.location.href,
                        userAgent: navigator.userAgent,
                        fbp, fbc,
                    }),
                });
            } catch { /* non-blocking */ }

            const { snapToken } = result.data;
            if (window.snap) {
                window.snap.pay(snapToken, {
                    onSuccess: async () => {
                        toast({ type: 'success', title: 'Pembayaran Berhasil! 🎉', description: 'Akun kamu sedang disiapkan...' });
                        const { error } = await supabase.auth.signInWithPassword({ email, password });
                        localStorage.removeItem('visora_pending_email');
                        localStorage.removeItem('visora_pending_pass');
                        if (!error) window.location.href = '/dashboard';
                        else window.location.href = '/success';
                    },
                    onPending: () => {
                        toast({ type: 'info', title: 'Pembayaran Pending', description: 'Selesaikan pembayaran sebelum batas waktu.' });
                        window.location.href = '/pending';
                    },
                    onError: () => {
                        localStorage.removeItem('visora_pending_email');
                        localStorage.removeItem('visora_pending_pass');
                        toast({ type: 'error', title: 'Pembayaran Gagal', description: 'Silakan coba lagi.' });
                        setIsLoading(false);
                    },
                    onClose: () => { setIsLoading(false); },
                });
            }
        } catch {
            toast({ type: 'error', title: 'Error', description: 'Gagal memproses. Coba lagi.' });
            setIsLoading(false);
        }
    };

    const progress = getUserProgress();

    return (
        <div style={{ background: '#fff', color: '#1d1d1f', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* ── NAVBAR ── */}
            <nav style={{ padding: '1rem 0', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', zIndex: 1000, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href="/landing-page.html">
                        <img src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_320/v1770727440/LOGO_VISORA_BLACK_fidzhe.png" alt="Visora" style={{ height: 58 }} />
                    </a>
                </div>
            </nav>

            <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 20px 120px' }}>

                {/* ── SECTION A: TRUST BADGES ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 999, padding: '6px 14px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#86868b' }}>Secure Payment</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 999, padding: '6px 14px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" /></svg>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#86868b' }}>Money Back Guarantee</span>
                    </div>
                </div>

                {/* ── SECTION B: SHOWCASE SLIDER ── */}
                <div style={{ position: 'relative', width: '100%', height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
                    {SHOWCASE_IMAGES.map((img, i) => (
                        <img key={i} src={img} alt="" style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                            opacity: showcaseIdx === i ? 1 : 0, transition: 'opacity 0.7s ease',
                        }} />
                    ))}
                    <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                        {SHOWCASE_IMAGES.map((_, i) => (
                            <div key={i} style={{
                                width: showcaseIdx === i ? 16 : 6, height: 6, borderRadius: 999,
                                background: showcaseIdx === i ? '#1d1d1f' : 'rgba(0,0,0,0.2)',
                                transition: 'all 0.3s ease',
                            }} />
                        ))}
                    </div>
                </div>

                {/* ── SECTION C: CHECKLIST BENEFITS ── */}
                <div style={{ marginBottom: 28 }}>
                    {BENEFITS.map((b, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, fontSize: '1rem' }}>
                            <span style={{ color: '#34C759', fontWeight: 900, lineHeight: 1.2 }}>✓</span>
                            <span>{b.bold ? <strong>{b.text}</strong> : b.text}</span>
                        </div>
                    ))}
                </div>

                {/* ── SECTION D + E + F: ORDER FORM CARD ── */}
                <div style={{
                    background: '#fff', borderRadius: 24, padding: '36px 28px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.04)',
                    marginBottom: 28,
                }}>
                    {/* Urgency */}
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <span style={{ display: 'inline-block', background: 'rgba(0,113,227,0.1)', color: '#0071e3', fontSize: '0.875rem', fontWeight: 700, padding: '6px 12px', borderRadius: 999, marginBottom: 14 }}>
                            Early Access Promo
                        </span>
                        <p style={{ color: '#FF3B30', fontWeight: 500, fontSize: '0.9rem', marginBottom: 8 }}>
                            Harga akan naik setelah 150 user pertama tercapai — no gimmick
                        </p>
                        <div style={{ width: '100%', height: 6, background: '#F5F5F7', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ height: '100%', background: '#FF3B30', width: `${progress}%`, transition: 'width 0.4s ease' }} />
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#86868b', margin: 0 }}>🔥 {userCount} / 150 user sudah join</p>
                    </div>

                    <h3 style={{ fontSize: '1.35rem', fontWeight: 600, textAlign: 'center', marginBottom: 24, letterSpacing: '-0.02em' }}>
                        Daftar Sekarang
                    </h3>

                    {/* Form Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Lengkap" style={inputStyle} />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 karakter)" style={inputStyle} />
                    </div>

                    {/* Promo */}
                    {!showPromo ? (
                        <button onClick={() => setShowPromo(true)} style={{ fontSize: '0.85rem', color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, display: 'block' }}>
                            Punya kode promo?
                        </button>
                    ) : (
                        <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Kode Promo" style={{ ...inputStyle, marginBottom: 16 }} />
                    )}

                    {/* Order Summary */}
                    <div style={{ background: '#F5F5F7', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: 6 }}>
                            <span style={{ color: '#86868b' }}>Visora - Smart Visual</span>
                            <span style={{ color: '#86868b', textDecoration: 'line-through', fontSize: '0.85rem' }}>Rp350.000</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#34C759', marginBottom: 8 }}>
                            🎉 Diskon promo 150 user pertama (-Rp251.000)
                        </div>
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700 }}>Total</span>
                            <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatRupiah(99000)}</span>
                        </div>
                    </div>

                    {/* CTA */}
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
                        ) : 'Bayar Sekarang'}
                    </button>
                    <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#86868b', marginTop: 12, marginBottom: 0 }}>
                        Sekali bayar. Tidak ada biaya bulanan. Tanpa Langganan.
                    </p>
                </div>

                {/* ── SECTION G: TESTIMONIALS MARQUEE ── */}
                <div style={{ marginBottom: 28, overflow: 'hidden' }}>
                    <h3 style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Apa kata mereka</h3>
                    <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', gap: 16, animation: 'marquee 45s linear infinite', width: `${TESTIMONIALS.length * 320 * 2}px` }}>
                            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                                <div key={i} style={{
                                    flexShrink: 0, width: 300, background: '#fff',
                                    border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20,
                                    padding: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                                }}>
                                    <div>
                                        <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 800 }}>{t.name}</h4>
                                        <span style={{ fontSize: '0.85rem', color: '#86868b' }}>{t.role}</span>
                                    </div>
                                    <p style={{ fontSize: '1rem', lineHeight: 1.55, marginTop: 10, marginBottom: 0, color: '#1d1d1f' }}>{t.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <p style={{ fontSize: '0.85rem', color: '#86868b', margin: 0 }}>© 2026 Visora. All rights reserved.</p>
                </div>
            </div>

            {/* ── FAKE PURCHASE NOTIFICATION ── */}
            {notifData && (
                <div style={{
                    position: 'fixed', bottom: 20, left: 20, display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(29,29,31,0.92)', backdropFilter: 'blur(10px)', color: '#fff',
                    padding: '12px 14px', borderRadius: 16, boxShadow: '0 14px 35px rgba(0,0,0,0.28)',
                    zIndex: 9999, animation: 'slideUp 0.4s ease-out', maxWidth: 340,
                }}>
                    <img
                        src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_120/v1771281459/visora-variant-2-1770749485907_nbnneu.jpg"
                        alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }}
                    />
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{notifData.name} - {notifData.city}</div>
                        <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>Baru saja membeli Visora Rp99.000</div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                input::placeholder { color: #86868b; }
                input:focus { border-color: rgba(0,113,227,0.5) !important; outline: none; }
            `}</style>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#F5F5F7',
    color: '#1d1d1f',
    fontSize: '1rem',
    borderRadius: 14,
    padding: '14px 18px',
    border: '1px solid rgba(0,0,0,0.06)',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
};

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from './ui/ToastProvider';
import { supabase } from '../lib/supabaseClient';
import { formatRupiah } from '../utils/currency';

// ── Testimonials Data ──
const TESTIMONIALS = [
    { name: 'Rina A.', rating: 5, text: 'Hasilnya luar biasa! Produk saya langsung terlihat premium.' },
    { name: 'Budi S.', rating: 5, text: 'Hemat waktu banget, ga perlu fotographer mahal lagi.' },
    { name: 'Sarah M.', rating: 5, text: 'Kualitas gambar setara studio profesional. Sangat recommended!' },
    { name: 'Dian P.', rating: 4, text: 'Konten marketing saya naik level drastis pakai Visora.' },
    { name: 'Ahmad R.', rating: 5, text: 'Gila sih, tinggal upload langsung jadi. Hemat biaya banget.' },
    { name: 'Maya L.', rating: 5, text: 'Pelanggan saya sampe nanya pakai studio mana, padahal pakai Visora.' },
    { name: 'Fajar K.', rating: 4, text: 'Worth it banget! Hasil visual marketing saya jadi konsisten.' },
    { name: 'Nisa W.', rating: 5, text: 'Bisa buat konten ads yang menarik dalam hitungan menit!' },
];

const FAKE_BUYERS = [
    { name: 'Andi Pratama', role: 'Owner Skincare' },
    { name: 'Siti Nurhaliza', role: 'Owner FNB' },
    { name: 'Rizki Ramadhan', role: 'Freelancer' },
    { name: 'Dewi Anggraini', role: 'Content Creator' },
    { name: 'Budi Santoso', role: 'Owner Fashion' },
    { name: 'Putri Maharani', role: 'Digital Marketer' },
];

const CAROUSEL_IMAGES = [
    'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&h=400&fit=crop',
];

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
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [buyerNotif, setBuyerNotif] = useState<{ name: string; role: string } | null>(null);

    // ── Meta Pixel ──
    useEffect(() => {
        const pixelId = import.meta.env.VITE_META_PIXEL_ID;
        if (!pixelId) return;
        // Inject Meta Pixel
        const script = document.createElement('script');
        script.innerHTML = `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${pixelId}');fbq('track','PageView');fbq('track','InitiateCheckout');
        `;
        document.head.appendChild(script);
        const noscript = document.createElement('noscript');
        noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
        document.body.appendChild(noscript);
    }, []);

    // ── Carousel auto-slide ──
    useEffect(() => {
        const timer = setInterval(() => setCarouselIndex(prev => (prev + 1) % CAROUSEL_IMAGES.length), 3500);
        return () => clearInterval(timer);
    }, []);

    // ── Fake purchase notifications ──
    useEffect(() => {
        let idx = 0;
        const delays = [10000, 15000, 20000];
        let timeout: NodeJS.Timeout;

        const showNext = () => {
            const buyer = FAKE_BUYERS[idx % FAKE_BUYERS.length];
            setBuyerNotif(buyer);
            setTimeout(() => setBuyerNotif(null), 4000);
            idx++;
            timeout = setTimeout(showNext, delays[idx % delays.length]);
        };

        timeout = setTimeout(showNext, delays[0]);
        return () => clearTimeout(timeout);
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

    // ── Recovery: auto-login if payment was completed while away ──
    useEffect(() => {
        const savedEmail = localStorage.getItem('visora_pending_email');
        const savedPass = localStorage.getItem('visora_pending_pass');
        if (savedEmail && savedPass) {
            supabase.auth.signInWithPassword({ email: savedEmail, password: savedPass }).then(({ error }) => {
                // Clear stored credentials regardless of outcome
                localStorage.removeItem('visora_pending_email');
                localStorage.removeItem('visora_pending_pass');
                if (!error) window.location.href = '/';
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

            // Save credentials temporarily for recovery if browser closes
            localStorage.setItem('visora_pending_email', email);
            localStorage.setItem('visora_pending_pass', password);

            const { snapToken } = result.data;
            if (window.snap) {
                window.snap.pay(snapToken, {
                    onSuccess: async () => {
                        const { error } = await supabase.auth.signInWithPassword({ email, password });
                        localStorage.removeItem('visora_pending_email');
                        localStorage.removeItem('visora_pending_pass');
                        if (!error) window.location.href = '/';
                        else window.location.href = '/success';
                    },
                    onPending: () => { window.location.href = '/pending'; },
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

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
            <div className="max-w-lg mx-auto px-4 py-8 pb-32">

                {/* ── SECTION 1: Trust Badges ── */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        <span className="text-[11px] text-gray-400 font-medium">Secure Payment</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" /></svg>
                        <span className="text-[11px] text-gray-400 font-medium">Money Back Guarantee</span>
                    </div>
                </div>

                {/* ── SECTION 2: Image Carousel ── */}
                <div className="relative w-full h-52 rounded-3xl overflow-hidden mb-8 border border-white/5">
                    {CAROUSEL_IMAGES.map((img, i) => (
                        <img
                            key={i}
                            src={img}
                            alt={`Visora result ${i + 1}`}
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                            style={{ opacity: carouselIndex === i ? 1 : 0 }}
                        />
                    ))}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {CAROUSEL_IMAGES.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${carouselIndex === i ? 'bg-white w-4' : 'bg-white/30'}`} />
                        ))}
                    </div>
                </div>

                {/* ── SECTION 3: Benefits ── */}
                <div className="mb-8 space-y-4">
                    <h2 className="text-xl font-bold text-center tracking-tight">Kenapa Harus Visora?</h2>
                    {[
                        { emoji: '🎨', title: 'AI Design Intelligence', desc: 'Upload produk, AI yang desain. Tidak perlu skill design.' },
                        { emoji: '⚡', title: 'Hemat Waktu & Biaya', desc: 'Hasil dalam hitungan detik. Tanpa fotographer mahal.' },
                        { emoji: '📈', title: 'Konten Marketing Pro', desc: 'Hasil setara studio profesional. Tingkatkan konversi ads Anda.' },
                        { emoji: '🎁', title: 'BONUS: 25 Credits', desc: 'Langsung bisa generate sampai 25 desain marketing.' },
                    ].map((b, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <span className="text-2xl flex-shrink-0">{b.emoji}</span>
                            <div>
                                <div className="text-sm font-semibold text-white">{b.title}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{b.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── SECTION 4: Order Form Card ── */}
                <div className="bg-[#1c1c1e] border border-white/5 rounded-3xl p-6 mb-8 shadow-2xl">
                    <h3 className="text-lg font-bold text-center mb-6 tracking-tight">Daftar Sekarang</h3>

                    <div className="space-y-3 mb-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Lengkap" className="w-full bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-5 py-[14px] border border-transparent focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-500" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-5 py-[14px] border border-transparent focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-500" />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-5 py-[14px] border border-transparent focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-500" />
                    </div>

                    {!showPromo ? (
                        <button onClick={() => setShowPromo(true)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors mb-4 block">
                            Punya kode promo?
                        </button>
                    ) : (
                        <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Kode Promo" className="w-full bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-5 py-[14px] border border-transparent focus:border-blue-500/50 outline-none transition-all placeholder:text-gray-500 mb-4" />
                    )}

                    {/* Order Summary */}
                    <div className="bg-black/30 rounded-2xl p-4 mb-5 space-y-2.5">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Visora - Smart Visual</span>
                            <span className="text-gray-500 line-through text-xs">Rp350.000</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-green-400 text-xs">🎉 150 user pertama (-251.000)</span>
                        </div>
                        <div className="border-t border-white/5 pt-2 flex justify-between">
                            <span className="font-bold text-white">Total</span>
                            <span className="font-bold text-white text-lg">{formatRupiah(99000)}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 shadow-lg
                        ${isLoading ? 'bg-red-700/50 text-white/50 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-500 active:scale-[0.98] shadow-red-600/20'}`}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : 'Bayar Sekarang'}
                    </button>
                </div>

                {/* ── SECTION 5: Testimonial Marquee ── */}
                <div className="mb-8 overflow-hidden">
                    <h3 className="text-center text-sm font-semibold text-gray-500 mb-4 uppercase tracking-widest">Kata Mereka</h3>
                    <div className="relative">
                        <div className="flex gap-4 animate-marquee" style={{ width: `${TESTIMONIALS.length * 280}px` }}>
                            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                                <div key={i} className="flex-shrink-0 w-64 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-1 mb-2">
                                        {Array.from({ length: t.rating }).map((_, s) => (
                                            <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill="#eab308"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed mb-2">{t.text}</p>
                                    <div className="text-[11px] text-gray-500 font-medium">{t.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* ── SECTION 6: Fake Purchase Notification ── */}
            {buyerNotif && (
                <div className="fixed bottom-6 left-6 bg-[#1c1c1e] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl z-[100] flex items-center gap-3 max-w-xs"
                    style={{ animation: 'slideUp 0.4s ease-out' }}>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="20" height="14" viewBox="0 0 34 24" fill="white">
                            <path d="M0 0H8V24H0V0Z" /><path d="M12 0H22C28.6274 0 34 5.37258 34 12C34 18.6274 28.6274 24 22 24H12V0Z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-white">{buyerNotif.name} baru saja membeli Visora</div>
                        <div className="text-[10px] text-gray-500">{buyerNotif.role}</div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 40s linear infinite;
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

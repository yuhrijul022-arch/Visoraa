import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initPixel, trackPageView, trackViewContent } from '../lib/metaPixel';
import {
    getUserCount, incrementUserCount,
    getNotifIndex, setNotifIndex, setLastNotifTime,
    NOTIF_NAMES, NOTIF_CITIES, NOTIF_TIMING, TESTIMONIALS,
    SHOWCASE_IMAGES,
} from '../lib/funnelState';

/* ───────────── data ───────────── */
const PAIN_POINTS = [
    'Punya referensi desain bagus, tapi hasil akhirnya beda jauh',
    'Desainer grafis mahal dan butuh waktu berhari-hari',
    'Mau cepat jualan, malah habis waktu urusan visual',
];

const SOLUTIONS = [
    { title: 'Gunakan Referensi Apapun', desc: 'Upload desain favorit Anda dari Pinterest atau kompetitor besar, Visora akan meniru estetikanya hingga 90% presisi.' },
    { title: 'Preset Style Siap Pakai', desc: 'Malas cari referensi? Pilih dari ratusan preset desain premium siap pakai yang sudah kami kurasi khusus untuk UMKM.' },
    { title: 'Magic Model AI', desc: 'Ubah foto produk di atas meja menjadi foto studio profesional dengan model manusia yang terlihat sangat nyata.' },
];

const USE_CASES = [
    { num: '01', title: 'Konten Promo', desc: 'Instagram & marketplace' },
    { num: '02', title: 'Foto produk', desc: 'Foto katalog, foto model, foto untuk campaign' },
    { num: '03', title: 'Campaign', desc: 'Poster diskon, launching, dan campaign' },
    { num: '04', title: 'Bisnis', desc: 'UMKM, brand lokal, sampai agency' },
    { num: '05', title: 'Daily Content', desc: 'Daily content tanpa ribet desain ulang' },
];

const BENEFITS_LP = [
    { text: 'Bonus Flowgen Studio – AI Foto Produk', bold: true },
    'Generate konten grafis promosi dari foto produk',
    'Mengikuti referensi desain pilihanmu',
    'Hasil rapi, detail, dan tidak terlihat AI',
    'Cocok untuk UMKM, brand, dan personal bisnis',
    'Akses selamanya tanpa biaya tambahan',
];

const FAQS = [
    { q: 'Apakah hasilnya benar-benar mirip referensi?', a: 'Visora meniru struktur desain, warna, dan komposisi hingga ±90%, tergantung kualitas referensi yang kamu upload.' },
    { q: 'Apakah perlu skill desain?', a: 'Tidak. Cukup upload foto produk dan referensi desain.' },
    { q: 'Apakah teks bisa diatur?', a: 'Bisa. Visora menghasilkan teks rapi dan readable yang bisa langsung dipakai.' },
    { q: 'Cocok untuk UMKM?', a: 'Sangat. Justru dirancang untuk bisnis yang butuh visual cepat tanpa ribet.' },
];

/* ───────────── component ───────────── */
export const LandingPage: React.FC = () => {
    const [userCount, setUserCount] = useState(getUserCount());
    const [notifData, setNotifData] = useState<{ name: string; city: string } | null>(null);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const faqRefs = useRef<(HTMLDivElement | null)[]>([]);

    /* ─ Meta Pixel ─ */
    useEffect(() => { initPixel(); trackPageView(); trackViewContent(); }, []);

    /* ─ Shared fake notifications (same engine as /formorder) ─ */
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let idx = getNotifIndex();
        const show = () => {
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
            timeout = setTimeout(show, NOTIF_TIMING[idx % NOTIF_TIMING.length]);
        };
        timeout = setTimeout(show, 5000);
        return () => clearTimeout(timeout);
    }, []);

    const progress = Math.round((userCount / 150) * 100);

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <style>{CSS}</style>

            {/* ─── NAV ─── */}
            <nav className="lp-navbar">
                <div className="lp-container lp-nav-container">
                    <a href="/">
                        <img src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_320/v1770727440/LOGO_VISORA_BLACK_fidzhe.png" alt="Visora" className="lp-logo-img" width="232" height="58" />
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <a href="/dashboard" className="lp-btn lp-btn-sm" style={{ background: 'transparent', color: 'var(--lp-text-primary)', border: '1px solid rgba(0,0,0,0.12)' }}>Login</a>
                        <a href="#pricing-section" className="lp-btn lp-btn-sm lp-btn-dark">Cobain Visora</a>
                    </div>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="lp-hero-section">
                <div className="lp-container">
                    <h1 className="lp-hero-headline">Ubah Foto Produk Biasa Jadi Konten Jualan Berkelas dalam 5 Detik</h1>
                    <p className="lp-hero-subheadline">Tanpa Skill Desain. Tanpa Sewa Desainer Mahal. Cukup Upload Foto &amp; Referensi, Biarkan AI Visora Mengubahnya Jadi Desain Profesional.</p>
                    <p className="lp-hero-highlight">Hasil 90% mirip referensi desain yang kamu mau!</p>
                    <div style={{ marginTop: 16 }}><a href="/formorder" className="lp-btn lp-btn-lg lp-btn-dark">Cobain Visora Sekarang</a></div>

                    <div className="lp-hero-visual">
                        <div className="lp-visual-card">
                            <div className="lp-visual-label">Foto Produk Biasa</div>
                            <img src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_640/v1770727440/PRODUCT_ljkr9f.jpg" className="lp-visual-img" width="640" height="640" alt="" />
                        </div>
                        <div className="lp-visual-arrow">→</div>
                        <div className="lp-visual-card">
                            <div className="lp-visual-label">Gaya Referensi</div>
                            <img src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_640/v1770727440/REFERENSI_uds5oc.jpg" className="lp-visual-img" width="640" height="640" alt="" />
                        </div>
                        <div className="lp-visual-arrow">→</div>
                        <div className="lp-visual-card lp-main-result">
                            <div className="lp-visual-label">Hasil Luar Biasa (AI)</div>
                            <img src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_720/v1770727441/HASIL_khdg7m.jpg" className="lp-visual-img" width="720" height="720" alt="" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── PROBLEM ─── */}
            <section className="lp-problem-section">
                <div className="lp-container">
                    <div className="lp-section-header">
                        <h2>Bosan Foto Produk Terlihat 'Amatir' &amp; Kurang Menjual?</h2>
                        <p>Cari referensi di Pinterest sudah capek-capek, pas eksekusi di Canva hasilnya zonk.</p>
                    </div>
                    <div className="lp-pain-grid">
                        {PAIN_POINTS.map((p, i) => (
                            <div key={i} className="lp-pain-card"><div className="lp-pain-icon">✕</div><p>{p}</p></div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── SOLUTION ─── */}
            <section className="lp-solution-section">
                <div className="lp-container">
                    <div className="lp-section-header">
                        <h2>Satu Tools, Ribuan Gaya Visual Tanpa Batas</h2>
                        <p>Visora bukan sekadar AI desain biasa. Kami menggabungkan tiga kekuatan utama untuk bisnis Anda:</p>
                    </div>
                    <div className="lp-solution-grid">
                        {SOLUTIONS.map((s, i) => (
                            <div key={i} className="lp-solution-card"><h3>{s.title}</h3><p>{s.desc}</p></div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── USE CASES ─── */}
            <section className="lp-usecases-section">
                <div className="lp-container">
                    <div className="lp-section-header">
                        <h2>Dipakai untuk berbagai kebutuhan bisnis</h2>
                        <p>Digunakan oleh bisnis owner yang butuh visual cepat, rapi, dan konsisten tanpa harus jago desain &amp; sewa vendor foto produk jutaan</p>
                    </div>
                    <div className="lp-usecases-wrap">
                        <div className="lp-usecases-grid">
                            {USE_CASES.map((uc, i) => (
                                <div key={i} className="lp-uc-card">
                                    <div className="lp-uc-top"><span className="lp-uc-num">{uc.num}</span><span className="lp-uc-pin" /></div>
                                    <h3 className="lp-uc-title">{uc.title}</h3>
                                    <p className="lp-uc-desc">{uc.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── SHOWCASE MARQUEE ─── */}
            <section className="lp-showcase-section">
                <div className="lp-container">
                    <div className="lp-section-header">
                        <h2>Hasil desain yang bisa langsung dipakai jualan</h2>
                        <p>Generated by Visora in seconds</p>
                    </div>
                </div>
                <div className="lp-marquee-wrapper">
                    <div className="lp-marquee-track">
                        {[0, 1].map(g => (
                            <div key={g} className="lp-marquee-group">
                                {SHOWCASE_IMAGES.map((src, i) => (
                                    <img key={i} src={src.replace('w_600', 'w_260')} className="lp-marquee-img" width="260" height="360" loading="lazy" alt="" />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── TESTIMONIALS MARQUEE ─── */}
            <section className="lp-testimonials-section">
                <div className="lp-container"><div className="lp-section-header"><h2>Apa kata yang udah nyobain??</h2></div></div>
                <div className="lp-saas-marquee">
                    <div className="lp-saas-marquee-content">
                        {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                            <div key={i} className="lp-saas-card">
                                <div className="lp-user-meta"><h4>{t.name}</h4><span>{t.role}</span></div>
                                <p className="lp-card-text">{t.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── PRICING ─── */}
            <section className="lp-pricing-section" id="pricing-section">
                <div className="lp-container">
                    <div className="lp-pricing-card">
                        <div className="lp-promo-badge">Early Access Promo</div>
                        <h2>Akses Selamanya dengan Harga Spesial</h2>
                        <div style={{ marginBottom: 16 }}>
                            <span className="lp-original-price">Rp 150.000</span>
                            <div className="lp-promo-price">Rp 99.000</div>
                            <p style={{ marginBottom: 0 }}>Akses selamanya (lifetime)</p>
                        </div>
                        <p style={{ color: '#FF3B30', fontWeight: 500 }}>Harga akan naik setelah 150 user pertama tercapai — no gimmick</p>
                        <div className="lp-counter-bar"><div className="lp-counter-fill" style={{ width: `${progress}%` }} /></div>
                        <p>🔥 {userCount} / 150 user sudah join</p>

                        <div className="lp-benefit-list">
                            {BENEFITS_LP.map((b, i) => {
                                const text = typeof b === 'string' ? b : b.text;
                                const bold = typeof b === 'string' ? false : b.bold;
                                return (
                                    <div key={i} className="lp-benefit-item">
                                        <span className="lp-check">✓</span>
                                        <span>{bold ? <strong>{text}</strong> : text}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <a href="/formorder" className="lp-btn lp-btn-dark" style={{ width: '100%', padding: 18, display: 'block', textAlign: 'center' }}>Beli Visora Sekarang</a>
                        <p style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Sekali bayar. Tidak ada biaya bulanan. Tanpa Langganan.</p>
                    </div>
                </div>
            </section>

            {/* ─── FAQ ─── */}
            <section className="lp-faq-section">
                <div className="lp-container" style={{ maxWidth: 860 }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '3rem' }}>Pertanyaan yang sering ditanyakan</h2>
                    <div>
                        {FAQS.map((f, i) => (
                            <div key={i} className="lp-accordion-item">
                                <button className="lp-accordion-header" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                    {f.q}<span>{openFaq === i ? '−' : '+'}</span>
                                </button>
                                <div
                                    ref={el => { faqRefs.current[i] = el; }}
                                    className="lp-accordion-content"
                                    style={{ maxHeight: openFaq === i ? (faqRefs.current[i]?.scrollHeight || 200) : 0 }}
                                >
                                    <p>{f.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CHAT ADMIN ─── */}
            <section className="lp-chat-section">
                <div className="lp-container" style={{ textAlign: 'center' }}>
                    <h2>Mau tau lebih detail tentang Visora??</h2>
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                        <a href="https://wa.me/6283193890414?text=Halo%20min%20saya%20tertarik%20sama%20Visora%2C%20mau%20nanya%20dulu%20nih" className="lp-wa-btn" rel="noopener" target="_blank">Chat Admin</a>
                    </div>
                </div>
            </section>

            {/* ─── FINAL PUSH ─── */}
            <section className="lp-final-section">
                <div className="lp-container" style={{ textAlign: 'center' }}>
                    <h2>Berhenti Membuang Waktu untuk Desain yang Tidak Menghasilkan Penjualan.</h2>
                    <p className="lp-final-sub">Amankan akses selamanya sekarang. Mulai ciptakan konten promosi yang membuat orang berhenti scrolling!</p>
                    <a href="/formorder" className="lp-btn lp-btn-xl lp-btn-dark">Beli Visora Sekarang!</a>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="lp-footer"><div className="lp-container"><p>&copy; 2026 Visora. All rights reserved.</p></div></footer>

            {/* ─── LIVE NOTIFICATION ─── */}
            {notifData && (
                <div className="lp-live-notif lp-notif-show">
                    <img className="lp-notif-img" src="https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_120/v1771281459/visora-variant-2-1770749485907_nbnneu.jpg" width="44" height="44" alt="" />
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{notifData.name} - {notifData.city}</div>
                        <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>Baru saja membeli Visora Rp99.000</div>
                    </div>
                </div>
            )}
        </>
    );
};

/* ───────────── CSS (scoped with lp- prefix) ───────────── */
const CSS = `
:root {
    --lp-bg: #FFFFFF;
    --lp-bg-secondary: #F5F5F7;
    --lp-text-primary: #1D1D1F;
    --lp-text-secondary: #86868B;
    --lp-accent-blue: #0071E3;
    --lp-accent-dark: #000000;
    --lp-radius: 20px;
    --lp-shadow: 0 10px 30px rgba(0,0,0,0.05);
    --lp-font: 'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --lp-transition: all 0.3s cubic-bezier(0.25,0.1,0.25,1);
    --lp-max: 1080px;
    --lp-py: 88px;
    --lp-py-sm: 64px;
}
body { font-family: var(--lp-font); background: var(--lp-bg); color: var(--lp-text-primary); line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.lp-container { max-width: var(--lp-max); margin: 0 auto; padding: 0 24px; }
.lp-btn { display: inline-block; padding: 12px 24px; border-radius: 999px; font-weight: 500; cursor: pointer; text-align: center; transition: transform 0.2s ease; line-height: 1; letter-spacing: -0.01em; text-decoration: none; color: inherit; }
.lp-btn:hover { transform: scale(1.02); }
.lp-btn-sm { font-size: 0.875rem; padding: 8px 16px; }
.lp-btn-lg { font-size: 1.125rem; padding: 16px 32px; }
.lp-btn-xl { font-size: 1.25rem; padding: 20px 40px; }
.lp-btn-dark { background: var(--lp-accent-dark); color: #fff; }
h1,h2,h3 { font-weight: 600; letter-spacing: -0.02em; color: var(--lp-text-primary); }
h1 { font-size: clamp(2.25rem,3.8vw,3.5rem); line-height: 1.08; letter-spacing: -0.03em; margin-bottom: 24px; }
h2 { font-size: clamp(1.75rem,3vw,2.5rem); line-height: 1.12; letter-spacing: -0.025em; margin-bottom: 16px; }
h3 { font-size: 1.35rem; line-height: 1.2; margin-bottom: 12px; }
.lp-section-header { text-align: center; max-width: 820px; margin: 0 auto 40px; }
.lp-section-header p { margin-bottom: 0; font-size: 1.0625rem; color: var(--lp-text-secondary); line-height: 1.6; }

/* NAV */
.lp-navbar { padding: 1rem 0; position: sticky; top: 0; background: rgba(255,255,255,0.8); backdrop-filter: blur(20px); z-index: 1000; border-bottom: 1px solid rgba(0,0,0,0.05); }
.lp-nav-container { display: flex; justify-content: space-between; align-items: center; }
.lp-logo-img { height: 58px; width: auto; display: block; }

/* HERO */
.lp-hero-section { padding: calc(var(--lp-py) - 8px) 0 var(--lp-py-sm); text-align: center; background: radial-gradient(circle at 50% 10%, rgba(0,113,227,0.05), transparent 60%); }
.lp-hero-headline { max-width: 820px; margin: 0 auto 24px; }
.lp-hero-subheadline { font-size: 1.375rem; line-height: 1.45; max-width: 880px; margin: 0 auto 16px; color: var(--lp-text-primary); }
.lp-hero-highlight { font-size: 1.0625rem; font-weight: 600; color: var(--lp-accent-blue); margin: 16px auto 40px; background: rgba(0,113,227,0.1); display: inline-block; padding: 10px 16px; border-radius: 999px; }
.lp-hero-visual { margin-top: 40px; display: flex; justify-content: center; align-items: center; gap: 18px; flex-wrap: wrap; }
.lp-visual-card { background: #fff; border-radius: 18px; padding: 14px; box-shadow: var(--lp-shadow); width: 280px; text-align: left; }
.lp-main-result { width: 320px; transform: scale(1.03); box-shadow: 0 20px 40px rgba(0,113,227,0.15); border: 1px solid rgba(0,113,227,0.1); }
.lp-visual-label { font-size: 0.875rem; font-weight: 700; margin-bottom: 10px; color: var(--lp-text-secondary); }
.lp-visual-img { width: 100%; height: auto; border-radius: 14px; display: block; }
.lp-visual-arrow { font-size: 2rem; color: var(--lp-text-secondary); opacity: 0.55; }

/* PROBLEM */
.lp-problem-section { padding: var(--lp-py) 0; background: var(--lp-bg-secondary); }
.lp-pain-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
.lp-pain-card { background: #fff; padding: 28px; border-radius: 24px; text-align: center; box-shadow: var(--lp-shadow); display: flex; flex-direction: column; align-items: center; }
.lp-pain-card p { margin-bottom: 0; font-size: 1.0625rem; color: var(--lp-text-secondary); }
.lp-pain-icon { font-size: 2rem; color: #FF3B30; margin-bottom: 14px; background: rgba(255,59,48,0.1); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* SOLUTION */
.lp-solution-section { padding: var(--lp-py) 0; }
.lp-solution-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 32px; }
.lp-solution-card { background: #fff; padding: 28px; border-radius: 24px; border: 1px solid rgba(0,0,0,0.06); text-align: left; }
.lp-solution-card h3 { color: var(--lp-accent-blue); margin-bottom: 16px; }
.lp-solution-card p { margin-bottom: 0; font-size: 1.0625rem; color: var(--lp-text-secondary); }

/* USE CASES */
.lp-usecases-section { padding: var(--lp-py) 0; background: radial-gradient(circle at 20% 10%, rgba(0,113,227,0.06), transparent 55%), linear-gradient(180deg, #fff 0%, #F5F5F7 100%); overflow: hidden; }
.lp-usecases-wrap { margin-top: 32px; position: relative; border-radius: 28px; background: rgba(255,255,255,0.6); backdrop-filter: blur(18px); border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 24px 60px rgba(0,0,0,0.06); padding: 28px; }
.lp-usecases-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
.lp-uc-card { grid-column: span 4; background: rgba(255,255,255,0.86); border: 1px solid rgba(0,0,0,0.06); border-radius: 22px; padding: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
.lp-uc-card::after { content: ""; position: absolute; inset: -60px -60px auto auto; width: 180px; height: 180px; background: radial-gradient(circle, rgba(0,113,227,0.12), transparent 60%); transform: rotate(18deg); }
.lp-uc-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; position: relative; z-index: 1; }
.lp-uc-num { font-size: 0.95rem; font-weight: 800; letter-spacing: 0.02em; color: rgba(0,113,227,0.82); background: rgba(0,113,227,0.1); padding: 6px 10px; border-radius: 999px; }
.lp-uc-pin { width: 14px; height: 14px; border-radius: 50%; background: rgba(0,113,227,0.85); box-shadow: 0 10px 22px rgba(0,113,227,0.25); }
.lp-uc-title { font-size: 1.25rem; margin: 0 0 6px; position: relative; z-index: 1; }
.lp-uc-desc { font-size: 1rem; margin: 0; color: var(--lp-text-secondary); position: relative; z-index: 1; }

/* SHOWCASE MARQUEE */
.lp-showcase-section { padding: var(--lp-py) 0; background: linear-gradient(180deg, #fff 0%, #F5F5F7 100%); overflow: hidden; }
.lp-marquee-wrapper { overflow: hidden; position: relative; margin-top: 32px; }
.lp-marquee-track { display: flex; width: max-content; animation: lpMarquee 30s linear infinite; }
.lp-marquee-group { display: flex; gap: 22px; padding-right: 22px; }
.lp-marquee-img { width: 260px; height: auto; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); object-fit: cover; }
@keyframes lpMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* TESTIMONIALS */
.lp-testimonials-section { padding: var(--lp-py-sm) 0 var(--lp-py); }
.lp-saas-marquee { display: flex; overflow: hidden; gap: 20px; padding: 26px 0; background: #fff; user-select: none; }
.lp-saas-marquee-content { display: flex; gap: 20px; animation: lpScroll 50s linear infinite; }
.lp-saas-card { flex-shrink: 0; width: 380px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 20px; padding: 22px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); white-space: normal; text-align: left; }
.lp-user-meta h4 { font-size: 1.05rem; margin: 0; font-weight: 800; color: var(--lp-text-primary); }
.lp-user-meta span { font-size: 0.85rem; color: var(--lp-text-secondary); }
.lp-card-text { font-size: 1rem; line-height: 1.55; color: #1d1d1f; margin-top: 10px; margin-bottom: 0; }
@keyframes lpScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* PRICING */
.lp-pricing-section { padding: var(--lp-py-sm) 0 var(--lp-py); background: #F5F5F7; text-align: center; }
.lp-pricing-card { background: #fff; max-width: 520px; margin: 0 auto; border-radius: 24px; padding: 44px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.02); }
.lp-promo-badge { display: inline-block; background: rgba(0,113,227,0.1); color: var(--lp-accent-blue); font-size: 0.875rem; font-weight: 700; padding: 6px 12px; border-radius: 999px; margin-bottom: 18px; }
.lp-promo-price { font-size: 3.25rem; font-weight: 800; color: var(--lp-text-primary); letter-spacing: -0.03em; }
.lp-original-price { font-size: 1.15rem; color: var(--lp-text-secondary); text-decoration: line-through; display: block; margin-bottom: 6px; }
.lp-counter-bar { width: 100%; height: 6px; background: #F5F5F7; border-radius: 999px; overflow: hidden; margin: 14px 0; }
.lp-counter-fill { height: 100%; background: #FF3B30; transition: width 0.4s ease; }
.lp-benefit-list { text-align: left; margin: 26px 0; }
.lp-benefit-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; font-size: 1rem; }
.lp-check { color: #34C759; font-weight: 900; line-height: 1.2; }

/* FAQ */
.lp-faq-section { padding: var(--lp-py) 0; }
.lp-accordion-item { border-bottom: 1px solid rgba(0,0,0,0.08); }
.lp-accordion-header { width: 100%; padding: 18px 0; background: none; border: none; display: flex; justify-content: space-between; align-items: center; font-size: 1.0625rem; font-weight: 600; cursor: pointer; text-align: left; color: var(--lp-text-primary); font-family: inherit; }
.lp-accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
.lp-accordion-content p { padding-bottom: 18px; margin-bottom: 0; font-size: 1rem; color: var(--lp-text-secondary); }

/* CHAT */
.lp-chat-section { padding: var(--lp-py-sm) 0; background: #fff; }
.lp-wa-btn { background: #25D366; color: #fff; padding: 16px 28px; border-radius: 999px; font-weight: 700; box-shadow: 0 18px 40px rgba(37,211,102,0.25); text-decoration: none; display: inline-block; transition: transform 0.2s ease; }
.lp-wa-btn:hover { transform: scale(1.02); }

/* FINAL */
.lp-final-section { padding: calc(var(--lp-py) + 12px) 0; text-align: center; background: linear-gradient(135deg, #F5F5F7 0%, #fff 100%); }
.lp-final-sub { font-size: 1.375rem; margin-bottom: 40px; color: var(--lp-text-secondary); }

/* FOOTER */
.lp-footer { padding: 2rem 0; text-align: center; border-top: 1px solid rgba(0,0,0,0.08); }
.lp-footer p { margin-bottom: 0; font-size: 1.0625rem; color: var(--lp-text-secondary); }

/* NOTIFICATION */
.lp-live-notif { position: fixed; bottom: 20px; left: 20px; display: flex; align-items: center; gap: 12px; background: rgba(29,29,31,0.92); backdrop-filter: blur(10px); color: #fff; padding: 12px 14px; border-radius: 16px; box-shadow: 0 14px 35px rgba(0,0,0,0.28); z-index: 9999; animation: lpSlideUp 0.4s ease-out; max-width: 340; }
.lp-notif-img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
@keyframes lpSlideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

/* RESPONSIVE */
@media (max-width: 900px) {
    .lp-container { padding: 0 18px; }
    .lp-hero-visual { flex-direction: column; }
    .lp-visual-arrow { transform: rotate(90deg); margin: 1rem 0; }
    .lp-usecases-wrap { padding: 18px; }
    .lp-uc-card { grid-column: span 12; }
    .lp-pricing-card { padding: 36px 20px; }
    .lp-section-header { margin-bottom: 28px; }
}
@media (prefers-reduced-motion: reduce) {
    .lp-marquee-track, .lp-saas-marquee-content { animation: none !important; }
    .lp-btn, .lp-wa-btn { transition: none !important; }
}
`;

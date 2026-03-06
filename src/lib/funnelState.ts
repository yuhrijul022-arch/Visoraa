/**
 * Shared funnel state between landing page and /formorder
 * Uses localStorage for seamless state continuation.
 */

const KEYS = {
    currentUser: 'visora_currentUser',
    notifIdx: 'visora_notif_idx',
    notifTs: 'visora_notif_ts',
    showcaseIdx: 'visora_showcase_idx',
} as const;

const MAX_USERS = 145;
const INITIAL_USER_COUNT = 112;

export function getUserCount(): number {
    const val = parseInt(localStorage.getItem(KEYS.currentUser) || '');
    return isNaN(val) ? INITIAL_USER_COUNT : Math.min(val, MAX_USERS);
}

export function incrementUserCount(): number {
    const current = getUserCount();
    if (current >= MAX_USERS) return current;
    const next = current + 1;
    localStorage.setItem(KEYS.currentUser, String(next));
    return next;
}

export function getUserProgress(): number {
    return Math.round((getUserCount() / 150) * 100);
}

export function getNotifIndex(): number {
    return parseInt(localStorage.getItem(KEYS.notifIdx) || '0') || 0;
}

export function setNotifIndex(idx: number): void {
    localStorage.setItem(KEYS.notifIdx, String(idx));
}

export function getLastNotifTime(): number {
    return parseInt(localStorage.getItem(KEYS.notifTs) || '0') || 0;
}

export function setLastNotifTime(ts: number): void {
    localStorage.setItem(KEYS.notifTs, String(ts));
}

// Shared notification dataset
export const NOTIF_NAMES = [
    'Adit', 'Bayu', 'Fajar', 'Gilang', 'Hendra',
    'Indra', 'Siti', 'Maya', 'Rendy', 'Indah',
];

export const NOTIF_CITIES = [
    'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar', 'Jogja', 'Bali',
];

export const NOTIF_TIMING = [10000, 18000]; // 10s, 18s alternating

// Shared testimonials
export const TESTIMONIALS = [
    { name: 'Merlin', role: 'Pebisnis Skincare', text: '"udah kepake dibisnis skincare aku, alhamdulillah ngurangin waktu buat produksi konten"' },
    { name: 'Sigit', role: 'Properti Agent', text: '"worth it sejauh ini aku pake buat bikin flayer promosi perumahan dan buat ngonten juga"' },
    { name: 'Gradi', role: 'Freelancer', text: '"makasih udah buat yang bikin tools ini, aku gausah hire freelance/desainer grafis lagi"' },
    { name: 'Eko', role: 'Brand Owner', text: '"kepake banget buat promo IG, tinggal rapihin dikit udah beres"' },
    { name: 'Siti', role: 'UMKM Food', text: '"enak bgtt kakk, tinggal upload foto produk, referensi, posting tanpa harus edit"' },
];

// Shared showcase images (same as landing page marquee)
export const SHOWCASE_IMAGES = [
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901861/1_kjxsbl.jpg',
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901863/2_w3liqr.jpg',
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901861/3_akltpp.jpg',
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901861/4_dsokko.jpg',
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901862/5_f7iwyn.jpg',
    'https://res.cloudinary.com/dodk1vq7t/image/upload/f_auto,q_auto,w_600/v1770901866/6_axfthh.jpg',
];

// Shared benefit list
export const BENEFITS = [
    { text: 'Bonus Flowgen Studio – AI Foto Produk', bold: true },
    { text: 'Generate konten grafis promosi dari foto produk' },
    { text: 'Mengikuti referensi desain pilihanmu' },
    { text: 'Hasil rapi, detail, dan tidak terlihat AI' },
    { text: 'Cocok untuk UMKM, brand, dan personal bisnis' },
    { text: 'Akses selamanya tanpa biaya tambahan' },
];

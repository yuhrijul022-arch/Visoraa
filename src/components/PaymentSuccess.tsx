import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const PaymentSuccess: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => { const t = setTimeout(() => navigate('/'), 5000); return () => clearTimeout(t); }, [navigate]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 font-sans">
            <div className="max-w-sm w-full text-center">
                <div className="text-6xl mb-6">✅</div>
                <h1 className="text-2xl font-bold mb-3 tracking-tight">Pembayaran Berhasil!</h1>
                <p className="text-gray-400 text-sm mb-8">Akun Anda sudah aktif. Credits telah ditambahkan.</p>
                <button onClick={() => navigate('/')} className="bg-white text-black px-8 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-200 active:scale-[0.98] transition-all">
                    Mulai Menggunakan Visora
                </button>
                <p className="text-xs text-gray-600 mt-4">Auto redirect dalam 5 detik...</p>
            </div>
        </div>
    );
};

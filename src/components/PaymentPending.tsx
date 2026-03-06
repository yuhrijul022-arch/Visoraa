import React from 'react';
import { useNavigate } from 'react-router-dom';

export const PaymentPending: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 font-sans">
            <div className="max-w-sm w-full text-center">
                <div className="text-6xl mb-6">⏳</div>
                <h1 className="text-2xl font-bold mb-3 tracking-tight">Menunggu Pembayaran</h1>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                    Silakan selesaikan pembayaran Anda. Credits akan otomatis ditambahkan setelah pembayaran dikonfirmasi.
                </p>
                <div className="space-y-3">
                    <button onClick={() => navigate('/')} className="w-full bg-white text-black py-3 rounded-2xl font-semibold text-sm hover:bg-gray-200 active:scale-[0.98] transition-all">
                        Ke Dashboard
                    </button>
                    <button onClick={() => navigate('/formorder')} className="w-full bg-white/5 text-white py-3 rounded-2xl font-medium text-sm border border-white/10 hover:bg-white/10 transition-all">
                        Bayar Ulang
                    </button>
                </div>
            </div>
        </div>
    );
};

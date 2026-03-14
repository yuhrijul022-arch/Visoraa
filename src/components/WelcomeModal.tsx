import React from 'react';

interface WelcomeModalProps {
  onClose: () => void;
  dbUser: any;
}

export default function WelcomeModal({ onClose, dbUser }: WelcomeModalProps) {
  const handleClose = () => {
    localStorage.setItem('visora_welcomed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl text-center" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Selamat Datang di Visora!</h3>
            <p className="text-gray-400 text-sm mb-6">Pendaftaran Anda telah berhasil diproses. Saldo credits bonus awal telah ditambahkan ke akun Anda.</p>
            
            <div className="bg-transparent mb-8 text-left">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-white/20">
                            <th className="py-3 text-white font-bold text-left">Plan</th>
                            <th className="py-3 text-white font-bold text-left">Welcome Credits</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-white/10">
                            <td className="py-3 font-bold text-white">Basic</td>
                            <td className="py-3 text-white font-bold">250 credits</td>
                        </tr>
                        <tr className="border-b border-white/10">
                            <td className="py-3 font-bold text-white">Pro</td>
                            <td className="py-3 text-white font-bold">400 credits</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <button onClick={handleClose} className="w-full py-4 rounded-xl bg-white text-black text-lg font-bold hover:bg-gray-200 transition-colors">
                Mulai Mendesain Sekarang
            </button>
        </div>
    </div>
  );
}

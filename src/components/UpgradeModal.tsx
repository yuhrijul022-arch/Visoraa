import React from 'react';
import { Sparkles, Zap } from 'lucide-react';

interface UpgradeModalProps {
  onClose: () => void;
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                <Sparkles size={28} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Upgrade ke Pro</h3>
            <p className="text-gray-400 text-sm mb-6">Nikmati akses tanpa batas dengan Infinite Mode, resolusi Ultra HD (4K), dan template eksklusif.</p>
            
            <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-left"><div className="text-green-400"><Zap size={16} /></div><span className="text-gray-300">Infinite Generate Mode</span></div>
                <div className="flex items-center gap-3 text-sm text-left"><div className="text-green-400"><Zap size={16} /></div><span className="text-gray-300">Resolusi 4K & Ultra HD</span></div>
                <div className="flex items-center gap-3 text-sm text-left"><div className="text-green-400"><Zap size={16} /></div><span className="text-gray-300">Jalur Cepat (Prioritas Server)</span></div>
            </div>

            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">Nanti</button>
                <button onClick={() => { onClose(); window.location.href = '/formorderauth?plan=pro'; }} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">Upgrade Sekarang</button>
            </div>
        </div>
    </div>
  );
}

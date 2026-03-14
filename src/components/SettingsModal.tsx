import React, { useState } from 'react';
import { Settings2, X, Box, Type, Code, Zap, Sparkles, Lock } from 'lucide-react';
import { DesignInputs, LayoutBlueprint, StyleProfile } from '../../types';

interface SettingsModalProps {
  onClose: () => void;
  inputs: DesignInputs;
  setInputs: React.Dispatch<React.SetStateAction<DesignInputs>>;
  dbUser: any;
  blueprint: LayoutBlueprint | null;
  styleProfile: StyleProfile | null;
  toast: any;
}

export default function SettingsModal({
  onClose,
  inputs,
  setInputs,
  dbUser,
  blueprint,
  styleProfile,
  toast
}: SettingsModalProps) {
  const [showJson, setShowJson] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" style={{ animation: 'fadeInDown 0.2s ease-out' }}>

        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings2 size={18} className="text-blue-500" /> Studio Settings
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Box size={14} /> Output Specs
              </h4>

              <div>
                <label className="text-[10px] font-medium text-gray-400 mb-2 block">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1:1', '4:5', '9:16', '16:9'].map(r => (
                    <button key={r} onClick={() => setInputs(prev => ({ ...prev, ratio: r as any }))}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${inputs.ratio === r ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-400 mb-2 block flex justify-between">
                  <span>Style Fidelity</span>
                  <span className="text-blue-400">{inputs.matchStrength}%</span>
                </label>
                <input type="range" min="0" max="100" value={inputs.matchStrength} onChange={(e) => setInputs(prev => ({ ...prev, matchStrength: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-gray-800 rounded-full appearance-none cursor-pointer" />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-400 mb-2 block">Variations</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(q => (
                    <button key={q} onClick={() => setInputs(prev => ({ ...prev, quantity: q }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${inputs.quantity === q ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selector in Settings */}
              <div>
                <label className="text-[10px] font-medium text-gray-400 mb-2 block">AI Model</label>
                <div className="flex gap-2">
                  <button onClick={() => setInputs(prev => ({ ...prev, mode: 'standard' }))}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${inputs.mode === 'standard' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                    <Zap size={10} /> Standard
                  </button>
                  <button onClick={() => setInputs(prev => ({ ...prev, mode: 'pro' }))}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${inputs.mode === 'pro' ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                    <Sparkles size={10} /> Pro
                  </button>
                  {dbUser?.plan === 'pro' || dbUser?.infiniteEnabled ? (
                      <button onClick={() => setInputs(prev => ({ ...prev, mode: 'infinite' }))}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${inputs.mode === 'infinite' ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                          <Sparkles size={10} className="text-orange-400" /> Infinite
                      </button>
                  ) : (
                      <button onClick={() => toast({ type: 'warning', title: 'Fitur Terkunci', description: 'Infinite Mode eksklusif untuk pengguna paket Pro.' })}
                          className="flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 bg-white/5 border-transparent text-gray-500 hover:bg-white/10 relative overflow-hidden">
                          <Lock size={10} className="text-gray-500" /> Infinite
                      </button>
                  )}
                </div>
                <div className="text-[9px] text-gray-500 mt-2 text-center font-medium">
                  {inputs.mode === 'infinite' ? '0 Credits (Unlimited untuk PRO) • Kecepatan Tinggi' : 
                  (inputs.mode === 'pro' ? '55-65 Credits per Gambar • Kualitas Fotorealistik' : '30-37 Credits per Gambar • Kualitas Menengah')}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Type size={14} /> Text & Copy
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {inputs.textMode === 'off' ? 'Disabled' : 'Enabled'}
                  </span>
                  <button
                    onClick={() => setInputs(prev => ({ ...prev, textMode: prev.textMode === 'off' ? 'on' : 'off' }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${inputs.textMode !== 'off' ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    <span className={`${inputs.textMode !== 'off' ? 'translate-x-4' : 'translate-x-1'} inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm`} />
                  </button>
                </div>
              </div>

              <div className={`space-y-3 transition-all duration-300 ${inputs.textMode === 'off' ? 'opacity-40 blur-[1px] pointer-events-none grayscale select-none' : ''}`}>
                <input name="brandName" disabled={inputs.textMode === 'off'} value={inputs.brandName} onChange={handleInputChange} placeholder="Brand Name" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                <input name="headline" disabled={inputs.textMode === 'off'} value={inputs.headline} onChange={handleInputChange} placeholder="Headline" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                <div className="flex gap-2">
                  <input name="price" disabled={inputs.textMode === 'off'} value={inputs.price} onChange={handleInputChange} placeholder="Price" className="w-1/3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                  <input name="cta" disabled={inputs.textMode === 'off'} value={inputs.cta} onChange={handleInputChange} placeholder="CTA" className="w-2/3 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {(blueprint || styleProfile) && (
            <div className="border-t border-white/5 pt-6">
              <button
                onClick={() => setShowJson(!showJson)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors mb-4"
              >
                <Code size={14} /> Blueprint Logic
              </button>

              {showJson && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-auto max-h-48 scrollbar-hide">
                    <div className="text-[10px] text-blue-400 font-bold mb-2">STYLE DNA</div>
                    <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">{JSON.stringify(styleProfile, null, 2)}</pre>
                  </div>
                  <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-auto max-h-48 scrollbar-hide">
                    <div className="text-[10px] text-blue-400 font-bold mb-2">LAYOUT STRUCTURE</div>
                    <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">{JSON.stringify(blueprint, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

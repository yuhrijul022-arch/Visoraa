import React, { useState, useEffect } from 'react';
import { DesignInputs, FileData, LayoutBlueprint, StyleProfile, AppUser } from './types';
import { generateViaAPI, fetchRecentGenerations } from './src/lib/generateService';
import { useCredits } from './src/lib/credits';
import { supabase } from './src/lib/supabaseClient';
import BottomControlBar from './components/BottomControlBar';
import ResultDisplay from './components/ResultDisplay';
import { ProfileMenu } from './src/components/ProfileMenu';
import { TopUpModal } from './src/components/TopUpModal';
import { useToast } from './src/components/ui/ToastProvider';
import { Loader2, AlertCircle, Settings2, Box, Type, Code, X, Zap, Sparkles } from 'lucide-react';

const INITIAL_INPUTS: DesignInputs = {
  brandName: "",
  headline: "",
  benefit: "",
  price: "",
  cta: "",
  ratio: "1:1",
  matchStrength: 50,
  customPrompt: "",
  textMode: "on",
  quantity: 1,
  mode: "standard",
};

interface AppProps {
  user: AppUser;
}

export default function App({ user }: AppProps) {
  // Restore step from localStorage (only 'upload' or 'done' are safe to restore)
  const [step, setStep] = useState<'upload' | 'analyzing' | 'preview' | 'generating' | 'done'>(() => {
    const saved = localStorage.getItem('visora_last_step');
    if (saved === 'done') return 'done';
    return 'upload';
  });

  // Restore inputs (settings + prompt) from localStorage
  const [inputs, setInputs] = useState<DesignInputs>(() => {
    try {
      const saved = localStorage.getItem('visora_studio_settings');
      if (saved) return { ...INITIAL_INPUTS, ...JSON.parse(saved) };
    } catch { /* ignore corrupt data */ }
    return INITIAL_INPUTS;
  });

  const [productImage, setProductImage] = useState<FileData | null>(null);
  const [refImage, setRefImage] = useState<FileData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [dbUser, setDbUser] = useState<any>(null);

  const [blueprint, setBlueprint] = useState<LayoutBlueprint | null>(null);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);

    // Restore image URLs from localStorage
    const [imageUrls, setImageUrls] = useState<string[]>(() => {
      try {
        const saved = localStorage.getItem('visora_image_urls');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
      return [];
    });
  
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Auto-save inputs to localStorage on every change
  useEffect(() => {
    localStorage.setItem('visora_studio_settings', JSON.stringify(inputs));
  }, [inputs]);

  // Auto-save step to localStorage
  useEffect(() => {
    localStorage.setItem('visora_last_step', step);
  }, [step]);

  // Auto-save image URLs to localStorage
  useEffect(() => {
    localStorage.setItem('visora_image_urls', JSON.stringify(imageUrls));
  }, [imageUrls]);

  // Restore images from Supabase if step=done but no URLs in localStorage
  useEffect(() => {
    if (step === 'done' && imageUrls.length === 0 && user?.uid) {
      fetchRecentGenerations(user.uid).then(urls => {
        if (urls.length > 0) {
          setImageUrls(urls);
        } else {
          // No images found, go back to upload
          setStep('upload');
        }
      });
    }
  }, []);

  // Fetch user from DB to know plan and infiniteEnabled
  useEffect(() => {
    if (user?.uid) {
      supabase.from('users').select('*').eq('id', user.uid).single().then(({ data }) => {
        setDbUser(data);
        if (data && data.plan && localStorage.getItem('visora_welcomed') !== 'true') {
            const activatedAt = data.plan_activated_at ? new Date(data.plan_activated_at).getTime() : 0;
            // Welcome msg for users activated in the last 24h
            if (Date.now() - activatedAt < 24 * 60 * 60 * 1000) {
               setShowWelcomeModal(true);
            } else {
               localStorage.setItem('visora_welcomed', 'true');
            }
        }
      });
    }
  }, [user?.uid]);

  const creditState = useCredits(user.uid);
  const { toast } = useToast();

  const isLocked = step === 'analyzing' || step === 'generating';

  const creditCost = inputs.mode === 'infinite' ? 0 : (inputs.mode === 'pro' ? 2 : 1);
  const totalCost = (inputs.quantity || 1) * creditCost;

  const handleAnalyze = async () => {
    if (!productImage) {
      toast({ type: 'warning', title: 'Upload Produk Dulu', description: 'Silakan upload gambar produk sebelum melanjutkan.' });
      return;
    }

    // Credit check
    if (creditState.credits < totalCost) {
      toast({ type: 'error', title: 'Credit Tidak Cukup', description: `Dibutuhkan ${totalCost} credit. Saldo Anda: ${creditState.credits} credit.` });
      setShowTopUp(true);
      return;
    }

    setStep('analyzing');
    setError(null);
    setTimeout(() => {
      setBlueprint({
        canvas: { ratio: inputs.ratio, safe_margin_percent: 10 },
        product_placement: { anchor: "center", scale_percent: 65, y_offset_percent: 0, shadow: "soft", cutout_needed: true },
        text_mode: inputs.textMode === 'off' ? 'OFF' : 'ON',
        output_language: "id",
        text_zones: {
          headline: { x: 50, y: 15, w: 80, h: 20, align: "center", enabled: true },
          benefit: { x: 50, y: 85, w: 60, h: 10, align: "center", enabled: true },
          price: { x: 80, y: 80, w: 20, h: 10, align: "right", enabled: true },
          cta: { x: 50, y: 90, w: 40, h: 8, align: "center", enabled: true },
        },
        style: { typography_mood: "modern_minimal", background_style: "clean_studio" },
        elements: { badge: { enabled: false }, shapes: { enabled: false }, frame: { enabled: false } },
        copy_policy: { keep_short: true, avoid_claims: true },
        product_category: "general",
      });
      setStyleProfile(null);
      setStep('preview');
    }, 1500);
  };

  const handleGenerate = async () => {
    if (!productImage || !blueprint) return;

    if (creditState.credits < totalCost) {
      toast({ type: 'error', title: 'Credit Tidak Cukup', description: `Dibutuhkan ${totalCost} credit. Saldo Anda: ${creditState.credits} credit. Silakan top up terlebih dahulu.` });
      setShowTopUp(true);
      return;
    }

    setStep('generating');
    setError(null);
    try {
      const result = await generateViaAPI(productImage, refImage, inputs, blueprint, styleProfile);

      if (result.status === 'FAILED') {
        throw new Error(result.error || 'Generation failed');
      }

      const urls = result.outputs.map(o => o.downloadUrl);
      if (urls.length > 0) {
        setImageUrls(urls);
        setStep('done');
        creditState.refresh();
        toast({ type: 'success', title: 'Desain Berhasil! 🎉', description: `${urls.length} variasi telah dibuat. Credit terpakai: ${totalCost}.` });
      } else {
        throw new Error("No images generated");
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.message || 'Generation failed';
      
      if (msg.startsWith('REDIRECT:')) {
         const parts = msg.split(':');
         window.location.href = parts[1];
         return;
      }
      
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        setError('Credit tidak cukup untuk melanjutkan.');
        toast({ type: 'error', title: 'Credit Habis', description: 'Silakan top up credit untuk melanjutkan generate desain.' });
        setShowTopUp(true);
      } else if (msg.includes('RATE_LIMITED')) {
        setError('Server sedang sibuk atau melampaui limit.');
        toast({ type: 'warning', title: 'Terlalu Banyak Permintaan', description: msg.includes('limit') ? msg.split('RATE_LIMITED: ')[1] : 'Server sedang sibuk, coba beberapa saat lagi.' });
      } else if (msg.includes('timeout') || msg.includes('Timeout')) {
        setError('Koneksi ke server timeout. Silakan coba lagi.');
        toast({ type: 'error', title: 'Koneksi Timeout', description: 'Server tidak merespon. Periksa koneksi internet Anda dan coba lagi.' });
      } else {
        setError('Terjadi kesalahan saat generate. Silakan coba lagi.');
        toast({ type: 'error', title: 'Generate Gagal', description: 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.' });
      }
      setStep('preview');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setProductImage(null);
    setRefImage(null);
    setInputs(INITIAL_INPUTS);
    setBlueprint(null);
    setStyleProfile(null);
    setImageUrls([]);
    setError(null);
    // Clear persisted state
    localStorage.removeItem('visora_last_step');
    localStorage.removeItem('visora_image_urls');
    localStorage.removeItem('visora_studio_settings');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (isLocked) return;
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col relative">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,30,40,0.4),rgba(0,0,0,1))] -z-10 pointer-events-none" />

      <main className="flex-1 overflow-y-auto relative scrollbar-hide">
        {/* Header */}
        <div className="p-6 md:p-8 flex justify-between items-center pointer-events-none sticky top-0 z-10 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]">
          <div className="flex items-center gap-3 pointer-events-auto select-none">
            <svg width="34" height="24" viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M0 0H8V24H0V0Z" fill="currentColor" />
              <path d="M12 0H22C28.6274 0 34 5.37258 34 12C34 18.6274 28.6274 24 22 24H12V0Z" fill="currentColor" />
            </svg>
            <span className="font-normal text-2xl tracking-tight text-white">Visora</span>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {step !== 'upload' && step !== 'done' && (
              <button onClick={handleReset} className="text-xs font-medium text-gray-500 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                Reset
              </button>
            )}
            <ProfileMenu user={user} credits={creditState.credits} onTopUp={() => setShowTopUp(true)} />
          </div>
        </div>

        {/* Central Display */}
        <div className="flex flex-col items-center justify-center p-4 min-h-[60vh]">
          {dbUser?.plan === 'basic' && (
            <div className="mb-6 w-full max-w-2xl bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between" style={{ animation: 'fadeInDown 0.4s ease-out' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                        <Sparkles size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h4 className="text-white font-semibold text-sm">Upgrade ke Pro</h4>
                        <p className="text-gray-400 text-xs">Unlock Infinite Mode & fitur 4K Resolution.</p>
                    </div>
                </div>
                <button onClick={() => setShowUpgradeModal(true)} className="px-4 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-purple-100 transition-colors">
                    Lihat Penawaran
                </button>
            </div>
          )}

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm" style={{ animation: 'fadeInDown 0.3s ease-out' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="text-center space-y-4 max-w-md mt-12" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 tracking-tight">
                Design Intelligence
              </h1>
              <p className="text-gray-400 text-lg">
                Upload your product below. We'll handle the rest.
              </p>
            </div>
          )}

          {(step === 'analyzing' || step === 'generating') && (
            <div className="flex flex-col items-center gap-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
                <Loader2 size={48} className="text-blue-500 animate-spin relative z-10" />
              </div>
              <p className="text-gray-400 font-medium animate-pulse">
                {step === 'analyzing' ? 'Analyzing product & planning composition...' : 'Rendering high-fidelity variations...'}
              </p>
            </div>
          )}

          {step === 'preview' && blueprint && (
            <div className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Blueprint Ready</h2>
                  <p className="text-gray-400 text-sm">AI has planned the composition. Ready to render.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-mono border ${inputs.mode === 'infinite' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : (inputs.mode === 'pro' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20')}`}>
                    {inputs.mode === 'infinite' ? 'INFINITE MODE' : (inputs.mode === 'pro' ? 'PRO MODE' : 'STANDARD')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Layout</div>
                  <div className="text-sm font-semibold text-white">{blueprint.product_placement.anchor} Anchor</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Style</div>
                  <div className="text-sm font-semibold text-white truncate">{styleProfile?.typography_mood || 'Modern'}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ratio</div>
                  <div className="text-sm font-semibold text-white">{inputs.ratio}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cost</div>
                  <div className="text-sm font-semibold text-white">{inputs.mode === 'infinite' ? 'Free (Pro)' : `${totalCost} credit${totalCost > 1 ? 's' : ''}`}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                >
                  Adjust Inputs
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Generate Images
                </button>
              </div>
            </div>
          )}

          {step === 'done' && imageUrls.length > 0 && (
            <div className="pb-32 w-full max-w-6xl mx-auto">
              <ResultDisplay
                imageUrls={imageUrls}
                blueprint={blueprint}
                styleProfile={styleProfile}
                onReset={handleReset}
                onDownload={() => { }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Control Bar */}
      {step !== 'done' && (
        <BottomControlBar
          step={step}
          inputs={inputs}
          setInputs={setInputs}
          productImage={productImage}
          setProductImage={setProductImage}
          refImage={refImage}
          setRefImage={setRefImage}
          onAnalyze={handleAnalyze}
          onGenerate={handleGenerate}
          isLocked={isLocked}
          isInfiniteEnabled={dbUser?.plan === 'pro' && dbUser?.infiniteEnabled}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" style={{ animation: 'fadeInDown 0.2s ease-out' }}>

            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings2 size={18} className="text-blue-500" /> Studio Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
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
                      <button onClick={() => {
                          if (dbUser?.plan !== 'pro') {
                              setShowSettings(false);
                              setShowUpgradeModal(true);
                              return;
                          }
                          setInputs(prev => ({ ...prev, mode: 'pro' }));
                      }}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${inputs.mode === 'pro' ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                        <Sparkles size={10} /> Pro {dbUser?.plan !== 'pro' && '🔒'}
                      </button>
                    </div>
                    <div className="text-[9px] text-gray-600 mt-1">
                      {inputs.mode === 'pro' ? '2 credits per image • Higher quality' : '1 credit per image • Fast generation'}
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
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
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
                      <button onClick={() => setShowUpgradeModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">Nanti</button>
                      <button onClick={() => { setShowUpgradeModal(false); window.location.href = '/formorderauth?plan=pro'; }} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors">Upgrade Sekarang</button>
                  </div>
              </div>
          </div>
      )}

      {/* Welcome Modal */}
      {showWelcomeModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl text-center" style={{ animation: 'fadeInDown 0.2s ease-out' }}>
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Selamat Datang di Visora!</h3>
                  <p className="text-gray-400 text-sm mb-6">Pendaftaran Anda telah berhasil diproses. Saldo credits bonus awal telah ditambahkan ke akun Anda.</p>
                  
                  <div className="bg-white/5 rounded-2xl p-4 mb-8">
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Paket Aktif</p>
                      <p className="text-lg font-bold text-white">{dbUser?.plan === 'pro' ? 'Pro Plan' : 'Basic Plan'}</p>
                  </div>

                  <button onClick={() => { localStorage.setItem('visora_welcomed', 'true'); setShowWelcomeModal(false); }} className="w-full py-4 rounded-xl bg-white text-black text-lg font-bold hover:bg-gray-200 transition-colors">
                      Mulai Mendesain Sekarang
                  </button>
              </div>
          </div>
      )}

      {/* Top Up Modal */}
      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={() => creditState.startFastPolling()} />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
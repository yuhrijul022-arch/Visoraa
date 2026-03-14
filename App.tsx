import React, { useState, useEffect, Suspense, lazy } from 'react';
import { DesignInputs, FileData, LayoutBlueprint, StyleProfile, AppUser } from './types';
import { useCredits } from './src/lib/credits';
import { supabase } from './src/lib/supabaseClient';
import { useToast } from './src/components/ui/ToastProvider';
import { Loader2, AlertCircle } from 'lucide-react';
import { EntitlementResolver } from './src/lib/entitlements';

const BottomControlBar = lazy(() => import('./components/BottomControlBar'));
const ResultDisplay = lazy(() => import('./components/ResultDisplay'));
const ProfileMenu = lazy(() => import('./src/components/ProfileMenu').then(m => ({ default: m.ProfileMenu })));
const TopUpModal = lazy(() => import('./src/components/TopUpModal').then(m => ({ default: m.TopUpModal })));

const SettingsModal = lazy(() => import('./src/components/SettingsModal'));
const UpgradeModal = lazy(() => import('./src/components/UpgradeModal'));
const WelcomeModal = lazy(() => import('./src/components/WelcomeModal'));

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
  const [step, setStep] = useState<'upload' | 'analyzing' | 'preview' | 'generating' | 'done'>(() => {
    const saved = localStorage.getItem('visora_last_step');
    if (saved === 'done') return 'done';
    return 'upload';
  });

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

  useEffect(() => {
    localStorage.setItem('visora_studio_settings', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem('visora_last_step', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem('visora_image_urls', JSON.stringify(imageUrls));
  }, [imageUrls]);

  useEffect(() => {
    if (step === 'done' && imageUrls.length === 0 && user?.uid) {
      import('./src/lib/generateService').then(({ fetchRecentGenerations }) => {
        fetchRecentGenerations(user.uid).then((urls: string[]) => {
          if (urls.length > 0) {
            setImageUrls(urls);
          } else {
            setStep('upload');
          }
        });
      });
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      supabase.from('users').select('*').eq('id', user.uid).single().then(({ data }) => {
        setDbUser(data);
        if (data && data.plan && localStorage.getItem('visora_welcomed') !== 'true') {
            const activatedAt = data.plan_activated_at ? new Date(data.plan_activated_at).getTime() : 0;
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

  const creditCost = inputs.mode === 'infinite' ? 0 : (inputs.mode === 'pro' ? 55 : 30);
  const totalCost = (inputs.quantity || 1) * creditCost;

  const handleAnalyze = async () => {
    if (!productImage) {
      toast({ type: 'warning', title: 'Upload Produk Dulu', description: 'Silakan upload gambar produk sebelum melanjutkan.' });
      return;
    }

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
      const { generateViaAPI } = await import('./src/lib/generateService');
      const result = await generateViaAPI(productImage, refImage, inputs, blueprint, styleProfile);

      if (result.status === 'FAILED') {
        throw new Error(result.error || 'Generation failed');
      }

      const urls = result.outputs.map((o: any) => o.downloadUrl);
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
    localStorage.removeItem('visora_last_step');
    localStorage.removeItem('visora_image_urls');
    localStorage.removeItem('visora_studio_settings');
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col relative">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,30,40,0.4),rgba(0,0,0,1))] -z-10 pointer-events-none" />

      <main className="flex-1 overflow-y-auto relative scrollbar-hide">
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
            <Suspense fallback={<div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />}>
              <ProfileMenu user={user} credits={creditState.credits} onTopUp={() => setShowTopUp(true)} plan={dbUser?.plan} />
            </Suspense>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 min-h-[60vh]">
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
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Generate Images
                </button>
              </div>
            </div>
          )}

          {step === 'done' && imageUrls.length > 0 && (
            <div className="pb-32 w-full max-w-6xl mx-auto">
              <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}>
                <ResultDisplay
                  imageUrls={imageUrls}
                  blueprint={blueprint}
                  styleProfile={styleProfile}
                  onReset={handleReset}
                  onDownload={() => { }}
                />
              </Suspense>
            </div>
          )}
        </div>
      </main>

      {step !== 'done' && (
        <Suspense fallback={<div className="h-24 bg-[#111] animate-pulse absolute bottom-0 w-full" />}>
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
            isInfiniteEnabled={
              dbUser ? new EntitlementResolver({
                plan: dbUser.plan || 'free',
                infinite_enabled: dbUser.infiniteEnabled || false,
                status: dbUser.status || 'active'
              }).canUseInfinite : false
            }
            onOpenSettings={() => setShowSettings(true)}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal 
            onClose={() => setShowSettings(false)}
            inputs={inputs}
            setInputs={setInputs}
            dbUser={dbUser}
            blueprint={blueprint}
            styleProfile={styleProfile}
            toast={toast}
          />
        </Suspense>
      )}

      {showUpgradeModal && (
        <Suspense fallback={null}>
          <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
        </Suspense>
      )}

      {showWelcomeModal && (
        <Suspense fallback={null}>
          <WelcomeModal onClose={() => setShowWelcomeModal(false)} dbUser={dbUser} />
        </Suspense>
      )}

      {showTopUp && (
        <Suspense fallback={null}>
          <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} onSuccess={() => creditState.startFastPolling()} />
        </Suspense>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
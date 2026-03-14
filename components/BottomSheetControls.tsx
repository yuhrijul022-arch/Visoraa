import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Sparkles, Settings2, Box, Type, ArrowRight, Code, X } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { DesignInputs, FileData, LayoutBlueprint, StyleProfile } from '../types';

interface BottomSheetControlsProps {
  step: 'upload' | 'analyzing' | 'preview' | 'generating' | 'done';
  inputs: DesignInputs;
  setInputs: React.Dispatch<React.SetStateAction<DesignInputs>>;
  productImage: FileData | null;
  setProductImage: (data: FileData | null) => void;
  refImage: FileData | null;
  setRefImage: (data: FileData | null) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  isLocked: boolean;
  blueprint: LayoutBlueprint | null;
  styleProfile: StyleProfile | null;
}

const BottomSheetControls: React.FC<BottomSheetControlsProps> = ({
  step,
  inputs,
  setInputs,
  productImage,
  setProductImage,
  refImage,
  setRefImage,
  onAnalyze,
  onGenerate,
  isLocked,
  blueprint,
  styleProfile
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showJson, setShowJson] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Auto-collapse on 'done' or when analyzing to show the canvas
  useEffect(() => {
    if (step === 'analyzing' || step === 'generating' || step === 'done') {
      setIsExpanded(false);
    } else if (step === 'upload' || step === 'preview') {
      setIsExpanded(true);
    }
  }, [step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (isLocked) return;
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleSliderMove = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    // Debounce handled by parent or simple set here if parent handles it
    setInputs(prev => ({ ...prev, matchStrength: parseInt(e.target.value) }));
  };

  // Helper to render Primary Action Button based on step
  const renderPrimaryAction = () => {
    if (step === 'upload') {
        return (
            <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                disabled={!productImage || isLocked}
                className="w-full py-4 bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-[15px] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5 active:scale-95"
            >
                <Sparkles size={18} className="text-blue-600 fill-blue-500" />
                Analyze & Plan
            </button>
        );
    }
    if (step === 'preview') {
        return (
            <button 
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                disabled={isLocked}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[15px] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95"
            >
                Generate Final Image <ArrowRight size={18} />
            </button>
        );
    }
    return null;
  };

  if (step === 'done') return null; // Hide completely when done

  return (
    <div 
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isExpanded ? 'h-[85vh] lg:h-[70vh]' : 'h-[100px]'}
        `}
    >
        {/* Glass Container */}
        <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden">
            
            {/* Handle / Header - Always visible */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex-shrink-0 h-14 w-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors relative"
            >
                <div className="w-12 h-1.5 bg-gray-700 rounded-full absolute top-4"></div>
                <div className="absolute right-6 top-4 text-xs font-medium text-gray-500 flex items-center gap-1">
                    {isExpanded ? 'Collapse' : 'Expand Controls'}
                    {isExpanded ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className={`flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
                    
                    {/* Column 1: Assets & Core Config */}
                    <div className="space-y-6">
                        <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Box size={14} className="text-blue-500" /> Source Assets
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <ImageUpload 
                                    label="Product" 
                                    image={productImage} 
                                    onImageChange={setProductImage}
                                    required
                                    disabled={isLocked}
                                />
                                <ImageUpload 
                                    label="Reference" 
                                    image={refImage} 
                                    onImageChange={setRefImage}
                                    disabled={isLocked}
                                />
                            </div>
                        </div>

                        <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Settings2 size={14} className="text-purple-500" /> Configuration
                            </h2>
                            
                            {/* Sliders & Toggles */}
                            <div className="space-y-5">
                                {/* Aspect Ratio */}
                                <div>
                                    <label className="text-[10px] font-medium text-gray-500 mb-2 block ml-1 uppercase">Aspect Ratio</label>
                                    <div className="bg-black/40 p-1 rounded-xl flex border border-white/5">
                                        {['1:1', '4:5', '9:16', '16:9'].map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setInputs(prev => ({...prev, ratio: r as any}))}
                                                disabled={isLocked}
                                                className={`flex-1 py-2 text-[11px] font-medium rounded-lg transition-all ${
                                                    inputs.ratio === r 
                                                    ? 'bg-gray-700 text-white shadow-md' 
                                                    : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Match Strength */}
                                <div>
                                    <div className="flex justify-between mb-2 ml-1">
                                        <label className="text-[10px] font-medium text-gray-500 uppercase">Style Fidelity</label>
                                        <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{inputs.matchStrength}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={inputs.matchStrength} 
                                        onChange={handleSliderMove}
                                        disabled={isLocked}
                                        className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                {/* Quantity */}
                                <div>
                                    <label className="text-[10px] font-medium text-gray-500 mb-2 block ml-1 uppercase">Variations</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4].map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => setInputs(prev => ({...prev, quantity: q}))}
                                                disabled={isLocked}
                                                className={`flex-1 py-2 text-xs font-bold rounded-xl border border-white/5 transition-all ${
                                                    inputs.quantity === q
                                                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                                                    : 'bg-black/40 text-gray-600 hover:bg-white/5'
                                                }`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Text & Advanced */}
                    <div className="space-y-6">
                        <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Type size={14} className="text-blue-500" /> Copy & Context
                                </h2>
                                <div className="flex bg-black/40 rounded-lg p-0.5">
                                    {(['auto', 'on', 'off'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setInputs(prev => ({ ...prev, textMode: mode }))}
                                            className={`px-3 py-1 text-[10px] font-medium rounded-md capitalize transition-all ${
                                                inputs.textMode === mode ? 'bg-gray-700 text-white' : 'text-gray-500'
                                            }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={`space-y-3 transition-opacity ${inputs.textMode === 'off' ? 'opacity-30 pointer-events-none' : ''}`}>
                                <input 
                                    name="brandName" value={inputs.brandName} onChange={handleInputChange} 
                                    placeholder="Brand Name" 
                                    className="w-full bg-black/40 text-white placeholder-gray-600 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-all"
                                />
                                <input 
                                    name="headline" value={inputs.headline} onChange={handleInputChange} 
                                    placeholder="Headline" 
                                    className="w-full bg-black/40 text-white placeholder-gray-600 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-all"
                                />
                                <div className="flex gap-2">
                                    <input 
                                        name="price" value={inputs.price} onChange={handleInputChange} 
                                        placeholder="Price" 
                                        className="w-1/3 bg-black/40 text-white placeholder-gray-600 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-all"
                                    />
                                    <input 
                                        name="cta" value={inputs.cta} onChange={handleInputChange} 
                                        placeholder="CTA Button" 
                                        className="w-2/3 bg-black/40 text-white placeholder-gray-600 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <label className="text-[10px] font-medium text-gray-500 mb-2 block ml-1 uppercase">Art Director Notes</label>
                                <textarea 
                                    name="customPrompt" value={inputs.customPrompt} onChange={handleInputChange} 
                                    placeholder="Add custom creative direction..." 
                                    className="w-full h-20 bg-black/40 text-white placeholder-gray-600 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-blue-500/50 outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Advanced JSON View */}
                        {(blueprint || styleProfile) && (
                            <div className="border border-white/10 rounded-3xl overflow-hidden bg-black/20">
                                <button 
                                    onClick={() => setShowJson(!showJson)}
                                    className="w-full px-5 py-4 flex items-center justify-between text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <span className="flex items-center gap-2"><Code size={14} /> Advanced: Blueprint Logic</span>
                                    {showJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {showJson && (
                                    <div className="px-5 pb-5 grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-auto max-h-48 scrollbar-hide">
                                            <div className="text-[10px] text-blue-400 font-bold mb-2">STYLE DNA</div>
                                            <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">
                                                {JSON.stringify(styleProfile, null, 2)}
                                            </pre>
                                        </div>
                                        <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-auto max-h-48 scrollbar-hide">
                                            <div className="text-[10px] text-blue-400 font-bold mb-2">LAYOUT BLUEPRINT</div>
                                            <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">
                                                {JSON.stringify(blueprint, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-[#0a0a0a] to-transparent z-50">
                <div className="max-w-md mx-auto">
                    {renderPrimaryAction()}
                </div>
            </div>

        </div>
    </div>
  );
};

export default BottomSheetControls;
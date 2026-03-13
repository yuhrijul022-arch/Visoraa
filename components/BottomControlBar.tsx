import React, { useRef } from 'react';
import { ArrowRight, Sparkles, Settings2, ImagePlus, Upload, Zap } from 'lucide-react';
import { DesignInputs, FileData } from '../types';

interface BottomControlBarProps {
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
    isInfiniteEnabled: boolean;
    onOpenSettings: () => void;
}

// Compact hidden upload helper
const CompactUploadBtn: React.FC<{
    label: string;
    image: FileData | null;
    onChange: (d: FileData | null) => void;
    disabled: boolean;
    required?: boolean;
}> = ({ label, image, onChange, disabled, required }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                onChange({
                    file,
                    previewUrl: URL.createObjectURL(file),
                    base64,
                    mimeType: file.type,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="relative group flex-shrink-0">
            <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={handleFile} disabled={disabled} />
            <button
                onClick={() => !disabled && inputRef.current?.click()}
                className={`
                    h-12 w-12 rounded-xl flex items-center justify-center transition-all border
                    ${image ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${!image && required ? 'ring-1 ring-blue-500/30' : ''}
                `}
                title={label}
            >
                {image ? (
                    <img src={image.previewUrl} className="w-full h-full object-cover rounded-xl" alt="preview" />
                ) : (
                    <ImagePlus size={18} className="text-gray-400" />
                )}
            </button>
            {!image && required && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>}
        </div>
    );
};

const BottomControlBar: React.FC<BottomControlBarProps> = ({
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
    isInfiniteEnabled,
    onOpenSettings
}) => {

    const renderCTA = () => {
        // Common responsive classes: full width on mobile, auto on desktop
        const btnBase = "h-12 w-full md:w-auto px-6 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg";

        if (step === 'upload') {
            return (
                <button
                    onClick={onAnalyze}
                    disabled={!productImage || isLocked}
                    className={`${btnBase} bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-black shadow-white/5`}
                >
                    <Sparkles size={16} className="text-blue-600 fill-blue-500" /> Analyze & Plan
                </button>
            )
        }
        if (step === 'analyzing') {
            return (
                <button disabled className={`${btnBase} bg-white/10 text-gray-400 cursor-wait`}>
                    Analyzing...
                </button>
            )
        }
        if (step === 'preview') {
            return (
                <button
                    onClick={onGenerate}
                    className={`${btnBase} bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20`}
                >
                    Generate Variations <ArrowRight size={16} />
                </button>
            )
        }
        if (step === 'generating') {
            return (
                <button disabled className={`${btnBase} bg-white/10 text-gray-400 cursor-wait`}>
                    Rendering...
                </button>
            )
        }
        // Done state
        return (
            <button
                onClick={onGenerate}
                className={`${btnBase} bg-[#2C2C2E] hover:bg-[#3a3a3c] text-white`}
            >
                <Sparkles size={16} /> Reroll
            </button>
        )
    };

    return (
        <div className="flex-shrink-0 z-50 p-4 md:p-6 pointer-events-none w-full pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent">
            <div className="max-w-4xl mx-auto bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 md:p-3 flex flex-col md:flex-row md:items-end gap-4 md:gap-3 pointer-events-auto">
                {/* Row 1: Uploads (Mobile) / Left (Desktop) */}
                <div className="flex items-center gap-3 md:gap-2 md:pr-3 md:border-r md:border-white/5 w-full md:w-auto border-b border-white/5 md:border-b-0 pb-4 md:pb-0">
                    <CompactUploadBtn label="Product (Required)" image={productImage} onChange={setProductImage} disabled={isLocked} required />
                    <CompactUploadBtn label="Reference Style" image={refImage} onChange={setRefImage} disabled={isLocked} />
                    <span className="md:hidden text-xs text-gray-500 ml-auto font-medium">Assets</span>
                </div>

                {/* Row 2: Input (Mobile) / Middle (Desktop) */}
                <div className="flex-1 w-full md:w-auto relative group">
                    <textarea
                        name="customPrompt"
                        value={inputs.customPrompt}
                        onChange={(e) => {
                            setInputs(prev => ({ ...prev, customPrompt: e.target.value }));
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                        }}
                        placeholder="Describe the desired outcome or add creative notes..."
                        disabled={isLocked}
                        rows={1}
                        className="w-full bg-white/5 md:bg-white/5 text-white placeholder-gray-500 text-sm px-4 py-3.5 outline-none rounded-2xl resize-none min-h-[48px] border border-white/10 hover:border-white/20 focus:border-blue-500/50 transition-all leading-relaxed scrollbar-hide"
                        style={{ overflowY: inputs.customPrompt.length > 100 ? 'auto' : 'hidden' }}
                    />
                    {/* Mode Selector in Settings */}
                    <div className="mt-3">
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
                            {isInfiniteEnabled && (
                                <button onClick={() => setInputs(prev => ({ ...prev, mode: 'infinite' }))}
                                    className={`flex-[1.2] py-2 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${inputs.mode === 'infinite' ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}>
                                    <Sparkles size={10} className="text-orange-400" /> Infinite
                                </button>
                            )}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">
                            {inputs.mode === 'infinite' ? 'Free generation for PRO users' : (inputs.mode === 'pro' ? '2 credits per image • Higher quality' : '1 credit per image • Fast generation')}
                        </div>
                    </div>
                </div>

                {/* Row 3: Actions (Mobile) / Right (Desktop) */}
                <div className="flex items-center gap-3 md:gap-2 md:pl-3 md:border-l md:border-white/5 w-full md:w-auto justify-between md:justify-start">
                    <button
                        onClick={onOpenSettings}
                        disabled={isLocked}
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5 md:border-none bg-white/5 md:bg-transparent flex-shrink-0"
                        title="Settings"
                    >
                        <Settings2 size={20} />
                    </button>
                    <div className="flex-1 md:flex-none">
                        {renderCTA()}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default BottomControlBar;
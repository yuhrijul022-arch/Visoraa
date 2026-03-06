import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, ZoomIn, X } from 'lucide-react';
import { LayoutBlueprint, StyleProfile } from '../types';

interface ResultDisplayProps {
  imageUrls: string[];
  blueprint: LayoutBlueprint | null;
  styleProfile: StyleProfile | null;
  onReset: () => void;
  onDownload: () => void;
}

const Lightbox: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            // Restore body scroll
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
                aria-label="Close preview"
            >
                <X size={24} />
            </button>
            <img 
                src={src} 
                alt="Full size preview" 
                className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
};

const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  imageUrls, 
  onReset 
}) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  
  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `visora-variant-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="w-full animate-fade-in">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Generated Gallery</h2>
            <div className="flex gap-2">
                 <button 
                    onClick={() => {
                        imageUrls.forEach((url, i) => handleDownload(url, i));
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium rounded-full transition-all flex items-center gap-2"
                >
                    <Download size={14} /> Download All
                </button>
            </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {imageUrls.map((img, idx) => (
                <div key={idx} className="group relative aspect-square bg-[#111] rounded-2xl overflow-hidden border border-white/10 shadow-2xl hover:border-blue-500/50 transition-all duration-300">
                    <img 
                        src={img} 
                        alt={`Result ${idx + 1}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                         <button 
                            onClick={() => setLightboxSrc(img)}
                            className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 hover:scale-110 transition-all"
                        >
                            <ZoomIn size={20} />
                        </button>
                        <button 
                            onClick={() => handleDownload(img, idx)}
                            className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-full hover:bg-gray-200 transition-all flex items-center gap-2"
                        >
                            <Download size={12} /> Save Image
                        </button>
                    </div>

                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md border border-white/5">
                        <span className="text-[10px] font-mono text-gray-300">V{idx + 1}</span>
                    </div>
                </div>
            ))}
            
            {/* New Iteration Card */}
            <button 
                onClick={onReset}
                className="aspect-square rounded-2xl border border-white/5 border-dashed bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all flex flex-col items-center justify-center group"
            >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <RefreshCw size={20} className="text-gray-400 group-hover:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-white">Start New Project</span>
            </button>
        </div>

        {/* Lightbox Modal */}
        {lightboxSrc && (
            <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        )}
    </div>
  );
};

export default ResultDisplay;
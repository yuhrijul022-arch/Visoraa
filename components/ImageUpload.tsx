import React, { useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { FileData } from '../types';

interface ImageUploadProps {
  label: string;
  image: FileData | null;
  onImageChange: (data: FileData | null) => void;
  required?: boolean;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ label, image, onImageChange, required, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (disabled) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      onImageChange({
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }, [onImageChange, disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onImageChange(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`w-full group ${disabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
      <div className="flex justify-between items-end mb-2 ml-1">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            {label}
        </label>
        {required && <span className="text-[10px] text-blue-500/80 bg-blue-500/10 px-1.5 py-0.5 rounded">Required</span>}
      </div>
      
      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        className={`
          relative h-44 w-full rounded-2xl transition-all duration-300 overflow-hidden
          ${image ? 'bg-black' : 'bg-[#2C2C2E]'}
          ${!disabled && !image ? 'hover:bg-[#3a3a3c] cursor-pointer' : ''}
          ${disabled ? 'cursor-not-allowed' : ''}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleChange}
          disabled={disabled}
        />

        {image ? (
          <div className="relative w-full h-full">
            <img
              src={image.previewUrl}
              alt="Preview"
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
            <button
              onClick={removeImage}
              disabled={disabled}
              className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/80 hover:scale-110 disabled:pointer-events-none"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-gray-300 font-medium opacity-0 group-hover:opacity-100 transition-all">
                Change Asset
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <ImageIcon className="text-gray-500 group-hover:text-white transition-colors" size={20} />
            </div>
            <p className="text-sm text-gray-300 font-medium">Drop image here</p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
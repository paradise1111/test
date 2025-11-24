import React, { useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onError, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    if (file.size > MAX_SIZE_BYTES) {
      onError(`文件过大：当前限制为 ${MAX_SIZE_MB}MB，请拆分文件后上传。`);
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer py-24 text-center transition-all duration-300
        border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50
        ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white'}
      `}
    >
      <input type="file" ref={inputRef} accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && validateAndSelect(e.target.files[0])} disabled={disabled} />
      
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className={`
          text-5xl transition-transform duration-300 group-hover:-translate-y-2
          ${disabled ? 'text-gray-300' : 'text-black'}
        `}>
           <i className="fa-solid fa-cloud-arrow-up"></i>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-2xl font-bold font-serif text-black tracking-tight group-hover:underline decoration-2 underline-offset-4">
            点击或拖拽上传原稿 PDF
          </h3>
          <div className="flex items-center justify-center gap-4 text-xs font-sans font-bold text-gray-400 uppercase tracking-widest">
             <span>Max Size: {MAX_SIZE_MB}MB</span>
             <span>•</span>
             <span>Format: PDF</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

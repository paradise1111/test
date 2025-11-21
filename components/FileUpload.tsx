import React, { useRef } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onError, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

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
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      validateAndSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-all duration-200 select-none active:scale-[0.98] touch-manipulation ${
        disabled 
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' 
          : 'border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 cursor-pointer'
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={inputRef}
        accept="application/pdf"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className={`p-4 rounded-full ${disabled ? 'bg-gray-200' : 'bg-white shadow-sm'}`}>
           {disabled ? <FileText className="w-8 h-8 text-gray-400" /> : <Upload className="w-8 h-8 text-blue-600" />}
        </div>
        <div className="space-y-1">
          <h3 className={`text-lg font-semibold ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
            点击上传 PDF 稿件
          </h3>
          <p className="text-sm text-gray-500">
             支持最大 {MAX_SIZE_MB}MB
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
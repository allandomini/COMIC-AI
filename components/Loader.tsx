import React from 'react';

interface LoaderProps {
  message: string;
  onCancel?: () => void;
}

const Loader: React.FC<LoaderProps> = ({ message, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
      <div className="w-20 h-20 border-8 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-6 text-2xl text-gray-200 font-semibold tracking-wide">{message}</p>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-8 font-bangers text-2xl tracking-wider bg-red-600 hover:bg-red-700 text-white py-2 px-8 rounded-lg transition-colors"
        >
          Stop Generation
        </button>
      )}
    </div>
  );
};

export default Loader;
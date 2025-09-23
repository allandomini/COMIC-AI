import React from 'react';
import type { ApiKeyStatus } from '../services/geminiService';

interface ApiStatusModalProps {
  statuses: ApiKeyStatus[];
  onClose: () => void;
}

const ApiStatusModal: React.FC<ApiStatusModalProps> = ({ statuses, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg border border-slate-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="font-bangers text-3xl text-yellow-400 p-4 border-b border-slate-700">API Key Status</h3>
        <div className="p-6 overflow-y-auto space-y-3 max-h-[60vh]">
          {statuses.length > 0 ? statuses.map(s => (
            <div key={s.keyIdentifier} className="flex justify-between items-center bg-slate-900 p-3 rounded-md">
              <span className="font-bold text-gray-300">{s.keyIdentifier}</span>
              <div className="flex items-center gap-2 text-right">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  s.status === 'ok' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
                }`}>
                  {s.status === 'ok' ? 'Active' : 'Error'}
                </span>
                <span className="text-slate-400 text-sm">{s.message}</span>
              </div>
            </div>
          )) : (
            <p className="text-slate-400 text-center">No API Keys found to test.</p>
          )}
        </div>
        <div className="p-4 border-t border-slate-700 mt-auto flex justify-end">
          <button onClick={onClose} className="font-bangers text-xl bg-slate-600 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiStatusModal;

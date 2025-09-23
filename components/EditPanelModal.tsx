import React, { useState } from 'react';
import type { StoryPage } from '../types';
import MagicIcon from './icons/MagicIcon';

interface EditPanelModalProps {
  page: StoryPage;
  onClose: () => void;
  onSave: (prompt: string) => void;
}

const EditPanelModal: React.FC<EditPanelModalProps> = ({ page, onClose, onSave }) => {
  const [prompt, setPrompt] = useState('');

  const handleSave = () => {
    if (!prompt.trim()) {
      alert("Please enter an edit instruction.");
      return;
    }
    onSave(prompt);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl border border-slate-700 m-4" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="font-bangers text-3xl text-yellow-400 mb-4 text-center">Edit Panel {page.page}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="w-full aspect-square bg-slate-900 rounded-md flex items-center justify-center">
              {page.image && <img src={page.image} alt={`Current panel ${page.page}`} className="w-full h-full object-contain rounded-md" />}
            </div>
            
            <div className="flex flex-col gap-4">
              <p className="text-slate-300">Describe the changes you want to make. Be specific!</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a hat to the main character, make the sky red, change the camera angle to a low-angle shot..."
                className="w-full h-48 p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-y text-base placeholder-slate-500"
              />
              <div className="text-sm text-slate-400">
                <strong>Original Description:</strong> {page.description}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900/50 p-4 flex justify-end items-center gap-4 rounded-b-lg border-t border-slate-700">
          <button 
            onClick={onClose} 
            className="font-bangers text-xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="font-bangers text-2xl tracking-wider flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50"
            disabled={!prompt.trim()}
          >
            Apply Edit <MagicIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPanelModal;
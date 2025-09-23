import React from 'react';
import SparklesIcon from './icons/SparklesIcon';

interface StoryInputProps {
  storyText: string;
  setStoryText: (text: string) => void;
  onNext: () => void;
}

const StoryInput: React.FC<StoryInputProps> = ({ storyText, setStoryText, onNext }) => {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center animate-fade-in space-y-8">
      <div className="w-full bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-lg shadow-2xl">
        <textarea
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
          placeholder="In a neon-lit city, Super Llama faced off against the villainous Dr. Alpaca..."
          className="w-full h-64 p-4 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-y text-lg placeholder-slate-500"
        />
      </div>
      <div className="flex justify-center mt-4">
        <button 
          onClick={onNext} 
          disabled={!storyText.trim()}
          className="font-bangers text-3xl tracking-wider flex items-center gap-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-10 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-yellow-500/20"
        >
          Analyze Story <SparklesIcon className="w-8 h-8"/>
        </button>
      </div>
    </div>
  );
};

export default StoryInput;
import React from 'react';
import type { Character } from '../types';
import DownloadIcon from './icons/DownloadIcon';
import SparklesIcon from './icons/SparklesIcon';

interface CharacterSheetDisplayProps {
  characters: Character[];
  onNext: () => void;
  onBack: () => void;
  inkingStyle: string;
  setInkingStyle: (style: string) => void;
  coloringStyle: string;
  setColoringStyle: (style: string) => void;
}

const CharacterSheetDisplay: React.FC<CharacterSheetDisplayProps> = ({ 
  characters, 
  onNext, 
  onBack, 
  inkingStyle,
  setInkingStyle,
  coloringStyle,
  setColoringStyle 
}) => {

  const handleDownload = (image: string, name: string) => {
    const link = document.createElement('a');
    link.href = image;
    link.download = `${name.replace(/\s+/g, '_').toLowerCase()}_character_sheet.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {characters.map(char => (
          <div key={char.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col border border-slate-700 transform hover:-translate-y-1 transition-transform duration-300">
            <div className="w-full h-80 bg-slate-900 flex items-center justify-center p-2">
              {char.image ? (
                <img src={char.image} alt={char.name} className="w-full h-full object-contain rounded"/>
              ) : (
                <div className="text-slate-400">No image provided</div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
              <h3 className="font-bangers text-2xl text-yellow-400">{char.name}</h3>
              <p className="text-gray-300 flex-grow text-sm">{char.description}</p>
              {char.image && (
                 <button onClick={() => handleDownload(char.image!, char.name)} className="mt-4 flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <DownloadIcon className="w-5 h-5" /> Download Sheet
                 </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="my-16 bg-slate-800 border border-slate-700 rounded-lg p-6 sm:p-8 shadow-2xl">
        <h2 className="font-bangers text-4xl text-center text-yellow-400 mb-2">Define Your Comic's Art Style</h2>
        <p className="text-center text-slate-300 mb-8">This will guide the look and feel of every panel.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col">
            <label className="block text-xl font-bold text-gray-300 mb-2 text-center font-bangers tracking-wider" htmlFor="inking-style">Inking Style</label>
            <p className="text-center text-slate-400 mb-3 text-sm">e.g., "Clean, sharp digital lines", "Heavy, moody brushstrokes", "Scratchy cross-hatching"</p>
            <input
              id="inking-style"
              type="text"
              value={inkingStyle}
              onChange={(e) => setInkingStyle(e.target.value)}
              placeholder="Describe the line art..."
              className="w-full p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none text-center"
            />
          </div>
          <div className="flex flex-col">
            <label className="block text-xl font-bold text-gray-300 mb-2 text-center font-bangers tracking-wider" htmlFor="coloring-style">Coloring Style</label>
            <p className="text-center text-slate-400 mb-3 text-sm">e.g., "Vibrant cel-shading", "Muted watercolor palette", "Flat vintage pulp colors"</p>
            <input
              id="coloring-style"
              type="text"
              value={coloringStyle}
              onChange={(e) => setColoringStyle(e.target.value)}
              placeholder="Describe the color and shading..."
              className="w-full p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none text-center"
            />
          </div>
        </div>
      </div>

       <div className="flex justify-center items-center gap-4 mt-10">
          <button onClick={onBack} className="font-bangers text-2xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-3 px-8 rounded-lg transition-colors">
            Back
          </button>
          <button onClick={onNext} className="font-bangers text-3xl tracking-wider flex items-center gap-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-10 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-yellow-500/20">
            Select Chapter <SparklesIcon className="w-8 h-8"/>
          </button>
      </div>
    </div>
  );
};

export default CharacterSheetDisplay;

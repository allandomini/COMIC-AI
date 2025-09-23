import React, { useState } from 'react';
import type { Character } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../database';
import { generateImageForPrompt, generateCharacterSheetFromImage } from '../services/geminiService';
import UploadIcon from './icons/UploadIcon';
import MagicIcon from './icons/MagicIcon';
import TrashIcon from './icons/TrashIcon';

// Helper to read file as Base64
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });


const CharacterLibrary: React.FC<{
  library: Character[],
  setLibrary: React.Dispatch<React.SetStateAction<Character[]>>,
  onBack: () => void
}> = ({ library, setLibrary, onBack }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChar, setNewChar] = useState<Partial<Character>>({ name: '', description: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSaveNewCharacter = async () => {
    if (!newChar.name || !newChar.description || !newChar.image) {
      alert("Please provide a name, description, and an initial image.");
      return;
    }
    
    setIsGenerating(true);
    try {
        const characterWithId: Character = {
            id: uuidv4(),
            name: newChar.name,
            description: newChar.description,
            image: newChar.image,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        
        // Generate the final character sheet
        const sheetImage = await generateCharacterSheetFromImage(characterWithId);
        const finalCharacter = { ...characterWithId, image: sheetImage };

        await db.saveCharacterToLibrary(finalCharacter);
        setLibrary(prev => [...prev, finalCharacter]);
        setShowAddModal(false);
        setNewChar({ name: '', description: '' });
    } catch (error) {
        console.error("Failed to save new character", error);
        alert("Could not save the character. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this character from your library permanently?")) {
      await db.deleteCharacterFromLibrary(id);
      setLibrary(prev => prev.filter(c => c.id !== id));
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const base64 = await toBase64(file);
      setNewChar(prev => ({ ...prev, image: base64 }));
    }
  };
  
  const handleGenerateInitialImage = async () => {
    if (!newChar.name || !newChar.description) {
      alert("Please enter a name and description first.");
      return;
    }
    setIsGenerating(true);
    try {
        const artStyle = 'Digital comic art style, vibrant colors, clean lines';
        const imageData = await generateImageForPrompt(newChar.description, 'Character', artStyle, newChar.name);
        setNewChar(prev => ({ ...prev, image: imageData }));
    } catch (error) {
        console.error("Failed to generate initial image", error);
        alert("Could not generate initial character image.");
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h2 className="font-bangers text-4xl text-yellow-400">Character Library</h2>
        <button onClick={() => setShowAddModal(true)} className="font-bangers text-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105">
          + Add New Character
        </button>
      </div>
      
      {library.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {library.map(char => (
            <div key={char.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col border border-slate-700 group">
              <div className="w-full h-64 bg-slate-900 flex items-center justify-center p-2 relative">
                {char.image && <img src={char.image} alt={char.name} className="w-full h-full object-contain rounded"/>}
                <button 
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-all transform hover:scale-110 opacity-0 group-hover:opacity-100 shadow-lg"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bangers text-2xl text-yellow-400">{char.name}</h3>
                <p className="text-gray-300 flex-grow text-sm line-clamp-3">{char.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
            <p className="text-slate-400 text-2xl">Your Character Library is empty.</p>
            <p className="text-slate-500 mt-2">Click "Add New Character" to start building your cast!</p>
        </div>
      )}

      <div className="flex justify-center mt-10">
        <button onClick={onBack} className="font-bangers text-2xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-3 px-8 rounded-lg transition-colors">
          Back to Dashboard
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl border border-slate-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="font-bangers text-3xl text-yellow-400 p-4 border-b border-slate-700">Add New Character</h3>
            <div className="p-6 space-y-4 overflow-y-auto">
              <input type="text" placeholder="Character Name" value={newChar.name} onChange={e => setNewChar(p => ({...p, name: e.target.value}))} className="w-full p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none" />
              <textarea placeholder="Character Description" value={newChar.description} onChange={e => setNewChar(p => ({...p, description: e.target.value}))} className="w-full h-24 p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-y" />
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-center text-slate-300 mb-4 font-bold">Provide an initial image for the character sheet</p>
                <div className="relative w-full h-48 bg-slate-900 rounded-md flex items-center justify-center border-2 border-dashed border-slate-700">
                    {newChar.image && !isGenerating && <img src={newChar.image} className="w-full h-full object-contain rounded-md" />}
                    {isGenerating && <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                <div className="flex gap-4 mt-4">
                    <label htmlFor="char-upload" className="w-full text-center cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <UploadIcon className="w-5 h-5" /> Upload Image
                    </label>
                    <input id="char-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
                    <button onClick={handleGenerateInitialImage} disabled={isGenerating} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-slate-500">
                        <MagicIcon className="w-5 h-5" /> Generate Image
                    </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 mt-auto flex justify-end gap-4">
              <button onClick={() => setShowAddModal(false)} className="font-bangers text-xl bg-slate-600 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSaveNewCharacter} disabled={!newChar.image || isGenerating} className="font-bangers text-2xl bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-2 px-6 rounded-lg transition-colors disabled:bg-slate-500 disabled:cursor-wait">
                {isGenerating ? "Generating Sheet..." : "Save to Library"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterLibrary;
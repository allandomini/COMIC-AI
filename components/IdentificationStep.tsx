import React, { useState } from 'react';
import type { Character, Scenery, Project } from '../types';
import { generateImageForPrompt } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import TrashIcon from './icons/TrashIcon';
import UploadIcon from './icons/UploadIcon';
import MagicIcon from './icons/MagicIcon';

// Helper to read file as Base64
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

interface EntityCardProps<T extends { id: string; description: string; name?: string; image: string | null; }> {
  entity: T;
  entityType: 'Character' | 'Scenery';
  onImageReady: (id: string, base64Image: string) => void;
  onImageRemove: (id: string) => void;
  artStyle: string;
  onImport?: (id: string) => void; // Optional for scenery
}

function EntityCard<T extends { id: string; description: string; name?: string; image: string | null; }>({ entity, entityType, onImageReady, onImageRemove, artStyle, onImport }: EntityCardProps<T>) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const base64 = await toBase64(file);
      onImageReady(entity.id, base64);
    }
  };
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const imageData = await generateImageForPrompt(entity.description, entityType, artStyle, entity.name);
      onImageReady(entity.id, imageData);
    } catch (error) {
      console.error(`Failed to generate image for ${entity.id}`, error);
      alert(`Could not generate image for ${entity.name || 'scenery'}.`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const fileInputId = `file-input-${entity.id}`;

  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 border border-slate-700">
      <div className="relative w-full md:w-48 h-48 bg-slate-900 rounded-md flex items-center justify-center flex-shrink-0 border-2 border-dashed border-slate-700">
        {entity.image ? (
          <>
            <img src={entity.image} alt={entity.name || 'Scenery'} className="w-full h-full object-cover rounded-md" />
             <button
                onClick={() => onImageRemove(entity.id)}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-transform transform hover:scale-110 shadow-lg"
                aria-label="Remove image"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
          </>
        ) : isGenerating ? (
            <div className="flex flex-col items-center gap-2">
                 <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-xs text-slate-400">Generating...</span>
            </div>
        ) : (
          <div className="text-slate-500 text-center p-2">Awaiting Image</div>
        )}
      </div>
      <div className="flex flex-col flex-grow">
        <h3 className="font-bangers text-2xl text-yellow-400">{entity.name || 'Scenery'}</h3>
        <p className="text-gray-300 flex-grow text-sm mb-3">{entity.description}</p>
        {!entity.image && !isGenerating && (
          <div className="flex flex-col sm:flex-row gap-2 mt-auto">
            <label htmlFor={fileInputId} className="w-full text-center cursor-pointer bg-cyan-800 hover:bg-cyan-900 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <UploadIcon className="w-4 h-4" /> Upload
            </label>
            <input id={fileInputId} type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} />
            {entityType === 'Character' && onImport && (
                <button onClick={() => onImport(entity.id)} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                    Import
                </button>
            )}
            <button onClick={handleGenerate} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <MagicIcon className="w-4 h-4" /> Generate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


interface IdentificationStepProps {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  onNext: () => void;
  onBack: () => void;
  characterLibrary: Character[];
}

const IdentificationStep: React.FC<IdentificationStepProps> = ({ project, updateProject, onNext, onBack, characterLibrary }) => {
  const [artStyle, setArtStyle] = useState('Digital comic art style, vibrant colors, clean lines');
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [importingCharacterId, setImportingCharacterId] = useState<string | null>(null);

  const handleCharacterImage = (id: string, base64Image: string) => {
    updateProject({ characters: project.characters.map(c => c.id === id ? { ...c, image: base64Image } : c) });
  };
  
  const handleSceneryImage = (id: string, base64Image: string) => {
    updateProject({ scenery: project.scenery.map(s => s.id === id ? { ...s, image: base64Image } : s) });
  };

  const handleCharacterImageRemove = (id: string) => {
    updateProject({ characters: project.characters.map(c => c.id === id ? { ...c, image: null } : c) });
  };
  
  const handleSceneryImageRemove = (id: string) => {
    updateProject({ scenery: project.scenery.map(s => s.id === id ? { ...s, image: null } : s) });
  };

  const handleOpenImportModal = (characterId: string) => {
    setImportingCharacterId(characterId);
    setShowLibraryModal(true);
  };

  const handleCloseImportModal = () => {
    setImportingCharacterId(null);
    setShowLibraryModal(false);
  };

  const handleImportCharacter = (characterFromLibrary: Character) => {
    if (!importingCharacterId) return;

    const updatedCharacters = project.characters.map(projChar => {
        if (projChar.id === importingCharacterId) {
            // Replace with library data, but keep the project-specific ID
            return {
                ...projChar, 
                name: characterFromLibrary.name,
                description: characterFromLibrary.description,
                image: characterFromLibrary.image,
            };
        }
        return projChar;
    });

    updateProject({ characters: updatedCharacters });
    handleCloseImportModal();
  };

  const allImagesProvided = project.characters.every(c => c.image) && project.scenery.every(s => s.image);
  const nextButtonText = project.generateDetailedSheets ? "Generate Character Sheets" : "Proceed to Art Style";

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in bg-slate-800 border border-slate-700 p-6 sm:p-8 rounded-lg shadow-2xl">
      <div className="mb-8 bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 className="font-bangers text-3xl text-yellow-400 mb-2 text-center">Unified Art Style</h3>
        <p className="text-center text-slate-400 mb-4">
          Define a consistent art style for all generated characters and scenery to ensure they look like they belong in the same world.
        </p>
        <textarea
          value={artStyle}
          onChange={(e) => setArtStyle(e.target.value)}
          placeholder="e.g., Gritty noir with sharp shadows, watercolor fantasy, classic 90s anime..."
          className="w-full h-24 p-3 bg-slate-900 text-gray-200 rounded-md border-2 border-slate-700 focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-y text-lg placeholder-slate-500"
        />
      </div>

      {/* Characters Section */}
      {project.characters.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4 border-b-2 border-slate-700 pb-2">
            <h3 className="font-bangers text-3xl text-yellow-400">Characters</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             {project.characters.map(char => (
               <EntityCard 
                key={char.id} 
                entity={char} 
                entityType="Character" 
                onImageReady={handleCharacterImage} 
                onImageRemove={handleCharacterImageRemove}
                artStyle={artStyle}
                onImport={handleOpenImportModal}
                />
             ))}
          </div>
        </div>
      )}

      {/* Scenery Section */}
      {project.scenery.length > 0 && (
        <div className="mt-10">
           <h3 className="font-bangers text-3xl text-yellow-400 mb-4 border-b-2 border-slate-700 pb-2">Scenery</h3>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {project.scenery.map(scn => (
                <EntityCard 
                    key={scn.id} 
                    entity={scn} 
                    entityType="Scenery" 
                    onImageReady={handleSceneryImage} 
                    onImageRemove={handleSceneryImageRemove}
                    artStyle={artStyle}
                />
              ))}
           </div>
        </div>
      )}
      
      <div className="flex flex-col items-center justify-center gap-4 mt-8 pt-8 border-t border-slate-700">
          <label htmlFor="character-sheet-toggle" className="flex items-center cursor-pointer group">
              <span className="mr-4 text-lg font-medium text-gray-300 group-hover:text-yellow-400 transition-colors">Generate Detailed Character Sheets</span>
              <div className="relative">
                  <input 
                      type="checkbox" 
                      id="character-sheet-toggle" 
                      className="sr-only" 
                      checked={project.generateDetailedSheets}
                      onChange={() => updateProject({ generateDetailedSheets: !project.generateDetailedSheets })}
                  />
                  <div className="block bg-slate-600 w-14 h-8 rounded-full"></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${project.generateDetailedSheets ? 'translate-x-6 bg-yellow-400' : 'bg-slate-400'}`}></div>
              </div>
          </label>
          <p className="text-center text-sm text-slate-400 max-w-md">
              (Recommended) Generates front, side, and back views for consistency. Disable to use your uploaded/generated images directly.
          </p>
      </div>
      
      <div className="flex justify-center items-center gap-4 mt-6">
        <button onClick={onBack} className="font-bangers text-2xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-3 px-8 rounded-lg transition-colors">
            Back
        </button>
        <button onClick={onNext} disabled={!allImagesProvided} className="font-bangers text-3xl tracking-wider flex items-center gap-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-10 rounded-lg transition-transform transform hover:scale-105 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-yellow-500/20">
          {nextButtonText} <SparklesIcon className="w-8 h-8"/>
        </button>
      </div>

      {/* Character Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={handleCloseImportModal}>
          <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] border border-slate-700 m-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="font-bangers text-3xl text-yellow-400 p-4 border-b border-slate-700">Import Character from Library</h3>
            <div className="p-4 overflow-y-auto">
              {characterLibrary.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {characterLibrary.map(char => (
                    <div key={char.id} className="cursor-pointer group" onClick={() => handleImportCharacter(char)}>
                      <div className="aspect-square bg-slate-900 rounded-md overflow-hidden border-2 border-transparent group-hover:border-yellow-400 transition-all">
                        {char.image && <img src={char.image} alt={char.name} className="w-full h-full object-cover"/>}
                      </div>
                      <p className="font-bangers text-lg text-center mt-2 group-hover:text-yellow-400 transition-colors">{char.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">Your character library is empty. You can add characters from the main dashboard.</p>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 mt-auto flex justify-end">
                <button onClick={handleCloseImportModal} className="font-bangers text-xl bg-slate-600 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors">
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdentificationStep;


import React, { useState, useEffect, useRef } from 'react';
import type { Character, Scenery, StoryPage, Chapter, LetteringElement, Project } from './types';
import { analyzeFullStory, generateStory, generatePanelImage, generateCharacterSheetFromImage, editPanelImage, analyzePanelForLettering, testApiKeys, GeminiApiError } from './services/geminiService';
import type { ApiKeyStatus } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import * as db from './database';
import StoryInput from './components/StoryInput';
import ChapterSelection from './components/ChapterSelection';
import IdentificationStep from './components/IdentificationStep';
import CharacterSheetDisplay from './components/CharacterSheetDisplay';
import StoryDisplay from './components/StoryDisplay';
import Loader from './components/Loader';
import SparklesIcon from './components/icons/SparklesIcon';
import Stepper from './components/Stepper';
import ProjectDashboard from './components/ProjectDashboard';
import CharacterLibrary from './components/CharacterLibrary';
import ApiStatusModal from './components/ApiStatusModal';

type Stage = 'story-input' | 'identification' | 'character-sheets' | 'chapter-selection' | 'story-panels';
type View = 'dashboard' | 'project' | 'character-library';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [characterLibrary, setCharacterLibrary] = useState<Character[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isCancellable, setIsCancellable] = useState(false);
  const generationCancelledRef = useRef(false);

  const [isApiStatusModalOpen, setIsApiStatusModalOpen] = useState(false);
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatus[]>([]);


  // Load all data from DB on initial mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setLoadingMessage("Loading creative assets...");
      try {
        await db.initDB();
        const [allProjects, allCharacters] = await Promise.all([
          db.getAllProjects(),
          db.getAllCharactersFromLibrary()
        ]);
        setProjects(allProjects.sort((a, b) => b.updatedAt - a.updatedAt));
        setCharacterLibrary(allCharacters);
      } catch (error) {
        console.error("Failed to load data from database:", error);
        alert("Could not load your saved data. Please check the console for errors.");
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Centralized save function using functional updates to prevent stale state
  const updateCurrentProject = (updates: Partial<Project>) => {
    setCurrentProject(prevProject => {
      if (!prevProject) return null;

      const updatedProject = { ...prevProject, ...updates };
      const projectToSave = { ...updatedProject, updatedAt: Date.now() };

      // Fire-and-forget save operations
      db.saveProject(projectToSave);
      setProjects(prevProjects => {
        const otherProjects = prevProjects.filter(p => p.id !== projectToSave.id);
        return [...otherProjects, projectToSave].sort((a, b) => b.updatedAt - a.updatedAt);
      });

      return projectToSave;
    });
  };

  const handleCreateNewProject = () => {
    const newProject: Project = {
      id: uuidv4(),
      title: 'Untitled Comic',
      storyText: '',
      chapters: [],
      characters: [],
      scenery: [],
      storyPages: [],
      inkingStyle: 'Clean, sharp digital line art',
      coloringStyle: 'Vibrant, cel-shaded colors with minimal gradients',
      stage: 'story-input',
      generateDetailedSheets: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      generatedFromChapterTitle: undefined,
    };
    setCurrentProject(newProject);
    setView('project');
  };

  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (projectToLoad) {
      setCurrentProject(projectToLoad);
      setView('project');
    }
  };
  
  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this project?")) {
      await db.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };
  
  const handleTestApiKeys = async () => {
    setLoadingMessage("Testing API Keys...");
    setIsLoading(true);
    try {
        const statuses = await testApiKeys();
        setApiKeyStatuses(statuses);
        setIsApiStatusModalOpen(true);
    } catch (error) {
        console.error("Failed to run API key test:", error);
        alert("An error occurred while testing the API keys.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnalyzeStory = async () => {
    if (!currentProject || !currentProject.storyText.trim()) {
      alert("Please enter a story first.");
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Analyzing your full story...');
    try {
      const { chapters, characters, scenery } = await analyzeFullStory(currentProject.storyText);
      updateCurrentProject({
        chapters: chapters,
        characters: characters.map(c => ({...c, id: uuidv4(), image: null })),
        scenery: scenery.map(s => ({...s, id: uuidv4(), image: null })),
        stage: 'identification',
      });
    } catch (error) {
      console.error('Error analyzing story:', error);
      if (error instanceof GeminiApiError) {
        alert(`Analysis Failed: ${error.userFriendlyMessage}`);
      } else if (error instanceof Error) {
        alert(`An unexpected error occurred: ${error.message}`);
      } else {
        alert('An unknown error occurred during story analysis.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeCharacters = async () => {
    if (!currentProject || !currentProject.generateDetailedSheets) {
        updateCurrentProject({ stage: 'character-sheets' });
        return;
    }

    setIsLoading(true);
    setLoadingMessage('Generating detailed character sheets...');
    try {
      const sheetPromises = currentProject.characters.map(async (char) => {
        if (!char.image) return char;
        const newImage = await generateCharacterSheetFromImage(char);
        return { ...char, image: newImage };
      });

      const updatedCharacters = await Promise.all(sheetPromises);
      updateCurrentProject({ characters: updatedCharacters, stage: 'character-sheets' });
    } catch (error) {
      console.error('Error generating character sheets:', error);
      if (error instanceof GeminiApiError) {
        alert(`Character Sheet Generation Failed: ${error.userFriendlyMessage}`);
      } else if (error instanceof Error) {
        alert(`An unexpected error occurred: ${error.message}`);
      } else {
        alert('An unknown error occurred while generating character sheets.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChapter = (chapter: Chapter) => {
    if (!currentProject) return;
    // If this chapter is already the one that's generated, just switch views
    if (currentProject.storyPages.length > 0 && currentProject.generatedFromChapterTitle === chapter.title) {
        updateCurrentProject({ stage: 'story-panels' });
    } else {
        // Otherwise, generate the new chapter
        handleGenerateStory(chapter);
    }
  };
  
  const handleCancelGeneration = () => {
    generationCancelledRef.current = true;
    setLoadingMessage("Cancelling...");
  };

  const handleGenerateStory = async (chapter: Chapter) => {
    if (!currentProject) return;
    
    generationCancelledRef.current = false;
    setIsLoading(true);
    setIsCancellable(true);
    setLoadingMessage('Assembling your comic script...');
    
    try {
        const generatedPages = await generateStory(chapter.text);
        let pagesWithImages: StoryPage[] = generatedPages.map(p => ({
            ...p,
            isGenerating: true,
            lettering: null,
            generationFailed: false
        }));
        
        updateCurrentProject({ 
            storyPages: pagesWithImages, 
            stage: 'story-panels', 
            generatedFromChapterTitle: chapter.title 
        });
        
        setIsLoading(false); // Hide the main loader, panel-specific loaders will show
        
        // --- STEP 1: Sequential Image Generation (for consistency) ---
        const totalPanels = generatedPages.length;
        for (let i = 0; i < totalPanels; i++) {
            if (generationCancelledRef.current) {
                console.log("Panel generation cancelled by user.");
                pagesWithImages = pagesWithImages.map((p, idx) => (idx >= i ? { ...p, isGenerating: false, generationFailed: true, failureReason: "Generation was cancelled." } : p));
                updateCurrentProject({ storyPages: pagesWithImages });
                break;
            }
            
            try {
                const previousPanelImage = i > 0 ? pagesWithImages[i - 1].image : undefined;
                
                const panelImage = await generatePanelImage(
                    pagesWithImages[i].description,
                    currentProject.characters,
                    currentProject.scenery,
                    currentProject.inkingStyle,
                    currentProject.coloringStyle,
                    pagesWithImages[i].sfx,
                    currentProject.storyText,
                    pagesWithImages[i].layout,
                    previousPanelImage
                );
                
                pagesWithImages = pagesWithImages.map((p, idx) => idx === i ? { ...p, image: panelImage, isGenerating: false, isLettering: true } : p);
                updateCurrentProject({ storyPages: pagesWithImages });
            } catch(panelError) {
                console.error(`Error generating panel ${i + 1}:`, panelError);
                const reason = (panelError instanceof GeminiApiError) ? panelError.userFriendlyMessage : "An unknown error occurred.";
                pagesWithImages = pagesWithImages.map((p, idx) => idx === i ? { ...p, isGenerating: false, isLettering: false, generationFailed: true, failureReason: reason, image: null } : p);
                updateCurrentProject({ storyPages: pagesWithImages });
            }
        }

        if (generationCancelledRef.current) {
            setIsCancellable(false);
            generationCancelledRef.current = false;
            return;
        }

        // --- STEP 2: Parallel Lettering Analysis (for speed) ---
        const letteringPromises = pagesWithImages.map((page, i) => {
            if (page.image && !page.generationFailed) {
                return analyzePanelForLettering(page.image, page.dialogue, page.narration)
                    .then(letteringData => ({ index: i, lettering: letteringData, error: null }))
                    .catch(error => {
                        console.error(`Lettering analysis failed for panel ${i + 1}`, error);
                        return { index: i, lettering: null, error };
                    });
            }
            return Promise.resolve(null);
        });

        const letteringResults = await Promise.all(letteringPromises);

        let finalPages = [...pagesWithImages];
        letteringResults.forEach(result => {
            if (result) {
                finalPages[result.index] = {
                    ...finalPages[result.index],
                    lettering: result.lettering,
                    isLettering: false,
                };
            }
        });

        updateCurrentProject({ storyPages: finalPages });

    } catch (error) {
        console.error('Error during script generation:', error);
        const errorMessage = (error instanceof GeminiApiError) ? error.userFriendlyMessage : (error instanceof Error) ? error.message : "An unknown error occurred.";
        alert(`Story Script Generation Failed: ${errorMessage}`);
        setIsLoading(false);
    } finally {
        setIsCancellable(false);
        generationCancelledRef.current = false;
    }
  };
  
  const handleRegeneratePanel = async (pageIndex: number) => {
    if (!currentProject) return;
    const pageToRegen = currentProject.storyPages[pageIndex];
    if (!pageToRegen) return;
    
    let pagesInProgress = currentProject.storyPages.map((p, i) =>
        i === pageIndex
          ? { ...p, isGenerating: true, isLettering: false, image: null, lettering: null, generationFailed: false, failureReason: undefined }
          : p
      );
    updateCurrentProject({ storyPages: pagesInProgress });


    try {
        const previousPanelImage = pageIndex > 0 ? currentProject.storyPages[pageIndex - 1].image : undefined;
        const panelImage = await generatePanelImage(
            pageToRegen.description,
            currentProject.characters,
            currentProject.scenery,
            currentProject.inkingStyle,
            currentProject.coloringStyle,
            pageToRegen.sfx,
            currentProject.storyText,
            pageToRegen.layout,
            previousPanelImage
        );
        
        pagesInProgress = pagesInProgress.map((p, i) => i === pageIndex ? { ...p, image: panelImage, isGenerating: false, isLettering: true } : p);
        updateCurrentProject({ storyPages: pagesInProgress });
        
        const letteringData = await analyzePanelForLettering(panelImage, pageToRegen.dialogue, pageToRegen.narration);

        pagesInProgress = pagesInProgress.map((p, i) => i === pageIndex ? { ...p, lettering: letteringData, isLettering: false } : p);
        updateCurrentProject({ storyPages: pagesInProgress });

    } catch (error) {
        console.error(`Error regenerating panel ${pageIndex + 1}:`, error);
        const reason = (error instanceof GeminiApiError) ? error.userFriendlyMessage : "An unknown error occurred during regeneration.";
        pagesInProgress = currentProject.storyPages.map((p, i) =>
            i === pageIndex
              ? { ...p, isGenerating: false, isLettering: false, generationFailed: true, failureReason: reason }
              : p
          );
        updateCurrentProject({ storyPages: pagesInProgress });
    }
  };

  const handleEditPanel = async (pageIndex: number, editPrompt: string) => {
    if (!currentProject) return;
    const pageToEdit = currentProject.storyPages[pageIndex];
    if (!pageToEdit || !pageToEdit.image) return;

    let pagesInProgress = currentProject.storyPages.map((p, i) => i === pageIndex ? { ...p, isGenerating: true, lettering: null } : p);
    updateCurrentProject({ storyPages: pagesInProgress });

    try {
        const editedImage = await editPanelImage(pageToEdit.image, editPrompt);
        
        pagesInProgress = pagesInProgress.map((p, i) => i === pageIndex ? { ...p, image: editedImage, isGenerating: false, isLettering: true } : p);
        updateCurrentProject({ storyPages: pagesInProgress });

        const letteringData = await analyzePanelForLettering(editedImage, pageToEdit.dialogue, pageToEdit.narration);
        
        pagesInProgress = pagesInProgress.map((p, i) => i === pageIndex ? { ...p, lettering: letteringData, isLettering: false } : p);
        updateCurrentProject({ storyPages: pagesInProgress });

    } catch (error) {
        console.error(`Error editing panel ${pageIndex + 1}:`, error);
        if (error instanceof GeminiApiError) {
          alert(`Panel Edit Failed: ${error.userFriendlyMessage}`);
        } else if (error instanceof Error) {
          alert(`An unexpected error occurred: ${error.message}`);
        } else {
          alert(`An unknown error occurred while editing panel ${pageIndex + 1}.`);
        }
        
        pagesInProgress = pagesInProgress.map((p, i) => i === pageIndex ? { ...p, isGenerating: false, isLettering: false } : p)
        updateCurrentProject({ storyPages: pagesInProgress });
    }
  };

  const handleUpdateLetteringElement = (pageIndex: number, elementId: string, updates: Partial<LetteringElement>) => {
    if (!currentProject) return;
    const newPages = [...currentProject.storyPages];
    const page = newPages[pageIndex];
    if (page && page.lettering) {
        const elementIndex = page.lettering.findIndex(el => el.id === elementId);
        if (elementIndex > -1) {
            const newLettering = [...page.lettering];
            newLettering[elementIndex] = { ...newLettering[elementIndex], ...updates };
            newPages[pageIndex] = { ...page, lettering: newLettering };
            updateCurrentProject({ storyPages: newPages });
        }
    }
  };

  const handleAddLetteringElement = (pageIndex: number, type: LetteringElement['type']) => {
    if (!currentProject) return;

    const newElement: LetteringElement = {
      id: uuidv4(),
      type: type,
      text: 'New dialogue...', // Default text
      x: 25, y: 25, width: 50, height: 20,
      fontWeight: 'normal',
      textAlign: 'center',
      tail: { x: 50, y: 60 }, // Default tail for speech-like
      fontFamily: 'Inter',
      fontSize: 1.5,
      color: '#000000',
      fillColor: '#FFFFFF',
    };

    // Customize based on type
    switch (type) {
      case 'narration':
        newElement.text = 'New narration...';
        newElement.tail = undefined;
        newElement.fontFamily = 'Bangers';
        newElement.fontSize = 2.0;
        newElement.fillColor = '#facc15';
        newElement.fontWeight = 'bold';
        break;
      case 'thought':
        newElement.text = 'New thought...';
        newElement.fontFamily = 'Comic Neue';
        break;
      case 'shout':
        newElement.text = 'NEW SHOUT!';
        newElement.fontFamily = 'Luckiest Guy';
        newElement.fontSize = 2.5;
        newElement.fontWeight = 'bold';
        break;
      // 'dialogue' uses the defaults
    }
    
    const newPages = [...currentProject.storyPages];
    const page = newPages[pageIndex];
    if (page) {
        const newLettering = [...(page.lettering || []), newElement];
        newPages[pageIndex] = { ...page, lettering: newLettering };
        updateCurrentProject({ storyPages: newPages });
    }
  };

  const handleDeleteLetteringElement = (pageIndex: number, elementId: string) => {
    if (!currentProject) return;
    const newPages = [...currentProject.storyPages];
    const page = newPages[pageIndex];
    if (page && page.lettering) {
        const newLettering = page.lettering.filter(el => el.id !== elementId);
        newPages[pageIndex] = { ...page, lettering: newLettering };
        updateCurrentProject({ storyPages: newPages });
    }
  };

  const handleReorderPages = (dragIndex: number, dropIndex: number) => {
    if (!currentProject) return;
    const newPages = [...currentProject.storyPages];
    const [draggedItem] = newPages.splice(dragIndex, 1);
    newPages.splice(dropIndex, 0, draggedItem);
    
    // Re-assign page numbers based on the new order
    const renumberedPages = newPages.map((page, index) => ({
      ...page,
      page: index + 1
    }));

    updateCurrentProject({ storyPages: renumberedPages });
  };


  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setView('dashboard');
  };

  const stageMap: Record<Stage, number> = {
    'story-input': 0, 'identification': 1, 'character-sheets': 2,
    'chapter-selection': 3, 'story-panels': 4,
  };
  
  const renderProjectWorkspace = () => {
    if (!currentProject) return null;
    const currentStep = stageMap[currentProject.stage];

    return (
        <div className={`transition-opacity duration-500 ${isLoading && currentProject.stage !== 'story-panels' ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
            {currentProject.stage !== 'story-panels' && <Stepper currentStep={currentStep} />}
            <input
              type="text"
              value={currentProject.title}
              onChange={(e) => updateCurrentProject({ title: e.target.value })}
              className="font-bangers text-3xl tracking-wider text-center bg-transparent text-yellow-400 w-full focus:outline-none focus:bg-slate-800/50 rounded-lg py-2 my-4"
              placeholder="Comic Title"
            />
            <main className="mt-4">
            {currentProject.stage === 'story-input' && (
                <StoryInput 
                storyText={currentProject.storyText}
                setStoryText={(text) => updateCurrentProject({ storyText: text })}
                onNext={handleAnalyzeStory}
                />
            )}
            
            {currentProject.stage === 'identification' && (
                <IdentificationStep
                  project={currentProject}
                  updateProject={updateCurrentProject}
                  onNext={handleFinalizeCharacters}
                  onBack={() => updateCurrentProject({ stage: 'story-input' })}
                  characterLibrary={characterLibrary}
                />
            )}

            {currentProject.stage === 'character-sheets' && (
                <CharacterSheetDisplay
                characters={currentProject.characters}
                onNext={() => updateCurrentProject({ stage: 'chapter-selection' })}
                onBack={() => updateCurrentProject({ stage: 'identification' })}
                inkingStyle={currentProject.inkingStyle}
                setInkingStyle={(style) => updateCurrentProject({ inkingStyle: style })}
                coloringStyle={currentProject.coloringStyle}
                setColoringStyle={(style) => updateCurrentProject({ coloringStyle: style })}
                />
            )}
            
            {currentProject.stage === 'chapter-selection' && (
                <ChapterSelection
                chapters={currentProject.chapters}
                onSelectChapter={handleSelectChapter}
                onBack={() => updateCurrentProject({ stage: 'character-sheets' })}
                project={currentProject}
                />
            )}

            {currentProject.stage === 'story-panels' && (
                <StoryDisplay 
                    pages={currentProject.storyPages} 
                    onBackToDashboard={handleBackToDashboard} 
                    onBack={() => updateCurrentProject({ stage: 'chapter-selection' })}
                    onRegenerate={handleRegeneratePanel}
                    onEdit={handleEditPanel}
                    onUpdateLetteringElement={handleUpdateLetteringElement}
                    onAddLetteringElement={handleAddLetteringElement}
                    onDeleteLetteringElement={handleDeleteLetteringElement}
                    onReorderPages={handleReorderPages}
                />
            )}
            </main>
        </div>
    );
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="relative text-center mb-8 border-b-2 border-slate-700 pb-6">
            {view === 'project' && (
                <button 
                    onClick={handleBackToDashboard} 
                    className="absolute top-0 left-0 mt-2 font-bangers text-xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors z-10">
                    &larr; Back to Projects
                </button>
            )}
            <div className="flex items-center justify-center gap-4">
                <h1 className="font-bangers text-5xl sm:text-7xl header-gradient tracking-wider">Comic Creator AI </h1>
                <div className="relative">
                    <SparklesIcon className="w-8 h-8 text-yellow-400" />
                    <SparklesIcon className="w-5 h-5 text-cyan-400 absolute -top-2 -right-2 animate-pulse" />
                </div>
            </div>
          <p className="text-lg sm:text-xl text-gray-300 mt-2">
            Bring your stories to life with the power of Gemini
          </p>
        </header>

        {isLoading && <Loader message={loadingMessage} onCancel={isCancellable ? handleCancelGeneration : undefined} />}
        {isApiStatusModalOpen && (
            <ApiStatusModal 
                statuses={apiKeyStatuses} 
                onClose={() => setIsApiStatusModalOpen(false)} 
            />
        )}
        
        {view === 'dashboard' && (
          <ProjectDashboard 
            projects={projects}
            onNewProject={handleCreateNewProject}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
            onCharacterLibrary={() => setView('character-library')}
            onTestApiKeys={handleTestApiKeys}
          />
        )}
        
        {view === 'character-library' && (
            <CharacterLibrary
                library={characterLibrary}
                setLibrary={setCharacterLibrary}
                onBack={() => setView('dashboard')}
            />
        )}
        
        {view === 'project' && renderProjectWorkspace()}
      </div>
    </div>
  );
};

export default App;

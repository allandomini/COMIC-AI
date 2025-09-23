import React from 'react';
import type { Chapter, Project } from '../types';

interface ChapterSelectionProps {
  chapters: Chapter[];
  onSelectChapter: (chapter: Chapter) => void;
  onBack: () => void;
  project: Project;
}

const ChapterSelection: React.FC<ChapterSelectionProps> = ({ chapters, onSelectChapter, onBack, project }) => {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <h2 className="font-bangers text-4xl text-center text-yellow-400 mb-2">Select a Chapter to Generate</h2>
        <p className="text-center text-slate-300 mb-8">Your assets and art style are locked in. Now, let's create the comic, one chapter at a time.</p>
      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700">
        <ul className="divide-y divide-slate-700">
          {chapters.map((chapter, index) => {
            const isAlreadyGenerated = project.storyPages.length > 0 && project.generatedFromChapterTitle === chapter.title;
            return (
              <li key={index} className="p-4 sm:p-6 hover:bg-slate-700/50 transition-colors duration-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-grow text-center sm:text-left">
                    <h3 className="font-bangers text-2xl text-yellow-400 tracking-wide">{`Chapter ${index + 1}: ${chapter.title}`}</h3>
                    <p className="text-slate-300 text-sm mt-1 line-clamp-2">{chapter.text}</p>
                  </div>
                  <button
                    onClick={() => onSelectChapter(chapter)}
                    className={`font-bangers text-xl tracking-wider text-white font-bold py-2 px-6 rounded-lg transition-transform transform hover:scale-105 flex-shrink-0 w-full sm:w-auto ${
                      isAlreadyGenerated ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isAlreadyGenerated ? 'Review Comic' : 'Generate Comic'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex justify-center mt-8">
        <button onClick={onBack} className="font-bangers text-2xl tracking-wider bg-slate-600 hover:bg-slate-700 text-white py-3 px-8 rounded-lg transition-colors">
          Back to Style
        </button>
      </div>
    </div>
  );
};

export default ChapterSelection;
import React from 'react';
import type { Project } from '../types';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import KeyIcon from './icons/KeyIcon';

interface ProjectDashboardProps {
  projects: Project[];
  onNewProject: () => void;
  onLoadProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCharacterLibrary: () => void;
  onTestApiKeys: () => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projects, onNewProject, onLoadProject, onDeleteProject, onCharacterLibrary, onTestApiKeys }) => {
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        <button 
          onClick={onNewProject}
          className="font-bangers text-3xl tracking-wider flex items-center gap-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold py-3 px-10 rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-yellow-500/20"
        >
          <PlusIcon className="w-8 h-8" /> New Comic Project
        </button>
        <button 
          onClick={onCharacterLibrary}
          className="font-bangers text-2xl tracking-wider flex items-center gap-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Character Library
        </button>
        <button 
          onClick={onTestApiKeys}
          className="font-bangers text-2xl tracking-wider flex items-center gap-3 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          <KeyIcon className="w-6 h-6" /> Test API Keys
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="font-bangers text-4xl text-yellow-400 mb-4 border-b-2 border-slate-700 pb-2">Your Projects</h2>
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 flex flex-col overflow-hidden group">
                <div 
                  className="p-4 flex-grow cursor-pointer" 
                  onClick={() => onLoadProject(project.id)}
                >
                  <div className="w-full aspect-video bg-slate-900 rounded mb-4 flex items-center justify-center overflow-hidden border border-slate-700">
                    {project.storyPages.find(p => p.image)?.image ? (
                        <img src={project.storyPages.find(p => p.image)!.image} className="w-full h-full object-cover" alt="Panel preview"/>
                    ) : (
                        <span className="font-bangers text-slate-600 text-2xl">No Panels Yet</span>
                    )}
                  </div>
                  <h3 className="font-bangers text-2xl text-yellow-400 truncate group-hover:text-yellow-300">{project.title}</h3>
                  <p className="text-xs text-slate-400">Last updated: {formatDate(project.updatedAt)}</p>
                </div>
                <div className="bg-slate-900/50 p-2 flex justify-end">
                   <button 
                     onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                     className="text-slate-400 hover:text-red-500 p-2 rounded-full transition-colors"
                     aria-label="Delete project"
                   >
                     <TrashIcon className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-400 text-xl">You have no saved projects yet.</p>
            <p className="text-slate-500 mt-2">Click "New Comic Project" to start your first creation!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDashboard;

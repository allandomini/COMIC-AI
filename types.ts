export interface Character {
  id: string;
  name: string;
  description: string;
  image: string | null; // Base64 string for the image
  createdAt?: number;
  updatedAt?: number;
}

export interface Scenery {
  id:string;
  description: string;
  image: string | null;
}

export interface SFX {
  text: string;
  style: string;
}

export interface LetteringElement {
  id: string;
  type: 'dialogue' | 'narration' | 'thought' | 'shout';
  text: string;
  x: number; // position of the box, percentage
  y: number;
  width: number;
  height: number;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  
  // New advanced styling
  fontFamily: string;
  fontSize: number; // vmin unit
  color: string; // hex for text
  fillColor: string; // hex for balloon background

  tail?: { // optional, for speech/thought/shout
    x: number; // position of the tail tip, percentage
    y: number;
  };
}

export interface StoryPage {
  page: number;
  description: string;
  narration: string; // For the narrator box
  dialogue: {
    character: string;
    line: string;
  }[]; // For speech bubbles in the image
  image?: string | null;
  isGenerating?: boolean;
  isLettering?: boolean;
  layout: 'standard' | 'wide' | 'tall' | 'splash';
  sfx?: SFX;
  lettering?: LetteringElement[] | null;
  generationFailed?: boolean;
  failureReason?: string;
}

export interface Chapter {
  title: string;
  text: string;
}

export type Stage = 'story-input' | 'identification' | 'character-sheets' | 'chapter-selection' | 'story-panels';

export interface Project {
  id: string;
  title: string;
  storyText: string;
  chapters: Chapter[];
  characters: Character[];
  scenery: Scenery[];
  storyPages: StoryPage[];
  inkingStyle: string;
  coloringStyle: string;
  stage: Stage;
  generateDetailedSheets: boolean;
  createdAt: number;
  updatedAt: number;
  generatedFromChapterTitle?: string;
}
import { openDB, IDBPDatabase } from 'idb';
import type { Project, Character } from './types';

const DB_NAME = 'ComicCreatorDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const CHARACTERS_STORE = 'characterLibrary';

let db: IDBPDatabase;

export async function initDB() {
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHARACTERS_STORE)) {
        db.createObjectStore(CHARACTERS_STORE, { keyPath: 'id' });
      }
    },
  });
}

// --- Project Functions ---

export async function saveProject(project: Project): Promise<void> {
  if (!db) await initDB();
  await db.put(PROJECTS_STORE, project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (!db) await initDB();
  return db.get(PROJECTS_STORE, id);
}

export async function getAllProjects(): Promise<Project[]> {
  if (!db) await initDB();
  return db.getAll(PROJECTS_STORE);
}

export async function deleteProject(id: string): Promise<void> {
  if (!db) await initDB();
  await db.delete(PROJECTS_STORE, id);
}

// --- Character Library Functions ---

export async function saveCharacterToLibrary(character: Character): Promise<void> {
  if (!db) await initDB();
  await db.put(CHARACTERS_STORE, character);
}

export async function getCharacterFromLibrary(id: string): Promise<Character | undefined> {
  if (!db) await initDB();
  return db.get(CHARACTERS_STORE, id);
}

export async function getAllCharactersFromLibrary(): Promise<Character[]> {
  if (!db) await initDB();
  return db.getAll(CHARACTERS_STORE);
}

export async function deleteCharacterFromLibrary(id: string): Promise<void> {
  if (!db) await initDB();
  await db.delete(CHARACTERS_STORE, id);
}
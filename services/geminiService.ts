
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Character, Scenery, StoryPage, Chapter, LetteringElement } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getNextKey, getTotalKeys, getApiKeys } from './apiKeyManager';

/**
 * Custom error class for API-related failures to provide user-friendly messages.
 */
export class GeminiApiError extends Error {
  constructor(message: string, public readonly userFriendlyMessage: string) {
    super(message);
    this.name = 'GeminiApiError';
    Object.setPrototypeOf(this, GeminiApiError.prototype);
  }
}

const isRateLimitError = (error: any): boolean => {
  const errorMessage = error.toString().toLowerCase();
  return errorMessage.includes('rate limit') || 
         errorMessage.includes('quota') ||
         errorMessage.includes('resource_exhausted');
};

const createPlaceholderSvgDataUrl = (text: string): string => {
  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="background-color:#4A5568;">
      <style>
        .title { fill: #FBBF24; font-size: 32px; font-family: 'Bangers', cursive, sans-serif; text-anchor: middle; }
        .text { fill: #E2E8F0; font-size: 24px; font-family: 'Inter', sans-serif; text-anchor: middle; white-space: pre-wrap; }
      </style>
      <text x="50%" y="45%" class="title">GENERATION FAILED</text>
      <text x="50%" y="60%" class="text">${text}</text>
    </svg>
  `;
  // In a browser environment, btoa is available for base64 encoding.
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};


const fileToBase64 = (base64: string): string => {
  const parts = base64.split(',');
  return parts.length > 1 ? parts[1] : base64;
};

async function geminiApiCall<T>(apiLogic: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const totalKeys = getTotalKeys();
  let lastError: any = new Error("No API keys are available or all have failed.");

  for (let i = 0; i < totalKeys; i++) {
    const { key, index } = getNextKey();
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await apiLogic(ai);
      return result;
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error)) {
        console.warn(`API key at index ${index} hit a rate limit. Trying next key...`);
        continue; // Try the next key
      } else {
        // For non-rate-limit errors, fail fast
        console.error(`An unrecoverable error occurred with API key at index ${index}:`, error);
        throw error;
      }
    }
  }

  // If all keys failed
  console.error("All API keys have failed.", lastError);
  if (isRateLimitError(lastError)) {
      throw new GeminiApiError(
          "All API keys have reached their rate limits.",
          "All available API keys have reached their daily limit. Please try again tomorrow or add new keys."
      );
  }
  throw lastError;
}

export const analyzeFullStory = async (fullStoryText: string): Promise<{
  chapters: Chapter[],
  characters: Omit<Character, 'id' | 'image'>[],
  scenery: Omit<Scenery, 'id' | 'image'>[]
}> => {
  try {
     return await geminiApiCall(async (ai) => {
        const prompt = `
          As an expert story editor and script analyst, your task is to perform a comprehensive analysis of the following story text.
          You must complete three objectives:
          1.  **Breakdown into Chapters:** Divide the story into logical chapters or scenes based on shifts in location, time, or major plot points. Provide a short, catchy title for each chapter.
          2.  **Identify All Characters:** Identify every unique character mentioned throughout the entire story. For each character, provide a detailed description of their appearance, personality, and any key visual traits an artist would need to know. Consolidate information from across the entire story for each character.
          3.  **Identify All Scenery:** Identify every distinct scenery or setting from the entire story. Provide a rich, atmospheric description for each one.

          CRITICAL INSTRUCTION: You MUST respond in the same language as the provided 'Full Story Text'. All of your output, including chapter titles, character descriptions, and scenery descriptions, must be in that language.

          Full Story Text:
          """
          ${fullStoryText}
          """

          Provide the final output in the specified JSON format, containing all chapters, all unique characters, and all unique scenery objects.
        `;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                chapters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "A short, catchy title for the chapter." },
                      text: { type: Type.STRING, description: "The full text content of this chapter." },
                    },
                    required: ["title", "text"],
                  },
                },
                characters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "The character's name." },
                      description: { type: Type.STRING, description: "A consolidated, detailed description of the character's appearance and personality from across the entire story." },
                    },
                    required: ["name", "description"],
                  },
                },
                scenery: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: "A rich, atmospheric description of the scenery or setting." },
                    },
                    required: ["description"],
                  },
                },
              },
              required: ["chapters", "characters", "scenery"]
            },
          },
        });
        
        const responseText = response.text?.trim();
        if (!responseText) {
          throw new GeminiApiError(
            "Analysis failed: The API returned an empty response.",
            "The request was blocked, possibly due to a content safety filter. Please try modifying your story text."
          );
        }
        try {
            const parsedResponse = JSON.parse(responseText);
            return parsedResponse;
        } catch(e) {
            console.error("Failed to parse JSON in analyzeFullStory", responseText);
            throw new GeminiApiError(
                "Failed to parse story analysis response.",
                "The API returned an invalid format for the story analysis. Please try again."
            );
        }
     });
  } catch (error) {
    if (error instanceof GeminiApiError) throw error;
    console.error("Error in analyzeFullStory:", error);
    throw new GeminiApiError(
        error instanceof Error ? error.message : String(error),
        "An unexpected error occurred while analyzing the story."
    );
  }
};


export const generateImageForPrompt = async (description: string, entityType: 'Character' | 'Scenery', artStyle: string, name?: string): Promise<string> => {
    try {
       return await geminiApiCall(async (ai) => {
            let fullPrompt = '';
            if (entityType === 'Character') {
                fullPrompt = `Generate a full-body character reference image for a comic book, rendered in the following art style: "${artStyle}". The character should be in a dynamic but clear pose against a **plain white background**. The character is named "${name}" and is described as: "${description}"`;
            } else { // Scenery
                fullPrompt = `Generate a rich, atmospheric establishing shot of a scene for a comic book. It is CRITICAL that you render this image in the following art style: "${artStyle}". The scene is described as: "${description}". The image must be an empty scene, with NO people or characters present. The art style is not a suggestion; it is a mandatory directive.`;
            }
            
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: '1:1',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
                return `data:image/png;base64,${base64ImageBytes}`;
            }

            throw new GeminiApiError(
                "No image was generated for the prompt.",
                "The image generation was blocked, possibly due to a content safety filter. Please try a different description."
            );
       });
    } catch (error) {
        if (error instanceof GeminiApiError && error.message.includes("rate limits")) {
            console.warn("API rate limit hit. Generating a placeholder image for prompt:", description);
            return createPlaceholderSvgDataUrl('API Limit Reached');
        }
        console.error("Error in generateImageForPrompt:", error);
        if (error instanceof GeminiApiError) throw error;
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred while generating the image."
        );
    }
};

export const generateCharacterSheetFromImage = async (character: Character): Promise<string> => {
    try {
        if (!character.image) {
            throw new Error("Character has no image to generate a sheet from.");
        }
        
        return await geminiApiCall(async (ai) => {
            const prompt = `
                Use the provided image as a strict visual reference for the character named "${character.name}".
                Your task is to create a single, professional-grade character sheet image on a **plain white background**.
                Neatly arrange the following elements on the sheet:
                1. A full-body view from the **front**.
                2. A full-body view from the **side**.
                3. A full-body view from the **back**.
                4. A section with at least three different **facial expressions** (e.g., happy, angry, sad).

                CRITICAL: The character's appearance, clothing, colors, and art style across all views and expressions must EXACTLY and CONSISTENTLY match the provided reference image. Do not deviate from the reference.
                Character description for context: "${character.description}".
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: fileToBase64(character.image),
                                mimeType: 'image/png',
                            },
                        },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const parts = response?.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            throw new GeminiApiError(
                "No image was generated for the character sheet.", 
                "The character sheet generation was blocked, possibly due to a content safety filter. Try using a different initial image."
            );
        });
    } catch (error) {
        if (error instanceof GeminiApiError && error.message.includes("rate limits")) {
            console.warn("API rate limit hit. Generating a placeholder character sheet.");
            return createPlaceholderSvgDataUrl('API Limit Reached');
        }
        console.error("Error in generateCharacterSheetFromImage:", error);
        if (error instanceof GeminiApiError) throw error;
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred while generating the character sheet."
        );
    }
};


export const generateStory = async (chapterText: string): Promise<StoryPage[]> => {
    try {
        return await geminiApiCall(async (ai) => {
            const prompt = `
                You are an award-winning comic book author and adapter. Your task is to transform a chapter of prose into an exceptional, professional-grade comic book script. This is not a simple transcription; it is an act of translation from one medium to another. Your adaptation must be cinematic, emotionally resonant, and visually dynamic.

                **Your Guiding Philosophy for Adaptation:**
                1.  **Show, Don't Tell:** Your primary goal is to convert descriptive prose and internal monologue into visual storytelling. Instead of narrating that a character is angry, describe a panel with a "tight close-up on their face, brow furrowed, teeth gritted, a vein pulsing on their temple."
                2.  **Cinematic Direction:** You are the director. For every panel, think in terms of camera shots. Use specific cinematic language: Extreme Close-Up (ECU), Close-Up (CU), Medium Shot (MS), Full Shot (FS), Wide Shot (WS), Establishing Shot. Specify camera angles: high-angle, low-angle, point-of-view (POV). This is crucial for creating mood and emphasis.
                3.  **Pacing is Everything:** A good adaptation controls the flow of time.
                    *   Use multiple panels for a single moment to slow down time and build tension (e.g., panel 1: hand reaching for a door; panel 2: close-up on the doorknob turning; panel 3: character's apprehensive face).
                    *   Use a single, dynamic panel to convey rapid action.
                    *   The number of panels should serve the story's rhythm, not be a fixed number.
                4.  **Extract, Don't Invent:** All dialogue and narration must be extracted or faithfully adapted from the source text. Your creativity lies in the visual interpretation, not in adding new plot points or dialogue.
                5.  **Language Consistency:** CRITICAL INSTRUCTION: The language for 'narration' and 'dialogue' text MUST perfectly match the language of the input 'Chapter Text'.
                6.  **Logical Scene Progression:** Ensure that a character's state (e.g., location, posture, condition) carries over logically from one panel description to the next. If a panel ends with a character sitting at a table, the next panel description should begin with that character at the table, unless the prose explicitly says they moved.

                **Chapter Text to Adapt:**
                """
                ${chapterText}
                """

                Now, break down the chapter into comic book panels according to the JSON schema provided. For each panel, provide the following:

                1. 'page': The sequential panel number, starting from 1.
                2. 'description': A masterfully crafted visual description for the artist. Be highly specific about the cinematic shot, camera angle, character expressions, actions, and key background details. Example: "LOW-ANGLE WIDE SHOT: The hero stands silhouetted against the stormy sky on a skyscraper's edge, their cape whipping in the wind. Rain lashes down, reflecting the neon city lights below."
                3. 'narration': Any text that is narration. If none, return an empty string.
                4. 'dialogue': An array of objects for spoken lines. Each object has 'character' and 'line'. If none, return an empty array.
                5. 'layout': Suggest a layout based on impact. 'splash' for breathtaking moments, 'wide' for action, 'tall' for dramatic entrances, 'standard' for regular beats.
                6. 'sfx': An optional sound effect object if clearly implied.
            `;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    systemInstruction: "You are an expert comic book writer and artist. Your job is to translate a prose story into a visually compelling comic book script with dynamic panel layouts and sound effects.",
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                page: { type: Type.INTEGER, description: "The panel number." },
                                description: { type: Type.STRING, description: "Detailed visual description of the scene, including composition." },
                                narration: { type: Type.STRING, description: "Narration text for the panel." },
                                dialogue: {
                                    type: Type.ARRAY,
                                    description: "Spoken lines by characters in the panel.",
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            character: { type: Type.STRING },
                                            line: { type: Type.STRING }
                                        },
                                        required: ["character", "line"]
                                    }
                                },
                                layout: { type: Type.STRING, description: "The suggested layout for the panel ('standard', 'wide', 'tall', 'splash')." },
                                sfx: {
                                    type: Type.OBJECT,
                                    description: "An optional sound effect for the panel.",
                                    properties: {
                                        text: { type: Type.STRING, description: "The sound effect text (e.g., 'BOOM!')." },
                                        style: { type: Type.STRING, description: "The visual style of the SFX (e.g., 'jagged, explosive letters')." }
                                    },
                                    required: ["text", "style"]
                                }
                            },
                            required: ["page", "description", "narration", "dialogue", "layout"],
                        },
                    },
                },
            });
            
            const responseText = response.text?.trim();
            if (!responseText) {
                throw new GeminiApiError(
                    "Story generation failed: The API returned an empty response.",
                    "The story script generation was blocked, possibly due to a content safety filter. Please try modifying the chapter text."
                );
            }
            try {
                const parsedResponse = JSON.parse(responseText);
                // Return pages sorted by 'page' number just in case the API returns them out of order
                return (parsedResponse as StoryPage[]).sort((a, b) => a.page - b.page);
            } catch (e) {
                console.error("Failed to parse JSON in generateStory", responseText);
                throw new GeminiApiError(
                    "Failed to parse story generation response.",
                    "The API returned an invalid format for the story script. Please try again."
                );
            }
        });
    } catch(error) {
        if (error instanceof GeminiApiError) throw error;
        console.error("Error in generateStory:", error);
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred while generating the story script."
        );
    }
};

export const generatePanelImage = async (
    description: string,
    charactersWithImages: Character[],
    sceneryWithImages: Scenery[],
    inkingStyle: string,
    coloringStyle: string,
    sfx: StoryPage['sfx'],
    fullStory: string,
    layout: StoryPage['layout'] = 'standard',
    previousPanelImage?: string | null
): Promise<string> => {
    try {
        return await geminiApiCall(async (ai) => {
            let sfxText = "There are no sound effects in this panel.";
            if (sfx && sfx.text && sfx.style) {
                sfxText = `Render the following onomatopoeia/sound effect prominently within the panel, integrated naturally with the art.
- SFX Text: "${sfx.text}"
- Visual Style: "${sfx.style}"`;
            }

            let aspectRatioInstruction: string;
            switch (layout) {
                case 'wide':
                case 'splash':
                    aspectRatioInstruction = "CRITICAL INSTRUCTION: The final generated image MUST have a WIDE, cinematic aspect ratio of 16:9.";
                    break;
                case 'tall':
                    aspectRatioInstruction = "CRITICAL INSTRUCTION: The final generated image MUST have a TALL, vertical aspect ratio of 3:4.";
                    break;
                case 'standard':
                default:
                    aspectRatioInstruction = "CRITICAL INSTRUCTION: The final generated image MUST have a SQUARE aspect ratio of 1:1.";
                    break;
            }

            const previousPanelContext = previousPanelImage 
                ? `**--- THE GOLDEN RULE: ABSOLUTE SCENE CONTINUITY (HIGHEST PRIORITY) ---**
Your most important task is to maintain perfect visual continuity from the PREVIOUS panel, which has been provided. This rule OVERRIDES all others if a conflict arises.
- **State Persistence:** Characters' positions, clothing, and expressions must logically follow from the previous panel. If a character was in bed, they remain in bed unless the description says they got up.
- **Environment Lock:** The background, lighting, and object placement MUST remain IDENTICAL to the previous panel, unless the new description explicitly dictates a change (e.g., "a vase falls over"). Treat the previous panel as the ground truth for the environment.
- This creates a seamless, professional flow. Failure to adhere to this continuity is a critical error.`
                : '';

            const promptText = `You are a master comic book artist and mangaka. Your task is to generate a single comic panel, treating the provided reference images with the same precision and strictness as a **ControlNet** model. Your primary directive is to achieve absolute visual consistency.

${previousPanelContext}

**--- ControlNet Anchoring (UNBREAKABLE RULE) ---**
The provided reference images for characters and scenery are your 'Control Images'. They are NOT inspirations or suggestions; they are **absolute blueprints for structure, form, and appearance.**
- You MUST anchor the generated characters' anatomy, clothing, colors, and facial structure directly to their reference sheets.
- Any deviation from these control images is a failure. Your creativity must be applied to composition and emotion, NOT to redesigning established assets.
- **LoRA Fine-Tuning Analogy:** Think of each character's reference sheet as a highly-trained LoRA. You must replicate the fine details—hairstyle, specific clothing items, unique markings—with 100% fidelity. Do not generalize or create a 'similar' character. Create the *exact* character shown in the reference.

**HOW TO USE REFERENCE IMAGES:**
- You MUST copy the character's clothing, hairstyle, colors, and overall design from the reference with 100% accuracy. Do not improvise or change the design in any way.

**CRITICAL: This image MUST NOT contain any speech bubbles, narration boxes, or dialogue text.** The image should only contain the artwork and any integrated sound effects (SFX).

**1. Style Interpretation:**
Analyze and internalize the requested art style:
- Inking Style: "${inkingStyle}"
- Coloring Style: "${coloringStyle}"
Faithfully interpret these descriptions.

**2. Scene and Compositional Logic:**
- You MUST avoid logical redundancies. For example, if a character is depicted lying in a bed, DO NOT draw another identical bed in the background of the same room.
- Ensure the environment makes logical sense based on the description and previous panel.

**3. Overall Story Context:**
To understand the tone, here is the full story:
"""
${fullStory}
"""

**4. This Panel's Specific Scene:**
Now, create the image for this specific panel: "${description}"

**5. Panel Dimensions:**
${aspectRatioInstruction}

**6. Sound Effects (SFX):**
${sfxText}

**7. Character & Scenery Mandate (REITERATED):**
Adhere to the reference images with zero deviation.
- **ANTI-DUPLICATION RULE:** Draw each character ONLY ONCE in the panel unless the prompt explicitly asks for a reflection or clone.

Create the final comic panel image based on all these instructions.`;

            const parts: any[] = [{ text: promptText }];

            if (previousPanelImage) {
                parts.unshift({
                    inlineData: { data: fileToBase64(previousPanelImage), mimeType: 'image/png' }
                });
                parts.unshift({ text: `This is the image from the immediately preceding panel. Use it for visual consistency.` });
            }

            charactersWithImages.forEach(char => {
                if (char.image) {
                    parts.push({text: `This is the character reference for ${char.name}.`});
                    parts.push({
                        inlineData: {
                            data: fileToBase64(char.image),
                            mimeType: 'image/png',
                        },
                    });
                }
            });

            sceneryWithImages.forEach((scn, index) => {
                if (scn.image) {
                    parts.push({text: `This is the scenery reference #${index + 1}: ${scn.description}.`});
                    parts.push({
                        inlineData: {
                            data: fileToBase64(scn.image),
                            mimeType: 'image/png',
                        },
                    });
                }
            });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const responseParts = response?.candidates?.[0]?.content?.parts;
            if (responseParts) {
                for (const part of responseParts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            throw new GeminiApiError(
                "No image was generated for the story panel.",
                "The panel generation was blocked, possibly due to a content safety filter. Please try regenerating or modifying the story."
            );
        });
    } catch (error) {
        if (error instanceof GeminiApiError && error.message.includes("rate limits")) {
            console.warn("API rate limit hit. Generating a placeholder panel image.");
            return createPlaceholderSvgDataUrl('API Limit Reached');
        }
        console.error("Error in generatePanelImage:", error);
        if (error instanceof GeminiApiError) throw error;
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred while generating the panel image."
        );
    }
};

export const analyzePanelForLettering = async (
    base64ImageData: string,
    dialogue: { character: string; line: string }[],
    narration: string
): Promise<LetteringElement[]> => {
    if (!narration && (!dialogue || dialogue.length === 0)) {
        return []; // No text to place, so we're done.
    }
    
    try {
        return await geminiApiCall(async (ai) => {
            const textContent = `
                - Narration: "${narration}"
                - Dialogue: ${dialogue.map(d => `\n  - ${d.character}: "${d.line}"`).join('')}
            `;

            const prompt = `
                You are a professional comic book letterer. Your task is to analyze the provided comic panel image and the associated text to determine the optimal placement, style, and shape for all lettering elements.

                **Image to Analyze is provided.**

                **Text content to place:**
                ${textContent}

                **Instructions & Rules:**
                1.  **Analyze Composition:** Identify open spaces in the image. DO NOT obscure character faces, hands, or key action points.
                2.  **Logical Flow:** Arrange elements in a natural reading order (top-to-bottom, left-to-right).
                3.  **Element Types & Styling:**
                    *   **narration:** Rendered as a rectangle. Does NOT have a tail. Use the 'Bangers' font, yellow fill color ('#facc15'), and black text ('#000000').
                    *   **dialogue:** Normal speech. Rendered as a rounded rectangle with a speech tail. Use the 'Inter' font, white fill ('#FFFFFF'), and black text ('#000000').
                    *   **thought:** Internal thoughts. Rendered as a cloud-like shape with a tail of small bubbles. Use 'Comic Neue' font, white fill ('#FFFFFF'), and black text ('#000000').
                    *   **shout:** Loud speech. Rendered as a jagged, explosive shape. Use a bold, large font like 'Luckiest Guy'. White fill ('#FFFFFF'), and black text ('#000000').
                    *   You MUST assign the correct 'type' and provide all styling properties for each element.
                4.  **Font Size (fontSize):** This MUST be a number representing a responsive unit (vmin). A standard dialogue size is around 1.5. A shout should be larger, around 2.5. A narration box can be around 2. Adjust based on the amount of text and available space.
                5.  **Speech Tail Placement (CRITICAL for dialogue, thought, shout):**
                    *   You MUST provide 'tail' coordinates ('x' and 'y' percentages).
                    *   The tail's tip must point directly to the mouth (for dialogue/shout) or head (for thought) of the speaking character.
                    *   Analyze the image to find the correct character and place the tail tip accurately.
                6.  **Coordinates & Dimensions:** All 'x', 'y', 'width', and 'height' values MUST be percentages (0-100) relative to the image dimensions. 'x' is from the left, 'y' is from the top.

                Provide the final JSON output according to the schema.
            `;

            const letteringSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['dialogue', 'narration', 'thought', 'shout'] },
                        text: { type: Type.STRING },
                        x: { type: Type.NUMBER, description: "Percentage from the left edge (0-100)." },
                        y: { type: Type.NUMBER, description: "Percentage from the top edge (0-100)." },
                        width: { type: Type.NUMBER, description: "Width as a percentage of the image width (0-100)." },
                        height: { type: Type.NUMBER, description: "Height as a percentage of the image height (0-100)." },
                        fontWeight: { type: Type.STRING, enum: ['normal', 'bold'], description: "Use 'bold' for emphasis, otherwise 'normal'." },
                        textAlign: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                        fontFamily: { type: Type.STRING, description: "Font name, e.g., 'Inter', 'Bangers', 'Comic Neue'."},
                        fontSize: { type: Type.NUMBER, description: "Font size as a responsive 'vmin' unit (e.g., 2.5)." },
                        color: { type: Type.STRING, description: "Text color as a hex code, e.g., '#000000'." },
                        fillColor: { type: Type.STRING, description: "Balloon background color as a hex code, e.g., '#FFFFFF'." },
                        tail: {
                            type: Type.OBJECT,
                            description: "Optional. Tip of the speech tail, pointing to the speaker.",
                            properties: {
                                x: { type: Type.NUMBER, description: "Tail tip X-coordinate as a percentage (0-100)." },
                                y: { type: Type.NUMBER, description: "Tail tip Y-coordinate as a percentage (0-100)." },
                            },
                            required: ["x", "y"]
                        }
                    },
                    required: ["type", "text", "x", "y", "width", "height", "fontWeight", "textAlign", "fontFamily", "fontSize", "color", "fillColor"]
                },
            };

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: fileToBase64(base64ImageData),
                                mimeType: 'image/png',
                            },
                        }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: letteringSchema,
                },
            });

            const responseText = response.text?.trim();
            if (!responseText) {
                console.warn("Lettering analysis returned an empty response. Falling back to default placement.");
                const fallbackLettering: Omit<LetteringElement, 'id'>[] = [];
                if (narration) fallbackLettering.push({ type: 'narration', text: narration, x: 5, y: 80, width: 90, height: 15, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Bangers', fontSize: 2.0, color: '#000000', fillColor: '#facc15' });
                dialogue.forEach((d, i) => fallbackLettering.push({ type: 'dialogue', text: d.line, x: 10, y: 10 + (i * 15), width: 80, height: 12, fontWeight: 'normal', textAlign: 'left', tail: {x: 50, y: 50}, fontFamily: 'Inter', fontSize: 1.5, color: '#000000', fillColor: '#FFFFFF' }));
                return fallbackLettering.map(el => ({ ...el, id: uuidv4() }));
            }

            try {
                const parsedResponse = JSON.parse(responseText);
                // Add unique IDs to each element for state management
                const elementsWithIds = parsedResponse.map((el: Omit<LetteringElement, 'id'>) => ({
                    ...el,
                    id: uuidv4(),
                }));
                return elementsWithIds as LetteringElement[];
            } catch (e) {
                 console.error("Failed to parse JSON in analyzePanelForLettering", responseText);
                 throw new GeminiApiError(
                    "Failed to parse lettering data.",
                    "The API returned an invalid format for lettering analysis. Please try regenerating the panel."
                 );
            }
        });
    } catch (error) {
        if (error instanceof GeminiApiError) throw error;
        console.error("Error in analyzePanelForLettering:", error);
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred during text placement analysis."
        );
    }
};

export const editPanelImage = async (
    base64ImageData: string,
    prompt: string
): Promise<string> => {
    try {
        return await geminiApiCall(async (ai) => {
            const editPrompt = `
              You are an expert digital artist and photo editor working on a comic book panel.
              Your task is to perform a specific, targeted edit on the provided image while preserving its original essence.

              **--- UNBREAKABLE RULES ---**
              1.  **PRESERVE ART STYLE:** You MUST maintain the original inking style, coloring style, character designs, and background details perfectly. Do not redraw or reinterpret the entire image.
              2.  **APPLY ONLY THE REQUESTED EDIT:** Your ONLY job is to apply the following user instruction. Do not add, remove, or change anything else.
              3.  **SEAMLESS INTEGRATION:** The edit must be seamlessly blended into the original image, matching the lighting, texture, and line work.

              **USER'S EDIT INSTRUCTION:**
              """
              ${prompt}
              """

              Now, apply this edit to the provided image and return only the edited image.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { text: editPrompt },
                        {
                            inlineData: {
                                data: fileToBase64(base64ImageData),
                                mimeType: 'image/png',
                            },
                        },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const parts = response?.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            throw new GeminiApiError(
                "No edited image was generated.",
                "The image edit was blocked, possibly due to a content safety filter. Please try a different edit prompt."
            );
        });

    } catch (error) {
        if (error instanceof GeminiApiError && error.message.includes("rate limits")) {
            console.warn("API rate limit hit. Could not edit panel image.");
            return createPlaceholderSvgDataUrl('API Limit: Edit Failed');
        }
        console.error("Error in editPanelImage:", error);
        if (error instanceof GeminiApiError) throw error;
        throw new GeminiApiError(
            error instanceof Error ? error.message : String(error),
            "An unexpected error occurred while editing the panel."
        );
    }
};

export interface ApiKeyStatus {
    keyIdentifier: string;
    status: 'ok' | 'error';
    message: string;
}

export const testApiKeys = async (): Promise<ApiKeyStatus[]> => {
    const keys = getApiKeys();
    const statusPromises = keys.map(async (key, index) => {
        const keyIdentifier = `API Key ${index + 1}`;
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            // A simple, low-cost call
            await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: "hello",
                config: { thinkingConfig: { thinkingBudget: 0 } } // make it fast
            });
            return { keyIdentifier, status: 'ok' as const, message: 'Active' };
        } catch (error) {
            let message = 'An unknown error occurred.';
            if (error instanceof Error) {
                if (isRateLimitError(error)) {
                    message = 'Quota limit reached.';
                } else if (error.message.includes('API key not valid')) {
                    message = 'Invalid API key.';
                } else {
                    message = error.message.slice(0, 100); // Truncate long messages
                }
            }
            return { keyIdentifier, status: 'error' as const, message };
        }
    });

    return Promise.all(statusPromises);
};

// WARNING: It is not recommended to hardcode API keys in the source code.
// This is implemented as per user request. The preferred method is using environment variables.

const userApiKeys = [
  'AIzaSyCsQdaVoM2xLe3pGI-cmrP4_l4xZCjKu2Q',
  'AIzaSyBfoxXlZLirVnKJv5Krz13CSKS6dDnqKKQ',
];

// Ensure the primary API key from environment variables is always first and included.
const apiKeys: string[] = [
  ...(process.env.API_KEY ? [process.env.API_KEY] : []),
  ...userApiKeys,
].filter(key => !!key); // Filter out any empty/undefined keys

if (apiKeys.length === 0) {
    throw new Error("No API_KEY is configured. Please set the environment variable or add keys to apiKeyManager.ts");
}

let currentKeyIndex = 0;

export const getApiKeys = (): string[] => {
  return [...apiKeys];
};

export const getNextKey = (): { key: string, index: number } => {
    const key = apiKeys[currentKeyIndex];
    const index = currentKeyIndex;
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return { key, index };
};

export const getTotalKeys = (): number => {
    return apiKeys.length;
};

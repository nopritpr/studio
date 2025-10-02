import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {groq} from 'genkitx-groq';

export const ai = genkit({
  plugins: [
    googleAI(),
    groq({apiKey: process.env.GROQ_API_KEY}),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

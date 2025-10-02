import {genkit} from 'genkit';
import {groq, gemma7b} from 'genkitx-groq';

export const ai = genkit({
  plugins: [
    groq({
      apiKey: process.env.GROQ_API_KEY,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
  models: [gemma7b],
});

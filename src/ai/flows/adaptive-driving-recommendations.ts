
'use server';

/**
 * @fileOverview Provides adaptive driving recommendations based on driving habits and predicted range.
 *
 * - getDrivingRecommendation - A function that returns driving recommendations.
 * - DrivingRecommendationInput - The input type for the getDrivingRecommendation function.
 * - DrivingRecommendationOutput - The return type for the getDrivingRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { gemma7b } from 'genkitx-groq';

const DrivingRecommendationInputSchema = z.object({
  drivingStyle: z
    .string()
    .describe("The user's current driving style (e.g., Eco, Balanced, Aggressive)."),
  predictedRange: z.number().describe('The predicted driving range in kilometers.'),
  batterySOC: z.number().describe('The current battery state of charge (percentage).'),
  acUsage: z.boolean().describe('Whether the A/C is currently in use.'),
  acTemp: z.number().describe('The A/C temperature setting in Celsius.'),
  passengers: z.number().describe('The number of passengers in the vehicle.'),
  driveMode: z.string().describe('The current drive mode (e.g., Eco, City, Sports).'),
  driveModeHistory: z.array(z.string()).describe('The history of the last 10 drive modes used.'),
  accelerationHistory: z.array(z.number()).describe('The history of acceleration values.'),
  outsideTemperature: z.number().describe('The current outside temperature in Celsius.'),
});
export type DrivingRecommendationInput = z.infer<typeof DrivingRecommendationInputSchema>;

const DrivingRecommendationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe(
      'A specific, positive, and actionable recommendation to improve energy efficiency and extend driving range. Frame it as a helpful tip. Maximum 2 sentences.'
    ),
  justification: z
    .string()
    .describe(
      'A brief explanation of why the recommendation is being made, based on the input data. Explain the logic. Maximum 2 sentences.'
    ),
});
export type DrivingRecommendationOutput = z.infer<typeof DrivingRecommendationOutputSchema>;

export async function getDrivingRecommendation(
  input: DrivingRecommendationInput
): Promise<DrivingRecommendationOutput> {
  return adaptiveDrivingRecommendationsFlow(input);
}

const adaptiveDrivingRecommendationsPrompt = ai.definePrompt({
  name: 'adaptiveDrivingRecommendationsPrompt',
  input: {schema: DrivingRecommendationInputSchema},
  output: {schema: DrivingRecommendationOutputSchema},
  config: {
    model: gemma7b,
  },
  prompt: `You are an expert AI driving coach for an electric vehicle. Your goal is to provide positive, helpful, and actionable recommendations to the driver to maximize their energy efficiency and range. Analyze the real-time data provided and generate a single recommendation with a clear justification.

  Current Vehicle & Environmental Data:
  - Driving Style: {{drivingStyle}}
  - Predicted Range: {{predictedRange}} km
  - Battery SOC: {{batterySOC}}%
  - Drive Mode: {{driveMode}}
  - Drive Mode History (last 10 changes): {{{json driveModeHistory}}}
  - A/C Status: {{#if acUsage}}On ({{acTemp}}°C){{else}}Off{{/if}}
  - Passengers: {{passengers}}
  - Outside Temperature: {{outsideTemperature}}°C
  - Acceleration History (last 10s): {{{json accelerationHistory}}}

  Your Task:
  Based on the data, identify the single most impactful area for improvement right now. Create a concise recommendation and a brief justification.

  Consider these scenarios:
  1.  **Frequent Mode Switching**: If the 'driveModeHistory' shows many recent changes, advise sticking to one mode.
      - Justification: Inconsistent modes prevent the system from optimizing power delivery.
  2.  **High Speed & Inefficient Mode**: If speed is high and the mode is 'Sports', suggest switching to 'Eco' or 'City'.
      - Justification: High speeds are less efficient, and 'Sports' mode prioritizes performance over range.
  3.  **Unnecessary A/C Usage**: If the A/C is on but the 'outsideTemperature' is mild (e.g., 18-24°C) and similar to the 'acTemp'.
      - Recommendation: Suggest turning off the A/C and using the fan or opening windows.
      - Justification: The A/C is a significant energy drain, and turning it off can add several kilometers of range.
  4.  **Aggressive Acceleration**: If 'accelerationHistory' shows frequent high positive values.
      - Recommendation: Advise smoother, more gradual acceleration.
      - Justification: Rapid acceleration consumes a large amount of power.
  5.  **High Passenger Load**: If passenger count is high.
      - Recommendation: Remind the driver that the extra weight impacts range and to drive smoothly.
      - Justification: Increased weight requires more energy to move the vehicle.

  Be encouraging and focus on one key point. Do not overwhelm the user.
`,
});

const adaptiveDrivingRecommendationsFlow = ai.defineFlow(
  {
    name: 'adaptiveDrivingRecommendationsFlow',
    inputSchema: DrivingRecommendationInputSchema,
    outputSchema: DrivingRecommendationOutputSchema,
  },
  async input => {
    const {output} = await adaptiveDrivingRecommendationsPrompt(input);
    return output!;
  }
);

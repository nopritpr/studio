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

const DrivingRecommendationInputSchema = z.object({
  drivingStyle: z
    .string()
    .describe("The user's current driving style (e.g., Eco, Balanced, Aggressive)."),
  predictedRange: z.number().describe('The predicted driving range in kilometers.'),
  batterySOC: z.number().describe('The current battery state of charge (percentage).'),
  acUsage: z.boolean().describe('Whether the A/C is currently in use.'),
  driveMode: z.string().describe('The current drive mode (e.g., Eco, City, Sports).'),
  outsideTemperature: z.number().describe('The current outside temperature in Celsius.'),
});
export type DrivingRecommendationInput = z.infer<typeof DrivingRecommendationInputSchema>;

const DrivingRecommendationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe(
      'A specific recommendation to improve energy efficiency and extend driving range.'
    ),
  justification: z
    .string()
    .describe(
      'Explanation of why the recommendation is being made, based on the input parameters.'
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
  model: 'googleai/gemini-1.5-pro-latest',
  input: {schema: DrivingRecommendationInputSchema},
  output: {schema: DrivingRecommendationOutputSchema},
  prompt: `You are an AI assistant that provides adaptive driving recommendations to electric vehicle (EV) drivers to improve energy efficiency and extend driving range.

  Based on the following information about the driver and their current driving conditions, provide a single, clear and actionable recommendation, as well as a justification for that recommendation. Keep the recommendation concise, 1-2 sentences maximum. Assume the user wants to maximize efficiency and range. The recommendation should be something the driver can do immediately.

  Driving Style: {{drivingStyle}}
  Predicted Range: {{predictedRange}} km
  Battery State of Charge: {{batterySOC}}%
  A/C Usage: {{#if acUsage}}On{{else}}Off{{/if}}
  Drive Mode: {{driveMode}}
  Outside Temperature: {{outsideTemperature}}°C

  Consider these factors when formulating your recommendation:

  *   **Driving Style:**  Eco-friendly drivers may need different advice than aggressive drivers.
  *   **Predicted Range:**  If the range is low, focus on maximizing efficiency.  If range is high, suggest maintaining good habits.
  *   **Battery SOC:**  Low SOC requires more aggressive efficiency measures.
  *   **A/C Usage:**  A/C consumes a significant amount of energy, especially in hot weather.
  *   **Drive Mode:**  Suggest switching to a more efficient mode if appropriate.
  *   **Outside Temperature:** Extreme temperatures affect battery performance.
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

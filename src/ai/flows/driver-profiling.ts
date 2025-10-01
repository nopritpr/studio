'use server';

/**
 * @fileOverview An AI agent that profiles a driver's driving style and provides recommendations.
 *
 * - analyzeDrivingStyle - A function that analyzes the driving style and provides a profile.
 * - AnalyzeDrivingStyleInput - The input type for the analyzeDrivingStyle function.
 * - AnalyzeDrivingStyleOutput - The return type for the analyzeDrivingStyle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDrivingStyleInputSchema = z.object({
  speedHistory: z.array(z.number()).describe('The history of the driver speed in km/h.'),
  accelerationHistory: z.array(z.number()).describe('The history of the driver acceleration in m/s^2.'),
  driveModeHistory: z.array(z.string()).describe('The history of the drive modes used.'),
  ecoScore: z.number().describe('The current eco score of the driver.'),
});
export type AnalyzeDrivingStyleInput = z.infer<typeof AnalyzeDrivingStyleInputSchema>;

const AnalyzeDrivingStyleOutputSchema = z.object({
  drivingStyle: z.string().describe('A description of the drivers driving style.'),
  recommendations: z.array(z.string()).describe('A list of recommendations for the driver to improve their driving.'),
});
export type AnalyzeDrivingStyleOutput = z.infer<typeof AnalyzeDrivingStyleOutputSchema>;

export async function analyzeDrivingStyle(input: AnalyzeDrivingStyleInput): Promise<AnalyzeDrivingStyleOutput> {
  return analyzeDrivingStyleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDrivingStylePrompt',
  model: 'googleai/gemini-pro',
  input: {schema: AnalyzeDrivingStyleInputSchema},
  output: {schema: AnalyzeDrivingStyleOutputSchema},
  prompt: `You are an expert driving coach who analyzes driving data and provides personalized recommendations to improve driving safety and efficiency.

Analyze the following driving data to determine the driver's driving style and provide 3-5 actionable recommendations to improve their driving habits:

Speed History: {{{speedHistory}}}
Acceleration History: {{{accelerationHistory}}}
Drive Mode History: {{{driveModeHistory}}}
Eco Score: {{{ecoScore}}}

Based on this data, create a short profile describing the driver's style, and provide 3-5 actionable recommendations to improve their driving habits.`,
});

const analyzeDrivingStyleFlow = ai.defineFlow(
  {
    name: 'analyzeDrivingStyleFlow',
    inputSchema: AnalyzeDrivingStyleInputSchema,
    outputSchema: AnalyzeDrivingStyleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

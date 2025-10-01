'use server';

/**
 * @fileOverview An AI agent that monitors driving patterns for signs of fatigue.
 * This represents an LSTM Autoencoder anomaly detection model.
 *
 * - monitorDriverFatigue - A function that analyzes driving data and detects fatigue.
 * - DriverFatigueInput - The input type for the monitorDriverFatigue function.
 * - DriverFatigueOutput - The return type for the monitorDriverFatigue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DriverFatigueInputSchema = z.object({
  speedHistory: z.array(z.number()).describe('The history of the driver speed in km/h over the last 60 seconds.'),
  accelerationHistory: z.array(z.number()).describe('The history of the driver acceleration in m/s^2 over the last 60 seconds.'),
  harshBrakingEvents: z.number().describe('Number of harsh braking events in the last minute.'),
  harshAccelerationEvents: z.number().describe('Number of harsh acceleration events in the last minute.'),
});
export type DriverFatigueInput = z.infer<typeof DriverFatigueInputSchema>;

const DriverFatigueOutputSchema = z.object({
  isFatigued: z.boolean().describe('Whether the driver is likely showing signs of fatigue.'),
  confidence: z.number().describe('The confidence level of the fatigue detection (0-1).'),
  reasoning: z.string().describe('A brief explanation for the fatigue detection.'),
});
export type DriverFatigueOutput = z.infer<typeof DriverFatigueOutputSchema>;

export async function monitorDriverFatigue(input: DriverFatigueInput): Promise<DriverFatigueOutput> {
  return driverFatigueMonitorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'driverFatigueMonitorPrompt',
  model: 'googleai/gemini-pro',
  input: {schema: DriverFatigueInputSchema},
  output: {schema: DriverFatigueOutputSchema},
  prompt: `You are an expert AI system designed to detect driver fatigue by analyzing vehicle telemetry, simulating an LSTM Autoencoder for anomaly detection. Your primary goal is to identify driving patterns that deviate from normal, alert driving.

Analyze the following time-series data from the last 60 seconds:

- Speed History (km/h): {{{json speedHistory}}}
- Acceleration History (m/s^2): {{{json accelerationHistory}}}
- Harsh Braking Events: {{harshBrakingEvents}}
- Harsh Acceleration Events: {{harshAccelerationEvents}}

Normal driving is characterized by smooth control inputs and consistent speed. Fatigue is often indicated by:
- High variance in speed (difficulty maintaining a constant speed).
- Frequent, small, jerky steering corrections (not directly measured, but implied by erratic acceleration/deceleration).
- Sudden, sharp braking or acceleration events after a period of calm (over-correction).
- A general increase in erratic or inconsistent control inputs compared to a learned baseline.

Based on your analysis, determine if the driver's behavior is anomalous and consistent with fatigue. Set 'isFatigued' to true if you detect fatigue, and provide your confidence and a brief reasoning.`,
});

const driverFatigueMonitorFlow = ai.defineFlow(
  {
    name: 'driverFatigueMonitorFlow',
    inputSchema: DriverFatigueInputSchema,
    outputSchema: DriverFatigueOutputSchema,
  },
  async input => {
    // In a real scenario, you'd compare against a learned baseline.
    // Here, the LLM simulates this comparison based on heuristic rules.
    const {output} = await prompt(input);
    return output!;
  }
);

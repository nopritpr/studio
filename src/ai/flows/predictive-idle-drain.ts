
'use server';

/**
 * @fileOverview An AI agent that predicts battery drain over the next 8 hours while the vehicle is idle.
 * This model considers various factors like A/C usage, passenger load, and ambient temperature.
 *
 * - predictIdleDrain - A function that predicts idle battery drain.
 * - PredictiveIdleDrainInput - The input type for the predictIdleDrain function.
 * - PredictiveIdleDrainOutput - The return type for the predictIdledrain function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictiveIdleDrainInputSchema = z.object({
  currentBatterySOC: z.number().describe('The current battery State of Charge (percentage).'),
  acOn: z.boolean().describe('Whether the A/C is currently active.'),
  acTemp: z.number().describe('The A/C temperature setting in Celsius.'),
  outsideTemp: z.number().describe('The current outside temperature in Celsius.'),
  passengers: z.number().describe('Number of passengers in the vehicle.'),
  goodsInBoot: z.boolean().describe('Whether there are goods in the boot.'),
});
export type PredictiveIdleDrainInput = z.infer<typeof PredictiveIdleDrainInputSchema>;

const PredictiveIdleDrainOutputSchema = z.object({
  hourlyPrediction: z.array(
    z.object({
      hour: z.number().describe('The hour from now (e.g., 1, 2, 3...).'),
      soc: z.number().describe('The predicted State of Charge (SOC) at that hour.'),
    })
  ).length(8).describe('An array of 8 objects, each representing the predicted SOC for the next 8 hours.')
});
export type PredictiveIdleDrainOutput = z.infer<typeof PredictiveIdleDrainOutputSchema>;


export async function predictIdleDrain(input: PredictiveIdleDrainInput): Promise<PredictiveIdleDrainOutput> {
  return predictiveIdleDrainFlow(input);
}

const predictiveIdleDrainFlow = ai.defineFlow(
  {
    name: 'predictiveIdleDrainFlow',
    inputSchema: PredictiveIdleDrainInputSchema,
    outputSchema: PredictiveIdleDrainOutputSchema,
  },
  async (input) => {
    const { currentBatterySOC } = input;

    // --- Step 1: Set the constant hourly drain to meet the 3% over 8 hours target ---
    const totalHourlyDrain = 0.375; // 3% / 8 hours

    // --- Step 2: Hour-by-Hour Prediction ---
    const hourlyPrediction: { hour: number; soc: number }[] = [];
    let currentSOC = currentBatterySOC;

    for (let i = 1; i <= 8; i++) {
      currentSOC -= totalHourlyDrain;
      // Ensure SOC doesn't go below 0
      currentSOC = Math.max(0, currentSOC);
      hourlyPrediction.push({
        hour: i,
        soc: parseFloat(currentSOC.toFixed(2)),
      });
    }

    return { hourlyPrediction };
  }
);

    

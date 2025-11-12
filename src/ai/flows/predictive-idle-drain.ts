
'use server';

/**
 * @fileOverview An AI agent that predicts battery drain over the next 8 hours while the vehicle is idle.
 * This model considers various factors like A/C usage, passenger load, and ambient temperature.
 *
 * - predictIdleDrain - A function that predicts idle battery drain.
 * - PredictiveIdleDrainInput - The input type for the predictIdleDrain function.
 * - PredictiveIdleDrainOutput - The return type for the predictIdleDrain function.
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
    const { currentBatterySOC, acOn, acTemp, outsideTemp } = input;

    // --- Step 1: Calculate Hourly Drain Components based on the correct formula ---

    // Base_Drain = 0.8% per hour
    const baseDrain = 0.8;

    // AC_Drain = Duty_Cycle × 2.1% per hour
    let acDrain = 0;
    if (acOn) {
      // Duty_Cycle = min(1.0, |T_outside - T_target| / 10.0)
      const dutyCycle = Math.min(1.0, Math.abs(outsideTemp - acTemp) / 10.0);
      acDrain = dutyCycle * 2.1;
    }

    // Temp_Penalty: Creates a linear penalty for temperatures above 25°C.
    // Example: At 30°C, penalty is (30-25)*0.06 = 0.3%. At 35°C, penalty is (35-25)*0.06 = 0.6%
    const tempPenalty = outsideTemp > 25 ? (outsideTemp - 25) * 0.06 : 0;

    // Total_Hourly_Drain
    const totalHourlyDrain = baseDrain + acDrain + tempPenalty;

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

    


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
import { googleAI } from '@genkit-ai/google-genai';

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

const predictiveIdleDrainPrompt = ai.definePrompt({
  name: 'predictiveIdleDrainPrompt',
  input: {schema: PredictiveIdleDrainInputSchema},
  output: {schema: PredictiveIdleDrainOutputSchema},
  config: {
    model: googleAI.model('gemini-pro'),
  },
  prompt: `You are an expert Electric Vehicle energy consumption model. Your task is to predict the battery State of Charge (SOC) over the next 8 hours, assuming the vehicle remains idle.

You must account for the following factors:
1.  **Base Phantom Drain**: The vehicle has a constant base phantom drain of 0.25% per hour for its essential systems (BMS, connectivity).
2.  **Climate Control**: If the A/C is on, the climate system works to maintain the A/C temperature setting. Its power consumption depends on the temperature difference between the outside and the A/C setting. The power draw is 1.5 kW. The system's duty cycle (how often it runs) is proportional to the temperature difference. For every 1 degree of difference, the duty cycle increases by 10% (up to 100%). For example, if it's 30°C outside and the A/C is set to 20°C, the difference is 10°C, so the system will run 100% of the time. This applies whether heating or cooling. If A/C is off, this drain is 0.
3.  **Battery Capacity**: The vehicle has a 75 kWh battery pack.

Current Vehicle & Environmental Data:
- Starting SOC: {{currentBatterySOC}}%
- A/C Status: {{#if acOn}}On ({{acTemp}}°C){{else}}Off{{/if}}
- Outside Temperature: {{outsideTemp}}°C
- Passengers: {{passengers}}
- Goods in Boot: {{goodsInBoot}}

The number of passengers and goods in the boot do not affect idle drain, as they only add mass which is irrelevant when stationary.

Calculate the total hourly SOC drop based on these factors and provide a list of the predicted SOC for each of the next 8 hours. The result must be an array of 8 hourly predictions.

Example Calculation for one hour:
- Base drain: 0.25%
- Climate Control drain: If A/C is on, calculate its duty cycle. Duty Cycle = min(1, abs(outsideTemp - acTemp) / 10). A/C power is 1.5 kW. The percentage drop per hour is (1.5 * Duty Cycle) / 75 * 100.
- Total hourly drop = Base drain + Climate Control drain.

For each hour from 1 to 8, calculate the new SOC by subtracting the total hourly drop from the previous hour's SOC. The starting SOC is the 'currentBatterySOC'.

Return the result as a JSON object with the 'hourlyPrediction' key, containing an array of 8 objects, each with 'hour' and 'soc'. The SOC value should have at most one decimal place. Do not add any commentary or explanations, just the JSON object.`,
});

const predictiveIdleDrainFlow = ai.defineFlow(
  {
    name: 'predictiveIdleDrainFlow',
    inputSchema: PredictiveIdleDrainInputSchema,
    outputSchema: PredictiveIdleDrainOutputSchema,
  },
  async input => {
    const {output} = await predictiveIdleDrainPrompt(input);
    return output!;
  }
);

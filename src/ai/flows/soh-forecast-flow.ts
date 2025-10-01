'use server';
/**
 * @fileOverview This file defines a Genkit flow for forecasting battery State of Health (SOH).
 *
 * The flow takes historical battery data and uses a machine learning model
 * to predict future SOH, allowing users to plan for battery end-of-life or replacement.
 *
 * - `forecastSoh` - The main function to trigger the SOH forecast.
 * - `SohForecastInput` - The input type for the `forecastSoh` function.
 * - `SohForecastOutput` - The output type for the `forecastSoh` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SohForecastInputSchema = z.object({
  historicalData: z.array(
    z.object({
      odometer: z.number().describe('Odometer reading in kilometers.'),
      cycleCount: z.number().describe('Number of charge cycles.'),
      avgBatteryTemp: z.number().describe('Average battery temperature in Celsius.'),
      ecoPercent: z
        .number()
        .describe('Percentage of driving in Eco mode (0-100).'),
      cityPercent: z
        .number()
        .describe('Percentage of driving in City mode (0-100).'),
      sportsPercent: z
        .number()
        .describe('Percentage of driving in Sports mode (0-100).'),
    })
  ).min(1).describe('Historical battery data for SOH forecasting.'),
});
export type SohForecastInput = z.infer<typeof SohForecastInputSchema>;

const SohForecastOutputSchema = z.array(
  z.object({
    odometer: z.number().describe('Odometer reading in kilometers.'),
    soh: z.number().describe('Predicted State of Health (SOH) percentage.'),
  })
).describe('Forecasted SOH values for future odometer readings.');
export type SohForecastOutput = z.infer<typeof SohForecastOutputSchema>;


export async function forecastSoh(input: SohForecastInput): Promise<SohForecastOutput> {
  return sohForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'sohForecastPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: SohForecastInputSchema},
  output: {schema: SohForecastOutputSchema},
  prompt: `You are a battery health forecasting expert. Given the historical driving data, predict the future State of Health (SOH) of the battery at different odometer readings.

Historical Data:
{{#each historicalData}}
  - Odometer: {{odometer}} km, Cycle Count: {{cycleCount}}, Avg. Temp: {{avgBatteryTemp}} °C, Eco: {{ecoPercent}}%, City: {{cityPercent}}%, Sports: {{sportsPercent}}%
{{/each}}

Based on this data, project the SOH decline. Assume a linear degradation based on odometer reading and cycle count as primary factors. High temperatures can accelerate degradation.

Provide the SOH forecast for the next 10 odometer readings, starting from the last odometer reading in the historical data and incrementing by 20,000 kilometers each time. The first value should be the predicted SOH at the next 20,000 km interval.

Ensure the output is a JSON array of objects, each containing the 'odometer' reading and the predicted 'soh' percentage.
`,
});

const sohForecastFlow = ai.defineFlow(
  {
    name: 'sohForecastFlow',
    inputSchema: SohForecastInputSchema,
    outputSchema: SohForecastOutputSchema,
  },
  async input => {
    // Ensure there's enough data to create a meaningful forecast.
    if (input.historicalData.length < 1) {
      return [];
    }
    const {output} = await prompt(input);
    return output!;
  }
);

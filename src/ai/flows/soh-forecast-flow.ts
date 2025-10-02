
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
      soh: z.number().optional().describe('The measured State of Health at this point.'),
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
  input: {schema: SohForecastInputSchema},
  output: {schema: SohForecastOutputSchema},
  config: {
    model: 'gemini-pro',
  },
  prompt: `You are a battery health forecasting expert. Given the historical driving and battery health data for an EV, predict the future State of Health (SOH) of the battery at different future odometer readings.

Historical Data:
The following data represents the battery's SOH at various points in its life.
{{#each historicalData}}
  - Odometer: {{odometer}} km, Cycle Count: {{cycleCount}}, Avg. Temp: {{avgBatteryTemp}}°C, SOH: {{soh}}%
{{/each}}

Based on this data, project the SOH decline. The primary factors for degradation are odometer reading and cycle count. Higher average temperatures can accelerate degradation. The relationship is generally non-linear, with a faster decline initially, which then becomes more gradual.

The last data point represents the current state of the vehicle.
Provide a forecast for the SOH at the next 20,000 km, 40,000 km, and 60,000 km from the current odometer reading.

Ensure the output is a JSON array of objects, each containing the 'odometer' reading and the predicted 'soh' percentage for those three future milestones.
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
    if (input.historicalData.length < 2) {
      return [];
    }
    const {output} = await prompt(input);
    
    if (!output) {
        return [];
    }

    // Combine historical and forecasted data
    const combinedData = [
        ...input.historicalData.filter(d => d.soh !== undefined), // only include historical data with SOH
        ...output
    ].map(item => ({ odometer: item.odometer, soh: item.soh! }));


    // Create a new array with unique odometer readings, preferring forecasted values for overlaps
    const dataMap = new Map<number, { odometer: number; soh: number }>();
    combinedData.forEach(item => {
        dataMap.set(item.odometer, item);
    });

    const uniqueData = Array.from(dataMap.values());

    // Sort by odometer
    uniqueData.sort((a, b) => a.odometer - b.odometer);
    
    return uniqueData;
  }
);

    

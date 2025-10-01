'use server';

/**
 * @fileOverview Estimates the remaining range of an EV based on driving style, climate control settings, and weather data.
 *
 * - predictRange - A function that takes driving behavior, climate control settings, and weather data as input, and estimates the remaining range.
 * - PredictiveRangeInput - The input type for the predictRange function.
 * - PredictiveRangeOutput - The return type for the predictRange function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PredictiveRangeInputSchema = z.object({
  drivingStyle: z.string().describe('The current driving style (e.g., Aggressive, Balanced, Eco).'),
  climateControlSettings: z.object({
    acUsage: z.number().describe('AC usage percentage (0-100).'),
    temperatureSetting: z.number().describe('The cabin temperature setting in Celsius.'),
  }),
  weatherData: z.object({
    temperature: z.number().describe('Outside temperature in Celsius.'),
    precipitation: z.string().describe('Current precipitation (e.g., none, rain, snow).'),
    windSpeed: z.number().describe('Wind speed in km/h.'),
  }),
  historicalData: z.array(z.object({
    speed: z.number(),
    powerConsumption: z.number(),
  })).describe('Recent historical driving data.'),
  batteryCapacity: z.number().describe('Total battery capacity in kWh.'),
  currentBatteryLevel: z.number().describe('Current battery level as a percentage (0-100).'),
});
export type PredictiveRangeInput = z.infer<typeof PredictiveRangeInputSchema>;

const PredictiveRangeOutputSchema = z.object({
  estimatedRange: z.number().describe('The estimated remaining range in kilometers.'),
  confidence: z.string().describe('Confidence level of the estimation (e.g., High, Medium, Low).'),
});
export type PredictiveRangeOutput = z.infer<typeof PredictiveRangeOutputSchema>;

export async function predictRange(input: PredictiveRangeInput): Promise<PredictiveRangeOutput> {
  return predictRangeFlow(input);
}

const predictRangePrompt = ai.definePrompt({
  name: 'predictRangePrompt',
  model: 'googleai/gemini-1.5-pro-latest',
  input: { schema: PredictiveRangeInputSchema },
  output: { schema: PredictiveRangeOutputSchema },
  prompt: `You are an EV range estimation expert. Based on the provided data, estimate the remaining range.

  Current State:
  - Driving Style: {{drivingStyle}}
  - Battery: {{currentBatteryLevel}}% of {{batteryCapacity}} kWh
  - AC Usage: {{climateControlSettings.acUsage}}% at {{climateControlSettings.temperatureSetting}}°C

  Environmental Conditions:
  - Outside Temp: {{weatherData.temperature}}°C
  - Weather: {{weatherData.precipitation}}
  - Wind: {{weatherData.windSpeed}} km/h

  Consider the impact of driving style, A/C usage (especially the difference between inside and outside temp), and weather on energy consumption. Agressive driving and heavy A/C use in extreme temperatures reduce range. Provide a realistic range estimate.`,
});

const predictRangeFlow = ai.defineFlow(
  {
    name: 'predictRangeFlow',
    inputSchema: PredictiveRangeInputSchema,
    outputSchema: PredictiveRangeOutputSchema,
  },
  async (input) => {
    const { output } = await predictRangePrompt(input);
    return output!;
  }
);

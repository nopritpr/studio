'use server';

/**
 * @fileOverview Estimates the remaining range of an EV based on driving style, climate control settings, and weather data.
 *
 * - predictRange - A function that takes driving behavior, climate control settings, and weather data as input, and estimates the remaining range.
 * - PredictiveRangeInput - The input type for the predictRange function
 * - PredictiveRangeOutput - The return type for the predictRange function
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictiveRangeInputSchema = z.object({
  drivingStyle: z
    .string()
    .describe(
      "The user's current driving style (e.g., Eco, Balanced, Aggressive)."
    ),
  climateControlSettings: z.object({
    acUsage: z.number().describe('A/C usage percentage (0-100).'),
    temperatureSetting: z.number().describe('Cabin temperature setting in Celsius.'),
  }),
  weatherData: z.object({
    temperature: z.number().describe('Outside temperature in Celsius.'),
    precipitation: z.string().describe('Type of precipitation (e.g., none, rain, snow).'),
    windSpeed: z.number().describe('Wind speed in km/h.'),
  }),
  historicalData: z.array(
    z.object({
      speed: z.number().describe('Vehicle speed in km/h.'),
      powerConsumption: z.number().describe('Power consumption in kW.'),
    })
  ).optional().describe('Historical speed and power consumption data.'),
  batteryCapacity: z.number().describe('Total battery capacity in kWh.'),
  currentBatteryLevel: z.number().describe('Current battery level in percentage.'),
});
export type PredictiveRangeInput = z.infer<typeof PredictiveRangeInputSchema>;


const PredictiveRangeOutputSchema = z.object({
  estimatedRange: z.number().describe('The estimated remaining range in kilometers.'),
  confidence: z.number().describe('Confidence level of the estimation (0-1).'),
});
export type PredictiveRangeOutput = z.infer<typeof PredictiveRangeOutputSchema>;


export async function predictRange(input: PredictiveRangeInput): Promise<PredictiveRangeOutput> {
  return predictiveRangeFlow(input);
}


const prompt = ai.definePrompt({
  name: 'predictiveRangePrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: PredictiveRangeInputSchema},
  output: {schema: PredictiveRangeOutputSchema},
  prompt: `You are an expert AI system that predicts the remaining range of an electric vehicle based on various factors. Your goal is to provide a more accurate range estimation than the standard one.

Analyze the following data:

- Driving Style: {{drivingStyle}}
- Climate Control: {{climateControlSettings.acUsage}}% AC, {{climateControlSettings.temperatureSetting}}°C
- Weather: {{weatherData.temperature}}°C, {{weatherData.precipitation}}, {{weatherData.windSpeed}} km/h wind
- Battery: {{currentBatteryLevel}}% of {{batteryCapacity}} kWh

Consider how these factors influence energy consumption:
- Aggressive driving significantly reduces range.
- High A/C usage, especially with large temperature differences, consumes more energy.
- Cold weather reduces battery efficiency.
- Headwinds and rain/snow increase energy consumption.

Based on your analysis, provide a realistic estimated range and a confidence score for your prediction.`,
});

const predictiveRangeFlow = ai.defineFlow(
  {
    name: 'predictiveRangeFlow',
    inputSchema: PredictiveRangeInputSchema,
    outputSchema: PredictiveRangeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

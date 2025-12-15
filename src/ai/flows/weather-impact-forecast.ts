
'use server';

/**
 * @fileOverview An AI agent that forecasts the impact of weather on EV range over 5 days.
 *
 * - getWeatherImpact - A function that returns the predicted range impact.
 */

import {ai} from '@/ai/genkit';
import { format } from 'date-fns';
import { GetWeatherImpactInputSchema, GetWeatherImpactOutputSchema, type GetWeatherImpactInput } from '@/lib/types';


export async function getWeatherImpact(input: GetWeatherImpactInput): Promise<import('@/lib/types').GetWeatherImpactOutput> {
  return weatherImpactFlow(input);
}

const weatherImpactPrompt = ai.definePrompt({
  name: 'weatherImpactPrompt',
  input: {schema: GetWeatherImpactInputSchema},
  output: {schema: GetWeatherImpactOutputSchema},
  config: {
    model: 'gemini-pro',
  },
  prompt: `You are an expert Electric Vehicle energy consumption model. Your task is to predict the daily range penalty in kilometers for the next 5 days based on the provided weather forecast.

The vehicle has an ideal range of {{initialRange}} km.

For each of the 5 days in the forecast, calculate the range penalty based on these factors:
1.  **Temperature Penalty**: The ideal temperature is 22°C. For every degree Celsius below 10°C or above 30°C, apply a 0.5% range penalty. Between 10°C and 20°C, and 25°C and 30°C, apply a 0.2% penalty per degree difference from 22°C.
2.  **Precipitation Penalty**: 'Rain' adds a 5% range penalty. 'Snow' adds a 15% range penalty.
3.  **Wind Penalty**: For every 10 km/h of wind speed, add a 2% range penalty.

Combine these penalties additively for each day. The 'rangePenaltyKm' should be this total percentage applied to the 'initialRange', expressed as a negative number.

Provide a brief 'reason' for each day's penalty, summarizing the main contributing factors (e.g., "Cold and windy," "Heavy rain," "Hot temperatures").

The 'day' field should be the day of the week, starting from tomorrow.

Current Date for reference: ${format(new Date(), 'EEEE, MMMM do, yyyy')}
Current SOC: {{currentSOC}}%
Ideal Full Range: {{initialRange}} km

Forecast Data:
{{#each forecast}}
- Day {{@index}}: Temp: {{temp}}°C, Precip: {{precipitation}}, Wind: {{windSpeed}} km/h
{{/each}}

Return ONLY the final JSON object with the 'dailyImpacts' key, containing an array of 5 objects.`,
});

const weatherImpactFlow = ai.defineFlow(
  {
    name: 'weatherImpactFlow',
    inputSchema: GetWeatherImpactInputSchema,
    outputSchema: GetWeatherImpactOutputSchema,
  },
  async (input) => {
    const { output } = await weatherImpactPrompt(input);
    return output!;
  }
);

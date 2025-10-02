
'use server';

/**
 * @fileOverview Predicts the impact of A/C usage on driving range.
 *
 * - getAcUsageImpact - A function that returns the predicted range impact of A/C usage.
 * - AcUsageImpactInput - The input type for the getAcUsageImpact function.
 * - AcUsageImpactOutput - The return type for the getAcUsageImpact function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AcUsageImpactInputSchema = z.object({
  acOn: z.boolean().describe('Whether the A/C is currently active.'),
  acTemp: z.number().describe('The A/C temperature setting in Celsius.'),
  outsideTemp: z.number().describe('The current outside temperature in Celsius.'),
  recentWhPerKm: z.number().describe('The recent average energy consumption in Watt-hours per kilometer.'),
});
export type AcUsageImpactInput = z.infer<typeof AcUsageImpactInputSchema>;

const AcUsageImpactOutputSchema = z.object({
  rangeImpactKm: z.number().describe('The predicted range change in kilometers over the next hour. Positive if range is gained (e.g., by turning A/C off), negative if lost (e.g., by turning A/C on).'),
  recommendation: z.string().describe('A brief recommendation based on the A/C impact.'),
});
export type AcUsageImpactOutput = z.infer<typeof AcUsageImpactOutputSchema>;

export async function getAcUsageImpact(input: AcUsageImpactInput): Promise<AcUsageImpactOutput> {
  return acUsageImpactFlow(input);
}

const acUsageImpactPrompt = ai.definePrompt({
  name: 'acUsageImpactPrompt',
  input: {schema: AcUsageImpactInputSchema},
  output: {schema: AcUsageImpactOutputSchema},
  config: {
    model: googleAI.model('gemini-pro'),
  },
  prompt: `You are an EV energy regression model. Your task is to calculate the range impact of the A/C over the next hour.

Current Vehicle & Environmental Data:
- A/C Status: {{#if acOn}}On ({{acTemp}}°C){{else}}Off{{/if}}
- Outside Temperature: {{outsideTemp}}°C
- Recent Efficiency: {{recentWhPerKm}} Wh/km

Follow these steps:
1.  **Calculate A/C Power Draw**:
    - The A/C consumes 1.5 kW (1500 Watts) of power when running.
    - Its duty cycle (how often it runs) depends on the temperature difference. Duty Cycle = min(1.0, abs(outsideTemp - acTemp) / 10.0).
    - Power Draw (Watts) = 1500 * Duty Cycle.

2.  **Calculate Energy Cost over One Hour**:
    - Energy (Wh) = Power Draw (Watts) * 1 hour.

3.  **Calculate Range Impact**:
    - Range Impact (km) = Energy (Wh) / Recent Efficiency (Wh/km).

4.  **Determine Output**:
    - If the A/C is ON, the 'rangeImpactKm' is the calculated range impact, but negative, because range is being lost. The recommendation should suggest turning it off to save range.
    - If the A/C is OFF, the 'rangeImpactKm' is the calculated range impact (a positive number), representing the range that would be lost if it were turned on. The recommendation should state the potential range loss.

Let's do a step-by-step calculation:
- Duty Cycle = min(1.0, abs({{outsideTemp}} - {{acTemp}}) / 10.0)
- Power Draw = 1500 * Duty Cycle
- Energy Cost (1 hour) = Power Draw
- Range Impact = Energy Cost / {{recentWhPerKm}}

Based on the A/C status ('{{acOn}}'), set the final 'rangeImpactKm' and 'recommendation'. Return ONLY the JSON object.`,
});

const acUsageImpactFlow = ai.defineFlow(
  {
    name: 'acUsageImpactFlow',
    inputSchema: AcUsageImpactInputSchema,
    outputSchema: AcUsageImpactOutputSchema,
  },
  async input => {
    const {output} = await acUsageImpactPrompt(input);
    return output!;
  }
);

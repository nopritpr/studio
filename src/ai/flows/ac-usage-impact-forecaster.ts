
'use server';

/**
 * @fileOverview Predicts the impact of A/C usage on driving range using a regression model.
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
  rangeImpactKm: z.number().describe('The predicted range change in kilometers over the next hour, based on a regression model. Positive if range is gained (e.g., by turning A/C off), negative if lost (e.g., by turning A/C on).'),
  recommendation: z.string().describe('A brief, actionable recommendation based on the A/C impact.'),
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
  prompt: `You are an EV energy regression model. Your task is to calculate the range impact of the A/C over the next hour using a specific regression formula.

Current Vehicle & Environmental Data:
- A/C Status: {{#if acOn}}On ({{acTemp}}°C){{else}}Off{{/if}}
- Outside Temperature: {{outsideTemp}}°C
- Recent Efficiency: {{recentWhPerKm}} Wh/km

Regression Model:
Range_Impact = β₀ + β₁×Temp_Diff + β₂×AC_Power + β₃×Efficiency

Coefficients:
β₀ = -2.5 (base intercept)
β₁ = 2.1 (temperature difference coefficient)
β₂ = 5.8 (power consumption coefficient)
β₃ = -0.03 (efficiency coefficient)

Follow these steps precisely:
1.  **Calculate Temperature Differential (Temp_Diff)**:
    - Temp_Diff = abs(outsideTemp - acTemp)

2.  **Calculate A/C Power Consumption (AC_Power)**:
    - The maximum A/C power is 3 kW.
    - The A/C's duty cycle depends on the temperature difference.
    - Duty_Cycle = min(1.0, Temp_Diff / 10.0).
    - AC_Power (kW) = Duty_Cycle × 3.0 kW.

3.  **Apply the Regression Formula**:
    - Use the calculated Temp_Diff and AC_Power, and the provided Recent Efficiency.
    - Range_Impact = -2.5 + (2.1 * Temp_Diff) + (5.8 * AC_Power) + (-0.03 * recentWhPerKm)

4.  **Determine Final Output**:
    - If the A/C is ON ('{{acOn}}' is true), the 'rangeImpactKm' is the calculated Range_Impact, but as a negative number, because range is being lost. The recommendation should suggest an action to reduce this loss (e.g., increasing the target temperature).
    - If the A/C is OFF ('{{acOn}}' is false), the 'rangeImpactKm' is the calculated Range_Impact as a positive number, representing the range that would be lost if it were turned on. The recommendation should state this potential loss.
    - The final 'rangeImpactKm' value should be rounded to one decimal place.

Let's do a step-by-step calculation with the provided data:
- Temp_Diff = abs({{outsideTemp}} - {{acTemp}})
- Duty_Cycle = min(1.0, Temp_Diff / 10.0)
- AC_Power = Duty_Cycle * 3.0
- Calculated Range_Impact = -2.5 + (2.1 * Temp_Diff) + (5.8 * AC_Power) + (-0.03 * {{recentWhPerKm}})

Now, determine the final 'rangeImpactKm' and 'recommendation' based on the A/C status. Return ONLY the JSON object.`,
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

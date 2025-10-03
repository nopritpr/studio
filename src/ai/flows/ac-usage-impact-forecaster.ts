
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

const AcUsageImpactInputSchema = z.object({
  acOn: z.boolean().describe('Whether the A/C is currently active.'),
  acTemp: z.number().describe('The A/C temperature setting in Celsius.'),
  outsideTemp: z.number().describe('The current outside temperature in Celsius.'),
  recentWhPerKm: z.number().describe('The recent average energy consumption in Watt-hours per kilometer.'),
});
export type AcUsageImpactInput = z.infer<typeof AcUsageImpactInputSchema>;

const AcUsageImpactOutputSchema = z.object({
  rangeImpactKm: z.number().describe('The predicted range change in kilometers over the next hour. Positive if range is gained (e.g., by turning A/C off), negative if lost (e.g., by turning A/C on).'),
  recommendation: z.string().describe('A brief, actionable recommendation based on the A/C impact.'),
});
export type AcUsageImpactOutput = z.infer<typeof AcUsageImpactOutputSchema>;

export async function getAcUsageImpact(input: AcUsageImpactInput): Promise<AcUsageImpactOutput> {
  return acUsageImpactFlow(input);
}

// Define a new input schema for the recommendation prompt, which includes the calculated impact.
const RecommendationPromptInputSchema = AcUsageImpactInputSchema.extend({
    calculatedImpact: z.number()
});

const recommendationPrompt = ai.definePrompt({
  name: 'acUsageRecommendationPrompt',
  input: {schema: RecommendationPromptInputSchema},
  output: {schema: z.object({ recommendation: z.string() })},
  prompt: `You are an EV energy efficiency expert. Based on the calculated range impact of the A/C, provide a single, concise, and helpful recommendation.

Data:
- A/C Status: {{#if acOn}}On{{else}}Off{{/if}}
- A/C Temperature: {{acTemp}}°C
- Outside Temperature: {{outsideTemp}}°C
- Calculated Hourly Range Impact: {{calculatedImpact}} km

Example Recommendations:
- If impact is high and negative: "High A/C usage is significantly reducing your range. Consider increasing the temperature to 24°C to save approximately X km/hour."
- If impact is low: "Your A/C usage is efficient. No changes needed."
- If A/C is off: "Turning on the A/C now would reduce your range by approximately {{calculatedImpact}} km per hour."

Generate ONLY the JSON object with the 'recommendation' field.`,
});

const acUsageImpactFlow = ai.defineFlow(
  {
    name: 'acUsageImpactFlow',
    inputSchema: AcUsageImpactInputSchema,
    outputSchema: AcUsageImpactOutputSchema,
  },
  async (input) => {
    // Perform the regression calculation directly in TypeScript for reliability.
    const { acOn, acTemp, outsideTemp, recentWhPerKm } = input;

    // Regression Coefficients
    const b0 = -2.5; // intercept
    const b1 = 2.1;  // temperature coefficient
    const b2 = 5.8;  // power coefficient
    const b3 = -0.03; // efficiency coefficient
    const MAX_AC_POWER_KW = 3.0;

    // Step 1: Calculate Temperature Differential
    const tempDiff = Math.abs(outsideTemp - acTemp);

    // Step 2: Calculate A/C Power Consumption
    const dutyCycle = Math.min(1.0, tempDiff / 10.0);
    const acPower = dutyCycle * MAX_AC_POWER_KW;

    // Step 3: Apply the Regression Formula
    const calculatedImpact = b0 + (b1 * tempDiff) + (b2 * acPower) + (b3 * recentWhPerKm);

    // Step 4: Determine Final Output based on A/C status
    // If A/C is on, the impact is a loss (negative).
    // If A/C is off, we show the potential loss if it were turned on (so we still use the negative value for the recommendation context).
    const rangeImpactKm = acOn ? -Math.abs(calculatedImpact) : Math.abs(calculatedImpact);

    // Use the AI only to generate the human-friendly recommendation text.
    const { output } = await recommendationPrompt({
      ...input,
      calculatedImpact: -Math.abs(calculatedImpact), // Always pass the potential loss to the AI
    });

    const recommendation = output?.recommendation ?? "Adjust A/C for optimal range.";

    return {
      rangeImpactKm: parseFloat(rangeImpactKm.toFixed(1)),
      recommendation: recommendation,
    };
  }
);


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

const AcUsageImpactInputSchema = z.object({
  acOn: z.boolean().describe('Whether the A/C is currently active.'),
  acTemp: z.number().describe('The A/C temperature setting in Celsius.'),
  outsideTemp: z.number().describe('The current outside temperature in Celsius.'),
  recentEfficiency: z.number().describe('The recent average energy consumption in Watt-hours per kilometer.'),
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

const acUsageImpactFlow = ai.defineFlow(
  {
    name: 'acUsageImpactFlow',
    inputSchema: AcUsageImpactInputSchema,
    outputSchema: AcUsageImpactOutputSchema,
  },
  async (input) => {
    const { acOn, acTemp, outsideTemp, recentEfficiency } = input;

    // Use a fallback if efficiency is zero to prevent division by zero errors
    const vehicleEfficiencyWhPerKm = recentEfficiency > 0 ? recentEfficiency : 160; 
    
    // Constants
    const MAX_AC_POWER_KW = 1.5; // Max power draw for the A/C compressor
    const TEMP_DIFF_SCALING_FACTOR = 15.0; // Defines how aggressively the A/C works based on temp diff

    // Calculate Temperature Differential
    const tempDiff = Math.abs(outsideTemp - acTemp);

    // Calculate AC Duty Cycle and Power Consumption
    // Duty cycle represents what percentage of its max power the A/C is using.
    const dutyCycle = Math.min(1.0, tempDiff / TEMP_DIFF_SCALING_FACTOR);
    const acPowerKw = dutyCycle * MAX_AC_POWER_KW;

    // Calculate energy consumed by AC in one hour (Wh)
    const acEnergyWh = acPowerKw * 1000;

    // Calculate the range in km that could have been driven with that energy
    const potentialImpactKm = acEnergyWh / vehicleEfficiencyWhPerKm;

    // Determine final output based on A/C status
    const rangeImpactKm = acOn ? -Math.abs(potentialImpactKm) : 0;
    
    // Generate recommendation
    let recommendation: string;
    if (acOn) {
        if (potentialImpactKm > 10) {
            recommendation = `High A/C usage is reducing your range. Try increasing the temp to ${acTemp + 2}°C to gain ~${(potentialImpactKm * 0.3).toFixed(0)} km/hr.`;
        } else if (potentialImpactKm > 3) {
            recommendation = `A/C is moderately impacting your range. Adjusting the temperature can save energy.`;
        } else {
            recommendation = "Your A/C usage is very efficient. No changes needed.";
        }
    } else {
        if (potentialImpactKm > 5) {
            recommendation = `It's cool outside. Turning on the A/C now would reduce your range by ~${potentialImpactKm.toFixed(0)} km per hour.`;
        } else {
            recommendation = "Using the A/C now will have a minimal impact on your range.";
        }
    }

    return {
      rangeImpactKm: parseFloat(rangeImpactKm.toFixed(1)),
      recommendation: recommendation,
    };
  }
);

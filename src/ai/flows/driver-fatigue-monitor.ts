
'use server';

/**
 * @fileOverview An AI agent that monitors driving patterns for signs of fatigue.
 * This simulates an LSTM Autoencoder anomaly detection model by calculating specific metrics.
 *
 * - monitorDriverFatigue - A function that analyzes driving data and detects fatigue.
 * - DriverFatigueInput - The input type for the monitorDriverFatigue function.
 * - DriverFatigueOutput - The return type for the monitorDriverFatigue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DriverFatigueInputSchema = z.object({
  speedHistory: z.array(z.number()).describe('The history of the driver speed in km/h over the last 60 seconds.'),
  accelerationHistory: z.array(z.number()).describe('The history of the driver acceleration in m/s^2 over the last 60 seconds.'),
  harshBrakingEvents: z.number().optional().describe('Count of harsh braking events in the window.'),
});
export type DriverFatigueInput = z.infer<typeof DriverFatigueInputSchema>;

const DriverFatigueOutputSchema = z.object({
  isFatigued: z.boolean().describe('Whether the driver is likely showing signs of fatigue.'),
  confidence: z.number().describe('The confidence level of the fatigue detection (0-1).'),
  reasoning: z.string().describe('A brief explanation for the fatigue detection.'),
});
export type DriverFatigueOutput = z.infer<typeof DriverFatigueOutputSchema>;

export async function monitorDriverFatigue(input: DriverFatigueInput): Promise<DriverFatigueOutput> {
  return driverFatigueMonitorFlow(input);
}

const driverFatigueMonitorFlow = ai.defineFlow(
  {
    name: 'driverFatigueMonitorFlow',
    inputSchema: DriverFatigueInputSchema,
    outputSchema: DriverFatigueOutputSchema,
  },
  async (input) => {
    const { speedHistory, accelerationHistory } = input;
    
    if (speedHistory.length < 10 || accelerationHistory.length < 10) {
      return {
        isFatigued: false,
        confidence: 0,
        reasoning: "Not enough data to assess fatigue.",
      };
    }

    // --- Step 1: Calculate Speed Variance ---
    const meanSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
    const speedVariance = speedHistory.reduce((sum, speed) => sum + Math.pow(speed - meanSpeed, 2), 0) / speedHistory.length;

    // --- Step 2: Calculate Sharp Brake Frequency ---
    const sharpBrakes = accelerationHistory.filter(a => a < -3.0).length;
    
    // --- Step 3: Calculate Acceleration Inconsistency (Jerky driving) ---
    let accelChanges = 0;
    for (let i = 1; i < accelerationHistory.length; i++) {
        accelChanges += Math.abs(accelerationHistory[i] - accelerationHistory[i-1]);
    }
    const accelInconsistency = accelerationHistory.length > 1 ? accelChanges / (accelerationHistory.length - 1) : 0;
    
    // --- Step 4: Fatigue Score Calculation (Recalibrated for High Sensitivity) ---
    // These weights and intercept are tuned to be highly sensitive to deviations from normal driving.
    const B0 = -4.0;  // Intercept calibrated to keep score low during normal driving.
    const w_speed_var = 0.5;   // High sensitivity to speed variance
    const w_sharp_brake = 1.0;  // Very high penalty for each sharp brake event
    const w_accel_incon = 2.0;   // High sensitivity to jerky movements
    
    const anomalyScore = B0 + (w_speed_var * speedVariance) + (w_sharp_brake * sharpBrakes) + (w_accel_incon * accelInconsistency);
    
    // Sigmoid function to map the raw anomaly score to a probability-like value (0-1)
    const fatigueConfidence = 1 / (1 + Math.exp(-anomalyScore));
    
    // Step 5: Generate human-friendly reasoning text.
    let reasoning: string;
    let highConfidenceReasons = [];
    if (speedVariance > 15) highConfidenceReasons.push("highly variable speed");
    if (sharpBrakes > 1) highConfidenceReasons.push("frequent sharp braking");
    if (accelInconsistency > 1.5) highConfidenceReasons.push("jerky acceleration");

    if (fatigueConfidence > 0.8) {
        reasoning = `High fatigue risk detected due to ${highConfidenceReasons.join(', ')}. Recommend taking a break.`;
    } else if (fatigueConfidence > 0.5) {
        reasoning = `Signs of fatigue detected: ${highConfidenceReasons.join(', ')}.`;
    } else {
        reasoning = "Driving patterns appear normal and alert.";
    }

    // --- Step 6: Determine Final Output ---
    return {
      isFatigued: fatigueConfidence > 0.75, // Set a threshold for the warning
      confidence: parseFloat(fatigueConfidence.toFixed(3)),
      reasoning: reasoning,
    };
  }
);

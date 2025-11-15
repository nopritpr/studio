
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
    // A sharp brake is a significant negative acceleration.
    const sharpBrakes = accelerationHistory.filter(a => a < -3.0).length;
    const timeWindowInSeconds = accelerationHistory.length; // Assume 1 data point per second
    const brakeFrequency = sharpBrakes / timeWindowInSeconds; // Brakes per second

    // --- Step 3: Calculate Acceleration Inconsistency ---
    // This measures how "jerky" the driving is by summing the absolute change in acceleration.
    let accelChanges = 0;
    for (let i = 1; i < accelerationHistory.length; i++) {
        accelChanges += Math.abs(accelerationHistory[i] - accelerationHistory[i-1]);
    }
    const accelInconsistency = accelerationHistory.length > 1 ? accelChanges / (accelerationHistory.length - 1) : 0;
    
    // --- Step 4: Fatigue Confidence Calculation (Recalibrated) ---
    // These weights and intercept are tuned to be sensitive to the input metrics.
    const B0 = -2.0;  // Intercept calibrated for typical driving being low confidence.
    const w1 = 0.3;   // Weight for speed_variance
    const w2 = 30.0;  // High weight for brake_frequency
    const w3 = 1.5;   // Weight for accel_inconsistency
    
    // The Z-score is a linear combination of the weighted metrics.
    const z = B0 + (w1 * speedVariance) + (w2 * brakeFrequency) + (w3 * accelInconsistency);
    
    // Sigmoid function to map Z-score to a probability (0-1)
    const fatigueConfidence = 1 / (1 + Math.exp(-z));
    
    // Step 5: Generate human-friendly reasoning text based on confidence.
    let reasoning: string;
    if (fatigueConfidence > 0.75) {
        reasoning = `High variance in speed and inconsistent acceleration patterns detected, suggesting fatigue. Speed variance: ${speedVariance.toFixed(2)}, Brake Freq: ${brakeFrequency.toFixed(2)}`;
    } else if (fatigueConfidence > 0.4) {
        reasoning = `Slightly erratic speed control was detected, which can be an early sign of fatigue. Speed variance: ${speedVariance.toFixed(2)}`;
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

    
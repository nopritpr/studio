'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/adaptive-driving-recommendations.ts';
import '@/ai/flows/driver-profiling.ts';
import '@/ai/flows/predictive-range-estimation.ts';
import '@/ai/flows/predictive-idle-drain.ts';
import '@/ai/flows/driver-fatigue-monitor.ts';
import '@/ai/flows/ac-usage-impact-forecaster.ts';
import '@/ai/flows/weather-impact-forecast.ts';

    

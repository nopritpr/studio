
'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { VehicleState } from '@/lib/types';

interface DynamicRangeChartProps {
  state: VehicleState;
}

export default function DynamicRangeChart({ state }: DynamicRangeChartProps) {
    const idealRange = state.initialRange * (state.batterySOC / 100);
    const predictedRange = state.predictedDynamicRange;
    const totalPenalty = Math.max(0, idealRange - predictedRange);

    const weights = {
      ac: state.acOn ? 0.3 : 0,
      temp: Math.abs(22 - state.outsideTemp) > 5 ? 0.2 : 0,
      driveMode: state.driveMode === 'Sports' ? 0.4 : (state.driveMode === 'City' ? 0.2 : 0),
      load: (state.passengers > 1 || state.goodsInBoot) ? 0.1 : 0,
    };

    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    const acPenalty = totalWeight > 0 ? (weights.ac / totalWeight) * totalPenalty : 0;
    const tempPenalty = totalWeight > 0 ? (weights.temp / totalWeight) * totalPenalty : 0;
    const driveModePenalty = totalWeight > 0 ? (weights.driveMode / totalWeight) * totalPenalty : 0;
    const loadPenalty = totalWeight > 0 ? (weights.load / totalWeight) * totalPenalty : 0;
    
    // The data for the chart now correctly reflects the logic: Ideal - Penalties = Predicted
    const data = [
        { name: 'Ideal', value: idealRange, fill: 'hsl(var(--chart-2))' },
        { name: 'A/C', value: -acPenalty, fill: 'hsl(var(--chart-5))' },
        { name: 'Temp', value: -tempPenalty, fill: 'hsl(var(--chart-5))' },
        { name: 'Drive Mode', value: -driveModePenalty, fill: 'hsl(var(--chart-5))' },
        { name: 'Load', value: -loadPenalty, fill: 'hsl(var(--chart-5))' },
        { name: 'Predicted', value: predictedRange, fill: 'hsl(var(--primary))' },
    ];


  const chartConfig = {};

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 50 }}
        stackOffset="sign"
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tickMargin={5}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => [`${Math.round(value as number)} km`, name]}
            />
          }
        />
        <Bar dataKey="value" radius={5}>
            <LabelList
                dataKey="value"
                position="right"
                offset={8}
                formatter={(value: number, entry: any) => {
                  if (entry === undefined || value === null) {
                    return null;
                  }
                  
                  const numValue = Number(value);
                  const roundedValue = Math.round(numValue);

                  if (['A/C', 'Temp', 'Drive Mode', 'Load'].includes(entry.name)) {
                    // For penalties, show the label only if the penalty is significant enough to not be 0 when rounded.
                    // A small threshold like -0.5 ensures we don't show "0 km" for tiny penalties.
                    if (numValue > -0.5) {
                        return '';
                    }
                  }
                  
                  return `${roundedValue} km`;
                }}
                className="fill-foreground font-semibold text-xs"
            />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

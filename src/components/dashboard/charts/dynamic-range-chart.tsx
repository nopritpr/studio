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

    const acPenalty = state.acOn ? 15 : 0;
    const tempPenalty = Math.abs(22 - state.outsideTemp) > 8 ? 10 : 0;
    const driveModePenalty = state.driveMode === 'Sports' ? 25 : (state.driveMode === 'City' ? 10 : 0);
    const loadPenalty = (state.passengers > 1 || state.goodsInBoot) ? 8 : 0;

    const totalPenalty = acPenalty + tempPenalty + driveModePenalty + loadPenalty;
    const predictedRange = Math.max(0, idealRange - totalPenalty);

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
                formatter={(value: number) => {
                  const numValue = Number(value);
                  if (numValue === 0) return '';
                  const roundedValue = Math.round(numValue);
                  // For negative values, we want to show them as positive penalties.
                  if (roundedValue < 0) return `-${Math.abs(roundedValue)} km`;
                  return `${roundedValue} km`;
                }}
                className="fill-foreground font-semibold text-xs"
            />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

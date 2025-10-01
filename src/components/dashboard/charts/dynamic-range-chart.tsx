'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { VehicleState } from '@/lib/types';
import { MODE_SETTINGS } from '@/lib/constants';

interface DynamicRangeChartProps {
  state: VehicleState;
}

export default function DynamicRangeChart({ state }: DynamicRangeChartProps) {
    const idealRange = 450 * (state.batterySOC / 100);

    const rangePenalties = {
        ac: state.acOn ? idealRange * 0.05 : 0,
        temp: Math.abs(22 - state.outsideTemp) * 1.5, // Simple temp model
        passengers: idealRange * (state.passengers - 1) * 0.002,
        goods: state.goodsInBoot ? idealRange * 0.02 : 0,
        driveMode: state.driveMode !== 'Eco' ? idealRange * (1 - (420 / 450)) : 0,
    };
    
    const totalPenalty = Object.values(rangePenalties).reduce((sum, val) => sum + val, 0);
    const predictedRange = Math.max(0, idealRange - totalPenalty);

    const data = [
        { name: 'Ideal', value: idealRange, fill: 'hsl(var(--chart-2))' },
        { name: 'A/C', value: -rangePenalties.ac, fill: 'hsl(var(--chart-5))' },
        { name: 'Temp', value: -rangePenalties.temp, fill: 'hsl(var(--chart-5))' },
        { name: 'Drive Mode', value: -rangePenalties.driveMode, fill: 'hsl(var(--chart-5))' },
        { name: 'Load', value: -(rangePenalties.passengers + rangePenalties.goods), fill: 'hsl(var(--chart-5))' },
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
                formatter={(value: number) => `${Math.round(value)} km`}
                className="fill-foreground font-semibold text-xs"
            />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

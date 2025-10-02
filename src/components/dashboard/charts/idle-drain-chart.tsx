
'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { PredictiveIdleDrainOutput } from '@/ai/flows/predictive-idle-drain';

interface IdleDrainChartProps {
  data: PredictiveIdleDrainOutput | null;
  currentSOC: number;
}

const getDefaultPrediction = (startSOC: number): PredictiveIdleDrainOutput => {
  const hourlyPrediction = [];
  let currentSOC = startSOC;
  for (let i = 1; i <= 8; i++) {
    currentSOC -= 0.5; // Default drain of 0.5% per hour
    hourlyPrediction.push({ hour: i, soc: parseFloat(currentSOC.toFixed(1)) });
  }
  return { hourlyPrediction };
};

export default function IdleDrainChart({ data, currentSOC }: IdleDrainChartProps) {
  const chartConfig = {
    soc: {
      label: 'SOC (%)',
      color: 'hsl(var(--primary))',
    },
  };

  const displayData = data && data.hourlyPrediction && data.hourlyPrediction.length > 0
    ? data
    : getDefaultPrediction(currentSOC);
    
  if (!displayData || !displayData.hourlyPrediction || displayData.hourlyPrediction.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center p-4">
          Generating forecast data...
        </p>
      </div>
    );
  }


  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <AreaChart
        data={displayData.hourlyPrediction}
        margin={{
          top: 10,
          right: 20,
          left: -10,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          name="Hour"
          unit="h"
        />
        <YAxis
          domain={['dataMin - 2', 'dataMax']}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          unit="%"
          name="SOC"
        />
        <Tooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => `After ${value}h`}
              formatter={(value, name) => [`${(value as number).toFixed(1)}%`, 'Predicted SOC']}
            />
          }
          cursor={{ strokeDasharray: '3 3' }}
        />
        <defs>
          <linearGradient id="fillSoc" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-soc)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-soc)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <Area
          dataKey="soc"
          type="monotone"
          fill="url(#fillSoc)"
          fillOpacity={1}
          stroke="var(--color-soc)"
          strokeWidth={2}
          name="SOC"
        />
      </AreaChart>
    </ChartContainer>
  );
}

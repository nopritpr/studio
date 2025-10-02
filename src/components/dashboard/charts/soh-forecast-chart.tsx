
'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface SohForecastChartProps {
  data: { odometer: number; soh: number }[];
  currentOdometer: number;
}

export default function SohForecastChart({ data, currentOdometer }: SohForecastChartProps) {
  const chartConfig = {
    soh: {
      label: 'SOH (%)',
      color: 'hsl(var(--primary))',
    },
    historical: {
        label: 'Historical SOH',
        color: 'hsl(var(--primary))'
    },
    forecast: {
        label: 'Forecasted SOH',
        color: 'hsl(var(--accent))'
    }
  };

  if (!data || data.length === 0) {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Generating forecast data...</p>
        </div>
    );
  }

  const historicalData = data.filter(d => d.odometer <= currentOdometer);
  const lastHistoricalPoint = historicalData[historicalData.length - 1];

  const forecastData = data.filter(d => d.odometer >= currentOdometer);
  // Ensure the forecast line connects to the historical line
  if (lastHistoricalPoint && forecastData.length > 0 && forecastData[0].odometer > lastHistoricalPoint.odometer) {
    forecastData.unshift(lastHistoricalPoint);
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="odometer"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value) => `${Math.round(value / 1000)}k`}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          name="Odometer"
          unit="km"
        />
        <YAxis
          domain={[70, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          unit="%"
          name="SOH"
        />
        <Tooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value, payload) => payload[0] ? `${payload[0].payload.odometer.toLocaleString()} km` : value}
              formatter={(value, name) => [`${(value as number).toFixed(1)}%`, name === 'soh' ? 'SOH' : name]}
            />
          }
          cursor={{ strokeDasharray: '3 3' }}
        />
        <Legend content={() => (
            <div className="text-xs flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: chartConfig.historical.color}}></div>Historical</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{backgroundColor: chartConfig.forecast.color}}></div>Forecast</div>
            </div>
        )} />
        <defs>
            <linearGradient id="fillHistorical" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartConfig.historical.color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartConfig.historical.color} stopOpacity={0.1} />
            </linearGradient>
             <linearGradient id="fillForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartConfig.forecast.color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartConfig.forecast.color} stopOpacity={0.1} />
            </linearGradient>
        </defs>
        {historicalData.length > 1 && <Area
          type="monotone"
          dataKey="soh"
          data={historicalData}
          stroke={chartConfig.historical.color}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#fillHistorical)"
          name="Historical SOH"
          isAnimationActive={false}
        />}
        {forecastData.length > 1 && <Area
          type="monotone"
          dataKey="soh"
          data={forecastData}
          stroke={chartConfig.forecast.color}
          strokeWidth={2}
          strokeDasharray="5 5"
          fillOpacity={1}
          fill="url(#fillForecast)"
          name="Forecasted SOH"
          isAnimationActive={false}
        />}
      </AreaChart>
    </ChartContainer>
  );
}

    

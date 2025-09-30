'use client';

import React from 'react';
import type { FiveDayForecast, WeatherData, WeatherListItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets } from 'lucide-react';

const getWeatherIcon = (iconCode: string, size: number = 24) => {
  const className = `w-${size/4} h-${size/4}`;
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  return <Image src={iconUrl} alt="weather icon" width={size} height={size} />;
};


const getDailyForecasts = (forecast: FiveDayForecast | null): WeatherListItem[] => {
  if (!forecast) return [];
  const dailyData: { [key: string]: WeatherListItem } = {};

  forecast.list.forEach(item => {
    const day = format(parseISO(item.dt_txt), 'yyyy-MM-dd');
    if (!dailyData[day]) {
      dailyData[day] = item;
    }
  });

  return Object.values(dailyData).slice(1, 6); // next 5 days
};


export default function Weather({ weather, forecast }: { weather: WeatherData | null, forecast: FiveDayForecast | null }) {
  const dailyForecasts = getDailyForecasts(forecast);

  return (
    <Card className="w-full h-full flex flex-col p-4 bg-background/60">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-sm font-headline">Weather</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-0 space-y-4">
        {weather ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-16 h-16">
                {getWeatherIcon(weather.weather[0].icon, 64)}
              </div>
              <div>
                <p className="font-semibold text-sm">{weather.name}</p>
                <p className="text-3xl font-bold font-headline">{Math.round(weather.main.temp)}°C</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Droplets className="w-4 h-4" />
                <span>{weather.main.humidity}%</span>
              </div>
              <div className="flex items-center gap-1">
                 {/* Chance of rain icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16.5V20"/><path d="M12 4.5V8"/><path d="M17.1 6.9 19 5"/><path_array d="M5 19 6.9 17.1"/><path d="M12 12 a4.5 4.5 0 0 0-4.5 4.5h9a4.5 4.5 0 0 0-4.5-4.5Z"/></svg>
                <span>{forecast?.list[0].pop ? Math.round(forecast.list[0].pop * 100) : 0}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Wind className="w-4 h-4" />
                <span>{weather.wind.speed.toFixed(1)} km/h</span>
              </div>
            </div>
          </>
        ) : <p className="text-xs text-muted-foreground">Loading current weather...</p>}
        
        <div className="flex-grow space-y-2 overflow-y-auto">
             {dailyForecasts.length > 0 ? (
                dailyForecasts.map((day, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                        <span className="font-semibold w-10">{format(parseISO(day.dt_txt), 'eee')}</span>
                        <div className="w-8 h-8 flex items-center justify-center">
                            {getWeatherIcon(day.weather[0].icon, 32)}
                        </div>
                        <span className="font-bold font-mono">{Math.round(day.main.temp)}°C</span>
                    </div>
                ))
             ) : (
                <p className="text-xs text-muted-foreground text-center">Loading forecast...</p>
             )}
        </div>
      </CardContent>
    </Card>
  );
}

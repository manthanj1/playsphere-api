const RAINY_WMO_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
]);

export interface WeatherResult {
  isRainy: boolean;
  weatherCode: number | null;
  temperature: number | null;
}

export function isRainyWeatherCode(code: number | null | undefined): boolean {
  if (code == null) return false;
  return RAINY_WMO_CODES.has(code);
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherResult> {
  // ── Demo / testing override ───────────────────────────────────────────────
  // Set FORCE_RAIN=true in playsphere-api/.env to simulate rainy conditions
  // without depending on actual weather. Remove or set to false for production.
  if (process.env.FORCE_RAIN === 'true') {
    console.log('[weather] FORCE_RAIN=true — returning simulated rain (WMO 61)');
    return { isRainy: true, weatherCode: 61, temperature: 22.5 };
  }
  // ─────────────────────────────────────────────────────────────────────────

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('current', 'weather_code,temperature_2m');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const data = (await response.json()) as {
    current?: { weather_code?: number; temperature_2m?: number };
  };

  const weatherCode = data.current?.weather_code ?? null;
  const temperature = data.current?.temperature_2m ?? null;

  return {
    isRainy: isRainyWeatherCode(weatherCode),
    weatherCode,
    temperature,
  };
}

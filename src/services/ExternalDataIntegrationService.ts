// External Data Integration Service
// Provides weather impact analysis, holiday calendar integration, and economic indicator correlations
// for enhanced prediction accuracy

import { formatDateForComparison } from '../utils/dateTimeUtils';

// Weather Impact Interface
export interface WeatherData {
  date: string;
  temperature: number; // Fahrenheit
  humidity: number; // Percentage
  precipitation: number; // Inches
  windSpeed: number; // MPH
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  visibility: number; // Miles
  pressure: number; // inHg
  uvIndex: number;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  workloadImpact: number; // -1 to 1 (negative = reduces workload, positive = increases)
}

// Holiday Calendar Interface
export interface HolidayData {
  date: string;
  name: string;
  type: 'federal' | 'business' | 'local' | 'cultural';
  impact: 'major' | 'moderate' | 'minor';
  workloadMultiplier: number; // 0.1 to 2.0 (how it affects typical workload)
  description: string;
  businessClosure: boolean;
}

// Economic Indicators Interface
export interface EconomicData {
  date: string;
  marketIndex: number; // S&P 500 or relevant market index
  unemploymentRate: number; // Percentage
  consumerConfidence: number; // Index value
  gasPrice: number; // Average national price
  inflationRate: number; // Monthly percentage
  businessActivityIndex: number; // Commercial activity indicator
  seasonalAdjustmentFactor: number; // Seasonal business adjustment
  economicTrend: 'growth' | 'stable' | 'decline';
  workloadCorrelation: number; // -1 to 1 correlation with workload
}

// Combined External Data Interface
export interface ExternalDataInsight {
  date: string;
  weather: WeatherData | null;
  holiday: HolidayData | null;
  economic: EconomicData | null;
  combinedImpactScore: number; // -2 to 2 (combined effect on workload)
  riskFactors: string[];
  recommendations: string[];
  confidence: number; // 0-1 confidence in the external data impact
}

class ExternalDataIntegrationService {
  private weatherCache: Map<string, WeatherData> = new Map();
  private holidayCache: Map<string, HolidayData> = new Map();
  private economicCache: Map<string, EconomicData> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

  constructor() {
    this.initializeStaticData();
  }

  // Initialize with static holiday and economic baseline data
  private initializeStaticData(): void {
    console.log("🌐 Initializing External Data Integration Service...");

    // Pre-populate major holidays for 2024-2025
    const holidays: HolidayData[] = [
      // 2024 Holidays
      { date: '2024-01-01', name: 'New Year\'s Day', type: 'federal', impact: 'major', workloadMultiplier: 0.1, description: 'Federal holiday - most businesses closed', businessClosure: true },
      { date: '2024-01-15', name: 'Martin Luther King Jr. Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - some business impact', businessClosure: false },
      { date: '2024-02-19', name: 'Presidents Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.6, description: 'Federal holiday - reduced business activity', businessClosure: false },
      { date: '2024-03-29', name: 'Good Friday', type: 'business', impact: 'minor', workloadMultiplier: 0.8, description: 'Many businesses close early', businessClosure: false },
      { date: '2024-05-27', name: 'Memorial Day', type: 'federal', impact: 'major', workloadMultiplier: 0.3, description: 'Federal holiday - summer kick-off', businessClosure: true },
      { date: '2024-06-19', name: 'Juneteenth', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - growing recognition', businessClosure: false },
      { date: '2024-07-04', name: 'Independence Day', type: 'federal', impact: 'major', workloadMultiplier: 0.2, description: 'Federal holiday - summer celebrations', businessClosure: true },
      { date: '2024-09-02', name: 'Labor Day', type: 'federal', impact: 'major', workloadMultiplier: 0.3, description: 'Federal holiday - end of summer', businessClosure: true },
      { date: '2024-10-14', name: 'Columbus Day', type: 'federal', impact: 'minor', workloadMultiplier: 0.9, description: 'Federal holiday - limited business impact', businessClosure: false },
      { date: '2024-11-11', name: 'Veterans Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - moderate impact', businessClosure: false },
      { date: '2024-11-28', name: 'Thanksgiving', type: 'federal', impact: 'major', workloadMultiplier: 0.1, description: 'Major holiday - virtually all businesses closed', businessClosure: true },
      { date: '2024-11-29', name: 'Black Friday', type: 'business', impact: 'major', workloadMultiplier: 1.8, description: 'Heavy commercial activity', businessClosure: false },
      { date: '2024-12-25', name: 'Christmas Day', type: 'federal', impact: 'major', workloadMultiplier: 0.05, description: 'Major holiday - all businesses closed', businessClosure: true },
      
      // 2025 Holidays
      { date: '2025-01-01', name: 'New Year\'s Day', type: 'federal', impact: 'major', workloadMultiplier: 0.1, description: 'Federal holiday - most businesses closed', businessClosure: true },
      { date: '2025-01-20', name: 'Martin Luther King Jr. Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - some business impact', businessClosure: false },
      { date: '2025-02-17', name: 'Presidents Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.6, description: 'Federal holiday - reduced business activity', businessClosure: false },
      { date: '2025-04-18', name: 'Good Friday', type: 'business', impact: 'minor', workloadMultiplier: 0.8, description: 'Many businesses close early', businessClosure: false },
      { date: '2025-05-26', name: 'Memorial Day', type: 'federal', impact: 'major', workloadMultiplier: 0.3, description: 'Federal holiday - summer kick-off', businessClosure: true },
      { date: '2025-06-19', name: 'Juneteenth', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - growing recognition', businessClosure: false },
      { date: '2025-07-04', name: 'Independence Day', type: 'federal', impact: 'major', workloadMultiplier: 0.2, description: 'Federal holiday - summer celebrations', businessClosure: true },
      { date: '2025-09-01', name: 'Labor Day', type: 'federal', impact: 'major', workloadMultiplier: 0.3, description: 'Federal holiday - end of summer', businessClosure: true },
      { date: '2025-10-13', name: 'Columbus Day', type: 'federal', impact: 'minor', workloadMultiplier: 0.9, description: 'Federal holiday - limited business impact', businessClosure: false },
      { date: '2025-11-11', name: 'Veterans Day', type: 'federal', impact: 'moderate', workloadMultiplier: 0.7, description: 'Federal holiday - moderate impact', businessClosure: false },
      { date: '2025-11-27', name: 'Thanksgiving', type: 'federal', impact: 'major', workloadMultiplier: 0.1, description: 'Major holiday - virtually all businesses closed', businessClosure: true },
      { date: '2025-11-28', name: 'Black Friday', type: 'business', impact: 'major', workloadMultiplier: 1.8, description: 'Heavy commercial activity', businessClosure: false },
      { date: '2025-12-25', name: 'Christmas Day', type: 'federal', impact: 'major', workloadMultiplier: 0.05, description: 'Major holiday - all businesses closed', businessClosure: true },
    ];

    // Cache holiday data
    holidays.forEach(holiday => {
      this.holidayCache.set(holiday.date, holiday);
    });

    console.log(`🗓️ Loaded ${holidays.length} holidays into cache`);
  }

  // Weather Impact Analysis
  public async getWeatherImpact(date: string): Promise<WeatherData | null> {
    const cacheKey = date;
    
    // Check cache first
    if (this.weatherCache.has(cacheKey)) {
      return this.weatherCache.get(cacheKey)!;
    }

    try {
      // In a real implementation, this would call a weather API
      // For demo purposes, we'll generate realistic weather data based on seasonal patterns
      const weatherData = this.generateSimulatedWeatherData(date);
      
      // Cache the result
      this.weatherCache.set(cacheKey, weatherData);
      
      return weatherData;
    } catch (error) {
      console.error(`🌤️ Failed to get weather data for ${date}:`, error);
      return null;
    }
  }

  // Holiday Calendar Integration
  public getHolidayImpact(date: string): HolidayData | null {
    const holiday = this.holidayCache.get(date);
    if (holiday) {
      console.log(`🎉 Holiday detected for ${date}: ${holiday.name} (Impact: ${holiday.impact})`);
      return holiday;
    }

    // Check for day-before and day-after holiday effects
    const dayBefore = new Date(date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(date);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const beforeHoliday = this.holidayCache.get(formatDateForComparison(dayBefore));
    const afterHoliday = this.holidayCache.get(formatDateForComparison(dayAfter));

    if (beforeHoliday && beforeHoliday.impact === 'major') {
      return {
        date,
        name: `Pre-${beforeHoliday.name}`,
        type: 'business',
        impact: 'moderate',
        workloadMultiplier: 1.3,
        description: `Day before ${beforeHoliday.name} - increased activity`,
        businessClosure: false
      };
    }

    if (afterHoliday && afterHoliday.impact === 'major') {
      return {
        date,
        name: `Post-${afterHoliday.name}`,
        type: 'business',
        impact: 'moderate',
        workloadMultiplier: 1.2,
        description: `Day after ${afterHoliday.name} - recovery activity`,
        businessClosure: false
      };
    }

    return null;
  }

  // Economic Indicators Analysis
  public async getEconomicIndicators(date: string): Promise<EconomicData | null> {
    const cacheKey = date;
    
    // Check cache first
    if (this.economicCache.has(cacheKey)) {
      return this.economicCache.get(cacheKey)!;
    }

    try {
      // In a real implementation, this would call economic data APIs
      // For demo purposes, we'll generate realistic economic indicators
      const economicData = this.generateSimulatedEconomicData(date);
      
      // Cache the result
      this.economicCache.set(cacheKey, economicData);
      
      return economicData;
    } catch (error) {
      console.error(`📈 Failed to get economic data for ${date}:`, error);
      return null;
    }
  }

  // Generate comprehensive external data insights
  public async getExternalDataInsights(dates: string[]): Promise<ExternalDataInsight[]> {
    console.log(`🌐 Generating external data insights for ${dates.length} dates...`);

    const insights: ExternalDataInsight[] = [];

    for (const date of dates) {
      const weather = await this.getWeatherImpact(date);
      const holiday = this.getHolidayImpact(date);
      const economic = await this.getEconomicIndicators(date);

      // Calculate combined impact score
      let combinedImpactScore = 0;
      const riskFactors: string[] = [];
      const recommendations: string[] = [];
      let confidence = 0.8; // Base confidence

      // Weather impact
      if (weather) {
        combinedImpactScore += weather.workloadImpact;
        
        if (weather.severity === 'extreme') {
          riskFactors.push(`🌪️ Extreme weather (${weather.condition}) may severely impact operations`);
          recommendations.push('Consider reduced operations or safety protocols');
          confidence *= 0.7;
        } else if (weather.severity === 'high') {
          riskFactors.push(`⛈️ Severe weather (${weather.condition}) expected`);
          recommendations.push('Monitor weather conditions closely');
          confidence *= 0.8;
        } else if (weather.precipitation > 1.0) {
          riskFactors.push('🌧️ Heavy precipitation may slow operations');
          recommendations.push('Allow extra time for transportation');
        }
      }

      // Holiday impact
      if (holiday) {
        combinedImpactScore += (holiday.workloadMultiplier - 1) * 0.5; // Scale to -1 to 1 range
        
        if (holiday.businessClosure) {
          riskFactors.push(`🏢 ${holiday.name} - major business closures expected`);
          recommendations.push('Plan for significantly reduced activity');
          confidence *= 0.9;
        } else if (holiday.workloadMultiplier < 0.8) {
          riskFactors.push(`📅 ${holiday.name} may reduce business activity`);
          recommendations.push('Adjust staffing levels accordingly');
        } else if (holiday.workloadMultiplier > 1.2) {
          riskFactors.push(`🛍️ ${holiday.name} may increase business activity`);
          recommendations.push('Consider additional staffing');
        }
      }

      // Economic impact
      if (economic) {
        combinedImpactScore += economic.workloadCorrelation * 0.3; // Moderate weight for economic factors
        
        if (economic.economicTrend === 'decline') {
          riskFactors.push('📉 Economic downturn may impact business volume');
          recommendations.push('Monitor market conditions for business changes');
          confidence *= 0.9;
        } else if (economic.economicTrend === 'growth') {
          riskFactors.push('📈 Economic growth may increase business demand');
          recommendations.push('Prepare for potential increased activity');
        }

        if (economic.gasPrice > 4.5) {
          riskFactors.push('⛽ High gas prices may affect transportation costs');
          recommendations.push('Factor in increased transportation costs');
        }
      }

      // Ensure combined impact score stays within bounds
      combinedImpactScore = Math.max(-2, Math.min(2, combinedImpactScore));

      // Add general recommendations based on combined score
      if (combinedImpactScore > 1) {
        recommendations.push('⬆️ Expect above-normal activity - increase resources');
      } else if (combinedImpactScore > 0.5) {
        recommendations.push('📊 Slightly elevated activity expected');
      } else if (combinedImpactScore < -1) {
        recommendations.push('⬇️ Expect below-normal activity - reduce resources');
      } else if (combinedImpactScore < -0.5) {
        recommendations.push('📉 Slightly reduced activity expected');
      } else {
        recommendations.push('➡️ Normal activity levels expected');
      }

      insights.push({
        date,
        weather,
        holiday,
        economic,
        combinedImpactScore,
        riskFactors,
        recommendations,
        confidence: Math.max(0.1, Math.min(1.0, confidence))
      });
    }

    console.log(`🌐 Generated ${insights.length} external data insights`);
    return insights;
  }

  // Apply external data adjustments to predictions
  public adjustPredictionsWithExternalData(
    basePrediction: number,
    externalInsight: ExternalDataInsight
  ): { adjustedPrediction: number; adjustmentFactor: number; reasoning: string[] } {
    let adjustmentFactor = 1.0 + (externalInsight.combinedImpactScore * 0.3); // 30% maximum adjustment
    const reasoning: string[] = [];

    // Weather adjustments
    if (externalInsight.weather) {
      const weatherAdjust = externalInsight.weather.workloadImpact * 0.15; // 15% max weather impact
      adjustmentFactor += weatherAdjust;
      
      if (Math.abs(weatherAdjust) > 0.05) {
        reasoning.push(`Weather (${externalInsight.weather.condition}): ${weatherAdjust > 0 ? '+' : ''}${(weatherAdjust * 100).toFixed(1)}%`);
      }
    }

    // Holiday adjustments
    if (externalInsight.holiday) {
      const holidayAdjust = (externalInsight.holiday.workloadMultiplier - 1) * 0.5; // Scale down
      adjustmentFactor += holidayAdjust;
      
      if (Math.abs(holidayAdjust) > 0.05) {
        reasoning.push(`Holiday (${externalInsight.holiday.name}): ${holidayAdjust > 0 ? '+' : ''}${(holidayAdjust * 100).toFixed(1)}%`);
      }
    }

    // Economic adjustments
    if (externalInsight.economic) {
      const economicAdjust = externalInsight.economic.workloadCorrelation * 0.1; // 10% max economic impact
      adjustmentFactor += economicAdjust;
      
      if (Math.abs(economicAdjust) > 0.02) {
        reasoning.push(`Economic (${externalInsight.economic.economicTrend}): ${economicAdjust > 0 ? '+' : ''}${(economicAdjust * 100).toFixed(1)}%`);
      }
    }

    // Ensure reasonable bounds
    adjustmentFactor = Math.max(0.3, Math.min(2.0, adjustmentFactor));
    
    const adjustedPrediction = Math.round(basePrediction * adjustmentFactor);

    return {
      adjustedPrediction,
      adjustmentFactor,
      reasoning
    };
  }

  // Simulate realistic weather data based on date and location patterns
  private generateSimulatedWeatherData(date: string): WeatherData {
    const dateObj = new Date(date);
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    
    // Seasonal baselines (simulate location like Seattle or similar climate)
    const seasonalBaselines = {
      temperature: [45, 48, 52, 58, 65, 71, 76, 75, 69, 60, 50, 45][month], // Monthly averages
      humidity: [78, 75, 70, 65, 60, 55, 50, 55, 65, 75, 80, 82][month],
      precipitation: [5.1, 3.8, 3.1, 2.5, 1.8, 1.5, 0.7, 0.9, 1.5, 3.2, 5.6, 6.0][month], // Monthly inches
    };

    // Add some randomness for realism
    const tempVariation = (Math.random() - 0.5) * 20;
    const humidityVariation = (Math.random() - 0.5) * 30;
    const precipVariation = Math.random() * 2;

    const temperature = Math.round(seasonalBaselines.temperature + tempVariation);
    const humidity = Math.max(20, Math.min(100, Math.round(seasonalBaselines.humidity + humidityVariation)));
    const precipitation = Math.max(0, seasonalBaselines.precipitation * (1 + precipVariation - 1));

    // Determine condition based on precipitation and temperature
    let condition: WeatherData['condition'] = 'sunny';
    if (precipitation > 0.5) condition = 'rainy';
    else if (precipitation > 0.1) condition = 'cloudy';
    else if (temperature > 80) condition = 'sunny';
    else if (humidity > 85) condition = 'foggy';

    // Determine severity
    let severity: WeatherData['severity'] = 'low';
    if (precipitation > 2 || temperature < 20 || temperature > 100) severity = 'extreme';
    else if (precipitation > 1 || temperature < 32 || temperature > 90) severity = 'high';
    else if (precipitation > 0.5 || humidity > 90) severity = 'moderate';

    // Calculate workload impact
    let workloadImpact = 0;
    if (condition === 'rainy' && precipitation > 0.5) workloadImpact -= 0.3;
    else if (condition === 'stormy') workloadImpact -= 0.6;
    else if (condition === 'snowy') workloadImpact -= 0.4;
    else if (condition === 'sunny' && temperature > 70 && temperature < 85) workloadImpact += 0.1;

    return {
      date,
      temperature,
      humidity,
      precipitation: Math.round(precipitation * 100) / 100,
      windSpeed: Math.round(Math.random() * 15 + 5),
      condition,
      visibility: Math.round(Math.max(1, 10 - precipitation * 3)),
      pressure: Math.round((29.5 + Math.random() * 1.5) * 100) / 100,
      uvIndex: Math.max(0, Math.round(8 * (temperature / 80) * (condition === 'sunny' ? 1 : 0.3))),
      severity,
      workloadImpact: Math.round(workloadImpact * 100) / 100
    };
  }

  // Simulate realistic economic indicators
  private generateSimulatedEconomicData(date: string): EconomicData {
    const dateObj = new Date(date);
    const month = dateObj.getMonth();
    
    // Base economic indicators with seasonal patterns
    const marketIndex = 4200 + (Math.random() - 0.5) * 400; // S&P 500 range
    const unemploymentRate = 3.5 + Math.random() * 2; // 3.5-5.5%
    const consumerConfidence = 95 + (Math.random() - 0.5) * 20; // 85-105
    const gasPrice = 3.2 + Math.random() * 1.5; // $3.20-$4.70
    const inflationRate = 2.5 + (Math.random() - 0.5) * 2; // 1.5-3.5%
    
    // Seasonal business activity (higher in spring/summer)
    const seasonalMultipliers = [0.9, 0.95, 1.05, 1.15, 1.2, 1.25, 1.15, 1.1, 1.05, 1.0, 0.9, 0.85];
    const businessActivityIndex = 100 * seasonalMultipliers[month] + (Math.random() - 0.5) * 10;

    // Determine economic trend
    let economicTrend: EconomicData['economicTrend'] = 'stable';
    if (marketIndex > 4400 && unemploymentRate < 4) economicTrend = 'growth';
    else if (marketIndex < 4000 || unemploymentRate > 5) economicTrend = 'decline';

    // Calculate workload correlation
    let workloadCorrelation = 0;
    workloadCorrelation += (marketIndex - 4200) / 4200 * 0.5; // Market performance impact
    workloadCorrelation += (100 - consumerConfidence) / 100 * -0.3; // Consumer confidence impact
    workloadCorrelation += (businessActivityIndex - 100) / 100 * 0.4; // Business activity impact
    workloadCorrelation = Math.max(-1, Math.min(1, workloadCorrelation));

    return {
      date,
      marketIndex: Math.round(marketIndex),
      unemploymentRate: Math.round(unemploymentRate * 10) / 10,
      consumerConfidence: Math.round(consumerConfidence),
      gasPrice: Math.round(gasPrice * 100) / 100,
      inflationRate: Math.round(inflationRate * 10) / 10,
      businessActivityIndex: Math.round(businessActivityIndex),
      seasonalAdjustmentFactor: seasonalMultipliers[month],
      economicTrend,
      workloadCorrelation: Math.round(workloadCorrelation * 100) / 100
    };
  }

  // Get summary statistics for external data impact analysis
  public async getExternalDataSummary(insights: ExternalDataInsight[]): Promise<{
    weatherImpact: { average: number; extreme: number; moderate: number };
    holidayImpact: { count: number; majorHolidays: number; businessImpact: number };
    economicImpact: { trend: string; stability: number; correlation: number };
    overallRisk: 'low' | 'moderate' | 'high';
    keyRecommendations: string[];
  }> {
    if (insights.length === 0) {
      return {
        weatherImpact: { average: 0, extreme: 0, moderate: 0 },
        holidayImpact: { count: 0, majorHolidays: 0, businessImpact: 0 },
        economicImpact: { trend: 'stable', stability: 0.8, correlation: 0 },
        overallRisk: 'low',
        keyRecommendations: ['No external data available for analysis']
      };
    }

    // Weather analysis
    const weatherImpacts = insights.map(i => i.weather?.workloadImpact || 0);
    const extremeWeatherCount = insights.filter(i => i.weather?.severity === 'extreme').length;
    const moderateWeatherCount = insights.filter(i => i.weather?.severity === 'moderate').length;

    // Holiday analysis
    const holidayCount = insights.filter(i => i.holiday !== null).length;
    const majorHolidays = insights.filter(i => i.holiday?.impact === 'major').length;
    const holidayBusinessImpact = insights
      .filter(i => i.holiday)
      .reduce((sum, i) => sum + (i.holiday!.workloadMultiplier - 1), 0) / Math.max(1, holidayCount);

    // Economic analysis
    const economicTrends = insights.map(i => i.economic?.economicTrend || 'stable');
    const trendMode = economicTrends.sort((a,b) =>
      economicTrends.filter(v => v === a).length - economicTrends.filter(v => v === b).length
    ).pop() || 'stable';

    const economicCorrelations = insights.map(i => i.economic?.workloadCorrelation || 0);
    const avgCorrelation = economicCorrelations.reduce((a, b) => a + b, 0) / economicCorrelations.length;

    // Overall risk assessment
    const combinedScores = insights.map(i => Math.abs(i.combinedImpactScore));
    const avgCombinedScore = combinedScores.reduce((a, b) => a + b, 0) / combinedScores.length;
    
    let overallRisk: 'low' | 'moderate' | 'high' = 'low';
    if (avgCombinedScore > 1 || extremeWeatherCount > 0 || majorHolidays > insights.length * 0.3) {
      overallRisk = 'high';
    } else if (avgCombinedScore > 0.5 || moderateWeatherCount > insights.length * 0.3 || holidayCount > 0) {
      overallRisk = 'moderate';
    }

    // Key recommendations
    const keyRecommendations: string[] = [];
    if (extremeWeatherCount > 0) {
      keyRecommendations.push('🌪️ Extreme weather events expected - implement contingency plans');
    }
    if (majorHolidays > 0) {
      keyRecommendations.push(`🏢 ${majorHolidays} major holiday(s) will significantly impact operations`);
    }
    if (trendMode === 'decline') {
      keyRecommendations.push('📉 Economic decline trend may reduce business volume');
    } else if (trendMode === 'growth') {
      keyRecommendations.push('📈 Economic growth trend may increase business demand');
    }
    if (Math.abs(avgCorrelation) > 0.3) {
      keyRecommendations.push(`📊 Strong economic correlation detected: ${avgCorrelation > 0 ? 'positive' : 'negative'} business impact expected`);
    }

    return {
      weatherImpact: {
        average: Math.round(weatherImpacts.reduce((a, b) => a + b, 0) / weatherImpacts.length * 100) / 100,
        extreme: extremeWeatherCount,
        moderate: moderateWeatherCount
      },
      holidayImpact: {
        count: holidayCount,
        majorHolidays,
        businessImpact: Math.round(holidayBusinessImpact * 100) / 100
      },
      economicImpact: {
        trend: trendMode,
        stability: 1 - (Math.abs(avgCorrelation) * 0.5), // Higher correlation = less stability
        correlation: Math.round(avgCorrelation * 100) / 100
      },
      overallRisk,
      keyRecommendations
    };
  }

  // Clear caches (useful for testing or forcing refresh)
  public clearCaches(): void {
    this.weatherCache.clear();
    this.economicCache.clear();
    // Don't clear holiday cache as it's static data
    console.log('🗑️ External data caches cleared');
  }
}

// Export singleton instance
export const externalDataService = new ExternalDataIntegrationService();
export default ExternalDataIntegrationService;

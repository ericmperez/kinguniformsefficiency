// ML Training Scheduler Service
// Automatically runs ML training every day at 4:00 AM
// Integrates with existing task scheduler system

import AutoMLDataService from './AutoMLDataService';
import MachineLearningService from './MachineLearningService';

interface MLTrainingConfig {
  enabled: boolean;
  schedule: string; // "HH:MM" format
  daysBack: number; // How many days of data to analyze
  maxRetries: number;
  retryDelayMinutes: number;
}

interface MLTrainingLog {
  timestamp: string;
  success: boolean;
  trainingSummary?: {
    totalComparisons: number;
    averageAccuracy: number;
    improvementTrend: string;
    dataProcessed: number;
  };
  error?: string;
  duration: number;
  retryCount: number;
}

class MLTrainingScheduler {
  private static instance: MLTrainingScheduler;
  private autoMLService: AutoMLDataService;
  private mlService: MachineLearningService;
  private config: MLTrainingConfig;
  private trainingLogs: MLTrainingLog[] = [];
  private isTraining: boolean = false;

  private constructor() {
    this.autoMLService = AutoMLDataService.getInstance();
    this.mlService = MachineLearningService.getInstance();
    
    // Default configuration
    this.config = {
      enabled: true,
      schedule: '04:00', // 4:00 AM
      daysBack: 7, // Analyze last 7 days
      maxRetries: 3,
      retryDelayMinutes: 5
    };

    this.loadConfiguration();
    this.loadTrainingLogs();
  }

  public static getInstance(): MLTrainingScheduler {
    if (!MLTrainingScheduler.instance) {
      MLTrainingScheduler.instance = new MLTrainingScheduler();
    }
    return MLTrainingScheduler.instance;
  }

  /**
   * Perform the daily ML training at scheduled time
   */
  public async performDailyTraining(retryCount: number = 0): Promise<MLTrainingLog> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log(`🤖 [ML Scheduler] Starting daily ML training at ${new Date().toLocaleString()}`);
    console.log(`📊 [ML Scheduler] Configuration: ${this.config.daysBack} days back, retry ${retryCount}/${this.config.maxRetries}`);

    if (this.isTraining) {
      const error = 'ML training already in progress';
      console.warn(`⚠️ [ML Scheduler] ${error}`);
      return this.createLog(timestamp, false, undefined, error, Date.now() - startTime, retryCount);
    }

    this.isTraining = true;

    try {
      // Step 1: Perform automatic ML training
      console.log('🔄 [ML Scheduler] Step 1: Running automatic ML training...');
      const trainingResults = await this.autoMLService.performAutomaticMLTraining(this.config.daysBack);
      
      if (trainingResults.length === 0) {
        throw new Error(`No training data found for the last ${this.config.daysBack} days`);
      }

      // Step 2: Get training statistics
      console.log('📈 [ML Scheduler] Step 2: Collecting training statistics...');
      const stats = await this.autoMLService.getAutomaticLearningStats();

      // Step 3: Get ML insights
      console.log('🧠 [ML Scheduler] Step 3: Gathering ML insights...');
      const insights = this.mlService.getMLInsights();

      const trainingSummary = {
        totalComparisons: stats.totalComparisons,
        averageAccuracy: stats.averageAccuracy,
        improvementTrend: stats.improvementTrend,
        dataProcessed: trainingResults.length
      };

      const duration = Date.now() - startTime;
      
      console.log('✅ [ML Scheduler] Daily ML training completed successfully');
      console.log(`📊 [ML Scheduler] Results: ${trainingSummary.totalComparisons} comparisons, ${trainingSummary.averageAccuracy.toFixed(2)}% accuracy`);
      console.log(`⏱️ [ML Scheduler] Duration: ${(duration / 1000).toFixed(2)} seconds`);

      // Log successful training
      const log = this.createLog(timestamp, true, trainingSummary, undefined, duration, retryCount);
      this.saveTrainingLog(log);

      return log;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown error occurred during ML training';
      
      console.error(`❌ [ML Scheduler] Daily ML training failed: ${errorMessage}`);
      console.error(`⏱️ [ML Scheduler] Failed after: ${(duration / 1000).toFixed(2)} seconds`);

      // Retry logic
      if (retryCount < this.config.maxRetries) {
        console.log(`🔄 [ML Scheduler] Retrying in ${this.config.retryDelayMinutes} minutes... (Attempt ${retryCount + 1}/${this.config.maxRetries})`);
        
        setTimeout(async () => {
          await this.performDailyTraining(retryCount + 1);
        }, this.config.retryDelayMinutes * 60 * 1000);
        
        return this.createLog(timestamp, false, undefined, `${errorMessage} (retry scheduled)`, duration, retryCount);
      } else {
        console.error(`🚫 [ML Scheduler] Maximum retries (${this.config.maxRetries}) exceeded. Giving up.`);
        
        // Log failed training
        const log = this.createLog(timestamp, false, undefined, `${errorMessage} (max retries exceeded)`, duration, retryCount);
        this.saveTrainingLog(log);

        return log;
      }

    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Manually trigger ML training (for testing or manual runs)
   */
  public async manualTraining(): Promise<MLTrainingLog> {
    console.log('🔧 [ML Scheduler] Manual ML training triggered');
    return await this.performDailyTraining(0);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MLTrainingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    console.log('⚙️ [ML Scheduler] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): MLTrainingConfig {
    return { ...this.config };
  }

  /**
   * Get training logs (last 30 entries)
   */
  public getTrainingLogs(): MLTrainingLog[] {
    return [...this.trainingLogs].slice(-30);
  }

  /**
   * Get training status and next scheduled run
   */
  public getStatus(): {
    isTraining: boolean;
    config: MLTrainingConfig;
    lastRun?: MLTrainingLog;
    nextScheduledRun: string;
    recentSuccessRate: number;
  } {
    const lastRun = this.trainingLogs[this.trainingLogs.length - 1];
    
    // Calculate next scheduled run
    const [hour, minute] = this.config.schedule.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(hour, minute, 0, 0);
    
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Calculate recent success rate (last 7 runs)
    const recentLogs = this.trainingLogs.slice(-7);
    const successCount = recentLogs.filter(log => log.success).length;
    const recentSuccessRate = recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0;

    return {
      isTraining: this.isTraining,
      config: this.config,
      lastRun,
      nextScheduledRun: nextRun.toLocaleString(),
      recentSuccessRate
    };
  }

  /**
   * Enable or disable the scheduler
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfiguration();
    console.log(`${enabled ? '✅' : '❌'} [ML Scheduler] ML training scheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Private helper methods
  private createLog(
    timestamp: string, 
    success: boolean, 
    trainingSummary?: any, 
    error?: string, 
    duration: number = 0, 
    retryCount: number = 0
  ): MLTrainingLog {
    return {
      timestamp,
      success,
      trainingSummary,
      error,
      duration,
      retryCount
    };
  }

  private saveTrainingLog(log: MLTrainingLog): void {
    this.trainingLogs.push(log);
    
    // Keep only last 100 logs for storage efficiency
    if (this.trainingLogs.length > 100) {
      this.trainingLogs = this.trainingLogs.slice(-100);
    }
    
    try {
      localStorage.setItem('ml_training_logs', JSON.stringify(this.trainingLogs));
    } catch (error) {
      console.warn('⚠️ [ML Scheduler] Could not save training logs to localStorage:', error);
    }
  }

  private loadTrainingLogs(): void {
    try {
      const stored = localStorage.getItem('ml_training_logs');
      if (stored) {
        this.trainingLogs = JSON.parse(stored);
        console.log(`📚 [ML Scheduler] Loaded ${this.trainingLogs.length} training logs from localStorage`);
      }
    } catch (error) {
      console.warn('⚠️ [ML Scheduler] Could not load training logs from localStorage:', error);
      this.trainingLogs = [];
    }
  }

  private saveConfiguration(): void {
    try {
      localStorage.setItem('ml_training_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('⚠️ [ML Scheduler] Could not save configuration to localStorage:', error);
    }
  }

  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem('ml_training_config');
      if (stored) {
        const loadedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...loadedConfig };
        console.log('⚙️ [ML Scheduler] Configuration loaded from localStorage:', this.config);
      }
    } catch (error) {
      console.warn('⚠️ [ML Scheduler] Could not load configuration from localStorage:', error);
    }
  }
}

export default MLTrainingScheduler;
export { MLTrainingScheduler };
export type { MLTrainingConfig, MLTrainingLog };

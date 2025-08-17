// Scheduled Task Runner for Driver Assignment Notifications
// Runs daily at 8 PM to check for unassigned drivers

import { checkAndNotifyUnassignedDrivers } from './driverAssignmentNotifier';
import MLTrainingScheduler from './MLTrainingScheduler';

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // Cron-like format: "hour:minute"
  action: () => Promise<void>;
  enabled: boolean;
}

class TaskScheduler {
  private tasks: ScheduledTask[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private mlTrainingScheduler: MLTrainingScheduler;

  constructor() {
    this.mlTrainingScheduler = MLTrainingScheduler.getInstance();
    
    // Register the driver assignment notification task
    this.registerTask({
      id: 'driver-assignment-check',
      name: 'Daily Driver Assignment Check',
      schedule: '20:00', // 8:00 PM
      action: this.runDriverAssignmentCheck,
      enabled: true
    });

    // Register the daily ML training task
    this.registerTask({
      id: 'ml-training-daily',
      name: 'Daily ML Training',
      schedule: '04:00', // 4:00 AM
      action: this.runDailyMLTraining,
      enabled: true
    });
  }

  /**
   * Registers a scheduled task
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.push(task);
    if (this.isRunning && task.enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Starts the task scheduler
   * Note: In production on Vercel, this is handled by cron jobs
   */
  start(): void {
    // Check if we're running in a Vercel environment
    if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('kinguniforms.net'))) {
      console.log('Task scheduler disabled - using Vercel cron jobs in production');
      return;
    }

    if (this.isRunning) {
      console.log('Task scheduler is already running');
      return;
    }

    console.log('Starting local task scheduler...');
    this.isRunning = true;

    // Schedule all enabled tasks
    this.tasks.filter(task => task.enabled).forEach(task => {
      this.scheduleTask(task);
    });

    console.log(`Local task scheduler started with ${this.tasks.filter(t => t.enabled).length} active tasks`);
  }

  /**
   * Stops the task scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Task scheduler is not running');
      return;
    }

    console.log('Stopping task scheduler...');
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach((interval, taskId) => {
      clearInterval(interval);
    });
    this.intervals.clear();

    console.log('Task scheduler stopped');
  }

  /**
   * Schedules a single task
   */
  private scheduleTask(task: ScheduledTask): void {
    const [hour, minute] = task.schedule.split(':').map(Number);
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.error(`Invalid schedule format for task ${task.id}: ${task.schedule}`);
      return;
    }

    // Calculate milliseconds until next occurrence
    const getNextRunTime = (): number => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, minute, 0, 0);

      // If scheduled time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      return scheduledTime.getTime() - now.getTime();
    };

    const scheduleNext = () => {
      const timeUntilNext = getNextRunTime();
      
      console.log(`Task "${task.name}" scheduled to run in ${Math.round(timeUntilNext / 1000 / 60)} minutes`);
      
      const timeout = setTimeout(async () => {
        console.log(`Executing scheduled task: ${task.name}`);
        
        try {
          await task.action();
          console.log(`Task "${task.name}" completed successfully`);
        } catch (error) {
          console.error(`Task "${task.name}" failed:`, error);
        }

        // Schedule next occurrence (24 hours later)
        if (this.isRunning) {
          scheduleNext();
        }
      }, timeUntilNext);

      this.intervals.set(task.id, timeout);
    };

    scheduleNext();
  }

  /**
   * Driver assignment check task action
   */
  private async runDriverAssignmentCheck(): Promise<void> {
    // Recipients for the notification (can be configured)
    const recipients = [
      'emperez@kinguniforms.net', // Main supervisor email
      // Add more recipients as needed
      // 'manager@kinguniforms.net',
      // 'operations@kinguniforms.net'
    ];

    await checkAndNotifyUnassignedDrivers(recipients);
  }

  /**
   * Daily ML training task action
   */
  private async runDailyMLTraining(): Promise<void> {
    await this.mlTrainingScheduler.performDailyTraining();
  }

  /**
   * Gets status of all tasks
   */
  getTaskStatus(): Array<{
    id: string;
    name: string;
    schedule: string;
    enabled: boolean;
    nextRun?: string;
  }> {
    return this.tasks.map(task => {
      let nextRun: string | undefined;
      
      if (task.enabled && this.isRunning) {
        const [hour, minute] = task.schedule.split(':').map(Number);
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hour, minute, 0, 0);

        // If scheduled time has passed today, it's tomorrow
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        nextRun = scheduledTime.toLocaleString();
      }

      return {
        id: task.id,
        name: task.name,
        schedule: task.schedule,
        enabled: task.enabled,
        nextRun
      };
    });
  }

  /**
   * Manually triggers a task by ID
   */
  async triggerTask(taskId: string): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID "${taskId}" not found`);
    }

    console.log(`Manually triggering task: ${task.name}`);
    await task.action();
  }
}

// Create global task scheduler instance
const taskScheduler = new TaskScheduler();

// Auto-start the scheduler when the module is imported
// This will begin scheduling tasks when the application starts
if (typeof window !== 'undefined') {
  // Only start in browser environment
  taskScheduler.start();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    taskScheduler.stop();
  });
}

export default taskScheduler;
export { TaskScheduler };

/**
 * Manual trigger function for testing
 */
export const triggerDriverAssignmentCheck = () => {
  return taskScheduler.triggerTask('driver-assignment-check');
};

/**
 * Manual trigger function for ML training
 */
export const triggerMLTraining = () => {
  return taskScheduler.triggerTask('ml-training-daily');
};

/**
 * Get current scheduler status
 */
export const getSchedulerStatus = () => {
  return taskScheduler.getTaskStatus();
};

/**
 * Get ML training scheduler status
 */
export const getMLTrainingStatus = () => {
  const mlScheduler = MLTrainingScheduler.getInstance();
  return mlScheduler.getStatus();
};

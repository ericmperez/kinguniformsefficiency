/**
 * Tunnel Cart Alert Service
 * 
 * Monitors tunnel cart button presses and triggers alerts when buttons are pressed
 * within 30 seconds of each other, which may indicate rapid successive operations
 * that require attention.
 */

import { AlertService } from '../services/AlertService';

interface ButtonPressRecord {
  timestamp: number;
  groupId: string;
  groupName: string;
  buttonType: 'increment' | 'decrement' | 'verify';
  userName: string;
  cartCount: number;
}

class TunnelCartAlertService {
  private buttonPresses: ButtonPressRecord[] = [];
  private readonly ALERT_THRESHOLD_MS = 30000; // 30 seconds
  private readonly MAX_HISTORY_SIZE = 100; // Keep last 100 button presses

  /**
   * Record a tunnel cart button press and check for rapid successive presses
   */
  public async recordButtonPress(
    groupId: string,
    groupName: string,
    buttonType: 'increment' | 'decrement' | 'verify',
    userName: string,
    cartCount: number
  ): Promise<void> {
    const currentTime = Date.now();
    
    // Add the new button press
    const newPress: ButtonPressRecord = {
      timestamp: currentTime,
      groupId,
      groupName,
      buttonType,
      userName,
      cartCount
    };
    
    this.buttonPresses.push(newPress);
    
    // Clean up old records to prevent memory issues
    this.cleanupOldRecords(currentTime);
    
    // Check for rapid successive presses
    await this.checkForRapidPresses(newPress);
  }

  /**
   * Check if there are rapid successive button presses within the threshold
   */
  private async checkForRapidPresses(currentPress: ButtonPressRecord): Promise<void> {
    const cutoffTime = currentPress.timestamp - this.ALERT_THRESHOLD_MS;
    
    // Find recent button presses for the same group
    const recentPresses = this.buttonPresses.filter(press => 
      press.groupId === currentPress.groupId &&
      press.timestamp >= cutoffTime &&
      press.timestamp < currentPress.timestamp
    );

    if (recentPresses.length > 0) {
      // Found rapid successive presses - create alert
      await this.createRapidPressAlert(currentPress, recentPresses);
    }
  }

  /**
   * Create an alert for rapid successive button presses
   */
  private async createRapidPressAlert(
    currentPress: ButtonPressRecord,
    recentPresses: ButtonPressRecord[]
  ): Promise<void> {
    const timeSpan = (currentPress.timestamp - recentPresses[0].timestamp) / 1000;
    const totalPresses = recentPresses.length + 1;
    
    // Create detailed press history for the alert
    const pressHistory = [...recentPresses, currentPress]
      .map(press => ({
        time: new Date(press.timestamp).toLocaleTimeString(),
        action: this.getActionDescription(press.buttonType, press.cartCount),
        user: press.userName
      }));

    try {
      await AlertService.createAlert({
        type: 'washing_alert',
        severity: 'medium',
        title: `Rapid Tunnel Cart Operations - ${currentPress.groupName}`,
        message: `${totalPresses} tunnel cart button presses detected within ${Math.round(timeSpan)} seconds. This may indicate an issue requiring attention.`,
        component: 'Washing/Tunnel',
        clientName: currentPress.groupName,
        userName: currentPress.userName,
        triggerData: {
          groupId: currentPress.groupId,
          totalPresses,
          timeSpanSeconds: Math.round(timeSpan),
          pressHistory,
          alertType: 'rapid_button_presses',
          thresholdSeconds: this.ALERT_THRESHOLD_MS / 1000
        },
        createdBy: 'System'
      });

      console.warn(`🚨 Rapid tunnel cart button presses detected for ${currentPress.groupName}:`, {
        totalPresses,
        timeSpanSeconds: Math.round(timeSpan),
        pressHistory
      });

    } catch (error) {
      console.error('Failed to create rapid tunnel cart press alert:', error);
    }
  }

  /**
   * Get a human-readable description of the button action
   */
  private getActionDescription(buttonType: string, cartCount: number): string {
    switch (buttonType) {
      case 'increment':
        return `Cart count increased to ${cartCount}`;
      case 'decrement':
        return `Cart count decreased to ${cartCount}`;
      case 'verify':
        return `Cart count verified (${cartCount})`;
      default:
        return `Cart operation (${cartCount})`;
    }
  }

  /**
   * Clean up old button press records to prevent memory issues
   */
  private cleanupOldRecords(currentTime: number): void {
    const cutoffTime = currentTime - (this.ALERT_THRESHOLD_MS * 2); // Keep records for 60 seconds
    
    // Remove old records
    this.buttonPresses = this.buttonPresses.filter(press => 
      press.timestamp >= cutoffTime
    );

    // Also limit total size
    if (this.buttonPresses.length > this.MAX_HISTORY_SIZE) {
      this.buttonPresses = this.buttonPresses.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Get current button press statistics for debugging
   */
  public getStatistics(): {
    totalRecords: number;
    oldestRecord: string | null;
    newestRecord: string | null;
    groupsWithActivity: string[];
  } {
    const now = Date.now();
    const recentPresses = this.buttonPresses.filter(press => 
      now - press.timestamp <= this.ALERT_THRESHOLD_MS
    );

    const uniqueGroups = [...new Set(recentPresses.map(press => press.groupName))];

    return {
      totalRecords: this.buttonPresses.length,
      oldestRecord: this.buttonPresses.length > 0 
        ? new Date(this.buttonPresses[0].timestamp).toLocaleString()
        : null,
      newestRecord: this.buttonPresses.length > 0 
        ? new Date(this.buttonPresses[this.buttonPresses.length - 1].timestamp).toLocaleString()
        : null,
      groupsWithActivity: uniqueGroups
    };
  }

  /**
   * Clear all button press records (for testing or reset purposes)
   */
  public clearHistory(): void {
    this.buttonPresses = [];
  }

  /**
   * Get recent button presses for a specific group (for debugging)
   */
  public getRecentPressesForGroup(groupId: string): ButtonPressRecord[] {
    const cutoffTime = Date.now() - this.ALERT_THRESHOLD_MS;
    return this.buttonPresses.filter(press => 
      press.groupId === groupId && press.timestamp >= cutoffTime
    );
  }
}

// Create and export a singleton instance
export const tunnelCartAlertService = new TunnelCartAlertService();

// Export types for use in components
export type { ButtonPressRecord };

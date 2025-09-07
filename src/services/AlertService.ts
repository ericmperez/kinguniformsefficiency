import { addDoc, collection, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertType, AlertSeverity, SystemAlert } from '../components/AlertsDashboard';

interface CreateAlertParams {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  component: string;
  clientName?: string;
  userName?: string;
  triggerData?: any;
  createdBy: string;
}

/**
 * Alert Service for creating and managing system alerts
 */
export class AlertService {
  /**
   * Create a new system alert
   */
  static async createAlert(params: CreateAlertParams): Promise<string> {
    try {
      const alertData = {
        ...params,
        timestamp: Timestamp.now(),
        isRead: false,
        isResolved: false,
      };

      const docRef = await addDoc(collection(db, 'system_alerts'), alertData);
      console.log(`🚨 Alert created: ${params.title} (${docRef.id})`);
      
      // Send email notification if configured
      await this.sendEmailNotification(params);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Send email notification for an alert if configured
   */
  static async sendEmailNotification(alertParams: CreateAlertParams): Promise<void> {
    try {
      // Get alert email configuration
      const configDoc = await getDoc(doc(db, 'settings', 'alertEmailConfig'));
      
      if (!configDoc.exists()) {
        console.log('No alert email configuration found');
        return;
      }

      const config = configDoc.data();
      
      // Check if alerts are enabled globally
      if (!config.enabled) {
        console.log('Alert emails are disabled');
        return;
      }

      // Check if this specific alert type is enabled
      const alertTypeKey = this.getAlertTypeKey(alertParams.type);
      if (!config.alertTypes[alertTypeKey]) {
        console.log(`Alert type ${alertParams.type} is disabled for email notifications`);
        return;
      }

      // Prepare email data
      const emailData = {
        recipients: config.emailRecipients,
        subject: `🚨 System Alert: ${alertParams.title}`,
        alertType: alertParams.type,
        severity: alertParams.severity,
        title: alertParams.title,
        message: alertParams.message,
        component: alertParams.component,
        clientName: alertParams.clientName,
        userName: alertParams.userName,
        timestamp: new Date().toISOString(),
        triggerData: alertParams.triggerData
      };

      // Send email via API
      const response = await fetch('/api/send-alert-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error(`Failed to send alert email: ${response.statusText}`);
      }

      console.log(`📧 Alert email sent for: ${alertParams.title}`);
    } catch (error) {
      console.error('Error sending alert email:', error);
      // Don't throw the error - we don't want email failures to prevent alert creation
    }
  }

  /**
   * Map alert types to configuration keys
   */
  static getAlertTypeKey(alertType: AlertType): string {
    const typeMap: Record<string, string> = {
      'segregation_error': 'segregationErrors',
      'driver_assignment': 'driverAssignment',
      'system_error': 'systemErrors',
      'tunnel_issue': 'tunnelIssues',
      'washing_alert': 'washingAlerts',
      'conventional_issue': 'conventionalIssues',
      'invoice_warning': 'invoiceWarnings',
      'shipping_problem': 'shippingProblems',
      'special_item': 'specialItems',
      'end_of_shift': 'endOfShift',
      'production_delay': 'general',
      'general': 'general'
    };
    
    return typeMap[alertType] || 'general';
  }

  /**
   * Create a segregation error alert
   */
  static async createSegregationErrorAlert(
    clientName: string,
    userName: string,
    expectedCount: number,
    actualCount: number,
    groupId: string
  ): Promise<string> {
    return this.createAlert({
      type: 'segregation_error',
      severity: 'high',
      title: `Cart Verification Error - ${clientName}`,
      message: `Cart count mismatch detected. Expected: ${expectedCount}, Actual: ${actualCount}. Employee: ${userName}`,
      component: 'Segregation',
      clientName,
      userName,
      triggerData: {
        expectedCount,
        actualCount,
        groupId,
        errorType: 'cart_verification'
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a driver assignment alert
   */
  static async createDriverAssignmentAlert(
    unassignedTrucks: number,
    targetDate: string,
    truckDetails: any[]
  ): Promise<string> {
    return this.createAlert({
      type: 'driver_assignment',
      severity: unassignedTrucks > 3 ? 'critical' : 'high',
      title: `${unassignedTrucks} Truck(s) Without Drivers`,
      message: `${unassignedTrucks} truck(s) scheduled for ${targetDate} do not have drivers assigned.`,
      component: 'Shipping',
      triggerData: {
        unassignedCount: unassignedTrucks,
        targetDate,
        truckDetails
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a tunnel issue alert
   */
  static async createTunnelIssueAlert(
    groupId: string,
    clientName: string,
    issueType: string,
    description: string
  ): Promise<string> {
    return this.createAlert({
      type: 'tunnel_issue',
      severity: 'medium',
      title: `Tunnel Issue - ${clientName}`,
      message: `${issueType}: ${description}`,
      component: 'Tunnel',
      clientName,
      triggerData: {
        groupId,
        issueType
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a washing alert
   */
  static async createWashingAlert(
    groupId: string,
    clientName: string,
    alertType: string,
    message: string,
    severity: AlertSeverity = 'medium'
  ): Promise<string> {
    return this.createAlert({
      type: 'washing_alert',
      severity,
      title: `Washing Alert - ${clientName}`,
      message: `${alertType}: ${message}`,
      component: 'Washing',
      clientName,
      triggerData: {
        groupId,
        alertType
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a conventional processing alert
   */
  static async createConventionalAlert(
    issueType: string,
    description: string,
    severity: AlertSeverity = 'medium',
    clientName?: string
  ): Promise<string> {
    return this.createAlert({
      type: 'conventional_issue',
      severity,
      title: `Conventional Processing Alert`,
      message: `${issueType}: ${description}`,
      component: 'Conventional',
      clientName,
      triggerData: {
        issueType
      },
      createdBy: 'System'
    });
  }

  /**
   * Create an invoice warning alert
   */
  static async createInvoiceAlert(
    invoiceId: string,
    clientName: string,
    warningType: string,
    message: string,
    severity: AlertSeverity = 'medium'
  ): Promise<string> {
    return this.createAlert({
      type: 'invoice_warning',
      severity,
      title: `Invoice Alert - ${clientName}`,
      message: `${warningType}: ${message}`,
      component: 'Active Invoices',
      clientName,
      triggerData: {
        invoiceId,
        warningType
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a shipping problem alert
   */
  static async createShippingAlert(
    problemType: string,
    description: string,
    severity: AlertSeverity = 'medium',
    clientName?: string,
    truckNumber?: string
  ): Promise<string> {
    return this.createAlert({
      type: 'shipping_problem',
      severity,
      title: `Shipping Problem${truckNumber ? ` - Truck ${truckNumber}` : ''}`,
      message: `${problemType}: ${description}`,
      component: 'Shipping',
      clientName,
      triggerData: {
        problemType,
        truckNumber
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a special item alert
   */
  static async createSpecialItemAlert(
    itemName: string,
    clientName: string,
    actionRequired: string,
    severity: AlertSeverity = 'medium'
  ): Promise<string> {
    return this.createAlert({
      type: 'special_item',
      severity,
      title: `Special Item Alert - ${clientName}`,
      message: `Item "${itemName}" requires attention: ${actionRequired}`,
      component: 'Conventional',
      clientName,
      triggerData: {
        itemName,
        actionRequired
      },
      createdBy: 'System'
    });
  }

  /**
   * Create an end-of-shift detection alert
   */
  static async createEndOfShiftAlert(
    teamsFinished: number,
    totalTeams: number,
    recommendations: string[]
  ): Promise<string> {
    const severity: AlertSeverity = teamsFinished === totalTeams ? 'low' : 'medium';
    
    return this.createAlert({
      type: 'end_of_shift',
      severity,
      title: `End of Shift Detection`,
      message: `${teamsFinished} of ${totalTeams} teams have finished. ${recommendations.join('. ')}`,
      component: 'Production',
      triggerData: {
        teamsFinished,
        totalTeams,
        recommendations
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a system error alert
   */
  static async createSystemErrorAlert(
    errorType: string,
    errorMessage: string,
    component: string,
    severity: AlertSeverity = 'high'
  ): Promise<string> {
    return this.createAlert({
      type: 'system_error',
      severity,
      title: `System Error - ${component}`,
      message: `${errorType}: ${errorMessage}`,
      component,
      triggerData: {
        errorType,
        stack: errorMessage
      },
      createdBy: 'System'
    });
  }

  /**
   * Create a general alert
   */
  static async createGeneralAlert(
    title: string,
    message: string,
    component: string,
    severity: AlertSeverity = 'medium',
    createdBy: string = 'System',
    additionalData?: any
  ): Promise<string> {
    return this.createAlert({
      type: 'general',
      severity,
      title,
      message,
      component,
      triggerData: additionalData,
      createdBy
    });
  }
}

// Helper functions for common alert scenarios

/**
 * Alert helper for cart verification errors in segregation
 */
export const alertCartVerificationError = async (
  clientName: string,
  userName: string,
  expectedCount: number,
  actualCount: number,
  groupId: string
) => {
  return AlertService.createSegregationErrorAlert(
    clientName,
    userName,
    expectedCount,
    actualCount,
    groupId
  );
};

/**
 * Alert helper for driver assignment issues
 */
export const alertDriverAssignment = async (
  unassignedTrucks: number,
  targetDate: string,
  truckDetails: any[]
) => {
  return AlertService.createDriverAssignmentAlert(
    unassignedTrucks,
    targetDate,
    truckDetails
  );
};

/**
 * Alert helper for production delays
 */
export const alertProductionDelay = async (
  component: string,
  delayReason: string,
  clientName?: string
) => {
  return AlertService.createAlert({
    type: 'production_delay',
    severity: 'medium',
    title: `Production Delay - ${component}`,
    message: `Delay detected: ${delayReason}`,
    component,
    clientName,
    triggerData: {
      delayReason,
      timestamp: Date.now()
    },
    createdBy: 'System'
  });
};

export default AlertService;

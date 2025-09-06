// Driver Assignment Notification Service
// Checks for unassigned drivers and sends email alerts at 8 PM daily

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface Driver {
  id: string;
  name: string;
  linkedUserId?: string;
  linkedUsername?: string;
}

interface TruckAssignment {
  truckNumber: string;
  driverId: string;
  driverName: string;
  assignedDate: string;
}

interface TruckSchedule {
  truckNumber: string;
  hasDeliveries: boolean;
  totalInvoices: number;
  clientNames: string[];
}

interface UnassignedTruckAlert {
  unassignedTrucks: TruckSchedule[];
  assignedTrucks: TruckSchedule[];
  totalScheduledTrucks: number;
  targetDate: string;
}

/**
 * Gets tomorrow's date in YYYY-MM-DD format (local time)
 */
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Use local time instead of UTC to avoid timezone issues
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Fetches all drivers from Firebase
 */
async function fetchAllDrivers(): Promise<Driver[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "drivers"));
    const drivers: Driver[] = [];
    querySnapshot.forEach((doc) => {
      drivers.push({ id: doc.id, ...doc.data() } as Driver);
    });
    return drivers.filter(driver => driver.linkedUserId); // Only include linked drivers
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return [];
  }
}

/**
 * Fetches truck assignments for a specific date
 */
async function fetchTruckAssignments(date: string): Promise<TruckAssignment[]> {
  try {
    const assignmentsQuery = query(
      collection(db, "truckAssignments"),
      where("assignedDate", "==", date)
    );
    const querySnapshot = await getDocs(assignmentsQuery);
    const assignments: TruckAssignment[] = [];
    
    querySnapshot.forEach((doc) => {
      assignments.push(doc.data() as TruckAssignment);
    });
    
    return assignments;
  } catch (error) {
    console.error("Error fetching truck assignments:", error);
    return [];
  }
}

/**
 * Fetches scheduled invoices for a specific date
 */
async function fetchScheduledInvoices(date: string): Promise<any[]> {
  try {
    // Query for invoices that have delivery dates for the target date
    const invoicesQuery = query(
      collection(db, "invoices"),
      where("deliveryDate", ">=", date + "T00:00:00.000Z"),
      where("deliveryDate", "<", date + "T23:59:59.999Z")
    );
    const querySnapshot = await getDocs(invoicesQuery);
    const invoices: any[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Only include truck deliveries, not client pickup
      if (data.deliveryMethod !== "client_pickup" && data.truckNumber && data.truckNumber !== "CLIENT_PICKUP") {
        invoices.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    return invoices;
  } catch (error) {
    console.error("Error fetching scheduled invoices:", error);
    return [];
  }
}

/**
 * Checks which trucks have deliveries but no drivers assigned
 */
export async function checkUnassignedDrivers(): Promise<UnassignedTruckAlert> {
  const tomorrowDate = getTomorrowDate();
  
  // Fetch scheduled invoices and truck assignments for tomorrow
  const [scheduledInvoices, assignments] = await Promise.all([
    fetchScheduledInvoices(tomorrowDate),
    fetchTruckAssignments(tomorrowDate)
  ]);

  // Create a map of truck assignments by truck number
  const assignedTruckNumbers = new Set(assignments.map(assignment => assignment.truckNumber));
  
  // Group invoices by truck number
  const truckSchedules: { [key: string]: TruckSchedule } = {};
  
  scheduledInvoices.forEach(invoice => {
    const truckNumber = String(invoice.truckNumber);
    
    if (!truckSchedules[truckNumber]) {
      truckSchedules[truckNumber] = {
        truckNumber,
        hasDeliveries: true,
        totalInvoices: 0,
        clientNames: []
      };
    }
    
    truckSchedules[truckNumber].totalInvoices++;
    if (!truckSchedules[truckNumber].clientNames.includes(invoice.clientName)) {
      truckSchedules[truckNumber].clientNames.push(invoice.clientName);
    }
  });

  // Separate trucks into assigned and unassigned
  const allScheduledTrucks = Object.values(truckSchedules);
  const unassignedTrucks = allScheduledTrucks.filter(truck => !assignedTruckNumbers.has(truck.truckNumber));
  const assignedTrucks = allScheduledTrucks.filter(truck => assignedTruckNumbers.has(truck.truckNumber));

  return {
    unassignedTrucks,
    assignedTrucks,
    totalScheduledTrucks: allScheduledTrucks.length,
    targetDate: tomorrowDate
  };
}

/**
 * Generates email content for unassigned trucks alert
 */
export function generateUnassignedTrucksEmail(alert: UnassignedTruckAlert): {
  subject: string;
  body: string;
} {
  const { unassignedTrucks, totalScheduledTrucks, assignedTrucks, targetDate } = alert;
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const subject = unassignedTrucks.length > 0 
    ? `🚨 Truck Assignment Alert: ${unassignedTrucks.length} Unassigned Truck(s) for ${formatDate(targetDate)}`
    : `✅ All Trucks Assigned for ${formatDate(targetDate)}`;

  let body = `King Uniforms - Daily Truck Assignment Report\n`;
  body += `Date: ${formatDate(targetDate)}\n`;
  body += `Time Generated: ${new Date().toLocaleString("en-US")}\n\n`;

  if (unassignedTrucks.length > 0) {
    body += `⚠️  ATTENTION REQUIRED: ${unassignedTrucks.length} out of ${totalScheduledTrucks} trucks with scheduled deliveries do NOT have drivers assigned.\n\n`;
    
    body += `TRUCKS WITHOUT DRIVERS:\n`;
    body += `─────────────────────────\n`;
    unassignedTrucks.forEach((truck, index) => {
      body += `${index + 1}. Truck ${truck.truckNumber} - ${truck.totalInvoices} deliveries (${truck.clientNames.join(', ')})\n`;
    });
    
    body += `\n`;
    body += `TRUCKS WITH DRIVERS ASSIGNED:\n`;
    body += `────────────────────────────────\n`;
    if (assignedTrucks.length > 0) {
      assignedTrucks.forEach((truck, index) => {
        body += `${index + 1}. Truck ${truck.truckNumber} - ${truck.totalInvoices} deliveries (${truck.clientNames.join(', ')})\n`;
      });
    } else {
      body += `None assigned yet.\n`;
    }
    
    body += `\n`;
    body += `ACTION REQUIRED:\n`;
    body += `─────────────────\n`;
    body += `Please log in to the King Uniforms system and assign drivers to the unassigned trucks before tomorrow's operations begin.\n\n`;
    body += `To assign drivers:\n`;
    body += `1. Go to Shipping Dashboard\n`;
    body += `2. Select tomorrow's date (${formatDate(targetDate)})\n`;
    body += `3. Use the "Assign Driver" dropdown for each truck\n`;
    body += `4. Ensure all trucks with deliveries have assigned drivers\n\n`;
  } else {
    body += `✅ EXCELLENT: All ${totalScheduledTrucks} trucks with scheduled deliveries have drivers assigned.\n\n`;
    
    body += `TRUCKS WITH DRIVERS ASSIGNED:\n`;
    body += `────────────────────────────────\n`;
    assignedTrucks.forEach((truck, index) => {
      body += `${index + 1}. Truck ${truck.truckNumber} - ${truck.totalInvoices} deliveries (${truck.clientNames.join(', ')})\n`;
    });
    
    body += `\n`;
    body += `No action required. All trucks are ready for tomorrow's operations.\n\n`;
  }

  body += `─────────────────────────────────────────────────────\n`;
  body += `This is an automated message from King Uniforms Truck Assignment System.\n`;
  body += `If you have questions, please contact your system administrator.\n`;

  return { subject, body };
}

/**
 * Sends email notification about unassigned trucks
 */
export async function sendUnassignedTrucksAlert(
  alert: UnassignedTruckAlert,
  recipients: string[]
): Promise<boolean> {
  if (recipients.length === 0) {
    console.warn("No recipients specified for truck assignment alert");
    return false;
  }

  const { subject, body } = generateUnassignedTrucksEmail(alert);

  try {
    // Use the existing email API
    const response = await fetch('/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipients.join(', '),
        subject,
        body
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API responded with status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`Driver assignment alert sent successfully to: ${recipients.join(', ')}`);
      return true;
    } else {
      console.error("Failed to send driver assignment alert:", result);
      return false;
    }
  } catch (error) {
    console.error("Error sending driver assignment alert:", error);
    return false;
  }
}

/**
 * Main function to check and notify about unassigned trucks
 */
export async function checkAndNotifyUnassignedDrivers(
  recipients: string[] = ["rmperez@kinguniforms.net", "eric.perez.pr@gmail.com", "jperez@kinguniforms.net"]
): Promise<void> {
  try {
    console.log("Checking for unassigned trucks...");
    
    const alert = await checkUnassignedDrivers();
    
    // Always send notification (whether there are unassigned trucks or not)
    // This provides daily confirmation that the system is working
    const success = await sendUnassignedTrucksAlert(alert, recipients);
    
    if (success) {
      console.log(`Truck assignment check completed. ${alert.unassignedTrucks.length} unassigned trucks found.`);
    } else {
      console.error("Failed to send truck assignment notification");
    }
  } catch (error) {
    console.error("Error in truck assignment check:", error);
    
    // Send error notification
    try {
      await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipients.join(', '),
          subject: '🚨 King Uniforms - Truck Assignment Check Failed',
          body: `The automated truck assignment check failed at ${new Date().toLocaleString("en-US")}.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the system manually and contact technical support if needed.`
        }),
      });
    } catch (emailError) {
      console.error("Failed to send error notification:", emailError);
    }
  }
}

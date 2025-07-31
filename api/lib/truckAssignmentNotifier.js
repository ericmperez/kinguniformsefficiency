// Server-side Driver Assignment Notification Service for Vercel
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";

/**
 * Gets tomorrow's date in YYYY-MM-DD format (local time)
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Use local time instead of UTC to avoid timezone issues
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Fetches truck assignments for a specific date
 */
async function fetchTruckAssignments(date) {
  try {
    const assignmentsQuery = query(
      collection(db, "truckAssignments"),
      where("assignedDate", "==", date)
    );
    const querySnapshot = await getDocs(assignmentsQuery);
    const assignments = [];
    
    querySnapshot.forEach((doc) => {
      assignments.push(doc.data());
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
async function fetchScheduledInvoices(date) {
  try {
    // Query for invoices that have delivery dates for the target date
    const invoicesQuery = query(
      collection(db, "invoices"),
      where("deliveryDate", ">=", date + "T00:00:00.000Z"),
      where("deliveryDate", "<", date + "T23:59:59.999Z")
    );
    const querySnapshot = await getDocs(invoicesQuery);
    const invoices = [];
    
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
export async function checkUnassignedTrucks() {
  const tomorrowDate = getTomorrowDate();
  
  // Fetch scheduled invoices and truck assignments for tomorrow
  const [scheduledInvoices, assignments] = await Promise.all([
    fetchScheduledInvoices(tomorrowDate),
    fetchTruckAssignments(tomorrowDate)
  ]);

  // Create a map of truck assignments by truck number
  const assignedTruckNumbers = new Set(assignments.map(assignment => assignment.truckNumber));
  
  // Group invoices by truck number
  const truckSchedules = {};
  
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
export function generateUnassignedTrucksEmail(alert) {
  const { unassignedTrucks, totalScheduledTrucks, assignedTrucks, targetDate } = alert;
  
  const formatDate = (dateStr) => {
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
 * Main function to check and notify about unassigned trucks
 */
export async function checkAndNotifyUnassignedDrivers(recipients = ["emperez@kinguniforms.net"]) {
  try {
    console.log("Checking for unassigned trucks...");
    
    const alert = await checkUnassignedTrucks();
    const { subject, body } = generateUnassignedTrucksEmail(alert);
    
    // Send the email using fetch to the email API
    const response = await fetch(process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/send-test-email`
      : 'http://localhost:5173/api/send-test-email', {
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
      console.log(`Truck assignment alert sent successfully to: ${recipients.join(', ')}`);
      console.log(`Truck assignment check completed. ${alert.unassignedTrucks.length} unassigned trucks found.`);
      return { success: true, alert };
    } else {
      console.error("Failed to send truck assignment alert:", result);
      throw new Error("Failed to send truck assignment alert");
    }
  } catch (error) {
    console.error("Error in truck assignment check:", error);
    throw error;
  }
}

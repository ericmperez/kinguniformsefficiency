import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice, TruckLoadingVerification, TruckPosition } from "../types";
import "./ShippingPage.css";
import InvoiceDetailsPopup from "./InvoiceDetailsPopup";
import SignatureModal from "./SignatureModal";
import { useAuth } from "./AuthContext";
import { formatDateForInput, dateStringToLocalISOString, formatDateEnglish } from "../utils/dateFormatter";

interface ShippingTruckData {
  truckNumber: string;
  invoices: ShippingInvoice[];
  assignedDriver?: string;
}

interface ShippingInvoice {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  clientId: string;
  deliveryDate: string;
  cartCount: number;
  truckNumber: string;
  receivedBy?: string;
  hasSignature?: boolean;
  tripNumber?: number; // Trip number (1 or 2)
  tripType?: "Trip 1" | "Trip 2"; // Descriptive trip label
}

interface Driver {
  id: string;
  name: string;
  linkedUserId?: string; // Link to user account
  linkedUsername?: string; // Cached username for display
}

interface TruckAssignment {
  truckNumber: string;
  driverId: string;
  driverName: string;
  assignedDate: string;
}

interface TruckCompletion {
  truckNumber: string;
  completedDate: string;
  completedBy: string;
  completedAt: string;
  isCompleted: boolean;
  tripNumber: number; // 1 for first trip, 2 for second trip
  tripType: "Trip 1" | "Trip 2";
}

interface EmergencyDelivery {
  id: string;
  driverId: string;
  driverName: string;
  truckNumber: string;
  clientId: string;
  clientName: string;
  deliveryDate: string;
  items: string;
  reason: string;
  signature: {
    image: string | null;
    name: string;
    timestamp: any;
    noPersonnelAvailable?: boolean;
  };
  createdAt: string;
  createdBy: string;
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth(); // Get current authenticated user
  const [shippingData, setShippingData] = useState<ShippingTruckData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  // Track which client is selected to show action buttons
  const [selectedClientInvoiceId, setSelectedClientInvoiceId] = useState<string | null>(
    null
  );
  const [signatureInvoice, setSignatureInvoice] = useState<{
    id: string;
    number?: string;
    clientName: string;
    clientId: string;
    fullInvoiceData?: any; // Add full invoice data for cart count display
    driverName?: string; // Add driver name
    deliveryDate?: string; // Add delivery date
  } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<{[key: string]: TruckAssignment}>({});
  const [truckCompletions, setTruckCompletions] = useState<{[key: string]: TruckCompletion}>({});
  const [truckLoadingVerifications, setTruckLoadingVerifications] = useState<{[key: string]: TruckLoadingVerification}>({});
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);
  const [completingTruck, setCompletingTruck] = useState<string | null>(null);
  const [verifyingTruckLoading, setVerifyingTruckLoading] = useState<string | null>(null);
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [showLoadingVerificationModal, setShowLoadingVerificationModal] = useState<string | null>(null);
  const [showViewLoadingDiagramModal, setShowViewLoadingDiagramModal] = useState<string | null>(null);
  const [actualCartCount, setActualCartCount] = useState<number>(0);
  const [verificationNotes, setVerificationNotes] = useState<string>("");
  const [truckDiagram, setTruckDiagram] = useState<TruckPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<{row: number, col: number} | null>(null);
  const [availableColors] = useState<string[]>([
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", 
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    "#F8C471", "#82E0AA", "#F1948A", "#85C1E9", "#D2B4DE"
  ]);

  // Scheduled invoices state (for non-shipped invoices with delivery dates)
  const [scheduledInvoices, setScheduledInvoices] = useState<ShippingInvoice[]>([]);

  // Force refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Track when data is being refreshed
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // Emergency delivery state
  const [showEmergencyDeliveryModal, setShowEmergencyDeliveryModal] = useState<boolean>(false);
  const [emergencyClientId, setEmergencyClientId] = useState<string>("");
  const [emergencyItems, setEmergencyItems] = useState<string>("");
  const [emergencyReason, setEmergencyReason] = useState<string>("");
  const [emergencySignature, setEmergencySignature] = useState<{
    id: string;
    clientName: string;
    receiverName?: string;
    noPersonnelAvailable?: boolean;
    signatureCanvas?: HTMLCanvasElement;
    isDrawing?: boolean;
    hasSignature?: boolean;
  } | null>(null);
  const [savingEmergencyDelivery, setSavingEmergencyDelivery] = useState<boolean>(false);
  const [clients, setClients] = useState<any[]>([]);

  // Emergency deliveries view state
  const [showEmergencyDeliveriesModal, setShowEmergencyDeliveriesModal] = useState<boolean>(false);
  const [emergencyDeliveries, setEmergencyDeliveries] = useState<EmergencyDelivery[]>([]);
  const [loadingEmergencyDeliveries, setLoadingEmergencyDeliveries] = useState<boolean>(false);

  // Function to handle clicking on an invoice
  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
  };

  // Function to handle clearing a signature
  const handleClearSignature = async (invoice: ShippingInvoice) => {
    if (!user) return;

    // Check if there is actually a signature to clear
    if (!invoice.hasSignature) {
      alert("This invoice does not have a signature to clear.");
      return;
    }

    // Confirm the action
    const confirmClear = window.confirm(
      `Are you sure you want to clear the signature for ${invoice.clientName}?\n\nThis will:\n• Remove the signature data\n• Reset the invoice to unsigned status\n• Clear the receiver information`
    );

    if (!confirmClear) return;

    try {
      // Update the invoice document to remove signature
      const { updateDoc, doc } = await import("firebase/firestore");
      
      await updateDoc(doc(db, "invoices", invoice.id), {
        signature: null,
        receivedBy: null,
      });

      // Log the activity
      if (user.username) {
        const { logActivity } = await import("../services/firebaseService");
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} cleared signature for laundry ticket #${invoice.invoiceNumber || invoice.id} (${invoice.clientName})`,
          user: user.username,
        });
      }

      // Refresh the shipping data to reflect the changes
      await fetchShippingData();

      alert(`Signature cleared for ${invoice.clientName}. The invoice is now marked as unsigned.`);
    } catch (error) {
      console.error("Error clearing signature:", error);
      alert("Error clearing signature. Please try again.");
    }
  };

  // Function to handle capturing a signature
  const handleSignatureCapture = async (invoice: ShippingInvoice) => {
    // Check if truck loading verification has been completed
    const loadingVerification = truckLoadingVerifications[invoice.truckNumber];
    if (!loadingVerification || !loadingVerification.isVerified) {
      alert("Truck loading verification must be completed before capturing signatures. Please verify the loading layout first.");
      return;
    }

    try {
      // Fetch full invoice data to get cart information
      const fullInvoiceData = await getDoc(doc(db, "invoices", invoice.id));
      const invoiceData = fullInvoiceData.exists() ? fullInvoiceData.data() : null;

      // Extract driver name from truck assignments
      const assignment = truckAssignments[invoice.truckNumber];
      const driverName = assignment ? assignment.driverName : undefined;
      
      // Format delivery date
      const deliveryDate = invoice.deliveryDate ? 
        formatDateEnglish(invoice.deliveryDate) : 
        selectedDate ? formatDateEnglish(selectedDate) : undefined;

      setSignatureInvoice({
        id: invoice.id,
        number: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientId: invoice.clientId,
        fullInvoiceData: invoiceData, // Include full invoice data with carts
        driverName: driverName, // Add driver name
        deliveryDate: deliveryDate, // Add delivery date
      });
    } catch (error) {
      console.error("Error fetching invoice data for signature:", error);
      // Fallback to basic signature without cart data
      setSignatureInvoice({
        id: invoice.id,
        number: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientId: invoice.clientId,
      });
    }
  };

  // Function to fetch drivers from Firebase
  const fetchDrivers = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "drivers"));
      const driversData: Driver[] = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() } as Driver);
      });
      setDrivers(driversData);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  }, []);

  // Effect to find current driver's ID if user is a driver
  useEffect(() => {
    if (user && user.role === "Driver" && drivers.length > 0) {
      const linkedDriver = drivers.find(
        (driver: any) => driver.linkedUserId === user.id
      );
      if (linkedDriver) {
        setCurrentDriverId(linkedDriver.id);
      }
    }
  }, [user, drivers]);

  // Function to fetch truck assignments for the selected date
  const fetchTruckAssignments = useCallback(async () => {
    if (!selectedDate) return;
    
    try {
      const assignmentsQuery = query(
        collection(db, "truckAssignments"),
        where("assignedDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(assignmentsQuery);
      const assignments: {[key: string]: TruckAssignment} = {};
      
      querySnapshot.forEach((doc) => {
        const assignment = doc.data() as TruckAssignment;
        assignments[assignment.truckNumber] = assignment;
      });
      
      setTruckAssignments(assignments);
    } catch (error) {
      console.error("Error fetching truck assignments:", error);
    }
  }, [selectedDate]);

  // Function to fetch truck completions for the selected date
  const fetchTruckCompletions = useCallback(async () => {
    if (!selectedDate) return;
    
    try {
      // Query for all completions on the selected date (both trips)
      const completionsQuery = query(
        collection(db, "truckCompletions"),
        where("completedDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(completionsQuery);
      const completions: {[key: string]: TruckCompletion} = {};
      
      querySnapshot.forEach((doc) => {
        const completion = doc.data() as TruckCompletion;
        const truckNumber = completion.truckNumber;
        
        // Keep the most recent trip completion for each truck
        if (!completions[truckNumber] || completion.tripNumber > completions[truckNumber].tripNumber) {
          completions[truckNumber] = completion;
        }
      });
      
      setTruckCompletions(completions);
    } catch (error) {
      console.error("Error fetching truck completions:", error);
    }
  }, [selectedDate]);

  // Function to fetch clients from Firebase
  const fetchClients = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "clients"));
      const clientsData: any[] = [];
      querySnapshot.forEach((doc) => {
        clientsData.push({ id: doc.id, ...doc.data() });
      });
      setClients(clientsData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  // Function to handle emergency delivery
  const handleEmergencyDelivery = () => {
    setEmergencyClientId("");
    setEmergencyItems("");
    setEmergencyReason("");
    setShowEmergencyDeliveryModal(true);
  };

  // Function to handle emergency delivery signature
  const handleEmergencySignature = () => {
    if (!emergencyClientId || !emergencyItems.trim() || !emergencyReason.trim()) {
      alert("Please fill in all required fields before capturing signature.");
      return;
    }

    const selectedClient = clients.find(c => c.id === emergencyClientId);
    if (!selectedClient) {
      alert("Please select a valid client.");
      return;
    }

    setEmergencySignature({
      id: `emergency_${Date.now()}`,
      clientName: selectedClient.name
    });
  };

  // Function to save emergency delivery
  const saveEmergencyDelivery = async (signatureData: any) => {
    if (!emergencyClientId || !emergencyItems.trim() || !emergencyReason.trim() || !user || !selectedDate) {
      return;
    }

    const selectedClient = clients.find(c => c.id === emergencyClientId);
    if (!selectedClient) return;

    setSavingEmergencyDelivery(true);
    try {
      const emergencyDelivery: Omit<EmergencyDelivery, 'id'> = {
        driverId: currentDriverId || user.id,
        driverName: user.username || user.id,
        truckNumber: "Emergency", // Will be updated if we can determine the truck
        clientId: emergencyClientId,
        clientName: selectedClient.name,
        deliveryDate: selectedDate,
        items: emergencyItems,
        reason: emergencyReason,
        signature: signatureData,
        createdAt: new Date().toISOString(),
        createdBy: user.username || user.id,
      };

      // Try to determine which truck the driver is assigned to
      if (currentDriverId) {
        const assignedTruck = Object.entries(truckAssignments).find(([_, assignment]) => 
          assignment.driverId === currentDriverId
        );
        if (assignedTruck) {
          emergencyDelivery.truckNumber = assignedTruck[0];
        }
      }

      // Create a unique document ID
      const docId = `${Date.now()}_${emergencyDelivery.driverId}`;
      await setDoc(doc(db, "emergencyDeliveries", docId), emergencyDelivery);

      alert("Emergency delivery recorded successfully!");
      setShowEmergencyDeliveryModal(false);
      setEmergencySignature(null);
    } catch (error) {
      console.error("Error saving emergency delivery:", error);
      alert("Error saving emergency delivery. Please try again.");
    } finally {
      setSavingEmergencyDelivery(false);
    }
  };

  // Function to fetch emergency deliveries for the selected date
  const fetchEmergencyDeliveries = useCallback(async () => {
    if (!selectedDate) {
      setEmergencyDeliveries([]);
      return;
    }
    
    setLoadingEmergencyDeliveries(true);
    try {
      const emergencyQuery = query(
        collection(db, "emergencyDeliveries"),
        where("deliveryDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(emergencyQuery);
      const deliveries: EmergencyDelivery[] = [];
      
      querySnapshot.forEach((doc) => {
        deliveries.push({ id: doc.id, ...doc.data() } as EmergencyDelivery);
      });
      
      // Sort by creation time (most recent first)
      deliveries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setEmergencyDeliveries(deliveries);
    } catch (error) {
      console.error("Error fetching emergency deliveries:", error);
    } finally {
      setLoadingEmergencyDeliveries(false);
    }
  }, [selectedDate]);

  // Function to handle viewing emergency deliveries
  const handleViewEmergencyDeliveries = () => {
    fetchEmergencyDeliveries();
    setShowEmergencyDeliveriesModal(true);
  };

  // Function to fetch truck loading verifications for the selected date
  const fetchTruckLoadingVerifications = useCallback(async () => {
    if (!selectedDate) return;
    
    try {
      // Query for all verifications on the selected date (both trips)
      const verificationsQuery = query(
        collection(db, "truckLoadingVerifications"),
        where("verifiedDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(verificationsQuery);
      const verifications: {[key: string]: TruckLoadingVerification} = {};
      
      querySnapshot.forEach((doc) => {
        const verification = doc.data() as TruckLoadingVerification;
        const truckNumber = verification.truckNumber;
        
        // Keep the most recent trip verification for each truck
        if (!verifications[truckNumber] || (verification.tripNumber || 0) > (verifications[truckNumber].tripNumber || 0)) {
          verifications[truckNumber] = verification;
        }
      });
      
      setTruckLoadingVerifications(verifications);
    } catch (error) {
      console.error("Error fetching truck loading verifications:", error);
    }
  }, [selectedDate]);

  // Function to assign driver to truck
  const assignDriverToTruck = async (truckNumber: string, driverId: string) => {
    if (!selectedDate || !driverId) return;
    
    setSavingAssignment(truckNumber);
    try {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return;

      const assignment: TruckAssignment = {
        truckNumber,
        driverId,
        driverName: driver.name,
        assignedDate: selectedDate,
      };

      // Create a unique document ID based on truck number and date
      const docId = `${truckNumber}_${selectedDate}`;
      await setDoc(doc(db, "truckAssignments", docId), assignment);

      // Update local state
      setTruckAssignments(prev => ({
        ...prev,
        [truckNumber]: assignment
      }));

      console.log(`Assigned ${driver.name} to Truck ${truckNumber} for ${selectedDate}`);
    } catch (error) {
      console.error("Error assigning driver to truck:", error);
    } finally {
      setSavingAssignment(null);
    }
  };

  // Function to check if all invoices in a truck have signatures
  const areAllInvoicesSigned = (truck: ShippingTruckData): boolean => {
    return truck.invoices.every(invoice => invoice.hasSignature);
  };

  // Function to mark truck as completed
  const markTruckAsCompleted = async (truckNumber: string) => {
    if (!selectedDate || !user) return;

    const truck = filteredData.find(t => t.truckNumber === truckNumber);
    if (!truck) return;

    if (!areAllInvoicesSigned(truck)) {
      alert("All invoices must have signatures before marking truck as completed.");
      return;
    }

    // Check if truck loading verification has been completed
    const loadingVerification = truckLoadingVerifications[truckNumber];
    if (!loadingVerification || !loadingVerification.isVerified) {
      alert("Truck loading diagram must be completed and verified before marking truck as done. Please verify the loading layout first.");
      return;
    }

    const currentTripNumber = getCurrentTripNumber(truckNumber);
    const currentTripType = getCurrentTripType(truckNumber);
    
    // Determine completion message based on trip
    const tripLabel = currentTripType;
    const confirmMessage = currentTripNumber === 1 
      ? `Mark Truck #${truckNumber} ${tripLabel} as completed? The truck will then be available for Trip 2 assignments.`
      : `Mark Truck #${truckNumber} ${tripLabel} as completed? This will complete all deliveries for this truck today.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setCompletingTruck(truckNumber);
    try {
      const completion: TruckCompletion = {
        truckNumber,
        completedDate: selectedDate,
        completedBy: user.username || user.id,
        completedAt: new Date().toISOString(),
        isCompleted: true,
        tripNumber: currentTripNumber,
        tripType: currentTripType,
      };

      // Create a unique document ID based on truck number, date, and trip
      const docId = `${truckNumber}_${selectedDate}_trip${currentTripNumber}`;
      await setDoc(doc(db, "truckCompletions", docId), completion);

      // Update local state
      setTruckCompletions(prev => ({
        ...prev,
        [truckNumber]: completion
      }));

      console.log(`Truck ${truckNumber} ${tripLabel} marked as completed for ${selectedDate}`);
    } catch (error) {
      console.error("Error marking truck as completed:", error);
      alert("Error marking truck as completed. Please try again.");
    } finally {
      setCompletingTruck(null);
    }
  };

  // Function to unmark truck as completed (for supervisors/admins)
  const unmarkTruckAsCompleted = async (truckNumber: string) => {
    if (!selectedDate || !user) return;

    const completion = truckCompletions[truckNumber];
    if (!completion) return;

    const tripLabel = completion.tripType;
    const isTrip2 = completion.tripNumber === 2;
    
    const confirmMessage = isTrip2 
      ? `Unmark Truck #${truckNumber} ${tripLabel} as completed? This will reopen the truck for Trip 2 deliveries.`
      : `Unmark Truck #${truckNumber} ${tripLabel} as completed? This will reopen the truck for Trip 1 deliveries.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setCompletingTruck(truckNumber);
    try {
      // Delete the specific trip completion document
      const docId = `${truckNumber}_${selectedDate}_trip${completion.tripNumber}`;
      await deleteDoc(doc(db, "truckCompletions", docId));

      // If this was Trip 2, we need to check if there's a Trip 1 completion to revert to
      if (completion.tripNumber === 2) {
        // Query for Trip 1 completion
        const trip1DocId = `${truckNumber}_${selectedDate}_trip1`;
        const trip1Doc = await getDoc(doc(db, "truckCompletions", trip1DocId));
        
        if (trip1Doc.exists()) {
          // Revert to Trip 1 completion state
          const trip1Completion = trip1Doc.data() as TruckCompletion;
          setTruckCompletions(prev => ({
            ...prev,
            [truckNumber]: trip1Completion
          }));
        } else {
          // No Trip 1 completion found, remove from state
          setTruckCompletions(prev => {
            const updated = { ...prev };
            delete updated[truckNumber];
            return updated;
          });
        }
      } else {
        // Trip 1 was unmarked, remove from state completely
        setTruckCompletions(prev => {
          const updated = { ...prev };
          delete updated[truckNumber];
          return updated;
        });
      }

      console.log(`Truck ${truckNumber} ${tripLabel} unmarked as completed for ${selectedDate}`);
    } catch (error) {
      console.error("Error unmarking truck as completed:", error);
      alert("Error unmarking truck as completed. Please try again.");
    } finally {
      setCompletingTruck(null);
    }
  };

  // Function to get current trip number for a truck based on completions
  const getCurrentTripNumber = (truckNumber: string): number => {
    const completion = truckCompletions[truckNumber];
    if (!completion || !completion.isCompleted) {
      return 1; // If no completion or not completed, we're on Trip 1
    }
    
    // If Trip 1 is completed, we're on Trip 2
    if (completion.tripNumber === 1) {
      return 2;
    }
    
    // If Trip 2 is completed, no more trips for today
    return 2; // Still return 2 to prevent errors, but truck should be fully completed
  };

  // Function to get current trip type for a truck
  const getCurrentTripType = (truckNumber: string): "Trip 1" | "Trip 2" => {
    const tripNumber = getCurrentTripNumber(truckNumber);
    return tripNumber === 1 ? "Trip 1" : "Trip 2";
  };

  // Function to check if a truck can accept new invoices
  const canTruckAcceptNewInvoices = (truckNumber: string): boolean => {
    const completion = truckCompletions[truckNumber];
    if (!completion || !completion.isCompleted) {
      return true; // Trip 1 not completed, can accept invoices
    }
    
    // If Trip 1 is completed but Trip 2 is not, can accept invoices for Trip 2
    if (completion.tripNumber === 1) {
      return true;
    }
    
    // If Trip 2 is completed, cannot accept more invoices
    return false;
  };

  // Function to get trip status message for users
  const getTripStatusMessage = (truckNumber: string): string => {
    const completion = truckCompletions[truckNumber];
    const currentTrip = getCurrentTripNumber(truckNumber);
    const canAccept = canTruckAcceptNewInvoices(truckNumber);
    
    if (!completion || !completion.isCompleted) {
      return `Currently on Trip 1. Can accept new invoices.`;
    }
    
    if (completion.tripNumber === 1) {
      return `Trip 1 completed. Now accepting invoices for Trip 2.`;
    }
    
    if (completion.tripNumber === 2) {
      return `All trips completed. No more invoices can be assigned to this truck today.`;
    }
    
    return `Unknown trip status.`;
  };

  // Function to get overflow recommendation
  const getOverflowRecommendation = (truckNumber: string): string | null => {
    if (!canTruckAcceptNewInvoices(truckNumber)) {
      // Find available trucks that can still accept invoices
      const availableTrucks = Array.from({ length: 10 }, (_, i) => (30 + i).toString())
        .filter(truck => canTruckAcceptNewInvoices(truck))
        .slice(0, 3); // Show max 3 recommendations
      
      if (availableTrucks.length > 0) {
        return `Truck #${truckNumber} is full. Consider assigning to: ${availableTrucks.map(t => `#${t}`).join(', ')}`;
      } else {
        return `All trucks appear to be at capacity. Contact supervisor for guidance.`;
      }
    }
    
    return null;
  };

  // Function to determine which trip an invoice belongs to based on truck state
  const determineInvoiceTrip = (truckNumber: string): { tripNumber: number; tripType: "Trip 1" | "Trip 2" } => {
    const currentTrip = getCurrentTripNumber(truckNumber);
    const currentTripType = getCurrentTripType(truckNumber);
    
    return {
      tripNumber: currentTrip,
      tripType: currentTripType
    };
  };

  // Function to calculate expected cart count for a truck
  const getExpectedCartCount = (truck: ShippingTruckData): number => {
    return truck.invoices.reduce((total, invoice) => total + invoice.cartCount, 0);
  };

  // Function to initialize empty truck diagram (3x4 grid)
  const initializeTruckDiagram = (): TruckPosition[] => {
    const positions: TruckPosition[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        positions.push({
          row,
          col,
          clientId: null,
          clientName: null,
          color: null,
          cartCount: 0
        });
      }
    }
    return positions;
  };

  // Function to calculate total cart count from truck diagram
  const calculateTotalCartCountFromDiagram = (diagram: TruckPosition[]): number => {
    return diagram.reduce((total, position) => {
      return total + (position.cartCount || 0);
    }, 0);
  };

  // Function to get unique clients from truck invoices
  const getUniqueClientsFromTruck = (truck: ShippingTruckData) => {
    const clientMap = new Map();
    truck.invoices.forEach(invoice => {
      if (!clientMap.has(invoice.clientId)) {
        clientMap.set(invoice.clientId, {
          id: invoice.clientId,
          name: invoice.clientName,
          totalCarts: 0
        });
      }
      clientMap.get(invoice.clientId).totalCarts += invoice.cartCount;
    });
    return Array.from(clientMap.values());
  };

  // Function to assign client to truck position
  const assignClientToPosition = (row: number, col: number, clientId: string, clientName: string, color: string, cartCount?: number) => {
    setTruckDiagram(prev => prev.map(pos => {
      if (pos.row === row && pos.col === col) {
        return {
          ...pos,
          clientId,
          clientName,
          color,
          cartCount: cartCount || 0
        };
      }
      return pos;
    }));
  };

  // Function to clear truck position
  const clearTruckPosition = (row: number, col: number) => {
    setTruckDiagram(prev => prev.map(pos => {
      if (pos.row === row && pos.col === col) {
        return {
          ...pos,
          clientId: null,
          clientName: null,
          color: null,
          cartCount: 0
        };
      }
      return pos;
    }));
  };

  // Function to handle truck loading verification
  const handleVerifyTruckLoading = (truckNumber: string) => {
    const truck = filteredData.find(t => t.truckNumber === truckNumber);
    if (!truck) return;

    const expectedCount = getExpectedCartCount(truck);
    setActualCartCount(expectedCount); // Pre-fill with expected count
    setVerificationNotes("");
    setTruckDiagram(initializeTruckDiagram()); // Initialize empty diagram
    setSelectedPosition(null);
    setShowLoadingVerificationModal(truckNumber);
  };

  // Function to save truck loading verification
  const saveTruckLoadingVerification = async () => {
    if (!showLoadingVerificationModal || !selectedDate || !user) return;

    const truck = filteredData.find(t => t.truckNumber === showLoadingVerificationModal);
    if (!truck) return;

    const expectedCount = getExpectedCartCount(truck);
    
    // Validate cart count input
    if (actualCartCount <= 0) {
      alert("Please enter a valid number of carts loaded (greater than 0).");
      return;
    }

    // Show confirmation if cart counts don't match
    if (actualCartCount !== expectedCount) {
      const confirmed = window.confirm(
        `Cart count mismatch detected!\n\n` +
        `Expected: ${expectedCount} carts\n` +
        `Actual: ${actualCartCount} carts\n\n` +
        `Are you sure you want to proceed with this verification? ` +
        `Please ensure you've added notes explaining the discrepancy.`
      );
      
      if (!confirmed) {
        return;
      }

      // Require notes when there's a mismatch
      if (!verificationNotes.trim()) {
        alert("Please add notes explaining why the cart count doesn't match the expected amount.");
        return;
      }
    }
    
    setVerifyingTruckLoading(showLoadingVerificationModal);
    try {
      // Sanitize truck diagram to remove undefined values that Firestore doesn't support
      const sanitizedTruckDiagram = truckDiagram.map(pos => {
        const sanitizedPos: any = {
          row: Number(pos.row) || 0,
          col: Number(pos.col) || 0,
          cartCount: Number(pos.cartCount) || 0
        };
        
        // Only add these fields if they have actual non-null, non-undefined, non-empty values
        if (pos.clientId && pos.clientId !== null && pos.clientId !== undefined) {
          sanitizedPos.clientId = String(pos.clientId);
        }
        if (pos.clientName && pos.clientName !== null && pos.clientName !== undefined) {
          sanitizedPos.clientName = String(pos.clientName);
        }
        if (pos.color && pos.color !== null && pos.color !== undefined) {
          sanitizedPos.color = String(pos.color);
        }
        
        return sanitizedPos;
      });

      // Create verification object with complete sanitization - ensure no undefined values
      const verification = {
        truckNumber: String(showLoadingVerificationModal || ""),
        verifiedDate: String(selectedDate || ""),
        verifiedBy: String(user?.username || user?.id || "Unknown"),
        verifiedAt: new Date().toISOString(),
        actualCartCount: Number(actualCartCount) || 0,
        expectedCartCount: Number(expectedCount) || 0,
        notes: String(verificationNotes || ""),
        isVerified: true,
        truckDiagram: sanitizedTruckDiagram || [],
        tripNumber: getCurrentTripNumber(showLoadingVerificationModal),
        tripType: getCurrentTripType(showLoadingVerificationModal)
      };

      // Double-check for any undefined values before saving
      console.log("🔧 [DEBUG] Verification object before saving:", verification);
      
      // Remove any undefined values from the object
      const cleanVerification = JSON.parse(JSON.stringify(verification, (key, value) => {
        return value === undefined ? null : value;
      }));

      // Create a unique document ID based on truck number, date, and trip
      const docId = `${showLoadingVerificationModal}_${selectedDate}_trip${getCurrentTripNumber(showLoadingVerificationModal)}`;
      console.log("🔧 [DEBUG] Saving to document ID:", docId);
      console.log("🔧 [DEBUG] Clean verification object:", cleanVerification);
      
      await setDoc(doc(db, "truckLoadingVerifications", docId), cleanVerification);

      // Update local state - cast to proper type for local state
      const typedVerification: TruckLoadingVerification = {
        id: docId,
        invoiceId: "", // Empty for truck-level verification
        truckNumber: cleanVerification.truckNumber,
        verifiedDate: cleanVerification.verifiedDate,
        verifiedBy: cleanVerification.verifiedBy,
        verifiedAt: cleanVerification.verifiedAt,
        actualCartCount: cleanVerification.actualCartCount,
        expectedCartCount: cleanVerification.expectedCartCount,
        notes: cleanVerification.notes,
        isVerified: cleanVerification.isVerified,
        truckDiagram: cleanVerification.truckDiagram,
        tripNumber: 1, // Default to Trip 1 for now, will be enhanced with automatic detection
        tripType: "Trip 1",
        items: [] // Empty for truck-level verification
      };

      setTruckLoadingVerifications(prev => ({
        ...prev,
        [showLoadingVerificationModal]: typedVerification
      }));

      console.log(`Truck ${showLoadingVerificationModal} loading verified for ${selectedDate}`);
      setShowLoadingVerificationModal(null);
      setActualCartCount(0);
      setVerificationNotes("");
      setTruckDiagram([]);
      setSelectedPosition(null);
    } catch (error) {
      console.error("Error saving truck loading verification:", error);
      alert("Error saving truck loading verification. Please try again.");
    } finally {
      setVerifyingTruckLoading(null);
    }
  };

  // Function to handle viewing the truck loading diagram
  const handleViewLoadingDiagram = (truckNumber: string) => {
    setShowViewLoadingDiagramModal(truckNumber);
  };

  // Function to fetch shipping data that can be called to refresh the data
  const fetchShippingData = useCallback(async (dateToFetch?: string) => {
    try {
      setLoading(true);

      // First, get all invoices with delivery dates to populate available dates
      const allInvoicesQuery = query(
        collection(db, "invoices"),
        where("deliveryDate", "!=", null)
      );
      
      const allInvoicesSnapshot = await getDocs(allInvoicesQuery);
      const allDates = new Set<string>();

      console.log(`📅 [ShippingPage] Found ${allInvoicesSnapshot.size} invoices with delivery dates`);

      // Collect all delivery dates from all invoices
      allInvoicesSnapshot.forEach((doc) => {
        const invoiceData = doc.data() as Invoice;
        if (invoiceData.deliveryDate) {
          // Convert ISO date to YYYY-MM-DD for date picker using timezone-aware utility
          try {
            const dateOnly = formatDateForInput(invoiceData.deliveryDate);
            allDates.add(dateOnly);
            console.log(`📅 [ShippingPage] Found delivery date: ${dateOnly} from invoice ${doc.id} (${invoiceData.clientName})`);
          } catch (error) {
            console.warn(`⚠️ [ShippingPage] Invalid date format for invoice ${doc.id}:`, invoiceData.deliveryDate);
          }
        }
      });

      // Sort dates chronologically and set the most recent as default
      const sortedDates = Array.from(allDates).sort();
      console.log(`📊 [ShippingPage] All delivery dates found:`, sortedDates);
      
      setAvailableDates(sortedDates);

      const date = dateToFetch || selectedDate;

      // If no date is selected, try to set one, but don't fetch data yet.
      if (!date) {
        if (sortedDates.length > 0 && !selectedDate) {
          const mostRecentDate = sortedDates[sortedDates.length - 1];
          console.log(`🎯 [ShippingPage] Setting default selected date to: ${mostRecentDate}`);
          setSelectedDate(mostRecentDate);
        }
        setLoading(false);
        setShippingData([]); // Clear data if no date is selected
        return;
      }

      // Now query for only shipped invoices (status "done") for the truck view
      const shippedInvoicesQuery = query(
        collection(db, "invoices"),
        where("status", "==", "done")
      );

      const shippedSnapshot = await getDocs(shippedInvoicesQuery);
      const invoices: ShippingInvoice[] = [];

      console.log(`🚛 [ShippingPage] Found ${shippedSnapshot.size} shipped invoices`);

      // Process the shipped invoices
      shippedSnapshot.forEach((doc) => {
        const invoiceData = doc.data() as Invoice;

        console.log(`📋 [ShippingPage] Processing shipped invoice ${doc.id}:`, {
          truckNumber: invoiceData.truckNumber,
          deliveryDate: invoiceData.deliveryDate,
          clientName: invoiceData.clientName,
          status: invoiceData.status
        });

        // Skip if missing required fields
        if (!invoiceData.truckNumber || !invoiceData.deliveryDate) {
          console.log(`⚠️ [ShippingPage] Skipping shipped invoice ${doc.id} - missing truckNumber or deliveryDate`);
          return;
        }

        // Convert truckNumber to string if it's a number
        const truckNumberStr = typeof invoiceData.truckNumber === "number"
          ? String(invoiceData.truckNumber)
          : String(invoiceData.truckNumber);

        // Only include trucks 30-39
        const truckNum = parseInt(truckNumberStr);
        if (isNaN(truckNum) || truckNum < 30 || truckNum > 39) {
          console.log(`⚠️ [ShippingPage] Skipping shipped invoice ${doc.id} - truck number ${truckNumberStr} not in range 30-39`);
          return;
        }

        // Calculate cart count
        const cartCount = invoiceData.carts?.length || 0;

        invoices.push({
          id: doc.id,
          invoiceNumber: invoiceData.invoiceNumber?.toString(),
          clientName: invoiceData.clientName,
          clientId: invoiceData.clientId,
          deliveryDate: invoiceData.deliveryDate,
          cartCount,
          truckNumber: truckNumberStr,
          receivedBy: invoiceData.receivedBy,
          hasSignature: !!invoiceData.signature,
        });
      });
      if (sortedDates.length > 0 && !selectedDate) {
        const mostRecentDate = sortedDates[sortedDates.length - 1];
        console.log(`🎯 [ShippingPage] Setting default selected date to: ${mostRecentDate}`);
        setSelectedDate(mostRecentDate);
      }

      // Group by truck number
      const truckMap: { [key: string]: ShippingInvoice[] } = {};

      for (const invoice of invoices) {
        if (!truckMap[invoice.truckNumber]) {
          truckMap[invoice.truckNumber] = [];
        }
        truckMap[invoice.truckNumber].push(invoice);
      }

      // Convert to array and sort by truck number
      const trucksArray: ShippingTruckData[] = Object.keys(truckMap).map(
        (truckNumber) => ({
          truckNumber,
          invoices: truckMap[truckNumber],
        })
      );

      trucksArray.sort(
        (a, b) => parseInt(a.truckNumber) - parseInt(b.truckNumber)
      );
      setShippingData(trucksArray);
    } catch (error) {
      console.error("Error fetching shipping data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Function to fetch scheduled invoices (non-shipped) for the selected date
  const fetchScheduledInvoices = useCallback(async (dateToFetch?: string) => {
    const date = dateToFetch || selectedDate;
    if (!date) {
      setScheduledInvoices([]);
      return;
    }

    try {
      console.log(`📋 [ShippingPage] Fetching scheduled invoices for ${date}`);
      
      // Query for invoices that are NOT shipped but have delivery dates
      const scheduledQuery = query(
        collection(db, "invoices"),
        where("status", "!=", "done")
      );

      const querySnapshot = await getDocs(scheduledQuery);
      const scheduledInvoicesArray: ShippingInvoice[] = [];

      querySnapshot.forEach((doc) => {
        const invoiceData = doc.data() as Invoice;

        // Skip if no delivery date
        if (!invoiceData.deliveryDate) return;

        // Convert ISO date to YYYY-MM-DD for comparison using timezone-aware utility
        let invoiceDate = "";
        try {
          invoiceDate = formatDateForInput(invoiceData.deliveryDate);
        } catch (error) {
          console.warn(`⚠️ [ShippingPage] Invalid date format for scheduled invoice ${doc.id}:`, invoiceData.deliveryDate);
          return;
        }

        // Only include invoices matching the selected date
        if (invoiceDate !== date) return;

        // Handle truck number based on delivery method
        let truckNumberStr;
        if (invoiceData.deliveryMethod === "client_pickup") {
          // Skip client pickup orders - they should stay in Active Invoices page
          return;
        } else {
          // For truck delivery, assign default truck number if not set
          truckNumberStr = invoiceData.truckNumber
            ? (typeof invoiceData.truckNumber === "number" ? String(invoiceData.truckNumber) : String(invoiceData.truckNumber))
            : "TBD"; // To Be Determined
        }

        // Calculate cart count
        const cartCount = invoiceData.carts?.length || 0;

        scheduledInvoicesArray.push({
          id: doc.id,
          invoiceNumber: invoiceData.invoiceNumber?.toString(),
          clientName: invoiceData.clientName,
          clientId: invoiceData.clientId,
          deliveryDate: invoiceData.deliveryDate,
          cartCount,
          truckNumber: truckNumberStr,
          receivedBy: invoiceData.receivedBy,
          hasSignature: !!invoiceData.signature,
        });

        console.log(
          `📋 [ShippingPage] Found scheduled invoice ${doc.id} for ${invoiceDate}: ${invoiceData.clientName} (Truck: ${truckNumberStr})`
        );
      });

      setScheduledInvoices(scheduledInvoicesArray);
      console.log(`📊 [ShippingPage] Found ${scheduledInvoicesArray.length} scheduled invoices for ${date}`);
    } catch (error) {
      console.error("Error fetching scheduled invoices:", error);
      setScheduledInvoices([]);
    }
  }, [selectedDate]);

  // Fetch shipping data for trucks 30-39
  useEffect(() => {
    fetchShippingData();
  }, [fetchShippingData]);

  // Add refresh functionality when component becomes visible (when user navigates to shipping page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh data to get any newly shipped invoices
        fetchShippingData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchShippingData]);

  // Fetch drivers on component mount
  useEffect(() => {
    fetchDrivers();
    fetchClients();
  }, [fetchDrivers, fetchClients]);

  // Fetch truck assignments when date changes
  useEffect(() => {
    if (selectedDate) {
      // Clear selected client when date changes for clean state
      setSelectedClientInvoiceId(null);
      
      fetchTruckAssignments();
      fetchTruckCompletions();
      fetchTruckLoadingVerifications();
      fetchEmergencyDeliveries();
      fetchScheduledInvoices();
    }
  }, [selectedDate, fetchTruckAssignments, fetchTruckCompletions, fetchTruckLoadingVerifications, fetchEmergencyDeliveries, fetchScheduledInvoices]);

  // Filter data by selected date and driver assignments (for driver role)
  const filteredData = selectedDate
    ? (() => {
        console.log(`🔍 [ShippingPage] Filtering data for selected date: ${selectedDate} (refreshTrigger: ${refreshTrigger})`);
        console.log(`📊 [ShippingPage] Input data - shippingData: ${shippingData.length} trucks, scheduledInvoices: ${scheduledInvoices.length} items`);
        
        // First, get shipped invoices for the selected date
        const shippedTrucks = shippingData
          .map((truck): ShippingTruckData => ({
            truckNumber: truck.truckNumber,
            invoices: truck.invoices.filter(
                (invoice) => {
                  // Convert ISO date string to YYYY-MM-DD for comparison using timezone-aware utility
                  let invoiceDate = "";
                  if (invoice.deliveryDate) {
                    try {
                      invoiceDate = formatDateForInput(invoice.deliveryDate);
                    } catch (error) {
                      // If date parsing fails, try direct comparison (for backward compatibility)
                      invoiceDate = invoice.deliveryDate;
                    }
                  }
                  const matches = invoiceDate === selectedDate;
                  console.log(`📋 [ShippingPage] Shipped invoice ${invoice.id} (${invoice.clientName}) - deliveryDate: "${invoice.deliveryDate}", converted: "${invoiceDate}", selectedDate: "${selectedDate}", matches: ${matches}`);
                  return matches;
                }
              ),
          }))
          .filter((truck) => truck.invoices.length > 0);

        // Create a map of existing trucks
        const truckMap: { [key: string]: ShippingInvoice[] } = {};
        shippedTrucks.forEach(truck => {
          truckMap[truck.truckNumber] = [...truck.invoices];
        });

        // Add scheduled invoices to appropriate trucks
        scheduledInvoices.forEach(scheduledInvoice => {
          const truckNumber = scheduledInvoice.truckNumber;
          console.log(`📋 [ShippingPage] Adding scheduled invoice ${scheduledInvoice.id} (${scheduledInvoice.clientName}) to truck ${truckNumber}`);
          
          if (!truckMap[truckNumber]) {
            truckMap[truckNumber] = [];
            console.log(`🚛 [ShippingPage] Created new truck entry for ${truckNumber}`);
          }
          truckMap[truckNumber].push(scheduledInvoice);
          console.log(`🚛 [ShippingPage] Truck ${truckNumber} now has ${truckMap[truckNumber].length} total invoices`);
        });

        // Convert back to array format
        const combinedTrucks: ShippingTruckData[] = Object.keys(truckMap).map(truckNumber => ({
          truckNumber,
          invoices: truckMap[truckNumber]
        }));

        // Apply driver filtering if needed
        const filtered = combinedTrucks.filter((truck) => {
          // If user is a driver, only show trucks assigned to them
          if (user && user.role === "Driver" && currentDriverId) {
            const assignment = truckAssignments[truck.truckNumber];
            return truck.invoices.length > 0 && assignment && assignment.driverId === currentDriverId;
          }
          // For non-drivers, show all trucks with invoices
          return truck.invoices.length > 0;
        });

        // Sort trucks by number
        filtered.sort((a, b) => {
          const aNum = a.truckNumber === "TBD" ? 999 : parseInt(a.truckNumber);
          const bNum = b.truckNumber === "TBD" ? 999 : parseInt(b.truckNumber);
          return aNum - bNum;
        });
        
        console.log(`🚛 [ShippingPage] Final filtered trucks with invoices:`, filtered.map(t => ({
          truckNumber: t.truckNumber,
          invoiceCount: t.invoices.length,
          invoices: t.invoices.map(inv => ({ 
            id: inv.id, 
            clientName: inv.clientName, 
            deliveryDate: inv.deliveryDate,
            isScheduled: scheduledInvoices.some(si => si.id === inv.id),
            truckNumber: inv.truckNumber
          }))
        })));

        console.log(`📊 [ShippingPage] Summary for ${selectedDate}:`);
        console.log(`   - Total trucks: ${filtered.length}`);
        console.log(`   - Total invoices: ${filtered.reduce((sum, t) => sum + t.invoices.length, 0)}`);
        console.log(`   - Scheduled invoices in data: ${scheduledInvoices.length}`);
        console.log(`   - Shipped trucks from shippingData: ${shippedTrucks.length}`);
        
        return filtered;
      })()
    : user && user.role === "Driver" && currentDriverId
      ? shippingData.filter((truck) => {
          const assignment = truckAssignments[truck.truckNumber];
          return assignment && assignment.driverId === currentDriverId;
        })
      : shippingData;

  // Calculate totals for each truck
  const calculateTruckTotals = (truck: ShippingTruckData) => {
    const totalCarts = truck.invoices.reduce(
      (sum, inv) => sum + inv.cartCount,
      0
    );
    const clientCount = new Set(truck.invoices.map((inv) => inv.clientId)).size;

    return { totalCarts, clientCount };
  };

  // Function to handle reverting invoice from shipped back to approved
  const handleRevertInvoiceToApproved = async (invoice: ShippingInvoice) => {
    if (!user) return;

    // Check user permissions - only supervisors and above can revert shipped invoices
    const isSupervisorOrAbove = user && ["Supervisor", "Admin", "Owner"].includes(user.role);
    if (!isSupervisorOrAbove) {
      alert("Only supervisors and administrators can revert shipped invoices.");
      return;
    }

    const confirmRevert = window.confirm(
      `Are you sure you want to revert Invoice #${invoice.invoiceNumber || invoice.id} back to approved status?\n\nThis will:\n• Remove it from shipping\n• Clear truck assignment\n• Clear delivery date\n• Return it to approved status`
    );

    if (!confirmRevert) return;

    try {
      // Import updateDoc from firestore
      const { updateDoc, doc } = await import("firebase/firestore");
      
      // Update the invoice status back to completed (approved)
      await updateDoc(doc(db, "invoices", invoice.id), {
        status: "completed",
        truckNumber: "",
        deliveryDate: "",
        // Keep the verified status and other approval data
      });

      // Log the activity
      if (user.username) {
        const { logActivity } = await import("../services/firebaseService");
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} reverted laundry ticket #${invoice.invoiceNumber || invoice.id} from shipped back to approved status`,
          user: user.username,
        });
      }

      // Refresh the shipping data to reflect the changes
      await fetchShippingData();
      await fetchScheduledInvoices();

      alert(`Invoice #${invoice.invoiceNumber || invoice.id} has been reverted to approved status.`);
    } catch (error) {
      console.error("Error reverting invoice:", error);
      alert("Error reverting invoice. Please try again.");
    }
  };

  return (
    <div className="container shipping-dashboard">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h2 className="mb-0">Shipping Dashboard</h2>
        {isRefreshing && (
          <div className="d-flex align-items-center text-primary">
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Refreshing...</span>
            </div>
            <small>Refreshing data...</small>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="row mb-4">
            <div className="col-md-4">
              <label className="form-label">Filter by Delivery Date</label>
              <select
                className="form-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="">All Dates</option>
                {availableDates.map((date) => {
                  // Parse as local date, not UTC
                  const [year, month, day] = date.split("-").map(Number);
                  const localDate = new Date(year, month - 1, day);
                  return (
                    <option key={date} value={date}>
                      {localDate.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="col-md-8 d-flex align-items-end gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  console.log(`🔄 [ShippingPage] Manual refresh triggered for date: ${selectedDate}`);
                  setIsRefreshing(true);
                  
                  // Clear existing data first
                  setShippingData([]);
                  setScheduledInvoices([]);
                  
                  // Fetch fresh data
                  Promise.all([
                    fetchShippingData(),
                    fetchScheduledInvoices()
                  ]).then(() => {
                    setRefreshTrigger(prev => prev + 1);
                    console.log(`✅ [ShippingPage] Manual refresh completed`);
                  }).finally(() => {
                    setIsRefreshing(false);
                  });
                }}
                title="Refresh shipping data"
                disabled={loading || isRefreshing}
              >
                <i className={`bi ${loading || isRefreshing ? 'bi-arrow-clockwise spinning' : 'bi-arrow-clockwise'} me-1`}></i>
                Refresh
              </button>
              <button
                className="btn btn-outline-info btn-sm"
                onClick={async () => {
                  try {
                    const q = query(
                      collection(db, "invoices"),
                      where("status", "==", "done")
                    );
                    const querySnapshot = await getDocs(q);
                    console.log("🔧 [DEBUG] All shipped invoices in database:");
                    querySnapshot.forEach((doc) => {
                      const data = doc.data();
                      console.log(`  📋 ${doc.id}:`, {
                        clientName: data.clientName,
                        deliveryDate: data.deliveryDate,
                        truckNumber: data.truckNumber,
                        status: data.status,
                        date: data.date
                      });
                    });
                  } catch (error) {
                    console.error("Debug query failed:", error);
                  }
                }}
                title="Debug: Log all shipped invoices"
              >
                <i className="bi bi-bug me-1"></i>
                Debug DB
              </button>
              {user && user.role === "Driver" && (
                <button
                  className="btn btn-warning"
                  onClick={handleEmergencyDelivery}
                  title="Record delivery for items not in truck"
                >
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Emergency Delivery
                </button>
              )}
              {user && ["Supervisor", "Admin", "Owner"].includes(user.role) && (
                <button
                  className="btn btn-info"
                  onClick={handleViewEmergencyDeliveries}
                  title="View all emergency deliveries for this date"
                  disabled={!selectedDate}
                >
                  <i className="bi bi-eye-fill me-2"></i>
                  View Emergency Deliveries
                  {emergencyDeliveries.length > 0 && (
                    <span className="badge bg-light text-dark ms-2">
                      {emergencyDeliveries.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Status Legend */}
          {selectedDate && filteredData.length > 0 && (
            <div className="row mb-3">
              <div className="col-12">
                <div className="alert alert-info d-flex align-items-center">
                  <i className="bi bi-info-circle me-2"></i>
                  <div className="d-flex align-items-center gap-3">
                    <span className="fw-bold me-2">Legend:</span>
                    <span className="d-flex align-items-center">
                      <span className="badge bg-success me-1">
                        <i className="bi bi-truck"></i> Shipped
                      </span>
                      <small className="text-muted">- Laundry Ticket has been shipped</small>
                    </span>
                    <span className="d-flex align-items-center">
                      <span className="badge bg-warning text-dark me-1">
                        <i className="bi bi-calendar-event"></i> Scheduled
                      </span>
                      <small className="text-muted">- Laundry Ticket scheduled for delivery (highlighted rows)</small>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="row">
            {filteredData.length === 0 ? (
              <div className="col-12 text-center py-5">
                {user && user.role === "Driver" ? (
                  <div>
                    <h5 className="text-muted">
                      No trucks assigned to you
                    </h5>
                    <p>
                      Please contact your supervisor to assign you to a truck for{" "}
                      {selectedDate ? new Date(selectedDate).toLocaleDateString("en-US") : "your deliveries"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h5 className="text-muted">
                      No shipped invoices found for trucks 30-39
                    </h5>
                    {selectedDate && (
                      <p>
                        No deliveries found for{" "}
                        {new Date(selectedDate).toLocaleDateString("en-US")}
                      </p>
                    )}
                    <div className="alert alert-info mt-3">
                      <i className="bi bi-info-circle me-2"></i>
                      <strong>This page shows:</strong>
                      <ul className="mt-2 mb-0">
                        <li>Laundry Tickets that have been shipped (status "done")</li>
                        <li>With truck numbers 30-39</li>
                        <li>Filtered by delivery date</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              filteredData.map((truck) => {
                const { totalCarts, clientCount } = calculateTruckTotals(truck);
                const isCompleted = truckCompletions[truck.truckNumber]?.isCompleted;
                const currentTripNumber = getCurrentTripNumber(truck.truckNumber);
                const currentTripType = getCurrentTripType(truck.truckNumber);
                const canAcceptNewInvoices = canTruckAcceptNewInvoices(truck.truckNumber);
                const allInvoicesSigned = areAllInvoicesSigned(truck);
                const hasLoadingVerification = truckLoadingVerifications[truck.truckNumber]?.isVerified || false;
                const canMarkComplete = allInvoicesSigned && !isCompleted && hasLoadingVerification;
                const isCurrentUserDriver = user && user.role === "Driver";
                const isSupervisorOrAbove = user && ["Supervisor", "Admin", "Owner"].includes(user.role);

                return (
                  <div
                    className="col-md-6 col-lg-4 mb-4"
                    key={truck.truckNumber}
                  >
                    <div className={`card shadow-sm truck-card ${
                      isCompleted ? 'border-success' : ''
                    } ${truck.truckNumber === "CLIENT_PICKUP" ? 'bg-light-pink' : ''}`} 
                    style={truck.truckNumber === "CLIENT_PICKUP" ? { backgroundColor: '#fce4ec' } : {}}>
                      <div className={`card-header truck-header ${
                        isCompleted ? 'bg-success text-white' : 
                        truck.truckNumber === "CLIENT_PICKUP" ? 'bg-pink text-dark' : ''
                      }`} 
                      style={truck.truckNumber === "CLIENT_PICKUP" && !isCompleted ? { backgroundColor: '#f8bbd9' } : {}}>
                        <div className="d-flex justify-content-between align-items-center">
                          <h4 className="mb-0">
                            {isCompleted && <i className="bi bi-check-circle-fill me-2"></i>}
                            {truck.truckNumber === "TBD" ? (
                              <>
                                <i className="bi bi-question-circle me-2 text-warning"></i>
                                Truck Assignment Pending
                              </>
                            ) : (
                              `Truck #${truck.truckNumber}`
                            )}
                          </h4>
                          <div className="d-flex flex-column align-items-end">
                            {/* Trip Status Badge */}
                            <span className={`badge mb-1 ${
                              currentTripNumber === 1 
                                ? (isCompleted ? 'bg-success' : 'bg-info') 
                                : (isCompleted ? 'bg-success' : 'bg-warning text-dark')
                            }`}>
                              <i className="bi bi-arrow-repeat me-1"></i>
                              {currentTripType} {isCompleted && currentTripNumber === 2 ? '(Final)' : ''}
                            </span>
                            
                            {truckAssignments[truck.truckNumber] && (
                              <span className="badge bg-primary mb-1">
                                <i className="bi bi-person-check"></i> {truckAssignments[truck.truckNumber].driverName}
                              </span>
                            )}
                            
                            {!canAcceptNewInvoices && (
                              <span className="badge bg-secondary mb-1">
                                <i className="bi bi-lock-fill"></i> No More Trips
                              </span>
                            )}
                            
                            {isCompleted && (
                              <span className="badge bg-light text-dark">
                                <i className="bi bi-flag-fill"></i> {currentTripType} Complete
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="card-body">
                        {/* Driver Assignment Section - Only show for non-driver users and actual trucks */}
                        {(!user || user.role !== "Driver") && truck.truckNumber !== "CLIENT_PICKUP" && (
                          <div className="mb-3">
                            <label className="form-label fw-bold">
                              <i className="bi bi-person"></i> Assign Driver
                            </label>
                            {drivers.filter((driver: any) => driver.linkedUserId).length === 0 ? (
                              <div className="alert alert-warning py-2">
                                <small>
                                  <strong>No linked drivers available.</strong><br />
                                  Link drivers to user accounts in Settings → Drivers to enable assignments.
                                </small>
                              </div>
                            ) : (
                              <div className="d-flex gap-2">
                                <select
                                  className="form-select form-select-sm"
                                  value={truckAssignments[truck.truckNumber]?.driverId || ""}
                                  onChange={(e) => assignDriverToTruck(truck.truckNumber, e.target.value)}
                                  disabled={savingAssignment === truck.truckNumber}
                                >
                                  <option value="">Select Driver...</option>
                                  {drivers
                                    .filter((driver: any) => driver.linkedUserId) // Only show drivers linked to user accounts
                                    .map((driver) => (
                                      <option key={driver.id} value={driver.id}>
                                        {driver.name} (ID: {driver.linkedUserId})
                                      </option>
                                    ))}
                                </select>
                                {savingAssignment === truck.truckNumber && (
                                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                                    <span className="visually-hidden">Saving...</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="truck-stats">
                          <div className="stat-item">
                            <h5 className="stat-value">{clientCount}</h5>
                            <small className="stat-label">Clients</small>
                          </div>
                          <div className="stat-item">
                            <h5 className="stat-value">{totalCarts}</h5>
                            <small className="stat-label">Carts</small>
                          </div>
                        </div>

                        <h6 className="border-bottom pb-2 mb-3">
                          Client List
                          <small className="text-muted d-block mt-1" style={{ fontSize: "12px", fontWeight: "normal" }}>
                            Click on a client to show action buttons
                          </small>
                        </h6>
                        <div className="client-list">
                          {truck.invoices.map((invoice) => {
                            // Determine if this is a scheduled (non-shipped) invoice
                            const isScheduled = scheduledInvoices.some(si => si.id === invoice.id);
                            const isSelected = selectedClientInvoiceId === invoice.id;
                            
                            return (
                              <div 
                                key={invoice.id} 
                                className={`d-flex align-items-center justify-content-between p-3 mb-2 border rounded ${
                                  isSelected 
                                    ? 'border-primary bg-primary-subtle' 
                                    : isScheduled 
                                      ? 'border-warning bg-warning-subtle' 
                                      : 'border-light bg-light'
                                }`}
                                style={{ 
                                  minHeight: "60px",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease"
                                }}
                                onClick={() => {
                                  // Toggle selection - if clicking the same client, deselect, otherwise select the new one
                                  setSelectedClientInvoiceId(selectedClientInvoiceId === invoice.id ? null : invoice.id);
                                }}
                              >
                                {/* Client info with cart count */}
                                <div className="d-flex align-items-center gap-3">
                                  <div>
                                    <div className="fw-bold text-primary" style={{ fontSize: "16px" }}>
                                      {invoice.clientName}
                                      {isSelected && (
                                        <i className="bi bi-chevron-right ms-2 text-primary"></i>
                                      )}
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-info" style={{ fontSize: "12px" }}>
                                        {invoice.cartCount} {invoice.cartCount === 1 ? "cart" : "carts"}
                                      </span>
                                      {invoice.hasSignature && (
                                        <span className="badge bg-success" style={{ fontSize: "11px" }}>
                                          <i className="bi bi-check-circle-fill me-1"></i>
                                          Signed
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Action buttons - only show when this client is selected */}
                                {isSelected && (
                                  <div className="d-flex gap-2">
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleInvoiceClick(invoice.id);
                                      }}
                                      title="View laundry ticket details"
                                    >
                                      <i className="bi bi-file-text"></i> Details
                                    </button>
                                    <button
                                      className={`btn btn-sm ${
                                        !truckLoadingVerifications[invoice.truckNumber]?.isVerified
                                          ? "btn-secondary"
                                          : invoice.hasSignature
                                          ? "btn-success"
                                          : "btn-outline-success"
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSignatureCapture(invoice);
                                      }}
                                      disabled={!truckLoadingVerifications[invoice.truckNumber]?.isVerified}
                                      title={
                                        !truckLoadingVerifications[invoice.truckNumber]?.isVerified
                                          ? "Loading verification required before signatures"
                                          : invoice.hasSignature
                                          ? "Update signature"
                                          : "Capture signature"
                                      }
                                    >
                                      <i
                                        className={`bi ${
                                          !truckLoadingVerifications[invoice.truckNumber]?.isVerified
                                            ? "bi-lock"
                                            : invoice.hasSignature
                                            ? "bi-pencil-square"
                                            : "bi-pen"
                                        }`}
                                      ></i>
                                      {!truckLoadingVerifications[invoice.truckNumber]?.isVerified
                                        ? "Locked"
                                        : invoice.hasSignature ? "Update" : "Sign"}
                                    </button>
                                    {/* Clear Signature button - Only show when signature exists */}
                                    {invoice.hasSignature && (
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleClearSignature(invoice);
                                        }}
                                        title="Clear signature and reset to unsigned status"
                                      >
                                        <i className="bi bi-x-circle"></i> Clear Signature
                                      </button>
                                    )}
                                    {/* Revert to Approved button - Only for supervisors and above */}
                                    {user && ["Supervisor", "Admin", "Owner"].includes(user.role) && (
                                      <button
                                        className="btn btn-sm btn-outline-warning"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRevertInvoiceToApproved(invoice);
                                        }}
                                        title="Revert to approved status (Supervisor only)"
                                      >
                                        <i className="bi bi-arrow-left-circle"></i> Revert
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="card-footer bg-light">
                        <div className="d-flex flex-column">
                          <small className="text-muted">
                            Delivery Date:{" "}
                            {selectedDate &&
                              new Date(selectedDate).toLocaleDateString("en-US")}
                          </small>
                        </div>
                        
                        {/* Truck Loading Verification Button Section - Only for actual trucks */}
                        {truck.truckNumber !== "CLIENT_PICKUP" && (
                          <div className="d-flex gap-2 align-items-center mb-2">
                            {!hasLoadingVerification && !isCompleted && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleVerifyTruckLoading(truck.truckNumber)}
                                disabled={verifyingTruckLoading === truck.truckNumber}
                                title="Verify truck loading and cart count"
                              >
                                {verifyingTruckLoading === truck.truckNumber ? (
                                  <div className="spinner-border spinner-border-sm" role="status">
                                    <span className="visually-hidden">Processing...</span>
                                  </div>
                                ) : (
                                  <>
                                    <i className="bi bi-clipboard-check"></i> Verify Loading
                                  </>
                                )}
                              </button>
                            )}
                            
                            {hasLoadingVerification && !isCompleted && (
                              <button
                                className="btn btn-sm btn-outline-info"
                                onClick={() => handleViewLoadingDiagram(truck.truckNumber)}
                                title="View truck loading diagram"
                              >
                                <i className="bi bi-eye"></i> View Layout
                              </button>
                            )}
                          </div>
                        )}

                        {/* Completion Button Section - Only for actual trucks */}
                        {truck.truckNumber !== "CLIENT_PICKUP" && (
                          <div className="d-flex gap-2 align-items-center">
                          {isCompleted ? (
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-success">
                                <i className="bi bi-check-circle-fill"></i> {currentTripType} Complete
                              </span>
                              {isSupervisorOrAbove && (
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => unmarkTruckAsCompleted(truck.truckNumber)}
                                  disabled={completingTruck === truck.truckNumber}
                                  title={`Unmark ${currentTripType} as completed (Supervisor only)`}
                                >
                                  {completingTruck === truck.truckNumber ? (
                                    <div className="spinner-border spinner-border-sm" role="status">
                                      <span className="visually-hidden">Processing...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <i className="bi bi-arrow-clockwise"></i> Reopen {currentTripType}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              {canMarkComplete && isCurrentUserDriver && (
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => markTruckAsCompleted(truck.truckNumber)}
                                  disabled={completingTruck === truck.truckNumber}
                                  title={`Mark ${currentTripType} as completed`}
                                >
                                  {completingTruck === truck.truckNumber ? (
                                    <div className="spinner-border spinner-border-sm text-white" role="status">
                                      <span className="visually-hidden">Processing...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <i className="bi bi-flag-fill"></i> Complete {currentTripType}
                                    </>
                                  )}
                                </button>
                              )}
                              
                              {!canMarkComplete && isCurrentUserDriver && !isCompleted && (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  disabled={true}
                                  title={
                                    !allInvoicesSigned 
                                      ? "All invoices must have signatures first"
                                      : !hasLoadingVerification
                                      ? "Truck loading verification must be completed first"
                                      : "Cannot mark as complete"
                                  }
                                >
                                  <i className="bi bi-flag"></i> Complete {currentTripType}
                                </button>
                              )}
                            </>
                          )}
                          
                          {!allInvoicesSigned && !isCompleted && (
                            <small className="text-warning">
                              <i className="bi bi-exclamation-triangle-fill"></i> Pending signatures
                            </small>
                          )}
                          
                          {allInvoicesSigned && !hasLoadingVerification && !isCompleted && (
                            <small className="text-warning">
                              <i className="bi bi-diagram-3"></i> Loading verification required
                            </small>
                          )}
                        </div>
                        )}
                      </div>
                      
                      {/* Trip Status Information Section - Only for actual trucks */}
                      {truck.truckNumber !== "CLIENT_PICKUP" && (
                        <div className="mt-3 p-3 bg-light border-top">
                        <h6 className="mb-2">
                          <i className="bi bi-info-circle me-1"></i>
                          Trip Status Information
                        </h6>
                        <div className="row">
                          <div className="col-md-6">
                            <div className="small">
                              <strong>Current Status:</strong><br />
                              <span className="text-muted">{getTripStatusMessage(truck.truckNumber)}</span>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="small">
                              <strong>Accept New Laundry Tickets:</strong><br />
                              <span className={`fw-bold ${canAcceptNewInvoices ? 'text-success' : 'text-danger'}`}>
                                <i className={`bi ${canAcceptNewInvoices ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                                {canAcceptNewInvoices ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Overflow Recommendation */}
                        {(() => {
                          const overflowRec = getOverflowRecommendation(truck.truckNumber);
                          return overflowRec ? (
                            <div className="mt-2">
                              <div className="alert alert-warning py-2 mb-0">
                                <small>
                                  <i className="bi bi-exclamation-triangle me-1"></i>
                                  <strong>Overflow Advisory:</strong> {overflowRec}
                                </small>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                      )}
                      
                      {/* Truck Loading Diagram Display - Only for actual trucks */}
                      {truck.truckNumber !== "CLIENT_PICKUP" && truckLoadingVerifications[truck.truckNumber] && (
                        <div className="mt-3 p-2 bg-light border-top">
                          <h6 className="mb-2 text-center">
                            <i className="bi bi-diagram-3 me-1"></i>
                            Truck Loading Layout
                          </h6>
                          <div 
                            className="truck-diagram-compact"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '3px',
                              maxWidth: '150px',
                              margin: '0 auto'
                            }}
                          >
                            {truckLoadingVerifications[truck.truckNumber].truckDiagram?.map((position: any, index: number) => {
                              const row = Math.floor(index / 3);
                              const col = index % 3;
                              
                              return (
                                <div
                                  key={`${row}-${col}`}
                                  style={{
                                    width: '30px',
                                    height: '25px',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '3px',
                                    backgroundColor: position.clientId ? position.color || '#e9ecef' : '#f8f9fa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: position.clientId ? '#000' : '#6c757d',
                                    position: 'relative',
                                    overflow: 'hidden'
                                  }}
                                  title={position.clientId ? 
                                    `${position.clientName}\nPosition: ${row + 1}-${col + 1}` : 
                                    `Empty\nPosition: ${row + 1}-${col + 1}`
                                  }
                                >
                                  {position.clientId ? (
                                    position.clientName?.substring(0, 2).toUpperCase()
                                  ) : (
                                    <i className="bi bi-dash" style={{ fontSize: '10px', color: '#adb5bd' }}></i>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-center mt-2">
                            <small className="text-muted">
                              <i className="bi bi-info-circle me-1"></i>
                              Verified: {truckLoadingVerifications[truck.truckNumber].actualCartCount} / {truckLoadingVerifications[truck.truckNumber].expectedCartCount} carts
                            </small>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Truck Loading Verification Modal */}
      {showLoadingVerificationModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clipboard-check me-2"></i>
                  Verify Truck Loading - Truck #{showLoadingVerificationModal} ({getCurrentTripType(showLoadingVerificationModal)})
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLoadingVerificationModal(null)}
                  disabled={verifyingTruckLoading !== null}
                ></button>
              </div>
              <div className="modal-body">
                {(() => {
                  const truck = filteredData.find(t => t.truckNumber === showLoadingVerificationModal);
                  if (!truck) return null;
                  
                  const expectedCount = getExpectedCartCount(truck);
                  
                  return (
                    <>
                      <div className="alert alert-info">
                        <i className="bi bi-info-circle-fill me-2"></i>
                        Please verify that all client items have been correctly loaded onto the truck and confirm the total number of carts.
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <div className="card">
                            <div className="card-body text-center">
                              <h6 className="card-title text-muted">Expected Carts</h6>
                              <h2 className="text-primary">{expectedCount}</h2>
                              <small className="text-muted">From all laundry tickets</small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="card">
                            <div className="card-body text-center">
                              <h6 className="card-title text-muted">
                                <strong>Actual Carts Loaded *</strong>
                              </h6>
                              <input
                                type="number"
                                className={`form-control form-control-lg text-center ${
                                  actualCartCount !== expectedCount ? 'border-warning' : 'border-success'
                                }`}
                                style={{ 
                                  fontSize: '1.5rem', 
                                  fontWeight: 'bold',
                                  backgroundColor: actualCartCount !== expectedCount ? '#fff3cd' : '#d1edff'
                                }}
                                value={actualCartCount}
                                onChange={(e) => setActualCartCount(Number(e.target.value))}
                                min="0"
                                disabled={verifyingTruckLoading !== null}
                                inputMode="none"
                                readOnly={/iPad|iPhone|iPod/.test(navigator.userAgent)}
                                placeholder="Enter count"
                                required
                              />
                              <small className="text-muted d-block mt-1">
                                {actualCartCount === expectedCount ? (
                                  <span className="text-success">
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                    Matches expected count
                                  </span>
                                ) : actualCartCount > 0 ? (
                                  <span className="text-warning">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                    Difference: {actualCartCount > expectedCount ? '+' : ''}{actualCartCount - expectedCount}
                                  </span>
                                ) : (
                                  <span className="text-danger">Required field</span>
                                )}
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>

                      {actualCartCount !== expectedCount && (
                        <div className="alert alert-warning">
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          <strong>Cart count mismatch!</strong> Expected {expectedCount} carts but {actualCartCount} were loaded.
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="form-label">
                          <strong>Client Breakdown:</strong>
                        </label>
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Client</th>
                                <th className="text-center">Carts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {truck.invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                  <td>{invoice.clientName}</td>
                                  <td className="text-center">
                                    <span className="badge bg-primary">{invoice.cartCount}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Truck Loading Diagram */}
                      <div className="mb-4">
                        <label className="form-label">
                          <strong>Truck Loading Diagram</strong>
                          <small className="text-muted ms-2">(3 columns × 4 rows - Click to assign clients)</small>
                        </label>
                        
                        {/* Client Color Legend */}
                        <div className="mb-3">
                          <div className="d-flex flex-wrap gap-2">
                            {getUniqueClientsFromTruck(truck).map((client, index) => (
                              <div 
                                key={client.id} 
                                className="d-flex align-items-center gap-2 p-2 border rounded"
                                style={{ backgroundColor: "#f8f9fa" }}
                              >
                                <div 
                                  className="color-swatch border" 
                                  style={{ 
                                    width: "20px", 
                                    height: "20px", 
                                    backgroundColor: availableColors[index % availableColors.length],
                                    borderRadius: "3px"
                                  }}
                                ></div>
                                <small className="fw-bold">{client.name}</small>
                                <small className="text-muted">({client.totalCarts} carts)</small>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Truck Grid */}
                        <div className="truck-diagram border rounded p-3" style={{ backgroundColor: "#f9f9f9" }}>
                          <div className="text-center mb-2">
                            <small className="text-muted fw-bold">FRONT OF TRUCK</small>
                          </div>
                          
                          <div className="truck-grid">
                            {[0, 1, 2, 3].map(row => (
                              <div key={row} className="d-flex justify-content-center gap-2 mb-2">
                                {[0, 1, 2].map(col => {
                                  const position = truckDiagram.find(p => p.row === row && p.col === col);
                                  const client = position?.clientId ? getUniqueClientsFromTruck(truck).find(c => c.id === position.clientId) : null;
                                  const colorIndex = client ? getUniqueClientsFromTruck(truck).findIndex(c => c.id === client.id) : -1;
                                  
                                  return (
                                    <div 
                                      key={`${row}-${col}`}
                                      className="truck-position border rounded d-flex flex-column align-items-center justify-content-center position-relative"
                                      style={{
                                        width: "80px",
                                        height: "60px",
                                        backgroundColor: position?.clientId 
                                          ? availableColors[colorIndex % availableColors.length] 
                                          : "#ffffff",
                                        cursor: "pointer",
                                        border: selectedPosition?.row === row && selectedPosition?.col === col 
                                          ? "2px solid #007bff" 
                                          : "1px solid #dee2e6",
                                        boxShadow: selectedPosition?.row === row && selectedPosition?.col === col 
                                          ? "0 0 0 0.2rem rgba(0,123,255,.25)" 
                                          : "none"
                                      }}
                                      onClick={() => setSelectedPosition({row, col})}
                                      title={position?.clientName || "Click to assign client"}
                                    >
                                      {position?.clientId ? (
                                        <>
                                          <small className="fw-bold text-white text-center" style={{ fontSize: "9px", lineHeight: "1" }}>
                                            {position.clientName}
                                          </small>
                                          <small className="fw-bold text-white text-center" style={{ fontSize: "8px", lineHeight: "1" }}>
                                            {position.cartCount || 0} carts
                                          </small>
                                          <button
                                            className="btn btn-sm position-absolute"
                                            style={{ 
                                              top: "-5px", 
                                              right: "-5px", 
                                              width: "18px", 
                                              height: "18px", 
                                              padding: "0",
                                              backgroundColor: "#dc3545",
                                              border: "none",
                                              borderRadius: "50%",
                                              color: "white",
                                              fontSize: "10px",
                                              lineHeight: "1"
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              clearTruckPosition(row, col);
                                            }}
                                            title="Remove client"
                                          >
                                            ×
                                          </button>
                                        </>
                                      ) : (
                                        <small className="text-muted" style={{ fontSize: "10px" }}>
                                          {row + 1}-{col + 1}
                                        </small>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-center mt-2">
                            <small className="text-muted fw-bold">BACK OF TRUCK</small>
                          </div>
                        </div>

                        {/* Client Assignment Controls */}
                        {selectedPosition && (
                          <div className="mt-3 p-3 border rounded" style={{ backgroundColor: "#e3f2fd" }}>
                            <h6 className="mb-2">
                              Assign Client to Position {selectedPosition.row + 1}-{selectedPosition.col + 1}
                            </h6>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                              {getUniqueClientsFromTruck(truck).map((client, index) => (
                                <button
                                  key={client.id}
                                  className="btn btn-sm d-flex align-items-center gap-2"
                                  style={{ 
                                    backgroundColor: availableColors[index % availableColors.length],
                                    color: "white",
                                    border: "none"
                                  }}
                                  onClick={() => {
                                    // Find any existing position for this client to get their cart count
                                    const existingPositions = truckDiagram.filter(p => p.clientId === client.id);
                                    const alreadyPlaced = existingPositions.reduce((sum, pos) => sum + (pos.cartCount || 0), 0);
                                    const remainingCarts = client.totalCarts - alreadyPlaced;
                                    
                                    // If client already has all their carts placed, don't allow more positions
                                    if (remainingCarts <= 0) {
                                      alert(`${client.name} already has all ${client.totalCarts} carts placed on the truck. Cannot assign to additional positions.`);
                                      return;
                                    }
                                    
                                    // Use a reasonable default (but don't exceed remaining carts)
                                    const defaultCartCount = Math.min(remainingCarts, Math.max(1, Math.floor(remainingCarts / 2)));
                                    
                                    assignClientToPosition(
                                      selectedPosition.row, 
                                      selectedPosition.col, 
                                      client.id, 
                                      client.name, 
                                      availableColors[index % availableColors.length],
                                      defaultCartCount
                                    );
                                    setSelectedPosition(null);
                                  }}
                                  title={`Assign ${client.name} to this position`}
                                >
                                  {client.name}
                                  <small>({client.totalCarts} total)</small>
                                </button>
                              ))}
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setSelectedPosition(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Edit Cart Count for Selected Position */}
                        {(() => {
                          const currentPosition = truckDiagram.find(p => 
                            selectedPosition && p.row === selectedPosition.row && p.col === selectedPosition.col && p.clientId
                          );
                          
                          if (currentPosition && selectedPosition) {
                            return (
                              <div className="mt-2 p-3 border rounded" style={{ backgroundColor: "#fff3cd" }}>
                                <h6 className="mb-2">
                                  Edit Cart Count for {currentPosition.clientName} at Position {selectedPosition.row + 1}-{selectedPosition.col + 1}
                                </h6>
                                <div className="d-flex align-items-center gap-2">
                                  <label className="form-label mb-0">Cart Count:</label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    style={{ width: "80px" }}
                                    min="0"
                                    max={(() => {
                                      // Get the client's total expected carts
                                      const client = getUniqueClientsFromTruck(truck).find(c => c.id === currentPosition.clientId);
                                      if (!client) return 0;
                                      
                                      // Calculate how many carts this client already has placed in other positions
                                      const otherPositionsTotal = truckDiagram
                                        .filter(p => p.clientId === currentPosition.clientId && 
                                                    !(p.row === selectedPosition.row && p.col === selectedPosition.col))
                                        .reduce((sum, pos) => sum + (pos.cartCount || 0), 0);
                                      
                                      // Maximum for this position = total expected - already placed elsewhere
                                      return Math.max(0, client.totalCarts - otherPositionsTotal);
                                    })()}
                                    value={currentPosition.cartCount || 0}
                                    onChange={(e) => {
                                      const newCount = parseInt(e.target.value) || 0;
                                      const client = getUniqueClientsFromTruck(truck).find(c => c.id === currentPosition.clientId);
                                      
                                      if (client) {
                                        // Calculate how many carts this client already has placed in other positions
                                        const otherPositionsTotal = truckDiagram
                                          .filter(p => p.clientId === currentPosition.clientId && 
                                                      !(p.row === selectedPosition.row && p.col === selectedPosition.col))
                                          .reduce((sum, pos) => sum + (pos.cartCount || 0), 0);
                                        
                                        // Check if the new count would exceed the client's total
                                        if (otherPositionsTotal + newCount > client.totalCarts) {
                                          alert(`Cannot place ${newCount} carts for ${client.name}. Maximum allowed: ${client.totalCarts - otherPositionsTotal} (${client.totalCarts} total - ${otherPositionsTotal} already placed)`);
                                          return;
                                        }
                                      }
                                      
                                      setTruckDiagram(prev => prev.map(pos => {
                                        if (pos.row === selectedPosition.row && pos.col === selectedPosition.col) {
                                          return { ...pos, cartCount: newCount };
                                        }
                                        return pos;
                                      }));
                                    }}
                                  />
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => setSelectedPosition(null)}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Diagram Cart Count Summary */}
                        <div className="mt-3 p-3 border rounded" style={{ backgroundColor: "#f8f9fa" }}>
                          <h6 className="mb-2">Cart Count Summary from Diagram</h6>
                          <div className="row">
                            {(() => {
                              const diagramTotal = calculateTotalCartCountFromDiagram(truckDiagram);
                              const clientBreakdown = getUniqueClientsFromTruck(truck).map(client => {
                                const clientPositions = truckDiagram.filter(p => p.clientId === client.id);
                                const clientCartCount = clientPositions.reduce((sum, pos) => sum + (pos.cartCount || 0), 0);
                                return { ...client, cartCountFromDiagram: clientCartCount };
                              });

                              return (
                                <>
                                  <div className="col-md-6">
                                    <div className="card text-center">
                                      <div className="card-body">
                                        <h6 className="card-title text-muted">Total from Diagram</h6>
                                        <h4 className={`${diagramTotal === expectedCount ? 'text-success' : 'text-warning'}`}>
                                          {diagramTotal}
                                        </h4>
                                        <small className="text-muted">carts placed</small>
                                        {diagramTotal !== expectedCount && (
                                          <div className="mt-1">
                                            <small className="text-warning">
                                              {diagramTotal > expectedCount ? 
                                                `${diagramTotal - expectedCount} over expected` : 
                                                `${expectedCount - diagramTotal} under expected`
                                              }
                                            </small>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-md-6">
                                    <div className="table-responsive">
                                      <table className="table table-sm">
                                        <thead>
                                          <tr>
                                            <th>Client</th>
                                            <th className="text-center">Expected</th>
                                            <th className="text-center">Placed</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {clientBreakdown.map(client => (
                                            <tr key={client.id} className={client.cartCountFromDiagram > client.totalCarts ? 'table-danger' : ''}>
                                              <td>{client.name}</td>
                                              <td className="text-center">
                                                <span className="badge bg-info">{client.totalCarts}</span>
                                              </td>
                                              <td className="text-center">
                                                <span className={`badge ${
                                                  client.cartCountFromDiagram === client.totalCarts ? 'bg-success' : 
                                                  client.cartCountFromDiagram > client.totalCarts ? 'bg-danger' : 'bg-warning'
                                                }`}>
                                                  {client.cartCountFromDiagram}
                                                  {client.cartCountFromDiagram > client.totalCarts && (
                                                    <i className="bi bi-exclamation-triangle-fill ms-1" title="Exceeds expected count!"></i>
                                                  )}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div className="col-12 mt-2">
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        setActualCartCount(diagramTotal);
                                      }}
                                    >
                                      <i className="bi bi-arrow-down-circle"></i> Use Diagram Total ({diagramTotal}) as Actual Count
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label">
                          <strong>Verification Notes</strong> {actualCartCount !== expectedCount && <span className="text-danger">*</span>}
                        </label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          placeholder={actualCartCount !== expectedCount 
                            ? "Please explain the cart count discrepancy..." 
                            : "Optional notes about the loading verification..."}
                          disabled={verifyingTruckLoading !== null}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLoadingVerificationModal(null)}
                  disabled={verifyingTruckLoading !== null}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={saveTruckLoadingVerification}
                  disabled={verifyingTruckLoading !== null || (actualCartCount !== getExpectedCartCount(filteredData.find(t => t.truckNumber === showLoadingVerificationModal) || { truckNumber: "", invoices: [] }) && !verificationNotes.trim())}
                >
                  {verifyingTruckLoading !== null ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill me-1"></i>
                      Confirm Loading Verified
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Loading Diagram Modal */}
      {showViewLoadingDiagramModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-diagram-3 me-2"></i>
                  Truck Loading Layout - Truck #{showViewLoadingDiagramModal} ({(() => {
                    const verification = truckLoadingVerifications[showViewLoadingDiagramModal];
                    return verification ? verification.tripType : 'Trip 1';
                  })()})
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowViewLoadingDiagramModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                {(() => {
                  const truck = filteredData.find(t => t.truckNumber === showViewLoadingDiagramModal);
                  const loadingVerification = truckLoadingVerifications[showViewLoadingDiagramModal];
                  
                  
                  if (!truck || !loadingVerification) {
                    return (
                      <div className="alert alert-info">
                        <i className="bi bi-info-circle me-2"></i>
                        No loading verification found for this truck.
                      </div>
                    );
                  }
                  
                  const savedDiagram = loadingVerification.truckDiagram || [];
                  const expectedCount = getExpectedCartCount(truck);
                  const countMatch = loadingVerification.actualCartCount === expectedCount;
                  
                  return (
                    <>
                      {/* Loading Summary */}
                      <div className="row mb-3">
                        <div className="col-md-4">
                          <div className="card text-center">
                            <div className="card-body">
                              <h6 className="card-title text-muted">Expected</h6>
                              <h4 className="text-primary">{expectedCount}</h4>
                              <small className="text-muted">carts</small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="card text-center">
                            <div className="card-body">
                              <h6 className="card-title text-muted">Actual</h6>
                              <h4 className={countMatch ? 'text-success' : 'text-warning'}>{loadingVerification.actualCartCount}</h4>
                              <small className="text-muted">carts</small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="card text-center">
                            <div className="card-body">
                              <h6 className="card-title text-muted">Status</h6>
                              <span className={`badge ${countMatch ? 'bg-success' : 'bg-warning text-dark'}`}>
                                {countMatch ? 'Match' : 'Mismatch'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {!countMatch && (
                        <div className="alert alert-warning">
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          <strong>Cart count mismatch!</strong> Expected {expectedCount} carts but {loadingVerification.actualCartCount} were loaded.
                        </div>
                      )}

                      {/* Client Color Legend */}
                      <div className="mb-3">
                        <h6>Client Legend:</h6>
                        <div className="d-flex flex-wrap gap-2">
                          {getUniqueClientsFromTruck(truck).map((client, index) => (
                            <div 
                              key={client.id} 
                              className="d-flex align-items-center gap-2 p-2 border rounded"
                              style={{ backgroundColor: "#f8f9fa" }}
                            >
                              <div 
                                className="color-swatch border" 
                                style={{ 
                                  width: "20px", 
                                  height: "20px", 
                                  backgroundColor: availableColors[index % availableColors.length],
                                  borderRadius: "3px"
                                }}
                              ></div>
                              <small className="fw-bold">{client.name}</small>
                              <small className="text-muted">({client.totalCarts} carts)</small>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Truck Loading Diagram (Read-only) */}
                      <div className="truck-diagram border rounded p-3" style={{ backgroundColor: "#f9f9f9" }}>
                        <div className="text-center mb-2">
                          <small className="text-muted fw-bold">FRONT OF TRUCK</small>
                        </div>
                        
                        <div className="truck-grid">
                          {[0, 1, 2, 3].map(row => (
                            <div key={row} className="d-flex justify-content-center gap-2 mb-2">
                              {[0, 1, 2].map(col => {
                                const position = savedDiagram.find((p: any) => p.row === row && p.col === col);
                                const client = position?.clientId ? getUniqueClientsFromTruck(truck).find(c => c.id === position.clientId) : null;
                                const colorIndex = client ? getUniqueClientsFromTruck(truck).findIndex(c => c.id === client.id) : -1;
                                
                                return (
                                  <div 
                                    key={`${row}-${col}`}
                                    className="truck-position border rounded d-flex flex-column align-items-center justify-content-center"
                                    style={{
                                      width: "80px",
                                      height: "60px",
                                      backgroundColor: position?.clientId 
                                        ? availableColors[colorIndex % availableColors.length] 
                                        : "#ffffff",
                                      border: "1px solid #dee2e6"
                                    }}
                                    title={position?.clientName || `Position ${row + 1}-${col + 1} (Empty)`}
                                  >
                                    {position?.clientId ? (
                                      <small className="fw-bold text-white text-center" style={{ fontSize: "10px", lineHeight: "1" }}>
                                        {position.clientName}
                                      </small>
                                    ) : (
                                      <small className="text-muted" style={{ fontSize: "10px" }}>
                                        {row + 1}-{col + 1}
                                      </small>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        
                        <div className="text-center mt-2">
                          <small className="text-muted fw-bold">BACK OF TRUCK</small>
                        </div>
                      </div>

                      {/* Verification Notes */}
                      {loadingVerification.notes && (
                        <div className="mt-3">
                          <h6>Verification Notes:</h6>
                          <div className="alert alert-info">
                            {loadingVerification.notes}
                          </div>
                        </div>
                      )}

                      {/* Verification Details */}
                      <div className="mt-3">
                        <small className="text-muted">
                          <strong>Verified by:</strong> {loadingVerification.verifiedBy} <br />
                          <strong>Verified at:</strong> {new Date(loadingVerification.verifiedAt).toLocaleString("en-US")}
                        </small>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowViewLoadingDiagramModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Popup */}
      {selectedInvoiceId && (
        <InvoiceDetailsPopup
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onRefresh={(dateToRefresh?: string) => {
            console.log(`🔄 [ShippingPage] onRefresh called with dateToRefresh: ${dateToRefresh}`);
            setIsRefreshing(true);
            
            // If a specific date is provided, fetch data for that date
            // Otherwise, use the current selected date
            const targetDate = dateToRefresh || selectedDate;
            console.log(`🎯 [ShippingPage] Refreshing data for target date: ${targetDate}`);
            
            if (targetDate) {
              // Clear existing data first to force refresh
              setShippingData([]);
              setScheduledInvoices([]);
              
              // Fetch fresh data
              Promise.all([
                fetchShippingData(targetDate),
                fetchScheduledInvoices(targetDate)
              ]).then(() => {
                // Trigger UI refresh
                setRefreshTrigger(prev => prev + 1);
                console.log(`✅ [ShippingPage] Data refresh completed for ${targetDate}`);
              }).catch(error => {
                console.error(`❌ [ShippingPage] Error refreshing data for ${targetDate}:`, error);
              }).finally(() => {
                setIsRefreshing(false);
              });
            } else {
              // Fallback to fetching without specific date
              fetchShippingData().then(() => {
                setRefreshTrigger(prev => prev + 1);
                console.log(`✅ [ShippingPage] Fallback data refresh completed`);
              }).finally(() => {
                setIsRefreshing(false);
              });
            }
          }}
        />
      )}

      {/* Signature Modal */}
      {signatureInvoice && (
        <SignatureModal
          show={!!signatureInvoice}
          onClose={() => setSignatureInvoice(null)}
          invoiceId={signatureInvoice.id}
          invoiceNumber={signatureInvoice.number}
          clientName={signatureInvoice.clientName}
          clientId={signatureInvoice.clientId}
          invoice={signatureInvoice.fullInvoiceData} // Pass full invoice data for cart display
          onSignatureSaved={fetchShippingData}
          driverName={signatureInvoice.driverName}
          deliveryDate={signatureInvoice.deliveryDate}
        />
      )}

      {/* Emergency Delivery Modal */}
      {showEmergencyDeliveryModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
                  Emergency Delivery Form
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEmergencyDeliveryModal(false)}
                  disabled={savingEmergencyDelivery}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Use this form to record deliveries for items that are not physically loaded in your truck.
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    <strong>Select Client</strong> <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={emergencyClientId}
                    onChange={(e) => setEmergencyClientId(e.target.value)}
                    disabled={savingEmergencyDelivery}
                  >
                    <option value="">Choose client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    <strong>Items/Description</strong> <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={emergencyItems}
                    onChange={(e) => setEmergencyItems(e.target.value)}
                    placeholder="Describe the items being delivered..."
                    disabled={savingEmergencyDelivery}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    <strong>Reason for Emergency Delivery</strong> <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    disabled={savingEmergencyDelivery}
                  >
                    <option value="">Select reason...</option>
                    <option value="Items not loaded on truck">Items not loaded on truck</option>
                    <option value="Last minute delivery request">Last minute delivery request</option>
                    <option value="Route change/addition">Route change/addition</option>
                    <option value="Replacement delivery">Replacement delivery</option>
                    <option value="Special circumstances">Special circumstances</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {emergencyClientId && emergencyItems.trim() && emergencyReason && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    Ready to capture signature. Click "Capture Signature" below.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEmergencyDeliveryModal(false)}
                  disabled={savingEmergencyDelivery}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleEmergencySignature}
                  disabled={savingEmergencyDelivery || !emergencyClientId || !emergencyItems.trim() || !emergencyReason}
                >
                  <i className="bi bi-pen me-1"></i>
                  Capture Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Delivery Signature Modal */}
      {emergencySignature && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Emergency Delivery Signature - {emergencySignature.clientName}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEmergencySignature(null)}
                  disabled={savingEmergencyDelivery}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Please have the person who received the emergency delivery sign below to confirm receipt.
                </div>

                <div className="mb-3">
                  <label className="form-label">Receiver's Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={emergencySignature.receiverName || ""}
                    onChange={(e) => setEmergencySignature({...emergencySignature, receiverName: e.target.value})}
                    placeholder="Enter the name of person receiving"
                    disabled={savingEmergencyDelivery}
                  />
                </div>

                <div className="mb-3">
                  <div className="form-check" style={{ padding: "10px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "5px" }}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="emergencyNoPersonnel"
                      checked={emergencySignature.noPersonnelAvailable || false}
                      onChange={(e) => setEmergencySignature({...emergencySignature, noPersonnelAvailable: e.target.checked})}
                      disabled={savingEmergencyDelivery}
                    />
                    <label className="form-check-label" htmlFor="emergencyNoPersonnel" style={{ fontWeight: "500", color: "#495057" }}>
                      <i className="bi bi-exclamation-triangle-fill me-2" style={{ color: "#ffc107" }}></i>
                      No authorized personnel available at the time of delivery
                    </label>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Signature</label>
                  <div
                    className="signature-container border rounded"
                    style={{
                      width: "100%",
                      height: "200px",
                      backgroundColor: emergencySignature.noPersonnelAvailable ? "#f1f3f5" : "#f8f9fa",
                      position: "relative",
                      opacity: emergencySignature.noPersonnelAvailable ? 0.5 : 1,
                    }}
                  >
                    <canvas
                      ref={(canvas) => {
                        if (canvas && !emergencySignature.signatureCanvas) {
                          setEmergencySignature({...emergencySignature, signatureCanvas: canvas});
                        }
                      }}
                      width={500}
                      height={200}
                      style={{ 
                        width: "100%", 
                        height: "100%", 
                        cursor: "crosshair",
                        touchAction: "none", // Prevent scrolling on touch
                      }}
                      // Mouse events for desktop
                      onMouseDown={(e) => {
                        if (emergencySignature.noPersonnelAvailable) return;
                        const canvas = e.currentTarget;
                        const rect = canvas.getBoundingClientRect();
                        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                          setEmergencySignature({...emergencySignature, isDrawing: true, hasSignature: true});
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!emergencySignature.isDrawing || emergencySignature.noPersonnelAvailable) return;
                        const canvas = e.currentTarget;
                        const rect = canvas.getBoundingClientRect();
                        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.lineTo(x, y);
                          ctx.stroke();
                        }
                      }}
                      onMouseUp={() => {
                        setEmergencySignature({...emergencySignature, isDrawing: false});
                      }}
                      // Touch events for mobile
                      onTouchStart={(e) => {
                        if (emergencySignature.noPersonnelAvailable) return;
                        e.preventDefault(); // Prevent scrolling
                        const canvas = e.currentTarget;
                        const rect = canvas.getBoundingClientRect();
                        const touch = e.touches[0];
                        const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                        const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(x, y);
                          setEmergencySignature({...emergencySignature, isDrawing: true, hasSignature: true});
                        }
                      }}
                      onTouchMove={(e) => {
                        if (!emergencySignature.isDrawing || emergencySignature.noPersonnelAvailable) return;
                        e.preventDefault(); // Prevent scrolling
                        const canvas = e.currentTarget;
                        const rect = canvas.getBoundingClientRect();
                        const touch = e.touches[0];
                        const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                        const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.lineTo(x, y);
                          ctx.stroke();
                        }
                      }}
                      onTouchEnd={() => {
                        setEmergencySignature({...emergencySignature, isDrawing: false});
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "#adb5bd",
                        pointerEvents: "none",
                        display: emergencySignature.hasSignature ? "none" : "block"
                      }}
                    >
                      <i className="bi bi-pen me-2"></i>
                      {emergencySignature.noPersonnelAvailable ? "Signature not required" : "Sign here"}
                    </div>
                  </div>
                  <div className="mt-2 d-flex gap-2">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        const canvas = emergencySignature.signatureCanvas;
                        if (canvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                          }
                        }
                        setEmergencySignature({...emergencySignature, hasSignature: false});
                      }}
                      disabled={savingEmergencyDelivery || emergencySignature.noPersonnelAvailable}
                    >
                      <i className="bi bi-x-lg me-1"></i>
                      Clear Signature
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setEmergencySignature(null)}
                  disabled={savingEmergencyDelivery}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={async () => {
                    const canvas = emergencySignature.signatureCanvas;
                    let signatureData;
                    
                    if (emergencySignature.noPersonnelAvailable) {
                      signatureData = {
                        image: null,
                        name: "No authorized personnel available at the time of delivery",
                        timestamp: new Date(),
                        noPersonnelAvailable: true,
                      };
                    } else {
                      if (!canvas || !emergencySignature.receiverName?.trim()) {
                        alert("Please provide receiver name and signature.");
                        return;
                      }
                      signatureData = {
                        image: canvas.toDataURL(),
                        name: emergencySignature.receiverName,
                        timestamp: new Date(),
                        noPersonnelAvailable: false,
                      };
                    }
                    
                    await saveEmergencyDelivery(signatureData);
                  }}
                  disabled={savingEmergencyDelivery || (!emergencySignature.noPersonnelAvailable && (!emergencySignature.receiverName?.trim()))}
                >
                  {savingEmergencyDelivery ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Saving...
                    </>
                  ) : emergencySignature.noPersonnelAvailable ? (
                    "Confirm No Personnel Available"
                  ) : (
                    "Save Emergency Delivery"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Emergency Deliveries Modal */}
      {showEmergencyDeliveriesModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-list-ul me-2"></i>
                  Emergency Deliveries
                  {selectedDate && ` - ${new Date(selectedDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEmergencyDeliveriesModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {loadingEmergencyDeliveries ? (
                  <div className="text-center py-4">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading emergency deliveries...</p>
                  </div>
                ) : emergencyDeliveries.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="bi bi-info-circle display-4 text-muted"></i>
                    <h5 className="mt-3 text-muted">No Emergency Deliveries</h5>
                    <p className="text-muted">
                      No emergency deliveries recorded for {selectedDate ? 
                        new Date(selectedDate).toLocaleDateString("en-US") : 
                        "this date"
                      }.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle-fill me-2"></i>
                      Found {emergencyDeliveries.length} emergency deliver{emergencyDeliveries.length === 1 ? 'y' : 'ies'} for this date.
                    </div>
                    
                    <div className="row">
                      {emergencyDeliveries.map((delivery) => (
                        <div className="col-md-6 mb-4" key={delivery.id}>
                          <div className="card border-warning shadow-sm">
                            <div className="card-header bg-warning text-dark">
                              <div className="d-flex justify-content-between align-items-center">
                                <h6 className="mb-0">
                                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                  Emergency Delivery
                                </h6>
                                <small>
                                  {new Date(delivery.createdAt).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </small>
                              </div>
                            </div>
                            <div className="card-body">
                              <div className="row">
                                <div className="col-sm-6">
                                  <strong>Client:</strong>
                                  <p className="mb-2">{delivery.clientName}</p>
                                  
                                  <strong>Driver:</strong>
                                  <p className="mb-2">{delivery.driverName}</p>
                                  
                                  <strong>Truck:</strong>
                                  <p className="mb-2">
                                    <span className="badge bg-secondary">{delivery.truckNumber}</span>
                                  </p>
                                </div>
                                <div className="col-sm-6">
                                  <strong>Reason:</strong>
                                  <p className="mb-2 text-muted">{delivery.reason}</p>
                                  
                                  <strong>Signature Status:</strong>
                                  <p className="mb-2">
                                    {delivery.signature.noPersonnelAvailable ? (
                                      <span className="badge bg-warning text-dark">
                                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                        No Personnel Available
                                      </span>
                                    ) : (
                                      <span className="badge bg-success">
                                        <i className="bi bi-check-circle-fill me-1"></i>
                                        Signed by: {delivery.signature.name}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="mt-3">
                                <strong>Items/Description:</strong>
                                <div className="p-2 bg-light border rounded mt-1">
                                  {delivery.items}
                                </div>
                              </div>
                              
                              {delivery.signature.image && (
                                <div className="mt-3">
                                  <strong>Signature:</strong>
                                  <div className="border rounded p-2 bg-white mt-1">
                                    <img 
                                      src={delivery.signature.image} 
                                      alt="Delivery signature"
                                      style={{ maxWidth: "100%", height: "auto" }}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 text-end">
                                <small className="text-muted">
                                  Recorded by: {delivery.createdBy} at {new Date(delivery.createdAt).toLocaleString("en-US")}
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEmergencyDeliveriesModal(false)}
                >
                  Close
                </button>
                {emergencyDeliveries.length > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      // Simple print functionality - could be enhanced
                      window.print();
                    }}
                    title="Print emergency deliveries report"
                  >
                    <i className="bi bi-printer me-1"></i>
                    Print Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Date and Truck Edit Modal - removed */}
    </div>
  );
};

export default ShippingPage;

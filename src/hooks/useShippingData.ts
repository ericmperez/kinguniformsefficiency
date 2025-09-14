import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export interface ShippingInvoice {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  clientId: string;
  deliveryDate: string;
  cartCount: number;
  truckNumber: string;
  receivedBy?: string;
  hasSignature?: boolean;
  tripNumber?: number;
  tripType?: "Trip 1" | "Trip 2";
}

export interface ShippingTruckData {
  truckNumber: string;
  invoices: ShippingInvoice[];
  assignedDriver?: string;
}

export interface Driver {
  id: string;
  name: string;
  linkedUserId?: string;
  linkedUsername?: string;
}

export interface TruckAssignment {
  truckNumber: string;
  driverId: string;
  driverName: string;
  assignedDate: string;
}

export interface TruckCompletion {
  truckNumber: string;
  completedDate: string;
  completedBy: string;
  completedAt: string;
  isCompleted: boolean;
  tripNumber: number;
  tripType: "Trip 1" | "Trip 2";
}

export const useShippingData = (selectedDate: string) => {
  const [shippingData, setShippingData] = useState<ShippingTruckData[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<{[key: string]: TruckAssignment}>({});
  const [truckCompletions, setTruckCompletions] = useState<{[key: string]: TruckCompletion}>({});
  const [scheduledInvoices, setScheduledInvoices] = useState<ShippingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Fetch drivers
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

  // Fetch truck assignments for a specific date
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

  // Fetch truck completions for a specific date
  const fetchTruckCompletions = useCallback(async () => {
    if (!selectedDate) return;

    try {
      const completionsQuery = query(
        collection(db, "truckCompletions"),
        where("completedDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(completionsQuery);
      const completions: {[key: string]: TruckCompletion} = {};

      querySnapshot.forEach((doc) => {
        const completion = doc.data() as TruckCompletion;
        const key = `${completion.truckNumber}_trip_${completion.tripNumber}`;
        completions[key] = completion;
      });

      setTruckCompletions(completions);
    } catch (error) {
      console.error("Error fetching truck completions:", error);
    }
  }, [selectedDate]);

  // Fetch shipping data
  const fetchShippingData = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date range for optimization: today + 2 days back + future dates
      const today = new Date();
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);
      
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      twoWeeksFromNow.setHours(23, 59, 59, 999);
      
      // Optimized query: Fetch shipped invoices with delivery date constraints
      const shippedQuery = query(
        collection(db, "invoices"),
        where("isShipped", "==", true),
        where("deliveryDate", ">=", twoDaysAgo.toISOString()),
        where("deliveryDate", "<=", twoWeeksFromNow.toISOString())
      );
      const shippedSnapshot = await getDocs(shippedQuery);
      
      const trucksMap = new Map<string, ShippingTruckData>();
      const dates = new Set<string>();

      shippedSnapshot.forEach((doc) => {
        const invoice = { id: doc.id, ...doc.data() } as any;
        
        if (invoice.truckNumber && invoice.deliveryDate) {
          // Add date to available dates
          try {
            const deliveryDate = new Date(invoice.deliveryDate).toISOString().split('T')[0];
            dates.add(deliveryDate);
          } catch (error) {
            // Fallback for date parsing
            dates.add(invoice.deliveryDate);
          }

          const shippingInvoice: ShippingInvoice = {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.clientName,
            clientId: invoice.clientId,
            deliveryDate: invoice.deliveryDate,
            cartCount: invoice.carts?.reduce((total: number, cart: any) => total + (cart.items?.length || 0), 0) || 0,
            truckNumber: invoice.truckNumber,
            receivedBy: invoice.receivedBy,
            hasSignature: !!invoice.signature,
            tripNumber: invoice.tripNumber || 1,
            tripType: invoice.tripType || "Trip 1"
          };

          if (!trucksMap.has(invoice.truckNumber)) {
            trucksMap.set(invoice.truckNumber, {
              truckNumber: invoice.truckNumber,
              invoices: []
            });
          }

          trucksMap.get(invoice.truckNumber)!.invoices.push(shippingInvoice);
        }
      });

      setShippingData(Array.from(trucksMap.values()));
      setAvailableDates(Array.from(dates).sort().reverse());

    } catch (error) {
      console.error("Error fetching shipping data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Assign driver to truck
  const assignDriverToTruck = useCallback(async (truckNumber: string, driverId: string) => {
    if (!selectedDate) return false;

    try {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) throw new Error("Driver not found");

      const assignment: TruckAssignment = {
        truckNumber,
        driverId,
        driverName: driver.name,
        assignedDate: selectedDate
      };

      const docId = `${selectedDate}_${truckNumber}`;
      await setDoc(doc(db, "truckAssignments", docId), assignment);

      setTruckAssignments(prev => ({
        ...prev,
        [truckNumber]: assignment
      }));

      return true;
    } catch (error) {
      console.error("Error assigning driver:", error);
      return false;
    }
  }, [selectedDate, drivers]);

  // Mark truck as completed
  const markTruckAsCompleted = useCallback(async (truckNumber: string, userId: string, userName: string) => {
    if (!selectedDate) return false;

    try {
      const currentTripNumber = getCurrentTripNumber(truckNumber);
      const currentTripType = getCurrentTripType(truckNumber);

      const completion: TruckCompletion = {
        truckNumber,
        completedDate: selectedDate,
        completedBy: userName,
        completedAt: new Date().toISOString(),
        isCompleted: true,
        tripNumber: currentTripNumber,
        tripType: currentTripType
      };

      const docId = `${selectedDate}_${truckNumber}_trip_${currentTripNumber}`;
      await setDoc(doc(db, "truckCompletions", docId), completion);

      const key = `${truckNumber}_trip_${currentTripNumber}`;
      setTruckCompletions(prev => ({
        ...prev,
        [key]: completion
      }));

      return true;
    } catch (error) {
      console.error("Error marking truck as completed:", error);
      return false;
    }
  }, [selectedDate]);

  // Get current trip number for truck
  const getCurrentTripNumber = useCallback((truckNumber: string): number => {
    const trip1Key = `${truckNumber}_trip_1`;
    const trip2Key = `${truckNumber}_trip_2`;
    
    const trip1Completed = truckCompletions[trip1Key]?.isCompleted;
    const trip2Completed = truckCompletions[trip2Key]?.isCompleted;
    
    if (!trip1Completed) return 1;
    if (trip1Completed && !trip2Completed) return 2;
    return 1; // Reset for new cycle or default
  }, [truckCompletions]);

  // Get current trip type for truck
  const getCurrentTripType = useCallback((truckNumber: string): "Trip 1" | "Trip 2" => {
    const tripNumber = getCurrentTripNumber(truckNumber);
    return tripNumber === 1 ? "Trip 1" : "Trip 2";
  }, [getCurrentTripNumber]);

  // Check if truck can accept new invoices
  const canTruckAcceptNewInvoices = useCallback((truckNumber: string): boolean => {
    const truck = shippingData.find(t => t.truckNumber === truckNumber);
    if (!truck) return true;

    const totalCarts = truck.invoices.reduce((sum, inv) => sum + (inv.cartCount || 0), 0);
    const currentTrip = getCurrentTripNumber(truckNumber);
    
    // Basic capacity check (15 carts per trip)
    const tripCarts = truck.invoices
      .filter(inv => (inv.tripNumber || 1) === currentTrip)
      .reduce((sum, inv) => sum + (inv.cartCount || 0), 0);
    
    return tripCarts < 15;
  }, [shippingData, getCurrentTripNumber]);

  // Get filtered data for selected date
  const getFilteredData = useCallback(() => {
    if (!selectedDate) return shippingData;

    return shippingData
      .map(truck => ({
        ...truck,
        invoices: truck.invoices.filter(invoice => {
          try {
            const invoiceDate = new Date(invoice.deliveryDate).toISOString().split('T')[0];
            return invoiceDate === selectedDate;
          } catch {
            return invoice.deliveryDate === selectedDate;
          }
        })
      }))
      .filter(truck => truck.invoices.length > 0);
  }, [shippingData, selectedDate]);

  // Initialize data
  useEffect(() => {
    fetchShippingData();
    fetchDrivers();
  }, [fetchShippingData, fetchDrivers]);

  // Fetch assignments and completions when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchTruckAssignments();
      fetchTruckCompletions();
    }
  }, [selectedDate, fetchTruckAssignments, fetchTruckCompletions]);

  return {
    // Data
    shippingData,
    drivers,
    truckAssignments,
    truckCompletions,
    scheduledInvoices,
    availableDates,
    loading,
    
    // Computed data
    filteredData: getFilteredData(),
    
    // Actions
    assignDriverToTruck,
    markTruckAsCompleted,
    
    // Utilities
    getCurrentTripNumber,
    getCurrentTripType,
    canTruckAcceptNewInvoices,
    
    // Refresh
    refetch: fetchShippingData
  };
}; 
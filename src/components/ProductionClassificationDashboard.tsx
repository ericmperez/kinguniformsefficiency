import React, { useEffect, useState, useMemo } from "react";
import ProductionTrackingService, {
  ProductionSummary,
  ProductionEntry,
} from "../services/ProductionTrackingService";
import {
  productClassificationService,
  type ProductClassificationRecord,
  type ProductClassification,
} from "../services/ProductClassificationService";
import EndOfShiftDashboard from "./EndOfShiftDashboard";
// Add segregation-related imports
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface ClassifiedEntry extends ProductionEntry {
  classification: "Mangle" | "Doblado";
  hourMinute: string; // "HH:MM" format
}

interface ProductionGroup {
  classification: "Mangle" | "Doblado";
  totalItems: number;
  currentHourRate: number;
  overallHourlyRate: number;
  entries: ClassifiedEntry[];
  uniqueProducts: number;
  clientsCount: number;
  activeInLast30Min: boolean;
  firstEntry?: Date;
  lastEntry?: Date;
}

interface EditableClassification {
  [productName: string]: ProductClassification;
}

const ProductionClassificationDashboard: React.FC = () => {
  const [productionSummary, setProductionSummary] =
    useState<ProductionSummary | null>(null);
  const [customClassifications, setCustomClassifications] =
    useState<EditableClassification>({});
  const [classificationRecords, setClassificationRecords] = useState<
    Map<string, ProductClassificationRecord>
  >(new Map());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Date selection state - defaults to today
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // State for all products added today (for Edit Classifications modal)
  const [allProductsToday, setAllProductsToday] = useState<string[]>([]);

  // Add segregation data state
  const [segregatedClientsToday, setSegregatedClientsToday] = useState<
    Array<{
      clientId: string;
      clientName: string;
      weight: number;
      timestamp: string;
      user?: string;
    }>
  >([]);
  const [totalSegregatedWeight, setTotalSegregatedWeight] = useState(0);
  const [segregationLoading, setSegregationLoading] = useState(true);

  // Add pickup entries state
  const [pickupEntriesToday, setPickupEntriesToday] = useState<
    Array<{
      id: string;
      clientId: string;
      clientName: string;
      driverId: string;
      driverName: string;
      groupId: string;
      weight: number;
      timestamp: string;
    }>
  >([]);
  const [totalPickupWeight, setTotalPickupWeight] = useState(0);
  const [pickupEntriesLoading, setPickupEntriesLoading] = useState(true);

  // Add toast notification state for classification saves
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // State for production start times for hourly rate calculations
  const [mangleStartTime, setMangleStartTime] = useState<string>(
    localStorage.getItem("mangleStartTime") || "08:00"
  );
  const [dobladoStartTime, setDobladoStartTime] = useState<string>(
    localStorage.getItem("dobladoStartTime") || "08:00"
  );
  const [segregationStartTime, setSegregationStartTime] = useState<string>(
    localStorage.getItem("segregationStartTime") || "08:00"
  );

  // State for lunch break configuration
  const [mangleLunchBreak, setMangleLunchBreak] = useState<string>(
    localStorage.getItem("mangleLunchBreak") || "no-break"
  );
  const [dobladoLunchBreak, setDobladoLunchBreak] = useState<string>(
    localStorage.getItem("dobladoLunchBreak") || "no-break"
  );
  const [segregationLunchBreak, setSegregationLunchBreak] = useState<string>(
    localStorage.getItem("segregationLunchBreak") || "no-break"
  );

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<{
    segregation: boolean;
    pickupEntries: boolean;
    mangleLog: boolean;
    dobladoLog: boolean;
  }>({
    segregation: false,
    pickupEntries: false,
    mangleLog: false,
    dobladoLog: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Save start times to localStorage when changed
  const handleMangleStartTimeChange = (time: string) => {
    setMangleStartTime(time);
    localStorage.setItem("mangleStartTime", time);
  };

  const handleDobladoStartTimeChange = (time: string) => {
    setDobladoStartTime(time);
    localStorage.setItem("dobladoStartTime", time);
  };

  const handleSegregationStartTimeChange = (time: string) => {
    setSegregationStartTime(time);
    localStorage.setItem("segregationStartTime", time);
  };

  // Save lunch break settings to localStorage when changed
  const handleMangleLunchBreakChange = (option: string) => {
    setMangleLunchBreak(option);
    localStorage.setItem("mangleLunchBreak", option);
  };

  const handleDobladoLunchBreakChange = (option: string) => {
    setDobladoLunchBreak(option);
    localStorage.setItem("dobladoLunchBreak", option);
  };

  const handleSegregationLunchBreakChange = (option: string) => {
    setSegregationLunchBreak(option);
    localStorage.setItem("segregationLunchBreak", option);
  };

  // Get classification for a product using the centralized service
  const getClassification = (productName: string): ProductClassification => {
    return productClassificationService.getClassification(productName);
  };

  // Initialize product classification service
  useEffect(() => {
    const initializeClassificationService = async () => {
      try {
        await productClassificationService.waitForInitialization();

        // Subscribe to classification changes
        const unsubscribeClassifications =
          productClassificationService.subscribe((classifications) => {
            setClassificationRecords(classifications);
            setCustomClassifications(
              productClassificationService.getClassificationsCompatFormat()
            );
            console.log(
              "🏷️ [Classification Dashboard] Updated classifications:",
              classifications.size,
              "products"
            );
          });

        return () => {
          unsubscribeClassifications();
        };
      } catch (error) {
        console.error(
          "🏷️ [Classification Dashboard] Failed to initialize classification service:",
          error
        );
      }
    };

    initializeClassificationService();
  }, []);

  // Initialize production tracking
  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();

    console.log("🏭 [Classification Dashboard] Starting production tracking");

    // Subscribe to production updates
    const unsubscribe = productionService.subscribe(
      (summary: ProductionSummary) => {
        console.log(
          "🏭 [Classification Dashboard] Received production update:",
          summary.totalItemsAdded,
          "items"
        );
        setProductionSummary(summary);
        setLoading(false);
      }
    );

    // Start tracking
    productionService.startTracking();

    // Cleanup
    return () => {
      console.log(
        "🏭 [Classification Dashboard] Cleaning up production tracking"
      );
      unsubscribe();
      productionService.stopTracking();
    };
  }, []);

  // Direct Firebase query to get ALL products added on selected date (bypassing service filters)
  useEffect(() => {
    const fetchAllProductsForDate = async () => {
      try {
        // Parse the selected date as local date to avoid timezone shift
        const [year, month, day] = selectedDate.split("-").map(Number);
        const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

        // Get all invoices to find ALL products added on selected date
        const invoicesSnapshot = await getDocs(collection(db, "invoices"));
        const allProductsSet = new Set<string>();

        invoicesSnapshot.docs.forEach((doc) => {
          const invoice = doc.data();
          const carts = invoice.carts || [];

          carts.forEach((cart: any) => {
            const items = cart.items || [];

            items.forEach((item: any) => {
              if (item.addedAt && item.productName) {
                const itemDate = new Date(item.addedAt);

                // Include ALL items added on selected date, regardless of quantity or other filters
                if (itemDate >= selectedDateObj && itemDate < nextDay) {
                  allProductsSet.add(item.productName);
                }
              }
            });
          });
        });

        const sortedProducts = Array.from(allProductsSet).sort();
        setAllProductsToday(sortedProducts);
        console.log(
          `🏭 [Classification] Found ${sortedProducts.length} unique products added on ${selectedDate}`
        );
      } catch (error) {
        console.error("Error fetching all products for selected date:", error);
      }
    };

    fetchAllProductsForDate();
  }, [selectedDate]);

  // State for segregation hourly rates
  const [segregationHourlyData, setSegregationHourlyData] = useState<
    Array<{
      hour: number;
      clients: number;
      weight: number;
      rate: number;
    }>
  >([]);

  // Fetch segregation data for selected date (with fallback to recent data)
  useEffect(() => {
    const fetchSegregationData = async () => {
      try {
        setSegregationLoading(true);

        // Get selected date string (YYYY-MM-DD format) using local timezone
        // Parse the selected date as local date to avoid timezone shift
        const [year, month, day] = selectedDate.split("-").map(Number);
        const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        const localDateStr = selectedDate; // Keep the original selected date string
        const utcDateStr = selectedDateObj.toISOString().slice(0, 10);

        console.log("🏭 [Segregation] Selected date:", selectedDate);
        console.log("🏭 [Segregation] Local date:", localDateStr);
        console.log("🏭 [Segregation] UTC date:", utcDateStr);
        console.log(
          "🏭 [Segregation] Timezone offset (hours):",
          selectedDateObj.getTimezoneOffset() / 60
        );

        // Try local date first, then UTC date as fallback
        let segregationQuery = query(
          collection(db, "segregation_done_logs"),
          where("date", "==", localDateStr)
        );

        let segregationSnapshot = await getDocs(segregationQuery);
        console.log(
          "🏭 [Segregation] Found",
          segregationSnapshot.docs.length,
          "records for local date:",
          localDateStr
        );

        // If no records found with local date and local != UTC, try UTC date
        if (
          segregationSnapshot.docs.length === 0 &&
          localDateStr !== utcDateStr
        ) {
          console.log("🏭 [Segregation] Trying UTC date:", utcDateStr);
          segregationQuery = query(
            collection(db, "segregation_done_logs"),
            where("date", "==", utcDateStr)
          );
          segregationSnapshot = await getDocs(segregationQuery);
          console.log(
            "🏭 [Segregation] Found",
            segregationSnapshot.docs.length,
            "records for UTC date:",
            utcDateStr
          );
        }

        // If still no records found, check recent records as fallback (only for today)
        let allSegregationDocs = segregationSnapshot.docs;
        const isToday = selectedDate === new Date().toISOString().slice(0, 10);

        if (segregationSnapshot.docs.length === 0 && isToday) {
          console.log(
            "🏭 [Segregation] No records for selected date, checking recent records (today only)..."
          );

          // Query recent segregation records (last 48 hours) as fallback for today only
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          const { Timestamp } = await import("firebase/firestore");

          const recentQuery = query(
            collection(db, "segregation_done_logs"),
            where("timestamp", ">=", Timestamp.fromDate(twoDaysAgo))
          );

          const recentSnapshot = await getDocs(recentQuery);
          console.log(
            "🏭 [Segregation] Found",
            recentSnapshot.docs.length,
            "recent records (last 48h)"
          );
          allSegregationDocs = recentSnapshot.docs;
        }

        const segregatedClients: typeof segregatedClientsToday = [];
        let totalWeight = 0;

        // Hourly breakdown data
        const hourlyBreakdown: {
          [hour: number]: { clients: number; weight: number };
        } = {};

        allSegregationDocs.forEach((doc) => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp || new Date().toISOString();

          // Convert Firestore timestamp to JavaScript Date if needed
          let timestampDate;
          if (timestamp && timestamp.toDate) {
            timestampDate = timestamp.toDate();
          } else if (timestamp) {
            timestampDate = new Date(timestamp);
          } else {
            timestampDate = new Date();
          }

          // For selected date (not today), include all records from that date
          // For today, only include records from the last 24 hours for better relevance
          const selectedDateObj = new Date(selectedDate);
          const isToday =
            selectedDate === new Date().toISOString().slice(0, 10);

          if (isToday) {
            const twentyFourHoursAgo = new Date(
              Date.now() - 24 * 60 * 60 * 1000
            );
            if (timestampDate < twentyFourHoursAgo) {
              return; // Skip old records for today only
            }
          }

          segregatedClients.push({
            clientId: data.clientId || "unknown",
            clientName: data.clientName || "Unknown Client",
            weight: weight,
            timestamp: timestampDate.toISOString(),
            user: data.user || "Unknown",
          });

          totalWeight += weight;

          // Calculate hourly breakdown
          const hour = timestampDate.getHours();
          if (!hourlyBreakdown[hour]) {
            hourlyBreakdown[hour] = { clients: 0, weight: 0 };
          }
          hourlyBreakdown[hour].clients += 1;
          hourlyBreakdown[hour].weight += weight;
        });

        // Convert hourly breakdown to array with rates
        const hourlyData = Object.entries(hourlyBreakdown)
          .map(([hourStr, data]) => {
            const hour = parseInt(hourStr);
            return {
              hour,
              clients: data.clients,
              weight: data.weight,
              rate: data.weight, // Weight per hour (since it's already per hour)
            };
          })
          .sort((a, b) => a.hour - b.hour);

        // Sort by timestamp (most recent first)
        segregatedClients.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setSegregatedClientsToday(segregatedClients);
        setTotalSegregatedWeight(totalWeight);
        setSegregationHourlyData(hourlyData);

        console.log("🏭 [Segregation Data] Processed segregation data:", {
          selectedDate: selectedDate,
          totalClients: segregatedClients.length,
          totalWeight: totalWeight,
          localDateFilter: localDateStr,
          utcDateFilter: utcDateStr,
          recordsFound: allSegregationDocs.length,
          recordsProcessed: segregatedClients.length,
          hourlyBreakdown: hourlyData,
          sampleClients: segregatedClients.slice(0, 3).map((c) => ({
            name: c.clientName,
            weight: c.weight,
            time: new Date(c.timestamp).toLocaleTimeString(),
          })),
        });
      } catch (error) {
        console.error("Error fetching segregation data:", error);
      } finally {
        setSegregationLoading(false);
      }
    };

    fetchSegregationData();
  }, [selectedDate]);

  // Fetch pickup entries data for selected date
  useEffect(() => {
    const fetchPickupEntries = async () => {
      try {
        setPickupEntriesLoading(true);

        // Get selected date range
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDateObj);
        nextDay.setDate(nextDay.getDate() + 1);

        // Import Firebase functions dynamically
        const { Timestamp } = await import("firebase/firestore");

        // Query pickup_entries for selected date
        const pickupEntriesQuery = query(
          collection(db, "pickup_entries"),
          where("timestamp", ">=", Timestamp.fromDate(selectedDateObj)),
          where("timestamp", "<", Timestamp.fromDate(nextDay))
        );

        const pickupEntriesSnapshot = await getDocs(pickupEntriesQuery);
        const pickupEntries: typeof pickupEntriesToday = [];
        let totalWeight = 0;

        pickupEntriesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp;

          // Convert timestamp to string
          let timestampStr = new Date().toISOString();
          if (timestamp && typeof timestamp.toDate === "function") {
            timestampStr = timestamp.toDate().toISOString();
          } else if (timestamp instanceof Date) {
            timestampStr = timestamp.toISOString();
          } else if (typeof timestamp === "string") {
            timestampStr = new Date(timestamp).toISOString();
          }

          pickupEntries.push({
            id: doc.id,
            clientId: data.clientId || "unknown",
            clientName: data.clientName || "Unknown Client",
            driverId: data.driverId || "unknown",
            driverName: data.driverName || "Unknown Driver",
            groupId: data.groupId || "unknown",
            weight: weight,
            timestamp: timestampStr,
          });

          totalWeight += weight;
        });

        // Sort by timestamp (most recent first)
        pickupEntries.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setPickupEntriesToday(pickupEntries);
        setTotalPickupWeight(totalWeight);

        console.log(
          "🚛 [Pickup Entries] Loaded pickup entries data for today:",
          {
            totalEntries: pickupEntries.length,
            totalWeight: totalWeight,
            entriesProcessed: pickupEntries.map(
              (e) => `${e.clientName} - ${e.weight}lbs`
            ),
          }
        );
      } catch (error) {
        console.error("Error fetching pickup entries data:", error);
      } finally {
        setPickupEntriesLoading(false);
      }
    };

    fetchPickupEntries();
  }, []);

  // Calculate current hour segregation rate
  const currentHourSegregationRate = useMemo(() => {
    if (!segregationHourlyData.length) return 0;

    const currentHour = new Date().getHours();
    const currentHourData = segregationHourlyData.find(
      (h) => h.hour === currentHour
    );

    return currentHourData ? currentHourData.rate : 0;
  }, [segregationHourlyData]);

  // State for production data for selected date
  const [selectedDateProductionData, setSelectedDateProductionData] = useState<{
    entries: ProductionEntry[];
    loading: boolean;
  }>({
    entries: [],
    loading: true,
  });

  // Fetch production data for selected date
  useEffect(() => {
    const fetchProductionDataForDate = async () => {
      try {
        setSelectedDateProductionData((prev) => ({ ...prev, loading: true }));

        // Get selected date range - handle timezone correctly
        // Parse the selected date as local date to avoid timezone shift
        const [year, month, day] = selectedDate.split("-").map(Number);
        const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

        console.log("🏭 [Production] Fetching data for date:", selectedDate);

        // Query all invoices and extract items added on selected date
        const invoicesSnapshot = await getDocs(collection(db, "invoices"));
        const productionEntries: ProductionEntry[] = [];

        invoicesSnapshot.docs.forEach((doc) => {
          const invoice = doc.data();
          const invoiceId = doc.id;
          const clientId = invoice.clientId || "";
          const clientName = invoice.clientName || "Unknown Client";
          const carts = invoice.carts || [];

          carts.forEach((cart: any) => {
            const cartId = cart.id || "";
            const cartName = cart.name || "Unknown Cart";
            const items = cart.items || [];

            items.forEach((item: any, itemIndex: number) => {
              if (item.addedAt) {
                const itemAddedAt = new Date(item.addedAt);

                // Include items added on selected date
                if (itemAddedAt >= selectedDateObj && itemAddedAt < nextDay) {
                  const productName = item.productName || "Unknown Product";
                  const quantity = Number(item.quantity) || 0;

                  // Only skip items with clearly invalid quantity
                  if (quantity > 0) {
                    productionEntries.push({
                      id: `${invoiceId}-${cartId}-${itemIndex}-${itemAddedAt.getTime()}`,
                      invoiceId,
                      clientId,
                      clientName,
                      cartId,
                      cartName,
                      productId: item.productId || "",
                      productName,
                      quantity,
                      price: Number(item.price) || 0,
                      addedBy: item.addedBy || "Unknown",
                      addedAt: itemAddedAt,
                      source: "invoice_item" as const,
                    });
                  }
                }
              }
            });
          });
        });

        // Sort by time (newest first)
        productionEntries.sort(
          (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
        );

        console.log(
          "🏭 [Production] Found",
          productionEntries.length,
          "entries for",
          selectedDate
        );

        setSelectedDateProductionData({
          entries: productionEntries,
          loading: false,
        });
      } catch (error) {
        console.error(
          "Error fetching production data for selected date:",
          error
        );
        setSelectedDateProductionData({
          entries: [],
          loading: false,
        });
      }
    };

    fetchProductionDataForDate();
  }, [selectedDate]);

  // Check if selected date is today
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  // Process production entries into classified groups
  const classifiedGroups = useMemo((): {
    mangle: ProductionGroup;
    doblado: ProductionGroup;
  } => {
    // Determine which data source to use
    const useSelectedDateData =
      !isToday || selectedDateProductionData.entries.length > 0;
    const entriesSource = useSelectedDateData
      ? selectedDateProductionData.entries
      : productionSummary?.allEntriesToday ||
        productionSummary?.recentEntries ||
        [];

    console.log("🔍 [Production Logs] Data source selection:", {
      selectedDate,
      isToday,
      useSelectedDateData,
      selectedDateEntries: selectedDateProductionData.entries.length,
      selectedDateLoading: selectedDateProductionData.loading,
      productionSummaryExists: !!productionSummary,
      allEntriesTodayCount: productionSummary?.allEntriesToday?.length || 0,
      recentEntriesCount: productionSummary?.recentEntries?.length || 0,
      finalEntriesCount: entriesSource.length,
    });

    if (
      entriesSource.length === 0 &&
      (selectedDateProductionData.loading || loading)
    ) {
      return {
        mangle: {
          classification: "Mangle",
          totalItems: 0,
          currentHourRate: 0,
          overallHourlyRate: 0,
          entries: [],
          uniqueProducts: 0,
          clientsCount: 0,
          activeInLast30Min: false,
        },
        doblado: {
          classification: "Doblado",
          totalItems: 0,
          currentHourRate: 0,
          overallHourlyRate: 0,
          entries: [],
          uniqueProducts: 0,
          clientsCount: 0,
          activeInLast30Min: false,
        },
      };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentHourStart = new Date();
    currentHourStart.setHours(currentHour, 0, 0, 0);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Classify all entries
    const classifiedEntries: ClassifiedEntry[] = entriesSource.map((entry) => ({
      ...entry,
      classification: getClassification(entry.productName),
      hourMinute: entry.addedAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    }));

    // Group by classification
    const mangleEntries = classifiedEntries.filter(
      (e) => e.classification === "Mangle"
    );
    const dobladoEntries = classifiedEntries.filter(
      (e) => e.classification === "Doblado"
    );

    console.log("🔍 [Production Logs] Classification results:", {
      totalEntries: classifiedEntries.length,
      mangleEntries: mangleEntries.length,
      dobladoEntries: dobladoEntries.length,
      mangleUnits: mangleEntries.reduce((sum, e) => sum + e.quantity, 0),
      dobladoUnits: dobladoEntries.reduce((sum, e) => sum + e.quantity, 0),
    });

    // Calculate statistics for each group
    const calculateGroupStats = (
      entries: ClassifiedEntry[]
    ): ProductionGroup => {
      if (entries.length === 0) {
        return {
          classification: entries === mangleEntries ? "Mangle" : "Doblado",
          totalItems: 0,
          currentHourRate: 0,
          overallHourlyRate: 0,
          entries: [],
          uniqueProducts: 0,
          clientsCount: 0,
          activeInLast30Min: false,
        };
      }

      // Sort by time
      const sortedEntries = [...entries].sort(
        (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
      );

      const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);
      const uniqueProducts = new Set(entries.map((e) => e.productName)).size;
      const clientsCount = new Set(entries.map((e) => e.clientId)).size;

      // Current hour items
      const currentHourEntries = entries.filter(
        (e) => e.addedAt >= currentHourStart
      );
      const currentHourItems = currentHourEntries.reduce(
        (sum, e) => sum + e.quantity,
        0
      );

      // Calculate current hour rate
      const minutesIntoCurrentHour = now.getMinutes();
      const hoursIntoCurrentHour = minutesIntoCurrentHour / 60;
      const currentHourRate =
        hoursIntoCurrentHour > 0 ? currentHourItems / hoursIntoCurrentHour : 0;

      // Overall hourly rate
      const firstEntry = sortedEntries[0];
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const durationMs = Math.max(
        lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime(),
        60000
      ); // Min 1 minute
      const durationHours = durationMs / (1000 * 60 * 60);
      const overallHourlyRate = totalItems / durationHours;

      // Check if active in last 30 minutes
      const activeInLast30Min = entries.some(
        (e) => e.addedAt >= thirtyMinutesAgo
      );

      return {
        classification: entries === mangleEntries ? "Mangle" : "Doblado",
        totalItems,
        currentHourRate,
        overallHourlyRate,
        entries: entries.sort(
          (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
        ), // Most recent first
        uniqueProducts,
        clientsCount,
        activeInLast30Min,
        firstEntry: firstEntry.addedAt,
        lastEntry: lastEntry.addedAt,
      };
    };

    return {
      mangle: calculateGroupStats(mangleEntries),
      doblado: calculateGroupStats(dobladoEntries),
    };
  }, [
    productionSummary,
    customClassifications,
    selectedDateProductionData,
    selectedDate,
    isToday,
    loading,
  ]);

  // Calculate timing summary for production on selected date
  const timingSummary = useMemo(() => {
    // Determine which data source to use
    const useSelectedDateData =
      !isToday || selectedDateProductionData.entries.length > 0;
    const entriesSource = useSelectedDateData
      ? selectedDateProductionData.entries
      : productionSummary?.recentEntries || [];

    if (entriesSource.length === 0) {
      return null;
    }

    const entries = entriesSource;
    const sortedEntries = [...entries].sort(
      (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
    );

    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const totalQuantity = entries.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );

    // Calculate production span
    const productionSpanMs =
      lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);
    const productionSpanMinutes = Math.floor(
      (productionSpanMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    // Calculate rates
    const selectedDateStart = new Date(selectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);
    const now = new Date();

    // For selected date calculations
    let hoursFromStart: number;
    if (isToday) {
      // For today, calculate from midnight to now
      hoursFromStart =
        (now.getTime() - selectedDateStart.getTime()) / (1000 * 60 * 60);
    } else {
      // For past dates, calculate for the full 24 hours
      hoursFromStart = 24;
    }

    const overallHourlyRate =
      hoursFromStart > 0 ? totalQuantity / hoursFromStart : 0;
    const productionPeriodRate =
      productionSpanHours > 0 ? totalQuantity / productionSpanHours : 0;

    return {
      firstEntry,
      lastEntry,
      totalQuantity,
      totalEntries: entries.length,
      productionSpanHours: Math.floor(productionSpanHours),
      productionSpanMinutes,
      overallHourlyRate,
      productionPeriodRate,
      uniqueClients: new Set(entries.map((e) => e.clientId)).size,
      uniqueProducts: new Set(entries.map((e) => e.productName)).size,
    };
  }, [productionSummary, selectedDateProductionData, selectedDate, isToday]);

  // Handle product classification change
  const handleClassificationChange = async (
    productName: string,
    newClassification: "Mangle" | "Doblado"
  ) => {
    try {
      // Always update via the centralized service (which syncs to Firebase)
      await productClassificationService.setClassification(
        productName,
        newClassification
      );

      // Update local state for immediate UI feedback
      setCustomClassifications((prev) => ({
        ...prev,
        [productName]: newClassification,
      }));

      // Close modals and show success feedback
      setShowEditModal(false);
      setEditingProduct("");

      // Show toast notification
      setToastMessage(
        `✅ Successfully saved: "${productName}" → ${newClassification}`
      );
      setToastType("success");
      setShowSaveToast(true);

      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setShowSaveToast(false);
      }, 3000);

      console.log(
        `✅ Saved classification for ${productName}: ${newClassification} (Firebase)`
      );
    } catch (error) {
      console.error("❌ Failed to save classification:", error);

      // Show error toast
      setToastMessage(
        `❌ Failed to save classification for "${productName}". Please try again.`
      );
      setToastType("error");
      setShowSaveToast(true);

      // Auto-hide error toast after 5 seconds
      setTimeout(() => {
        setShowSaveToast(false);
      }, 5000);
    }
  };

  // Get default classification for a product (for compatibility with modal)
  const getDefaultClassification = (
    productName: string
  ): ProductClassification => {
    const name = productName.toLowerCase();

    // Mangle items (flat items that go through mangle machines)
    if (
      name.includes("sheet") ||
      name.includes("duvet") ||
      name.includes("sabana") ||
      name.includes("servilleta") ||
      name.includes("funda") ||
      name.includes("fitted sheet king")
    ) {
      return "Mangle";
    }

    // All other items → Doblado
    return "Doblado";
  };

  const formatRate = (rate: number) => {
    if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
    return `${Math.round(rate)}/hr`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading production classification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">🏭 Production Classification Dashboard</h2>
              <p className="text-muted">
                {isToday
                  ? "Real-time tracking of Mangle vs Doblado production • Auto-updates"
                  : `Historical data for ${new Date(
                      selectedDate
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`}
                {!isToday && (
                  <span className="badge bg-info ms-2">Historical View</span>
                )}
              </p>
            </div>
            <div className="d-flex gap-3 align-items-center">
              {/* Date Selector */}
              <div>
                <label
                  htmlFor="selectedDate"
                  className="form-label mb-1 small text-muted"
                >
                  Select Date
                </label>
                <input
                  type="date"
                  id="selectedDate"
                  className="form-control form-control-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              {/* Quick Date Buttons */}
              <div className="d-flex gap-1">
                <button
                  className={`btn btn-sm ${
                    selectedDate === new Date().toISOString().slice(0, 10)
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() =>
                    setSelectedDate(new Date().toISOString().slice(0, 10))
                  }
                >
                  Today
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setSelectedDate(yesterday.toISOString().slice(0, 10));
                  }}
                >
                  Yesterday
                </button>
              </div>
              <button
                className="btn btn-outline-primary"
                onClick={() => setShowEditModal(true)}
              >
                <i className="fas fa-edit me-2"></i>
                Edit Classifications
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Saved Classifications Info */}
      {Object.keys(customClassifications).length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="alert alert-info border-info">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="alert-heading mb-2">
                    <i className="fas fa-save me-2"></i>
                    Custom Classifications Active (
                    {Object.keys(customClassifications).length})
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(customClassifications)
                      .slice(0, 10) // Show only first 10
                      .map(([productName, classification]) => (
                        <span
                          key={productName}
                          className={`badge bg-${
                            classification === "Mangle" ? "success" : "warning"
                          } text-dark`}
                          title={`${productName} is classified as ${classification}`}
                        >
                          {productName} → {classification}
                        </span>
                      ))}
                    {Object.keys(customClassifications).length > 10 && (
                      <span className="badge bg-secondary">
                        +{Object.keys(customClassifications).length - 10}{" "}
                        more...
                      </span>
                    )}
                  </div>
                  {Object.keys(customClassifications).length > 10 && (
                    <small className="text-muted d-block mt-1">
                      Click "Edit Classifications" to see all custom
                      classifications
                    </small>
                  )}
                </div>
                <button
                  className="btn btn-sm btn-outline-info"
                  onClick={() => setShowEditModal(true)}
                  title="View and edit all classifications"
                >
                  <i className="fas fa-cog"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Classifications Modal */}
      {showEditModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Product Classifications</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProduct("");
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p className="text-muted">
                    Change product classifications between Mangle and Doblado.
                    Default rules: Sheets, Duvets, Sabanas, Servilletas, Fundas,
                    and Fitted Sheets → Mangle. All others → Doblado.
                  </p>
                  {Object.keys(customClassifications).length > 0 && (
                    <div className="alert alert-success">
                      <h6 className="alert-heading">
                        <i className="fas fa-check-circle me-2"></i>
                        {Object.keys(customClassifications).length} Custom
                        Classifications Saved
                      </h6>
                      <p className="mb-0">
                        Your custom classifications are automatically saved to
                        Firebase and applied immediately. Changes will be
                        reflected in all production reports and dashboards.
                        <br />
                        <small className="text-success">
                          <i className="fas fa-info-circle me-1"></i>
                          <strong>Only 1 value per product:</strong> Each
                          product can have only one classification (Mangle or
                          Doblado). Updating a classification replaces the
                          previous value.
                        </small>
                      </p>
                    </div>
                  )}
                </div>
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Default Classification</th>
                        <th>Current Classification</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProductsToday.map((product) => {
                        const defaultClass = getDefaultClassification(product);
                        const currentClass = getClassification(product);
                        const isCustom =
                          customClassifications[product] !== undefined;
                        return (
                          <tr
                            key={product}
                            className={isCustom ? "table-warning" : ""}
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                {product}
                                {isCustom && (
                                  <span className="ms-2">
                                    <i
                                      className="fas fa-star text-warning"
                                      title="Custom classification saved"
                                    ></i>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge bg-${
                                  defaultClass === "Mangle"
                                    ? "success"
                                    : "warning"
                                }`}
                              >
                                {defaultClass}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge bg-${
                                  currentClass === "Mangle"
                                    ? "success"
                                    : "warning"
                                }`}
                              >
                                {currentClass}
                              </span>
                              {isCustom && (
                                <small className="text-warning ms-2">
                                  <i className="fas fa-check-circle"></i> Saved
                                </small>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setEditingProduct(product)}
                              >
                                {isCustom ? "Edit" : "Classify"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Product Edit Modal */}
      {editingProduct && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Edit Classification: {editingProduct}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditingProduct("")}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <p className="text-muted">
                    <strong>Product:</strong> {editingProduct}
                  </p>
                  <p className="text-muted mb-3">
                    <strong>Current Classification:</strong>{" "}
                    <span
                      className={`badge bg-${
                        getClassification(editingProduct) === "Mangle"
                          ? "success"
                          : "warning"
                      } ms-2`}
                    >
                      {getClassification(editingProduct)}
                    </span>
                  </p>
                  <p className="small text-muted">
                    Choose the new classification for this product:
                  </p>
                  <div className="alert alert-info py-2">
                    <small>
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Auto-save:</strong> Your selection will be saved
                      immediately to Firebase and applied across all production
                      reports. Only one classification per product is allowed.
                    </small>
                  </div>
                </div>

                <div className="d-grid gap-3">
                  <button
                    className={`btn ${
                      getClassification(editingProduct) === "Mangle"
                        ? "btn-success"
                        : "btn-outline-success"
                    } btn-lg`}
                    onClick={() =>
                      handleClassificationChange(editingProduct, "Mangle")
                    }
                  >
                    <i className="fas fa-compress-arrows-alt me-3"></i>
                    <div className="d-inline-block text-start">
                      <div className="fw-bold">Mangle</div>
                      <small className="d-block">
                        Flat items processed through mangle machines
                      </small>
                    </div>
                  </button>

                  <button
                    className={`btn ${
                      getClassification(editingProduct) === "Doblado"
                        ? "btn-warning"
                        : "btn-outline-warning"
                    } btn-lg`}
                    onClick={() =>
                      handleClassificationChange(editingProduct, "Doblado")
                    }
                  >
                    <i className="fas fa-hands me-3"></i>
                    <div className="d-inline-block text-start">
                      <div className="fw-bold">Doblado</div>
                      <small className="d-block">
                        Items requiring manual folding/processing
                      </small>
                    </div>
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditingProduct("")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification for Classification Saves */}
      {showSaveToast && (
        <div
          className={`position-fixed top-0 end-0 p-3`}
          style={{ zIndex: 9999 }}
        >
          <div
            className={`toast show ${
              toastType === "success" ? "bg-success" : "bg-danger"
            } text-white`}
            role="alert"
          >
            <div className="toast-header">
              <i
                className={`fas ${
                  toastType === "success"
                    ? "fa-check-circle"
                    : "fa-exclamation-circle"
                } text-${toastType === "success" ? "success" : "danger"} me-2`}
              ></i>
              <strong className="me-auto">Classification Update</strong>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowSaveToast(false)}
              ></button>
            </div>
            <div className="toast-body">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* Production Start Time Configuration */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-info">
            <div className="card-header bg-light text-dark">
              <h5 className="mb-0">
                <i className="fas fa-clock me-2"></i>
                Production Start Time Configuration
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-compress-arrows-alt me-2 text-success"></i>
                      Mangle Production Start Time
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={mangleStartTime}
                      onChange={(e) =>
                        handleMangleStartTimeChange(e.target.value)
                      }
                    />
                    <small className="text-muted">
                      Used to calculate hourly production rates for Daily
                      Dashboard charts
                    </small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-hands me-2 text-warning"></i>
                      Doblado Production Start Time
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={dobladoStartTime}
                      onChange={(e) =>
                        handleDobladoStartTimeChange(e.target.value)
                      }
                    />
                    <small className="text-muted">
                      Used to calculate hourly production rates for Daily
                      Dashboard charts
                    </small>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <i className="fas fa-tasks me-2 text-info"></i>
                      Segregation Start Time
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={segregationStartTime}
                      onChange={(e) =>
                        handleSegregationStartTimeChange(e.target.value)
                      }
                    />
                    <small className="text-muted">
                      Used to calculate hourly segregation rates for Daily
                      Dashboard charts
                    </small>
                  </div>
                </div>
              </div>
              <div className="alert alert-light mt-3">
                <i className="fas fa-info-circle me-2 text-info"></i>
                <strong>Note:</strong> These start times are used by the Daily
                Dashboard to calculate accurate hourly production rates. The
                graphs will show production from these selected times onwards.
                Settings are saved automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Timing Summary */}
      {timingSummary && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-light text-dark">
                <h5 className="mb-0">
                  <i className="fas fa-clock me-2"></i>
                  Today's Production Timeline
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* First Product */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-success mb-1">
                        <i
                          className="fas fa-play-circle"
                          style={{ fontSize: "1.5rem" }}
                        ></i>
                      </div>
                      <h6 className="text-success mb-1">First Product Added</h6>
                      <div className="fw-bold" style={{ fontSize: "1.1rem" }}>
                        {formatTime(timingSummary.firstEntry.addedAt)}
                      </div>
                      <small className="text-muted">
                        {timingSummary.firstEntry.productName}
                        <br />
                        {timingSummary.firstEntry.clientName}
                      </small>
                    </div>
                  </div>

                  {/* Last Product */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-danger mb-1">
                        <i
                          className="fas fa-stop-circle"
                          style={{ fontSize: "1.5rem" }}
                        ></i>
                      </div>
                      <h6 className="text-danger mb-1">Last Product Added</h6>
                      <div className="fw-bold" style={{ fontSize: "1.1rem" }}>
                        {formatTime(timingSummary.lastEntry.addedAt)}
                      </div>
                      <small className="text-muted">
                        {timingSummary.lastEntry.productName}
                        <br />
                        {timingSummary.lastEntry.clientName}
                      </small>
                    </div>
                  </div>

                  {/* Production Span */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-warning mb-1">
                        <i
                          className="fas fa-hourglass-half"
                          style={{ fontSize: "1.5rem" }}
                        ></i>
                      </div>
                      <h6 className="text-warning mb-1">Production Span</h6>
                      <div className="fw-bold" style={{ fontSize: "1.1rem" }}>
                        {timingSummary.productionSpanHours}h{" "}
                        {timingSummary.productionSpanMinutes}m
                      </div>
                      <small className="text-muted">
                        Active production period
                      </small>
                    </div>
                  </div>

                  {/* Production Rate */}
                  <div className="col-md-3 col-sm-6 mb-3">
                    <div className="text-center">
                      <div className="text-info mb-1">
                        <i
                          className="fas fa-tachometer-alt"
                          style={{ fontSize: "1.5rem" }}
                        ></i>
                      </div>
                      <h6 className="text-info mb-1">Production Rate</h6>
                      <div className="fw-bold" style={{ fontSize: "1.1rem" }}>
                        {Math.round(timingSummary.productionPeriodRate)}/hr
                      </div>
                      <small className="text-muted">During active period</small>
                    </div>
                  </div>
                </div>

                {/* Additional Stats Row */}
                <hr />
                <div className="row text-center">
                  <div className="col-md-3 col-6">
                    <div
                      className="fw-bold text-primary"
                      style={{ fontSize: "1.5rem" }}
                    >
                      {timingSummary.totalQuantity.toLocaleString()}
                    </div>
                    <small className="text-muted">Total Units</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div
                      className="fw-bold text-primary"
                      style={{ fontSize: "1.5rem" }}
                    >
                      {timingSummary.totalEntries}
                    </div>
                    <small className="text-muted">Total Items</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div
                      className="fw-bold text-primary"
                      style={{ fontSize: "1.5rem" }}
                    >
                      {timingSummary.uniqueProducts}
                    </div>
                    <small className="text-muted">Product Types</small>
                  </div>
                  <div className="col-md-3 col-6">
                    <div
                      className="fw-bold text-primary"
                      style={{ fontSize: "1.5rem" }}
                    >
                      {timingSummary.uniqueClients}
                    </div>
                    <small className="text-muted">Clients</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Hourly Production Analytics Dashboard */}
      {timingSummary &&
        // Show for today's real-time data or selected date historical data
        ((isToday &&
          productionSummary &&
          productionSummary.recentEntries.length > 0) ||
          (!isToday && selectedDateProductionData.entries.length > 0)) && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-header bg-light text-dark">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      <i className="fas fa-chart-line me-2"></i>
                      📊 Hourly Production Analytics
                      {!isToday && (
                        <small className="text-muted ms-2">
                          ({new Date(selectedDate).toLocaleDateString()})
                        </small>
                      )}
                    </h5>
                    <div className="d-flex gap-3 text-center">
                      <div>
                        <div className="fw-bold fs-6">
                          {(() => {
                            if (isToday && productionSummary) {
                              return Object.keys(
                                productionSummary.hourlyBreakdown || {}
                              ).length;
                            } else {
                              // Calculate active hours from selected date data
                              const hourlyBreakdown: {
                                [hour: number]: number;
                              } = {};
                              const entriesSource =
                                selectedDateProductionData.entries;
                              entriesSource.forEach((entry) => {
                                const hour = entry.addedAt.getHours();
                                if (!hourlyBreakdown[hour])
                                  hourlyBreakdown[hour] = 0;
                                hourlyBreakdown[hour] += entry.quantity;
                              });
                              return Object.keys(hourlyBreakdown).length;
                            }
                          })()}
                        </div>
                        <small className="text-muted">Active Hours</small>
                      </div>
                      <div>
                        <div className="fw-bold fs-6">
                          {(() => {
                            if (isToday && productionSummary) {
                              return Math.round(
                                productionSummary.currentHourRate || 0
                              );
                            } else {
                              // For historical dates, show average hourly rate
                              const entriesSource =
                                selectedDateProductionData.entries;
                              if (entriesSource.length === 0) return 0;

                              const totalQuantity = entriesSource.reduce(
                                (sum, e) => sum + e.quantity,
                                0
                              );
                              const hourlyBreakdown: {
                                [hour: number]: number;
                              } = {};
                              entriesSource.forEach((entry) => {
                                const hour = entry.addedAt.getHours();
                                if (!hourlyBreakdown[hour])
                                  hourlyBreakdown[hour] = 0;
                                hourlyBreakdown[hour] += entry.quantity;
                              });
                              const activeHours =
                                Object.keys(hourlyBreakdown).length;
                              return activeHours > 0
                                ? Math.round(totalQuantity / activeHours)
                                : 0;
                            }
                          })()}
                        </div>
                        <small className="text-muted">
                          {isToday ? "Current Rate/hr" : "Avg Rate/hr"}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Hour</th>
                          <th className="text-center">Mangle/Doblado Split</th>
                          <th className="text-center">Units Processed</th>
                          <th className="text-center">Clients</th>
                          <th>Top Products</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Determine which data source to use
                          const useRealTimeData =
                            isToday &&
                            productionSummary &&
                            productionSummary.recentEntries.length > 0;
                          const useSelectedDateData =
                            !isToday ||
                            (!useRealTimeData &&
                              selectedDateProductionData.entries.length > 0);

                          console.log(
                            "🔍 [Hourly Table] Data source selection:",
                            {
                              selectedDate,
                              isToday,
                              useRealTimeData,
                              useSelectedDateData,
                              productionSummaryExists: !!productionSummary,
                              selectedDateEntries:
                                selectedDateProductionData.entries.length,
                              recentEntries:
                                productionSummary?.recentEntries?.length || 0,
                            }
                          );

                          // Common function to generate table rows
                          const generateTableRows = (
                            allHours: Set<number>,
                            hourlyData: any,
                            hourlyFromService: any = {},
                            isRealTime: boolean = false
                          ) => {
                            const hourlyRows = Array.from(allHours)
                              .sort((a, b) => a - b)
                              .map((hour) => {
                                const data = hourlyData[hour] || {
                                  items: 0,
                                  units: 0,
                                  clients: new Set(),
                                  products: {},
                                  mangleItems: 0,
                                  dobladoItems: 0,
                                  mangleUnits: 0,
                                  dobladoUnits: 0,
                                };

                                // Get units from service data first (for real-time), then fall back to computed data
                                const hourKey = `${hour}:00`;
                                const serviceUnits = isRealTime
                                  ? hourlyFromService[hourKey] || 0
                                  : 0;
                                const computedUnits = data.units;
                                const finalUnits = Math.max(
                                  serviceUnits,
                                  computedUnits
                                );

                                const hourStr =
                                  hour.toString().padStart(2, "0") + ":00";

                                // Get top 3 products for this hour
                                const productEntries = Object.entries(
                                  data.products
                                );
                                const topProducts = productEntries
                                  .sort(
                                    ([, a], [, b]) =>
                                      (b as number) - (a as number)
                                  )
                                  .slice(0, 3)
                                  .map(
                                    ([product, qty]) => `${product} (${qty})`
                                  )
                                  .join(", ");

                                const isCurrentHour =
                                  isToday && new Date().getHours() === hour;
                                const hasActivity =
                                  finalUnits > 0 || data.items > 0;

                                return (
                                  <tr
                                    key={hour}
                                    className={
                                      isCurrentHour
                                        ? "table-warning"
                                        : hasActivity
                                        ? ""
                                        : "table-light text-muted"
                                    }
                                  >
                                    <td>
                                      <span
                                        className={`fw-bold ${
                                          isCurrentHour
                                            ? "text-warning"
                                            : hasActivity
                                            ? ""
                                            : "text-muted"
                                        }`}
                                      >
                                        {hourStr}
                                        {isCurrentHour && (
                                          <small className="ms-1">
                                            (Current)
                                          </small>
                                        )}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      {data.items > 0 ? (
                                        <div>
                                          <div
                                            className="mb-1"
                                            style={{
                                              width: "120px",
                                              margin: "0 auto",
                                            }}
                                          >
                                            <div
                                              className="progress"
                                              style={{
                                                height: "20px",
                                                borderRadius: "10px",
                                                border: "1px solid #dee2e6",
                                              }}
                                              title={`${data.mangleUnits.toLocaleString()} Mangle pieces, ${data.dobladoUnits.toLocaleString()} Doblado pieces`}
                                            >
                                              <div
                                                className="progress-bar bg-success"
                                                style={{
                                                  width: `${Math.round(
                                                    (data.mangleUnits /
                                                      data.units) *
                                                      100
                                                  )}%`,
                                                  fontSize: "11px",
                                                  fontWeight: "bold",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  color: "black",
                                                }}
                                              >
                                                M{" "}
                                                {Math.round(
                                                  (data.mangleUnits /
                                                    data.units) *
                                                    100
                                                )}
                                                %
                                              </div>
                                              <div
                                                className="progress-bar bg-warning"
                                                style={{
                                                  width: `${Math.round(
                                                    (data.dobladoUnits /
                                                      data.units) *
                                                      100
                                                  )}%`,
                                                  fontSize: "11px",
                                                  fontWeight: "bold",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  color: "#856404",
                                                }}
                                              >
                                                D{" "}
                                                {Math.round(
                                                  (data.dobladoUnits /
                                                    data.units) *
                                                    100
                                                )}
                                                %
                                              </div>
                                            </div>
                                          </div>
                                          <small className="text-muted">
                                            {data.mangleUnits.toLocaleString()}{" "}
                                            /{" "}
                                            {data.dobladoUnits.toLocaleString()}
                                          </small>
                                        </div>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      {finalUnits > 0 ? (
                                        <span className="fw-bold">
                                          {finalUnits.toLocaleString()}
                                        </span>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      {data.clients.size > 0 ? (
                                        <span className="badge bg-info">
                                          {data.clients.size}
                                        </span>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                    <td>
                                      {topProducts ? (
                                        <small className="text-muted">
                                          {topProducts}
                                        </small>
                                      ) : (
                                        <small className="text-muted">
                                          No activity
                                        </small>
                                      )}
                                    </td>
                                  </tr>
                                );
                              });

                            // Calculate totals for summary row
                            const totalSummary = (() => {
                              let totalMangleItems = 0;
                              let totalDobladoItems = 0;
                              let totalMangleUnits = 0;
                              let totalDobladoUnits = 0;
                              let totalUnits = 0;
                              let totalItems = 0;
                              const allDayClients = new Set<string>();

                              Object.values(hourlyData).forEach((data: any) => {
                                totalMangleItems += data.mangleItems || 0;
                                totalDobladoItems += data.dobladoItems || 0;
                                totalMangleUnits += data.mangleUnits || 0;
                                totalDobladoUnits += data.dobladoUnits || 0;
                                totalUnits += data.units || 0;
                                totalItems += data.items || 0;
                                if (data.clients) {
                                  data.clients.forEach((client: string) =>
                                    allDayClients.add(client)
                                  );
                                }
                              });

                              return {
                                totalMangleItems,
                                totalDobladoItems,
                                totalMangleUnits,
                                totalDobladoUnits,
                                totalUnits,
                                totalItems,
                                totalClients: allDayClients.size,
                              };
                            })();

                            // Add summary row
                            const totalRow = (
                              <tr
                                key="daily-total"
                                className="table-dark border-top border-3 border-primary"
                              >
                                <th className="fw-bold text-light">
                                  <i className="fas fa-calculator me-2"></i>
                                  {isToday ? "DAILY TOTAL" : "DATE TOTAL"}
                                </th>
                                <th className="text-center">
                                  {totalSummary.totalItems > 0 ? (
                                    <div>
                                      <div
                                        className="mb-1"
                                        style={{
                                          width: "140px",
                                          margin: "0 auto",
                                        }}
                                      >
                                        <div
                                          className="progress"
                                          style={{
                                            height: "24px",
                                            borderRadius: "12px",
                                            border: "2px solid #ffffff",
                                          }}
                                          title={`${totalSummary.totalMangleUnits.toLocaleString()} Mangle pieces, ${totalSummary.totalDobladoUnits.toLocaleString()} Doblado pieces`}
                                        >
                                          <div
                                            className="progress-bar bg-success"
                                            style={{
                                              width: `${Math.round(
                                                (totalSummary.totalMangleUnits /
                                                  totalSummary.totalUnits) *
                                                  100
                                              )}%`,
                                              fontSize: "12px",
                                              fontWeight: "bold",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              color: "black",
                                            }}
                                          >
                                            M{" "}
                                            {Math.round(
                                              (totalSummary.totalMangleUnits /
                                                totalSummary.totalUnits) *
                                                100
                                            )}
                                            %
                                          </div>
                                          <div
                                            className="progress-bar bg-warning"
                                            style={{
                                              width: `${Math.round(
                                                (totalSummary.totalDobladoUnits /
                                                  totalSummary.totalUnits) *
                                                  100
                                              )}%`,
                                              fontSize: "12px",
                                              fontWeight: "bold",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              color: "#856404",
                                            }}
                                          >
                                            D{" "}
                                            {Math.round(
                                              (totalSummary.totalDobladoUnits /
                                                totalSummary.totalUnits) *
                                                100
                                            )}
                                            %
                                          </div>
                                        </div>
                                      </div>
                                      <small className="text-dark">
                                        {totalSummary.totalMangleUnits.toLocaleString()}{" "}
                                        /{" "}
                                        {totalSummary.totalDobladoUnits.toLocaleString()}
                                      </small>
                                    </div>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </th>
                                <th className="text-center">
                                  <span className="badge bg-primary fs-6">
                                    {totalSummary.totalUnits.toLocaleString()}
                                  </span>
                                </th>
                                <th className="text-center">
                                  <span className="badge bg-info fs-6">
                                    {totalSummary.totalClients}
                                  </span>
                                </th>
                                <th>
                                  <strong className="text-light">
                                    {totalSummary.totalItems.toLocaleString()}{" "}
                                    items processed
                                    {isToday
                                      ? " today"
                                      : ` on ${new Date(
                                          selectedDate
                                        ).toLocaleDateString()}`}
                                  </strong>
                                </th>
                              </tr>
                            );

                            return [...hourlyRows, totalRow];
                          };

                          if (useRealTimeData && productionSummary) {
                            // Use existing real-time logic for today's data
                            const hourlyFromService =
                              productionSummary.hourlyBreakdown || {};
                            const allEntries =
                              productionSummary.allEntriesToday ||
                              productionSummary.recentEntries;

                            console.log(
                              "🔍 [Hourly Table] Using real-time data:",
                              {
                                hourlyBreakdownKeys:
                                  Object.keys(hourlyFromService),
                                allEntriesCount: allEntries.length,
                              }
                            );

                            // Process entries for real-time data
                            const hourlyData: {
                              [hour: number]: {
                                items: number;
                                units: number;
                                clients: Set<string>;
                                products: { [product: string]: number };
                                mangleItems: number;
                                dobladoItems: number;
                                mangleUnits: number;
                                dobladoUnits: number;
                              };
                            } = {};

                            allEntries.forEach((entry) => {
                              const hour = entry.addedAt.getHours();
                              if (!hourlyData[hour]) {
                                hourlyData[hour] = {
                                  items: 0,
                                  units: 0,
                                  clients: new Set(),
                                  products: {},
                                  mangleItems: 0,
                                  dobladoItems: 0,
                                  mangleUnits: 0,
                                  dobladoUnits: 0,
                                };
                              }

                              hourlyData[hour].items++;
                              hourlyData[hour].units += entry.quantity;
                              hourlyData[hour].clients.add(entry.clientName);

                              if (
                                !hourlyData[hour].products[entry.productName]
                              ) {
                                hourlyData[hour].products[
                                  entry.productName
                                ] = 0;
                              }
                              hourlyData[hour].products[entry.productName] +=
                                entry.quantity;

                              const classification = getClassification(
                                entry.productName
                              );
                              if (classification === "Mangle") {
                                hourlyData[hour].mangleItems++;
                                hourlyData[hour].mangleUnits += entry.quantity;
                              } else {
                                hourlyData[hour].dobladoItems++;
                                hourlyData[hour].dobladoUnits += entry.quantity;
                              }
                            });

                            // Collect all hours from both service and computed data
                            const allHours = new Set<number>();
                            Object.keys(hourlyFromService).forEach(
                              (hourStr) => {
                                const hourMatch = hourStr.match(/(\d+):00/);
                                if (hourMatch) {
                                  const hour = parseInt(hourMatch[1]);
                                  if (!isNaN(hour)) allHours.add(hour);
                                }
                              }
                            );
                            Object.keys(hourlyData).forEach((hourStr) => {
                              const hour = parseInt(hourStr);
                              if (!isNaN(hour)) allHours.add(hour);
                            });

                            return generateTableRows(
                              allHours,
                              hourlyData,
                              hourlyFromService,
                              true
                            );
                          } else if (useSelectedDateData) {
                            // Use selected date data for historical analysis
                            const entriesSource =
                              selectedDateProductionData.entries;

                            console.log(
                              "🔍 [Hourly Table] Using selected date data:",
                              {
                                selectedDate,
                                entriesCount: entriesSource.length,
                              }
                            );

                            // Process selected date entries
                            const hourlyData: {
                              [hour: number]: {
                                items: number;
                                units: number;
                                clients: Set<string>;
                                products: { [product: string]: number };
                                mangleItems: number;
                                dobladoItems: number;
                                mangleUnits: number;
                                dobladoUnits: number;
                              };
                            } = {};

                            entriesSource.forEach((entry) => {
                              const hour = entry.addedAt.getHours();
                              if (!hourlyData[hour]) {
                                hourlyData[hour] = {
                                  items: 0,
                                  units: 0,
                                  clients: new Set(),
                                  products: {},
                                  mangleItems: 0,
                                  dobladoItems: 0,
                                  mangleUnits: 0,
                                  dobladoUnits: 0,
                                };
                              }

                              hourlyData[hour].items++;
                              hourlyData[hour].units += entry.quantity;
                              hourlyData[hour].clients.add(entry.clientName);

                              if (
                                !hourlyData[hour].products[entry.productName]
                              ) {
                                hourlyData[hour].products[
                                  entry.productName
                                ] = 0;
                              }
                              hourlyData[hour].products[entry.productName] +=
                                entry.quantity;

                              const classification = getClassification(
                                entry.productName
                              );
                              if (classification === "Mangle") {
                                hourlyData[hour].mangleItems++;
                                hourlyData[hour].mangleUnits += entry.quantity;
                              } else {
                                hourlyData[hour].dobladoItems++;
                                hourlyData[hour].dobladoUnits += entry.quantity;
                              }
                            });

                            const allHours = new Set<number>();
                            Object.keys(hourlyData).forEach((hourStr) => {
                              const hour = parseInt(hourStr);
                              if (!isNaN(hour)) allHours.add(hour);
                            });

                            return generateTableRows(
                              allHours,
                              hourlyData,
                              {},
                              false
                            );
                          } else {
                            // No data available
                            return (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="text-center text-muted py-4"
                                >
                                  {selectedDateProductionData.loading
                                    ? "Loading hourly data..."
                                    : "No production data available for this date"}
                                </td>
                              </tr>
                            );
                          }
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Stats */}
                  <div className="row mt-3">
                    <div className="col-12">
                      <div className="alert alert-light">
                        <div className="row text-center">
                          <div className="col-md-3">
                            <strong className="text-primary">
                              {(() => {
                                if (isToday && productionSummary) {
                                  return Object.values(
                                    productionSummary.hourlyBreakdown || {}
                                  )
                                    .reduce((sum, count) => sum + count, 0)
                                    .toLocaleString();
                                } else {
                                  // Use selected date data
                                  return selectedDateProductionData.entries
                                    .reduce((sum, e) => sum + e.quantity, 0)
                                    .toLocaleString();
                                }
                              })()}
                            </strong>
                            <br />
                            <small className="text-muted">
                              Total Units {isToday ? "Today" : "This Date"}
                            </small>
                          </div>
                          <div className="col-md-3">
                            <strong className="text-success">
                              {(() => {
                                if (isToday && productionSummary) {
                                  return Object.keys(
                                    productionSummary.hourlyBreakdown || {}
                                  ).length;
                                } else {
                                  // Calculate active hours from selected date data
                                  const hourlyBreakdown: {
                                    [hour: number]: number;
                                  } = {};
                                  selectedDateProductionData.entries.forEach(
                                    (entry) => {
                                      const hour = entry.addedAt.getHours();
                                      if (!hourlyBreakdown[hour])
                                        hourlyBreakdown[hour] = 0;
                                      hourlyBreakdown[hour] += entry.quantity;
                                    }
                                  );
                                  return Object.keys(hourlyBreakdown).length;
                                }
                              })()}
                            </strong>
                            <br />
                            <small className="text-muted">Active Hours</small>
                          </div>
                          <div className="col-md-3">
                            <strong className="text-info">
                              {(() => {
                                if (isToday && productionSummary) {
                                  return Object.keys(
                                    productionSummary.hourlyBreakdown || {}
                                  ).length > 0
                                    ? Math.round(
                                        Object.values(
                                          productionSummary.hourlyBreakdown ||
                                            {}
                                        ).reduce(
                                          (sum, count) => sum + count,
                                          0
                                        ) /
                                          Object.keys(
                                            productionSummary.hourlyBreakdown ||
                                              {}
                                          ).length
                                      )
                                    : 0;
                                } else {
                                  // Calculate average hourly rate from selected date data
                                  const hourlyBreakdown: {
                                    [hour: number]: number;
                                  } = {};
                                  selectedDateProductionData.entries.forEach(
                                    (entry) => {
                                      const hour = entry.addedAt.getHours();
                                      if (!hourlyBreakdown[hour])
                                        hourlyBreakdown[hour] = 0;
                                      hourlyBreakdown[hour] += entry.quantity;
                                    }
                                  );
                                  const activeHours =
                                    Object.keys(hourlyBreakdown).length;
                                  const totalQuantity =
                                    selectedDateProductionData.entries.reduce(
                                      (sum, e) => sum + e.quantity,
                                      0
                                    );
                                  return activeHours > 0
                                    ? Math.round(totalQuantity / activeHours)
                                    : 0;
                                }
                              })()}
                            </strong>
                            <br />
                            <small className="text-muted">Avg Units/Hour</small>
                          </div>
                          <div className="col-md-3">
                            <strong className="text-warning">
                              {(() => {
                                if (isToday && productionSummary) {
                                  return Math.round(
                                    productionSummary.currentHourRate || 0
                                  );
                                } else {
                                  // For historical dates, show peak hourly rate instead
                                  const hourlyBreakdown: {
                                    [hour: number]: number;
                                  } = {};
                                  selectedDateProductionData.entries.forEach(
                                    (entry) => {
                                      const hour = entry.addedAt.getHours();
                                      if (!hourlyBreakdown[hour])
                                        hourlyBreakdown[hour] = 0;
                                      hourlyBreakdown[hour] += entry.quantity;
                                    }
                                  );
                                  const hourlyRates =
                                    Object.values(hourlyBreakdown);
                                  return hourlyRates.length > 0
                                    ? Math.max(...hourlyRates)
                                    : 0;
                                }
                              })()}
                            </strong>
                            <br />
                            <small className="text-muted">
                              {isToday ? "Current Hour Rate" : "Peak Hour Rate"}
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card border-success h-100">
            <div className="card-header bg-light text-dark">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="fas fa-compress-arrows-alt me-2"></i>
                  Mangle Production
                  {classifiedGroups.mangle.activeInLast30Min && (
                    <span className="badge bg-light text-success ms-2">
                      🔴 Live
                    </span>
                  )}
                </h5>
              </div>
            </div>
            <div className="card-body">
              <div className="row text-center mb-3">
                <div className="col-4">
                  <h3 className="text-success">
                    {classifiedGroups.mangle.totalItems.toLocaleString()}
                  </h3>
                  <small className="text-muted">Total Items</small>
                </div>
                <div className="col-4">
                  <h3 className="text-info">
                    {formatRate(classifiedGroups.mangle.currentHourRate)}
                  </h3>
                  <small className="text-muted">Current Rate</small>
                </div>
                <div className="col-4">
                  <h3 className="text-warning">
                    {formatRate(classifiedGroups.mangle.overallHourlyRate)}
                  </h3>
                  <small className="text-muted">Overall Rate</small>
                </div>
              </div>
              <div className="row text-center">
                <div className="col-6">
                  <div className="fw-bold">
                    {classifiedGroups.mangle.uniqueProducts}
                  </div>
                  <small className="text-muted">Product Types</small>
                </div>
                <div className="col-6">
                  <div className="fw-bold">
                    {classifiedGroups.mangle.clientsCount}
                  </div>
                  <small className="text-muted">Clients</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card border-warning h-100">
            <div className="card-header bg-light text-dark">
              <h5 className="mb-0">
                <i className="fas fa-hands me-2"></i>
                Doblado Production
                {classifiedGroups.doblado.activeInLast30Min && (
                  <span className="badge bg-light text-warning ms-2">
                    🔴 Live
                  </span>
                )}
              </h5>
            </div>
            <div className="card-body">
              <div className="row text-center mb-3">
                <div className="col-4">
                  <h3 className="text-warning">
                    {classifiedGroups.doblado.totalItems.toLocaleString()}
                  </h3>
                  <small className="text-muted">Total Items</small>
                </div>
                <div className="col-4">
                  <h3 className="text-info">
                    {formatRate(classifiedGroups.doblado.currentHourRate)}
                  </h3>
                  <small className="text-muted">Current Rate</small>
                </div>
                <div className="col-4">
                  <h3 className="text-primary">
                    {formatRate(classifiedGroups.doblado.overallHourlyRate)}
                  </h3>
                  <small className="text-muted">Overall Rate</small>
                </div>
              </div>
              <div className="row text-center">
                <div className="col-6">
                  <div className="fw-bold">
                    {classifiedGroups.doblado.uniqueProducts}
                  </div>
                  <small className="text-muted">Product Types</small>
                </div>
                <div className="col-6">
                  <div className="fw-bold">
                    {classifiedGroups.doblado.clientsCount}
                  </div>
                  <small className="text-muted">Clients</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segregated Clients Log for Today */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-info">
            <div
              className="card-header bg-light text-dark"
              style={{ cursor: "pointer" }}
              onClick={() => toggleSection("segregation")}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i
                    className={`fas ${
                      collapsedSections.segregation
                        ? "fa-chevron-right"
                        : "fa-chevron-down"
                    } me-2`}
                  ></i>
                  <i className="fas fa-tasks me-2"></i>
                  Segregated Clients (Last 24h)
                </h5>
                <div className="d-flex gap-4">
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {segregatedClientsToday.length}
                    </div>
                    <small className="text-muted">Clients</small>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {totalSegregatedWeight.toLocaleString()} lbs
                    </div>
                    <small className="text-muted">Total Weight</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            <div
              className={`collapse ${
                !collapsedSections.segregation ? "show" : ""
              }`}
            >
              <div className="card-body p-0">
                {segregationLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-info" role="status">
                      <span className="visually-hidden">
                        Loading segregation data...
                      </span>
                    </div>
                    <div className="mt-2 text-muted">
                      Loading segregation data...
                    </div>
                  </div>
                ) : segregatedClientsToday.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="fas fa-clipboard-list fa-2x mb-3 opacity-25"></i>
                    <div>
                      No clients have been segregated in the last 24 hours
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead className="table-info">
                        <tr>
                          <th>Time</th>
                          <th>Client Name</th>
                          <th className="text-center">Weight (lbs)</th>
                          <th className="text-center">Segregated By</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {segregatedClientsToday.map((client, index) => (
                          <tr key={`${client.clientId}-${index}`}>
                            <td>
                              <span className="badge bg-info">
                                {new Date(client.timestamp).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )}
                              </span>
                            </td>
                            <td className="fw-bold">{client.clientName}</td>
                            <td className="text-center">
                              <span className="badge bg-success fs-6">
                                {client.weight.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-secondary">
                                {client.user || "Unknown"}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-info">
                                <i className="fas fa-check-circle me-1"></i>
                                Segregated
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pickup Entries Log */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-primary">
            <div
              className="card-header bg-light text-dark"
              style={{ cursor: "pointer" }}
              onClick={() => toggleSection("pickupEntries")}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i
                    className={`fas ${
                      collapsedSections.pickupEntries
                        ? "fa-chevron-right"
                        : "fa-chevron-down"
                    } me-2`}
                  ></i>
                  <i className="fas fa-truck me-2"></i>
                  Pickup Entries Today
                </h5>
                <div className="d-flex gap-4">
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {pickupEntriesToday.length}
                    </div>
                    <small className="opacity-75">Entries</small>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold fs-6">
                      {totalPickupWeight.toLocaleString()} lbs
                    </div>
                    <small className="opacity-75">Total Weight</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            <div
              className={`collapse ${
                !collapsedSections.pickupEntries ? "show" : ""
              }`}
            >
              <div className="card-body p-0">
                {pickupEntriesLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">
                        Loading pickup entries data...
                      </span>
                    </div>
                    <div className="mt-2 text-muted">
                      Loading pickup entries data...
                    </div>
                  </div>
                ) : pickupEntriesToday.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="fas fa-truck fa-2x mb-3 opacity-25"></i>
                    <div>No pickup entries recorded today</div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead className="table-info">
                        <tr>
                          <th>Time</th>
                          <th>Client Name</th>
                          <th>Driver Name</th>
                          <th className="text-center">Weight (lbs)</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pickupEntriesToday.map((entry, index) => (
                          <tr key={`${entry.id}-${index}`}>
                            <td>
                              <span className="badge bg-info">
                                {new Date(entry.timestamp).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  }
                                )}
                              </span>
                            </td>
                            <td className="fw-bold">{entry.clientName}</td>
                            <td>{entry.driverName}</td>
                            <td className="text-center">
                              <span className="badge bg-success fs-6">
                                {entry.weight.toLocaleString()}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-primary">
                                <i className="fas fa-check-circle me-1"></i>
                                Entrada
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="row">
        {/* Mangle Table */}
        <div className="col-12 mb-4">
          <div className="card">
            <div
              className="card-header bg-light text-dark"
              style={{ cursor: "pointer" }}
              onClick={() => toggleSection("mangleLog")}
            >
              <h5 className="mb-0">
                <i
                  className={`fas ${
                    collapsedSections.mangleLog
                      ? "fa-chevron-right"
                      : "fa-chevron-down"
                  } me-2`}
                ></i>
                <i className="fas fa-compress-arrows-alt me-2"></i>
                Mangle Production Log ({
                  classifiedGroups.mangle.entries.length
                }{" "}
                entries)
              </h5>
            </div>

            {/* Collapsible Content */}
            <div
              className={`collapse ${
                !collapsedSections.mangleLog ? "show" : ""
              }`}
            >
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-info">
                      <tr>
                        <th>Time</th>
                        <th>Client Name</th>
                        <th>Product</th>
                        <th className="text-center">Quantity</th>
                        <th>Added By</th>
                        <th>Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classifiedGroups.mangle.entries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted py-4"
                          >
                            <i className="fas fa-inbox fa-2x mb-2 d-block opacity-25"></i>
                            No mangle items processed today
                          </td>
                        </tr>
                      ) : (
                        classifiedGroups.mangle.entries.map((entry, index) => (
                          <tr key={`${entry.id}-${index}`}>
                            <td>
                              <span className="badge bg-info">
                                {formatTime(entry.addedAt)}
                              </span>
                            </td>
                            <td className="fw-bold">{entry.clientName}</td>
                            <td>{entry.productName}</td>
                            <td className="text-center">
                              <span className="badge bg-success fs-6">
                                {entry.quantity.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <small className="text-muted">
                                {entry.addedBy}
                              </small>
                            </td>
                            <td>
                              <small className="text-muted">
                                #{entry.invoiceId.slice(-6)}
                              </small>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Doblado Table */}
        <div className="col-12 mb-4">
          <div className="card">
            <div
              className="card-header bg-light text-dark"
              style={{ cursor: "pointer" }}
              onClick={() => toggleSection("dobladoLog")}
            >
              <h5 className="mb-0">
                <i
                  className={`fas ${
                    collapsedSections.dobladoLog
                      ? "fa-chevron-right"
                      : "fa-chevron-down"
                  } me-2`}
                ></i>
                <i className="fas fa-hands me-2"></i>
                Doblado Production Log (
                {classifiedGroups.doblado.entries.length} entries)
              </h5>
            </div>

            {/* Collapsible Content */}
            <div
              className={`collapse ${
                !collapsedSections.dobladoLog ? "show" : ""
              }`}
            >
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-info">
                      <tr>
                        <th>Time</th>
                        <th>Client Name</th>
                        <th>Product</th>
                        <th className="text-center">Quantity</th>
                        <th>Added By</th>
                        <th>Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classifiedGroups.doblado.entries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted py-4"
                          >
                            <i className="fas fa-inbox fa-2x mb-2 d-block opacity-25"></i>
                            No doblado items processed today
                          </td>
                        </tr>
                      ) : (
                        classifiedGroups.doblado.entries.map((entry, index) => (
                          <tr key={`${entry.id}-${index}`}>
                            <td>
                              <span className="badge bg-info">
                                {formatTime(entry.addedAt)}
                              </span>
                            </td>
                            <td className="fw-bold">{entry.clientName}</td>
                            <td>{entry.productName}</td>
                            <td className="text-center">
                              <span className="badge bg-success fs-6">
                                {entry.quantity.toLocaleString()}
                              </span>
                            </td>
                            <td>
                              <small className="text-muted">
                                {entry.addedBy}
                              </small>
                            </td>
                            <td>
                              <small className="text-muted">
                                #{entry.invoiceId.slice(-6)}
                              </small>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End-of-Shift Detection Dashboard */}
      <div className="row mb-4">
        <div className="col-12">
          <EndOfShiftDashboard className="shadow-lg border-0" />
        </div>
      </div>

      {/* Live Update Footer */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info text-center">
            <div className="row">
              <div className="col-md-8">
                <small>
                  <i className="fas fa-sync-alt me-2"></i>
                  <strong>Real-time Updates:</strong> This dashboard updates
                  automatically as items are added to invoices.
                  {productionSummary && (
                    <span className="ms-2">
                      Last update:{" "}
                      {productionSummary.lastUpdate.toLocaleString()}
                    </span>
                  )}
                </small>
              </div>
              <div className="col-md-4">
                <small>
                  <i className="fas fa-cloud me-2"></i>
                  <strong>Classifications:</strong> Auto-saved to Firebase
                  {Object.keys(customClassifications).length > 0 && (
                    <span className="badge bg-success ms-2">
                      {Object.keys(customClassifications).length} saved
                    </span>
                  )}
                </small>
              </div>
            </div>
            {Object.keys(customClassifications).length > 0 && (
              <div className="mt-2">
                <small className="text-muted">
                  <i className="fas fa-eye me-1"></i>
                  Your saved classifications appear in: Daily Dashboard charts,
                  Production reports, Invoice printing, and all analytics. Each
                  product has exactly 1 classification value.
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionClassificationDashboard;

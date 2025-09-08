import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { productClassificationService } from "../services/ProductClassificationService";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ClientEntry {
  id: string;
  clientId: string;
  clientName: string;
  weight: number;
  timestamp: Date;
  cartId: string;
  classification?: "Mangle" | "Doblado";
}

interface ProductEntry {
  id: string;
  clientId: string;
  clientName: string;
  productName: string;
  quantity: number;
  addedAt: Date;
  classification: "Mangle" | "Doblado";
}

interface ClientDailyAnalysis {
  clientId: string;
  clientName: string;
  totalWeight: number;
  totalItems: number;
  percentageOfDayWeight: number;
  percentageOfDayItems: number;
  estimatedMangleWeight: number;
  estimatedDobladoWeight: number;
  estimatedMangleItems: number;
  estimatedDobladoItems: number;
  manglePercentage: number;
  dobladoPercentage: number;
  actualMangleItems?: number;
  actualDobladoItems?: number;
}

interface HistoricalPrediction {
  clientId: string;
  clientName: string;
  averageItems: number;
  averageMangleItems: number;
  averageDobladoItems: number;
  averageWeight: number;
  occurrences: number; // How many times this client appeared on this day of week
  confidence: number; // Percentage confidence based on data consistency
  lastSeen: Date;
}

interface DayOfWeekAnalysis {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  totalPredictedItems: number;
  totalPredictedWeight: number;
  totalPredictedMangleItems: number;
  totalPredictedDobladoItems: number;
  clientPredictions: HistoricalPrediction[];
}

interface WashingOrder {
  sequence: number;
  clientId: string;
  clientName: string;
  totalWeight: number;
  estimatedMangleItems: number;
  estimatedDobladoItems: number;
  manglePercentage: number;
  dobladoPercentage: number;
  washingReason: string;
  cumulativeMangleLoad: number;
  cumulativeDobladoLoad: number;
  loadBalance: number; // Difference between Mangle and Doblado cumulative loads
  priorityScore: number;
}

interface BalanceMetrics {
  optimalBalance: number;
  currentMangleLoad: number;
  currentDobladoLoad: number;
  balanceDifference: number;
  efficiency: number;
}

const ClientDailyAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Ensure we get today's date in the local timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    console.log(
      `📅 [ClientDailyAnalytics] Initializing with today's date: ${todayStr}`
    );
    return todayStr;
  });
  const [pickupEntries, setPickupEntries] = useState<ClientEntry[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductEntry[]>(
    []
  );
  const [clientAnalysis, setClientAnalysis] = useState<ClientDailyAnalysis[]>(
    []
  );
  const [totalDayWeight, setTotalDayWeight] = useState(0);
  const [totalDayItems, setTotalDayItems] = useState(0);
  const [classificationStats, setClassificationStats] = useState({
    totalProducts: 0,
    mangleProducts: 0,
    dobladoProducts: 0,
    customClassifications: 0,
  });
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [dayOfWeekAnalysis, setDayOfWeekAnalysis] =
    useState<DayOfWeekAnalysis | null>(null);
  
  // Washing Order Optimization State
  const [washingOrder, setWashingOrder] = useState<WashingOrder[]>([]);
  const [balanceMetrics, setBalanceMetrics] = useState<BalanceMetrics>({
    optimalBalance: 0,
    currentMangleLoad: 0,
    currentDobladoLoad: 0,
    balanceDifference: 0,
    efficiency: 0,
  });
  const [optimizationView, setOptimizationView] = useState<'table' | 'chart'>('table');

  // Fetch pickup entries (weight data)
  const fetchPickupData = async (date: string) => {
    try {
      // Parse date correctly for local timezone
      const [year, month, day] = date.split("-").map(Number);
      const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
      const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

      console.log(
        `🗓️ [ClientDailyAnalytics] Fetching pickup data for date: ${date}`
      );
      console.log(
        `📅 Date range: ${selectedDateObj.toLocaleDateString()} to ${nextDay.toLocaleDateString()}`
      );
      console.log(
        `⏰ UTC range: ${selectedDateObj.toISOString()} to ${nextDay.toISOString()}`
      );

      const pickupQuery = query(
        collection(db, "pickup_entries"),
        where("timestamp", ">=", Timestamp.fromDate(selectedDateObj)),
        where("timestamp", "<", Timestamp.fromDate(nextDay))
      );

      const pickupSnapshot = await getDocs(pickupQuery);
      const entries: ClientEntry[] = [];

      console.log(
        `📊 [ClientDailyAnalytics] Found ${pickupSnapshot.docs.length} pickup entries for ${date}`
      );

      pickupSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const weight = Number(data.weight) || 0;
        const timestamp = data.timestamp;

        let timestampDate: Date;
        if (timestamp && typeof timestamp.toDate === "function") {
          timestampDate = timestamp.toDate();
        } else if (timestamp instanceof Date) {
          timestampDate = timestamp;
        } else if (typeof timestamp === "string") {
          timestampDate = new Date(timestamp);
        } else {
          timestampDate = new Date();
        }

        // Additional check to ensure we're getting the right date
        const entryDateStr = timestampDate.toLocaleDateString();
        const selectedDateStr = selectedDateObj.toLocaleDateString();

        console.log(
          `📦 Entry: ${data.clientName} - ${weight}lbs on ${entryDateStr} (Selected: ${selectedDateStr})`
        );

        entries.push({
          id: doc.id,
          clientId: data.clientId || "unknown",
          clientName: data.clientName || "Unknown Client",
          weight: weight,
          timestamp: timestampDate,
          cartId: data.cartId || "",
        });
      });

      setPickupEntries(entries);
      const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
      setTotalDayWeight(totalWeight);

      console.log(
        `✅ [ClientDailyAnalytics] Loaded ${entries.length} pickup entries, total weight: ${totalWeight}lbs`
      );
    } catch (error) {
      console.error("Error fetching pickup data:", error);
    }
  };

  // Fetch production entries (item data)
  const fetchProductionData = async (date: string) => {
    try {
      // Parse date correctly for local timezone
      const [year, month, day] = date.split("-").map(Number);
      const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
      const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

      console.log(
        `🏭 [ClientDailyAnalytics] Fetching production data for date: ${date}`
      );
      console.log(
        `📅 Production date range: ${selectedDateObj.toLocaleDateString()} to ${nextDay.toLocaleDateString()}`
      );

      // Fetch invoices for the selected date
      const invoicesQuery = query(
        collection(db, "invoices"),
        where("date", ">=", Timestamp.fromDate(selectedDateObj)),
        where("date", "<", Timestamp.fromDate(nextDay))
      );

      const invoicesSnapshot = await getDocs(invoicesQuery);
      const entries: ProductEntry[] = [];

      console.log(
        `🧾 [ClientDailyAnalytics] Found ${invoicesSnapshot.docs.length} invoices for ${date}`
      );

      // Initialize classification service
      await productClassificationService.waitForInitialization();

      invoicesSnapshot.docs.forEach((doc) => {
        const invoice = doc.data();
        const invoiceDate = invoice.date;

        let addedAt: Date;
        if (invoiceDate && typeof invoiceDate.toDate === "function") {
          addedAt = invoiceDate.toDate();
        } else if (invoiceDate instanceof Date) {
          addedAt = invoiceDate;
        } else if (typeof invoiceDate === "string") {
          addedAt = new Date(invoiceDate);
        } else {
          addedAt = new Date();
        }

        // Log invoice details for debugging
        const invoiceDateStr = addedAt.toLocaleDateString();
        const selectedDateStr = selectedDateObj.toLocaleDateString();
        console.log(
          `📋 Invoice ${doc.id} for ${invoice.clientName} dated ${invoiceDateStr} (Selected: ${selectedDateStr})`
        );

        if (invoice.carts && Array.isArray(invoice.carts)) {
          invoice.carts.forEach((cart: any) => {
            if (cart.items && Array.isArray(cart.items)) {
              cart.items.forEach((item: any) => {
                if (item.addedAt) {
                  // Check individual item addedAt timestamps
                  let itemAddedAt: Date;
                  if (
                    item.addedAt &&
                    typeof item.addedAt.toDate === "function"
                  ) {
                    itemAddedAt = item.addedAt.toDate();
                  } else if (item.addedAt instanceof Date) {
                    itemAddedAt = item.addedAt;
                  } else if (typeof item.addedAt === "string") {
                    itemAddedAt = new Date(item.addedAt);
                  } else {
                    itemAddedAt = addedAt; // Fall back to invoice date
                  }

                  // Only include items that were actually added on the selected date
                  if (itemAddedAt >= selectedDateObj && itemAddedAt < nextDay) {
                    const classification =
                      productClassificationService.getClassification(
                        item.productName
                      );

                    console.log(
                      `📦 Item: ${item.productName} (${item.quantity}) for ${invoice.clientName} - ${classification}`
                    );

                    entries.push({
                      id: `${doc.id}-${cart.id}-${
                        item.productId || Math.random()
                      }`,
                      clientId: invoice.clientId || "unknown",
                      clientName: invoice.clientName || "Unknown Client",
                      productName: item.productName || "Unknown Product",
                      quantity: Number(item.quantity) || 0,
                      addedAt: itemAddedAt,
                      classification: classification,
                    });
                  } else {
                    console.log(
                      `⏭️ Skipping item ${
                        item.productName
                      } - added on ${itemAddedAt.toLocaleDateString()}, not ${selectedDateStr}`
                    );
                  }
                } else {
                  // If no item-specific addedAt, use invoice date but check if it's in range
                  if (addedAt >= selectedDateObj && addedAt < nextDay) {
                    const classification =
                      productClassificationService.getClassification(
                        item.productName
                      );

                    entries.push({
                      id: `${doc.id}-${cart.id}-${
                        item.productId || Math.random()
                      }`,
                      clientId: invoice.clientId || "unknown",
                      clientName: invoice.clientName || "Unknown Client",
                      productName: item.productName || "Unknown Product",
                      quantity: Number(item.quantity) || 0,
                      addedAt: addedAt,
                      classification: classification,
                    });
                  }
                }
              });
            }
          });
        }
      });

      setProductionEntries(entries);
      const totalItems = entries.reduce(
        (sum, entry) => sum + entry.quantity,
        0
      );
      setTotalDayItems(totalItems);

      console.log(
        `✅ [ClientDailyAnalytics] Loaded ${entries.length} production entries, total items: ${totalItems}`
      );
    } catch (error) {
      console.error("Error fetching production data:", error);
    }
  };

  // Fetch historical data for day-of-week predictions
  const fetchHistoricalAnalysis = async (targetDate: string) => {
    setHistoricalLoading(true);
    try {
      console.log(
        `📊 [ClientDailyAnalytics] Starting historical analysis for ${targetDate}`
      );

      // Parse target date and get day of week
      const [year, month, day] = targetDate.split("-").map(Number);
      const targetDateObj = new Date(year, month - 1, day);
      const dayOfWeek = targetDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[dayOfWeek];

      console.log(`📅 Target day: ${dayName} (${dayOfWeek})`);

      // Calculate date range for past 365 days
      const oneYearAgo = new Date(targetDateObj);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      console.log(
        `📈 Analyzing from ${oneYearAgo.toLocaleDateString()} to ${targetDateObj.toLocaleDateString()}`
      );

      // Fetch all invoices from the past year
      const historicalQuery = query(
        collection(db, "invoices"),
        where("date", ">=", Timestamp.fromDate(oneYearAgo)),
        where("date", "<", Timestamp.fromDate(targetDateObj))
      );

      const historicalSnapshot = await getDocs(historicalQuery);
      console.log(
        `📋 Found ${historicalSnapshot.docs.length} historical invoices`
      );

      // Initialize classification service
      await productClassificationService.waitForInitialization();

      // Group data by client and same day of week
      const clientHistoryMap = new Map<
        string,
        {
          clientName: string;
          sameDayData: Array<{
            date: Date;
            totalItems: number;
            mangleItems: number;
            dobladoItems: number;
            weight: number;
          }>;
        }
      >();

      historicalSnapshot.docs.forEach((doc) => {
        const invoice = doc.data();
        const invoiceDate = invoice.date;

        let invDate: Date;
        if (invoiceDate && typeof invoiceDate.toDate === "function") {
          invDate = invoiceDate.toDate();
        } else if (invoiceDate instanceof Date) {
          invDate = invoiceDate;
        } else if (typeof invoiceDate === "string") {
          invDate = new Date(invoiceDate);
        } else {
          return; // Skip invalid dates
        }

        // Only include invoices from the same day of week
        if (invDate.getDay() !== dayOfWeek) {
          return;
        }

        console.log(
          `📊 Processing ${
            invoice.clientName
          } invoice from ${invDate.toLocaleDateString()} (${
            dayNames[invDate.getDay()]
          })`
        );

        const clientId = invoice.clientId || "unknown";
        const clientName = invoice.clientName || "Unknown Client";

        if (!clientHistoryMap.has(clientId)) {
          clientHistoryMap.set(clientId, {
            clientName,
            sameDayData: [],
          });
        }

        let totalItems = 0;
        let mangleItems = 0;
        let dobladoItems = 0;

        if (invoice.carts && Array.isArray(invoice.carts)) {
          invoice.carts.forEach((cart: any) => {
            if (cart.items && Array.isArray(cart.items)) {
              cart.items.forEach((item: any) => {
                const quantity = Number(item.quantity) || 0;
                const classification =
                  productClassificationService.getClassification(
                    item.productName
                  );

                totalItems += quantity;
                if (classification === "Mangle") {
                  mangleItems += quantity;
                } else {
                  dobladoItems += quantity;
                }
              });
            }
          });
        }

        clientHistoryMap.get(clientId)!.sameDayData.push({
          date: invDate,
          totalItems,
          mangleItems,
          dobladoItems,
          weight: Number(invoice.totalWeight) || 0,
        });
      });

      // Calculate predictions for each client
      const clientPredictions: HistoricalPrediction[] = [];
      let totalPredictedItems = 0;
      let totalPredictedWeight = 0;
      let totalPredictedMangleItems = 0;
      let totalPredictedDobladoItems = 0;

      clientHistoryMap.forEach((history, clientId) => {
        if (history.sameDayData.length === 0) return;

        // Calculate averages
        const totalSameDayItems = history.sameDayData.reduce(
          (sum, d) => sum + d.totalItems,
          0
        );
        const totalSameDayMangle = history.sameDayData.reduce(
          (sum, d) => sum + d.mangleItems,
          0
        );
        const totalSameDayDoblado = history.sameDayData.reduce(
          (sum, d) => sum + d.dobladoItems,
          0
        );
        const totalSameDayWeight = history.sameDayData.reduce(
          (sum, d) => sum + d.weight,
          0
        );

        const occurrences = history.sameDayData.length;
        const averageItems = Math.round(totalSameDayItems / occurrences);
        const averageMangleItems = Math.round(totalSameDayMangle / occurrences);
        const averageDobladoItems = Math.round(
          totalSameDayDoblado / occurrences
        );
        const averageWeight = Math.round(totalSameDayWeight / occurrences);

        // Calculate confidence based on consistency of data
        const itemVariances = history.sameDayData.map((d) =>
          Math.abs(d.totalItems - averageItems)
        );
        const avgVariance =
          itemVariances.reduce((sum, v) => sum + v, 0) / itemVariances.length;
        const confidence = Math.max(
          0,
          Math.min(100, 100 - (avgVariance / averageItems) * 100)
        );

        // Get most recent occurrence
        const lastSeen = history.sameDayData.reduce(
          (latest, d) => (d.date > latest ? d.date : latest),
          history.sameDayData[0].date
        );

        const prediction: HistoricalPrediction = {
          clientId,
          clientName: history.clientName,
          averageItems,
          averageMangleItems,
          averageDobladoItems,
          averageWeight,
          occurrences,
          confidence: Math.round(confidence),
          lastSeen,
        };

        clientPredictions.push(prediction);

        // Add to totals
        totalPredictedItems += averageItems;
        totalPredictedWeight += averageWeight;
        totalPredictedMangleItems += averageMangleItems;
        totalPredictedDobladoItems += averageDobladoItems;

        console.log(
          `📊 ${
            history.clientName
          }: ${averageItems} items avg (${averageMangleItems}M/${averageDobladoItems}D) from ${occurrences} ${dayName}s, confidence: ${Math.round(
            confidence
          )}%`
        );
      });

      // Sort predictions by average items (highest first)
      clientPredictions.sort((a, b) => b.averageItems - a.averageItems);

      const analysis: DayOfWeekAnalysis = {
        dayOfWeek,
        dayName,
        totalPredictedItems,
        totalPredictedWeight,
        totalPredictedMangleItems,
        totalPredictedDobladoItems,
        clientPredictions: clientPredictions.filter((p) => p.averageItems > 0), // Only include clients with predictions
      };

      setDayOfWeekAnalysis(analysis);
      console.log(
        `✅ [ClientDailyAnalytics] Historical analysis complete: ${analysis.clientPredictions.length} clients, ${totalPredictedItems} predicted items`
      );
    } catch (error) {
      console.error("Error fetching historical analysis:", error);
    } finally {
      setHistoricalLoading(false);
    }
  };

  // Calculate client analysis
  const calculateClientAnalysis = useMemo(() => {
    if (pickupEntries.length === 0 || totalDayWeight === 0) return [];

    // Group pickup entries by client
    const clientWeightMap = new Map<
      string,
      { clientName: string; totalWeight: number }
    >();

    pickupEntries.forEach((entry) => {
      const existing = clientWeightMap.get(entry.clientId);
      if (existing) {
        existing.totalWeight += entry.weight;
      } else {
        clientWeightMap.set(entry.clientId, {
          clientName: entry.clientName,
          totalWeight: entry.weight,
        });
      }
    });

    // Group production entries by client
    const clientItemsMap = new Map<
      string,
      {
        clientName: string;
        totalItems: number;
        mangleItems: number;
        dobladoItems: number;
      }
    >();

    productionEntries.forEach((entry) => {
      const existing = clientItemsMap.get(entry.clientId);
      if (existing) {
        existing.totalItems += entry.quantity;
        if (entry.classification === "Mangle") {
          existing.mangleItems += entry.quantity;
        } else {
          existing.dobladoItems += entry.quantity;
        }
      } else {
        clientItemsMap.set(entry.clientId, {
          clientName: entry.clientName,
          totalItems: entry.quantity,
          mangleItems: entry.classification === "Mangle" ? entry.quantity : 0,
          dobladoItems: entry.classification === "Doblado" ? entry.quantity : 0,
        });
      }
    });

    // Calculate overall classification percentages from production data
    const totalMangleItems = productionEntries
      .filter((entry) => entry.classification === "Mangle")
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const totalDobladoItems = productionEntries
      .filter((entry) => entry.classification === "Doblado")
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const overallManglePercentage =
      totalDayItems > 0 ? (totalMangleItems / totalDayItems) * 100 : 50;
    const overallDobladoPercentage =
      totalDayItems > 0 ? (totalDobladoItems / totalDayItems) * 100 : 50;

    // Combine data and calculate estimates
    const analysis: ClientDailyAnalysis[] = [];

    clientWeightMap.forEach((weightData, clientId) => {
      const itemsData = clientItemsMap.get(clientId);
      const clientWeight = weightData.totalWeight;
      const clientItems = itemsData?.totalItems || 0;

      // Calculate percentages
      const percentageOfDayWeight = (clientWeight / totalDayWeight) * 100;
      const percentageOfDayItems = totalDayItems > 0 ? (clientItems / totalDayItems) * 100 : 0;

      // Calculate client-specific classification percentages
      let manglePercentage = overallManglePercentage;
      let dobladoPercentage = overallDobladoPercentage;

      if (itemsData && clientItems > 0) {
        manglePercentage = (itemsData.mangleItems / clientItems) * 100;
        dobladoPercentage = (itemsData.dobladoItems / clientItems) * 100;
      }

      // Estimate weight and items distribution based on percentages
      const estimatedMangleWeight = (clientWeight * manglePercentage) / 100;
      const estimatedDobladoWeight = (clientWeight * dobladoPercentage) / 100;
      const estimatedMangleItems = (clientItems * manglePercentage) / 100;
      const estimatedDobladoItems = (clientItems * dobladoPercentage) / 100;

      analysis.push({
        clientId,
        clientName: weightData.clientName,
        totalWeight: clientWeight,
        totalItems: clientItems,
        percentageOfDayWeight,
        percentageOfDayItems,
        estimatedMangleWeight,
        estimatedDobladoWeight,
        estimatedMangleItems,
        estimatedDobladoItems,
        manglePercentage,
        dobladoPercentage,
        actualMangleItems: itemsData?.mangleItems,
        actualDobladoItems: itemsData?.dobladoItems,
      });
    });

    // Sort by weight percentage (highest first)
    return analysis.sort(
      (a, b) => b.percentageOfDayWeight - a.percentageOfDayWeight
    );
  }, [pickupEntries, productionEntries, totalDayWeight, totalDayItems]);

  // Calculate Optimal Washing Order for Balanced Workload
  const calculateWashingOrder = useMemo(() => {
    if (clientAnalysis.length === 0) return { order: [], metrics: {
      optimalBalance: 0,
      currentMangleLoad: 0,
      currentDobladoLoad: 0,
      balanceDifference: 0,
      efficiency: 0,
    }};

    console.log("🔄 Calculating optimal washing order for balanced workload...");

    // Create a working copy of client analysis sorted by priority factors
    const clientsToProcess = [...clientAnalysis].map(client => ({
      ...client,
      priorityScore: 0,
      balanceContribution: 0
    }));

    // Calculate total expected items for both areas
    const totalExpectedMangleItems = clientsToProcess.reduce((sum, client) => sum + client.estimatedMangleItems, 0);
    const totalExpectedDobladoItems = clientsToProcess.reduce((sum, client) => sum + client.estimatedDobladoItems, 0);
    const optimalBalance = (totalExpectedMangleItems + totalExpectedDobladoItems) / 2;

    console.log(`📊 Total Expected - Mangle: ${Math.round(totalExpectedMangleItems)}, Doblado: ${Math.round(totalExpectedDobladoItems)}`);

    const washingSequence: WashingOrder[] = [];
    let cumulativeMangleLoad = 0;
    let cumulativeDobladoLoad = 0;
    let sequenceNumber = 1;

    // Process clients in optimal order for balanced loading
    while (clientsToProcess.length > 0) {
      // Calculate current balance difference
      const currentBalanceDiff = Math.abs(cumulativeMangleLoad - cumulativeDobladoLoad);

      // Score each remaining client based on how they'd improve balance
      clientsToProcess.forEach(client => {
        const afterMangleLoad = cumulativeMangleLoad + client.estimatedMangleItems;
        const afterDobladoLoad = cumulativeDobladoLoad + client.estimatedDobladoItems;
        const afterBalanceDiff = Math.abs(afterMangleLoad - afterDobladoLoad);

        // Priority factors:
        // 1. Balance improvement (lower difference is better)
        const balanceImprovement = Math.max(0, currentBalanceDiff - afterBalanceDiff);
        
        // 2. Weight factor (heavier clients processed earlier)
        const weightFactor = (client.totalWeight / totalDayWeight) * 1000;
        
        // 3. Area preference (prioritize area that's currently behind)
        let areaPreference = 0;
        if (cumulativeMangleLoad < cumulativeDobladoLoad && client.manglePercentage > client.dobladoPercentage) {
          areaPreference = 200; // Boost for Mangle-heavy clients when Mangle is behind
        } else if (cumulativeDobladoLoad < cumulativeMangleLoad && client.dobladoPercentage > client.manglePercentage) {
          areaPreference = 200; // Boost for Doblado-heavy clients when Doblado is behind
        }

        // Combined priority score
        client.priorityScore = balanceImprovement * 10 + weightFactor + areaPreference;
        client.balanceContribution = balanceImprovement;
      });

      // Select the highest priority client
      clientsToProcess.sort((a, b) => b.priorityScore - a.priorityScore);
      const selectedClient = clientsToProcess.shift()!;

      // Update cumulative loads
      cumulativeMangleLoad += selectedClient.estimatedMangleItems;
      cumulativeDobladoLoad += selectedClient.estimatedDobladoItems;

      // Determine washing reason
      let washingReason = "";
      if (selectedClient.balanceContribution > 0) {
        washingReason = "🎯 Improves balance";
      } else if (selectedClient.totalWeight > totalDayWeight * 0.2) {
        washingReason = "⚖️ High volume client";
      } else if (sequenceNumber === 1) {
        washingReason = "🥇 Highest priority";
      } else {
        const mangleDeficit = cumulativeMangleLoad < cumulativeDobladoLoad;
        const clientFavorsDeficitArea = mangleDeficit ? 
          selectedClient.manglePercentage > selectedClient.dobladoPercentage :
          selectedClient.dobladoPercentage > selectedClient.manglePercentage;
        
        if (clientFavorsDeficitArea) {
          washingReason = `📈 Balances ${mangleDeficit ? 'Mangle' : 'Doblado'} workload`;
        } else {
          washingReason = "📋 Sequential processing";
        }
      }

      const loadBalance = Math.abs(cumulativeMangleLoad - cumulativeDobladoLoad);

      washingSequence.push({
        sequence: sequenceNumber++,
        clientId: selectedClient.clientId,
        clientName: selectedClient.clientName,
        totalWeight: selectedClient.totalWeight,
        estimatedMangleItems: selectedClient.estimatedMangleItems,
        estimatedDobladoItems: selectedClient.estimatedDobladoItems,
        manglePercentage: selectedClient.manglePercentage,
        dobladoPercentage: selectedClient.dobladoPercentage,
        washingReason,
        cumulativeMangleLoad,
        cumulativeDobladoLoad,
        loadBalance,
        priorityScore: selectedClient.priorityScore,
      });
    }

    // Calculate final metrics
    const finalBalance = Math.abs(cumulativeMangleLoad - cumulativeDobladoLoad);
    const totalItems = cumulativeMangleLoad + cumulativeDobladoLoad;
    const efficiency = totalItems > 0 ? Math.max(0, 100 - (finalBalance / totalItems) * 100) : 100;

    const metrics: BalanceMetrics = {
      optimalBalance,
      currentMangleLoad: cumulativeMangleLoad,
      currentDobladoLoad: cumulativeDobladoLoad,
      balanceDifference: finalBalance,
      efficiency: Math.round(efficiency * 100) / 100,
    };

    console.log("✅ Washing order optimization complete:");
    console.log(`   Final balance: Mangle ${Math.round(cumulativeMangleLoad)} vs Doblado ${Math.round(cumulativeDobladoLoad)}`);
    console.log(`   Balance difference: ${Math.round(finalBalance)} items`);
    console.log(`   Efficiency: ${efficiency.toFixed(1)}%`);

    return { order: washingSequence, metrics };
  }, [clientAnalysis, totalDayWeight]);

  // Update washing order and balance metrics when calculation changes
  useEffect(() => {
    const result = calculateWashingOrder;
    setWashingOrder(result.order);
    setBalanceMetrics(result.metrics);
  }, [calculateWashingOrder]);

  useEffect(() => {
    setClientAnalysis(calculateClientAnalysis);
  }, [calculateClientAnalysis]);

  // Initialize classification service and subscribe to changes
  useEffect(() => {
    const initializeAndSubscribe = async () => {
      try {
        // Initialize classification service
        await productClassificationService.waitForInitialization();
        console.log(
          "🏷️ [ClientDailyAnalytics] Classification service initialized"
        );

        // Subscribe to classification changes for real-time updates
        const unsubscribe = productClassificationService.subscribe(() => {
          console.log(
            "🔄 [ClientDailyAnalytics] Classifications updated, refreshing analysis..."
          );

          // Update classification stats
          const stats = productClassificationService.getStats();
          setClassificationStats(stats);

          // Re-fetch production data to apply new classifications
          if (selectedDate) {
            fetchProductionData(selectedDate);
          }
        });

        // Initial stats load
        const stats = productClassificationService.getStats();
        setClassificationStats(stats);

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error(
          "🏷️ [ClientDailyAnalytics] Failed to initialize classification service:",
          error
        );
      }
    };

    const cleanup = initializeAndSubscribe();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn && cleanupFn());
    };
  }, []);

  // Fetch data when date changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPickupData(selectedDate),
        fetchProductionData(selectedDate),
        fetchHistoricalAnalysis(selectedDate),
      ]);
      setLoading(false);
    };

    fetchData();
  }, [selectedDate]);

  // Chart data for weight distribution
  const weightChartData = useMemo(() => {
    const labels = clientAnalysis.slice(0, 10).map((client) => {
      const name = client.clientName;
      return name.length > 20 ? name.slice(0, 20) + "..." : name;
    });

    const data = clientAnalysis
      .slice(0, 10)
      .map((client) => client.totalWeight);

    return {
      labels,
      datasets: [
        {
          label: "Weight (lbs)",
          data,
          backgroundColor: [
            "#FF6384",
            "#36A2EB",
            "#FFCE56",
            "#4BC0C0",
            "#9966FF",
            "#FF9F40",
            "#FF6B6B",
            "#4ECDC4",
            "#45B7D1",
            "#96CEB4",
          ],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    };
  }, [clientAnalysis]);

  // Chart data for mangle/doblado estimation
  const classificationChartData = useMemo(() => {
    const labels = clientAnalysis.slice(0, 8).map((client) => {
      const name = client.clientName;
      return name.length > 15 ? name.slice(0, 15) + "..." : name;
    });

    const mangleData = clientAnalysis
      .slice(0, 8)
      .map((client) => client.estimatedMangleWeight);
    const dobladoData = clientAnalysis
      .slice(0, 8)
      .map((client) => client.estimatedDobladoWeight);

    return {
      labels,
      datasets: [
        {
          label: "Estimated Mangle Weight",
          data: mangleData,
          backgroundColor: "#28a745",
          borderWidth: 1,
          borderColor: "#1e7e34",
        },
        {
          label: "Estimated Doblado Weight",
          data: dobladoData,
          backgroundColor: "#ffc107",
          borderWidth: 1,
          borderColor: "#e0a800",
        },
      ],
    };
  }, [clientAnalysis]);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-2">Loading client daily analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h2 className="mb-2">
                <i className="fas fa-chart-pie me-2"></i>
                Client Daily Analytics & Mangle/Doblado Estimation
                <span className="ms-2 fs-6">
                  {selectedDate === new Date().toISOString().slice(0, 10) ? (
                    <span className="badge bg-success">
                      <i className="fas fa-calendar-day me-1"></i>
                      Today's Live Data
                    </span>
                  ) : (
                    <span className="badge bg-info">
                      <i className="fas fa-history me-1"></i>
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </span>
                  )}
                </span>
              </h2>
              <p className="text-muted mb-3">
                Analyze the percentage of items that come for each client daily
                and estimate mangle vs doblado distribution based on weight and
                historical patterns.
              </p>

              {/* Classification System Info */}
              <div className="alert alert-info border-info mb-3">
                <div className="row align-items-center">
                  <div className="col-md-8">
                    <h6 className="alert-heading mb-1">
                      <i className="fas fa-sync-alt me-2"></i>
                      Using Production Classification Dashboard System
                    </h6>
                    <small className="mb-0">
                      This analysis uses the same Mangle/Doblado classification
                      rules as the Production Classification Dashboard.
                      Classifications are synced in real-time via Firebase.
                      <br />
                      <strong>Mangle:</strong> Sheets, Duvets, Sabanas, Towels,
                      Tablecloths, etc.
                      <strong className="ms-2">Doblado:</strong> Uniforms,
                      Scrubs, General garments
                    </small>
                  </div>
                  <div className="col-md-4 text-end">
                    <div className="small text-muted">
                      <div>
                        <strong>{classificationStats.totalProducts}</strong>{" "}
                        products classified
                      </div>
                      <div>
                        <span className="text-success">
                          {classificationStats.mangleProducts} Mangle
                        </span>{" "}
                        •{" "}
                        <span className="text-warning">
                          {classificationStats.dobladoProducts} Doblado
                        </span>
                      </div>
                      <div>
                        <strong>
                          {classificationStats.customClassifications}
                        </strong>{" "}
                        custom overrides
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Selector and Summary Stats */}
              <div className="row align-items-end">
                <div className="col-md-4 mb-2">
                  <label htmlFor="selectedDate" className="form-label">
                    Select Date:
                  </label>
                  <div className="input-group">
                    <input
                      type="date"
                      id="selectedDate"
                      className="form-control"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <button
                      className="btn btn-outline-primary"
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const todayStr = today.toISOString().slice(0, 10);
                        setSelectedDate(todayStr);
                        console.log(
                          `📅 [ClientDailyAnalytics] Jumping to today: ${todayStr}`
                        );
                      }}
                      title="Jump to today's date"
                    >
                      <i className="fas fa-calendar-day me-1"></i>
                      Today
                    </button>
                  </div>
                  <small className="text-muted">
                    {selectedDate === new Date().toISOString().slice(0, 10) ? (
                      <span className="text-primary">
                        <i className="fas fa-check-circle me-1"></i>
                        Viewing today's data
                      </span>
                    ) : (
                      <span>
                        Historical data for{" "}
                        {new Date(
                          selectedDate + "T00:00:00"
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </small>
                </div>
                <div className="col-md-8 mb-2">
                  <div className="row text-center">
                    <div className="col-sm-3">
                      <div className="text-primary h4 mb-1">
                        {clientAnalysis.length}
                      </div>
                      <small className="text-muted">Clients</small>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-success h4 mb-1">
                        {totalDayWeight.toLocaleString()}
                      </div>
                      <small className="text-muted">Total Weight (lbs)</small>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-info h4 mb-1">
                        {totalDayItems.toLocaleString()}
                      </div>
                      <small className="text-muted">Total Items</small>
                    </div>
                    <div className="col-sm-3">
                      <div className="text-warning h4 mb-1">
                        {totalDayWeight > 0 && clientAnalysis.length > 0
                          ? (totalDayWeight / clientAnalysis.length).toFixed(0)
                          : 0}
                      </div>
                      <small className="text-muted">Avg Weight/Client</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="row mb-4">
        {/* Weight Distribution Chart */}
        <div className="col-lg-6 mb-3">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-weight-hanging me-2"></i>
                Client Weight Distribution
              </h5>
            </div>
            <div className="card-body p-3">
              {clientAnalysis.length > 0 ? (
                <div style={{ height: "350px", position: "relative" }}>
                  <Pie
                    data={weightChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom" as const,
                          labels: {
                            usePointStyle: true,
                            font: {
                              size: 11,
                            },
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (context) {
                              const client = clientAnalysis[context.dataIndex];
                              return `${context.label}: ${
                                context.parsed
                              } lbs (${client.percentageOfDayWeight.toFixed(
                                1
                              )}%)`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="fas fa-chart-pie fa-3x mb-3 opacity-25"></i>
                  <p>No data available for selected date</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mangle/Doblado Estimation Chart */}
        <div className="col-lg-6 mb-3">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-chart-bar me-2"></i>
                Mangle vs Doblado Weight Estimation
              </h5>
            </div>
            <div className="card-body p-3">
              {clientAnalysis.length > 0 ? (
                <div style={{ height: "350px", position: "relative" }}>
                  <Bar
                    data={classificationChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        intersect: false,
                      },
                      scales: {
                        x: {
                          stacked: true,
                          ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            font: {
                              size: 10,
                            },
                          },
                        },
                        y: {
                          stacked: true,
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: "Weight (lbs)",
                            font: {
                              size: 12,
                            },
                          },
                          ticks: {
                            font: {
                              size: 10,
                            },
                          },
                        },
                      },
                      plugins: {
                        legend: {
                          position: "top" as const,
                          labels: {
                            usePointStyle: true,
                            font: {
                              size: 11,
                            },
                          },
                        },
                        tooltip: {
                          callbacks: {
                            footer: function (tooltipItems) {
                              const clientIndex = tooltipItems[0].dataIndex;
                              const client = clientAnalysis[clientIndex];
                              return `Total: ${client.totalWeight} lbs`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="fas fa-chart-bar fa-3x mb-3 opacity-25"></i>
                  <p>No data available for selected date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Predictions Section */}
      {dayOfWeekAnalysis && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">
                  <i className="fas fa-crystal-ball me-2"></i>
                  Historical Predictions for {dayOfWeekAnalysis.dayName}s
                  {historicalLoading && (
                    <div
                      className="spinner-border spinner-border-sm ms-2"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </h5>
                <small className="opacity-75">
                  Based on 365-day analysis of same day-of-week patterns
                </small>
              </div>
              <div className="card-body">
                {/* Prediction Summary */}
                <div className="row mb-4">
                  <div className="col-md-3 text-center">
                    <div className="h4 text-primary mb-1">
                      {dayOfWeekAnalysis.totalPredictedItems.toLocaleString()}
                    </div>
                    <small className="text-muted">Predicted Total Items</small>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="h4 text-success mb-1">
                      {dayOfWeekAnalysis.totalPredictedWeight.toLocaleString()}
                    </div>
                    <small className="text-muted">Predicted Weight (lbs)</small>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="h4 text-info mb-1">
                      {dayOfWeekAnalysis.totalPredictedMangleItems.toLocaleString()}
                    </div>
                    <small className="text-muted">Predicted Mangle Items</small>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="h4 text-warning mb-1">
                      {dayOfWeekAnalysis.totalPredictedDobladoItems.toLocaleString()}
                    </div>
                    <small className="text-muted">
                      Predicted Doblado Items
                    </small>
                  </div>
                </div>

                {/* Predictions vs Actual Comparison */}
                {totalDayItems > 0 && (
                  <div className="alert alert-success border-success mb-4">
                    <h6 className="alert-heading mb-2">
                      <i className="fas fa-chart-line me-2"></i>
                      Prediction vs Actual Comparison
                    </h6>
                    <div className="row text-center">
                      <div className="col-md-4">
                        <strong>Total Items:</strong>
                        <br />
                        <span className="text-primary">
                          Predicted: {dayOfWeekAnalysis.totalPredictedItems}
                        </span>
                        <br />
                        <span className="text-success">
                          Actual: {totalDayItems}
                        </span>
                        <br />
                        <small
                          className={`fw-bold ${
                            Math.abs(
                              dayOfWeekAnalysis.totalPredictedItems -
                                totalDayItems
                            ) /
                              totalDayItems <
                            0.2
                              ? "text-success"
                              : "text-warning"
                          }`}
                        >
                          {totalDayItems > 0
                            ? `${(
                                ((dayOfWeekAnalysis.totalPredictedItems -
                                  totalDayItems) /
                                  totalDayItems) *
                                100
                              ).toFixed(1)}% difference`
                            : "N/A"}
                        </small>
                      </div>
                      <div className="col-md-4">
                        <strong>Mangle Items:</strong>
                        <br />
                        <span className="text-primary">
                          Predicted:{" "}
                          {dayOfWeekAnalysis.totalPredictedMangleItems}
                        </span>
                        <br />
                        <span className="text-success">
                          Actual:{" "}
                          {productionEntries
                            .filter((e) => e.classification === "Mangle")
                            .reduce((sum, e) => sum + e.quantity, 0)}
                        </span>
                      </div>
                      <div className="col-md-4">
                        <strong>Doblado Items:</strong>
                        <br />
                        <span className="text-primary">
                          Predicted:{" "}
                          {dayOfWeekAnalysis.totalPredictedDobladoItems}
                        </span>
                        <br />
                        <span className="text-success">
                          Actual:{" "}
                          {productionEntries
                            .filter((e) => e.classification === "Doblado")
                            .reduce((sum, e) => sum + e.quantity, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Client Predictions Table */}
                {dayOfWeekAnalysis.clientPredictions.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Client Name</th>
                          <th className="text-center">Avg Items</th>
                          <th className="text-center">Avg Mangle</th>
                          <th className="text-center">Avg Doblado</th>
                          <th className="text-center">Avg Weight</th>
                          <th className="text-center">Occurrences</th>
                          <th className="text-center">Confidence</th>
                          <th className="text-center">Last Seen</th>
                          {totalDayItems > 0 && (
                            <th className="text-center">Actual vs Predicted</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {dayOfWeekAnalysis.clientPredictions
                          .slice(0, 20)
                          .map((prediction) => {
                            // Find actual data for this client
                            const actualClient = clientAnalysis.find(
                              (c) => c.clientId === prediction.clientId
                            );

                            return (
                              <tr key={prediction.clientId}>
                                <td className="fw-bold">
                                  {prediction.clientName}
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-primary">
                                    {prediction.averageItems}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-success">
                                    {prediction.averageMangleItems}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-warning text-dark">
                                    {prediction.averageDobladoItems}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-info">
                                    {prediction.averageWeight}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <small className="text-muted">
                                    {prediction.occurrences} times
                                  </small>
                                </td>
                                <td className="text-center">
                                  <div className="d-flex align-items-center justify-content-center">
                                    <div
                                      className="progress me-1"
                                      style={{ height: "16px", width: "40px" }}
                                    >
                                      <div
                                        className={`progress-bar ${
                                          prediction.confidence >= 80
                                            ? "bg-success"
                                            : prediction.confidence >= 60
                                            ? "bg-warning"
                                            : "bg-danger"
                                        }`}
                                        style={{
                                          width: `${prediction.confidence}%`,
                                        }}
                                      ></div>
                                    </div>
                                    <small className="fw-bold">
                                      {prediction.confidence}%
                                    </small>
                                  </div>
                                </td>
                                <td className="text-center">
                                  <small className="text-muted">
                                    {prediction.lastSeen.toLocaleDateString()}
                                  </small>
                                </td>
                                {totalDayItems > 0 && (
                                  <td className="text-center">
                                    {actualClient ? (
                                      <div>
                                        <small className="text-success">
                                          Actual: {actualClient.totalItems}
                                        </small>
                                        <br />
                                        <small
                                          className={`fw-bold ${
                                            Math.abs(
                                              prediction.averageItems -
                                                actualClient.totalItems
                                            ) <= 2
                                              ? "text-success"
                                              : Math.abs(
                                                  prediction.averageItems -
                                                    actualClient.totalItems
                                                ) <= 5
                                              ? "text-warning"
                                              : "text-danger"
                                          }`}
                                        >
                                          {prediction.averageItems -
                                            actualClient.totalItems >
                                          0
                                            ? "+"
                                            : ""}
                                          {prediction.averageItems -
                                            actualClient.totalItems}
                                        </small>
                                      </div>
                                    ) : (
                                      <small className="text-muted">
                                        No data
                                      </small>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {dayOfWeekAnalysis.clientPredictions.length === 0 && (
                  <div className="text-center text-muted py-4">
                    <i className="fas fa-calendar-times fa-3x mb-3 opacity-25"></i>
                    <h6>No Historical Data Available</h6>
                    <p className="mb-0">
                      No client data found for {dayOfWeekAnalysis.dayName}s in
                      the past 365 days.
                      <br />
                      Try selecting a different date or ensure historical data
                      exists.
                    </p>
                  </div>
                )}

                {/* Prediction Methodology */}
                <div className="mt-4 p-3 bg-light rounded">
                  <h6 className="mb-2">
                    <i className="fas fa-info-circle me-2"></i>
                    Prediction Methodology
                  </h6>
                  <div className="row">
                    <div className="col-md-6">
                      <small>
                        <strong>Data Source:</strong> Analysis of invoices from
                        the past 365 days
                        <br />
                        <strong>Filtering:</strong> Only includes data from the
                        same day of week
                        <br />
                        <strong>Calculation:</strong> Simple average of
                        historical values
                      </small>
                    </div>
                    <div className="col-md-6">
                      <small>
                        <strong>Confidence Level:</strong> Based on data
                        consistency
                        <br />
                        <strong>Green (80%+):</strong> Highly reliable
                        prediction
                        <br />
                        <strong>Yellow (60-79%):</strong> Moderate reliability
                        <br />
                        <strong>Red (&lt;60%):</strong> Lower reliability
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Analysis Table */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-table me-2"></i>
                Detailed Client Analysis
              </h5>
            </div>
            <div className="card-body p-0">
              {clientAnalysis.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th style={{ minWidth: "150px" }}>Client Name</th>
                        <th
                          className="text-center"
                          style={{ minWidth: "80px" }}
                        >
                          Weight
                          <br />
                          <small>(lbs)</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "120px" }}
                        >
                          Weight %<br />
                          <small>of Day</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "80px" }}
                        >
                          Items
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "80px" }}
                        >
                          Items %<br />
                          <small>of Day</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "100px" }}
                        >
                          Est. Mangle
                          <br />
                          <small>Weight</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "100px" }}
                        >
                          Est. Doblado
                          <br />
                          <small>Weight</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "100px" }}
                        >
                          Est. Mangle
                          <br />
                          <small>Items</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "100px" }}
                        >
                          Est. Doblado
                          <br />
                          <small>Items</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "80px" }}
                        >
                          Mangle
                          <br />
                          <small>%</small>
                        </th>
                        <th
                          className="text-center"
                          style={{ minWidth: "80px" }}
                        >
                          Doblado
                          <br />
                          <small>%</small>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAnalysis.map((client, index) => (
                        <tr key={client.clientId}>
                          <td className="fw-bold">{client.clientName}</td>
                          <td className="text-center">
                            <span className="badge bg-primary">
                              {client.totalWeight.toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="d-flex align-items-center justify-content-center">
                              <div
                                className="progress me-2"
                                style={{
                                  height: "18px",
                                  width: "60px",
                                  minWidth: "60px",
                                }}
                              >
                                <div
                                  className="progress-bar bg-info"
                                  style={{
                                    width: `${Math.min(
                                      client.percentageOfDayWeight,
                                      100
                                    )}%`,
                                    fontSize: "10px",
                                  }}
                                ></div>
                              </div>
                              <small className="fw-bold">
                                {client.percentageOfDayWeight.toFixed(1)}%
                              </small>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-secondary">
                              {client.totalItems.toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <small className="fw-bold text-muted">
                              {client.percentageOfDayItems.toFixed(1)}%
                            </small>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-success">
                              {Math.round(
                                client.estimatedMangleWeight
                              ).toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-warning text-dark">
                              {Math.round(
                                client.estimatedDobladoWeight
                              ).toLocaleString()}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="text-success fw-bold">
                              {Math.round(
                                client.estimatedMangleItems
                              ).toLocaleString()}
                              {client.actualMangleItems !== undefined && (
                                <small className="d-block text-muted">
                                  (Act: {client.actualMangleItems})
                                </small>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="text-warning fw-bold">
                              {Math.round(
                                client.estimatedDobladoItems
                              ).toLocaleString()}
                              {client.actualDobladoItems !== undefined && (
                                <small className="d-block text-muted">
                                  (Act: {client.actualDobladoItems})
                                </small>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-success">
                              {client.manglePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-warning text-dark">
                              {client.dobladoPercentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <i className="fas fa-table fa-3x mb-3 opacity-25"></i>
                  <p>No client data available for selected date</p>
                  <small>
                    Try selecting a different date or ensure data exists for
                    this period
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Washing Order Optimization Section */}
      {washingOrder.length > 0 && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-warning">
              <div className="card-header bg-warning text-dark">
                <h5 className="mb-0">
                  <i className="fas fa-sort-numeric-down me-2"></i>
                  🧺 Optimal Washing Order for Balanced Workload
                  <span className="badge bg-dark ms-2">
                    {balanceMetrics.efficiency.toFixed(1)}% Efficiency
                  </span>
                </h5>
                <small>
                  Optimized sequence to balance Mangle ({Math.round(balanceMetrics.currentMangleLoad)} items) 
                  and Doblado ({Math.round(balanceMetrics.currentDobladoLoad)} items) workloads
                </small>
              </div>
              <div className="card-body">
                {/* Balance Metrics Summary */}
                <div className="row mb-4">
                  <div className="col-md-3 text-center">
                    <div className="card bg-success text-white">
                      <div className="card-body py-2">
                        <h4 className="mb-1">{Math.round(balanceMetrics.currentMangleLoad)}</h4>
                        <small>Mangle Items</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="card bg-warning text-dark">
                      <div className="card-body py-2">
                        <h4 className="mb-1">{Math.round(balanceMetrics.currentDobladoLoad)}</h4>
                        <small>Doblado Items</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className="card bg-info text-white">
                      <div className="card-body py-2">
                        <h4 className="mb-1">{Math.round(balanceMetrics.balanceDifference)}</h4>
                        <small>Balance Difference</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 text-center">
                    <div className={`card ${balanceMetrics.efficiency >= 90 ? 'bg-success' : balanceMetrics.efficiency >= 80 ? 'bg-warning' : 'bg-danger'} text-white`}>
                      <div className="card-body py-2">
                        <h4 className="mb-1">{balanceMetrics.efficiency.toFixed(1)}%</h4>
                        <small>Efficiency Score</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Toggle */}
                <div className="mb-3">
                  <div className="btn-group" role="group">
                    <button
                      className={`btn ${optimizationView === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setOptimizationView('table')}
                    >
                      <i className="fas fa-table me-1"></i>
                      Table View
                    </button>
                    <button
                      className={`btn ${optimizationView === 'chart' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setOptimizationView('chart')}
                    >
                      <i className="fas fa-chart-line me-1"></i>
                      Chart View
                    </button>
                  </div>
                </div>

                {/* Washing Order Table */}
                {optimizationView === 'table' && (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th className="text-center" style={{ width: '60px' }}>Order</th>
                          <th style={{ minWidth: '200px' }}>Client Name</th>
                          <th className="text-center">Weight</th>
                          <th className="text-center">Mangle Items</th>
                          <th className="text-center">Doblado Items</th>
                          <th className="text-center">Mangle %</th>
                          <th className="text-center">Doblado %</th>
                          <th style={{ minWidth: '200px' }}>Reason</th>
                          <th className="text-center">Cumulative Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {washingOrder.map((order, index) => (
                          <tr key={order.clientId} className={index < 3 ? 'table-success' : ''}>
                            <td className="text-center">
                              <span className={`badge ${index < 3 ? 'bg-success' : 'bg-secondary'} fs-6`}>
                                #{order.sequence}
                              </span>
                            </td>
                            <td className="fw-bold">{order.clientName}</td>
                            <td className="text-center">
                              <span className="badge bg-primary">
                                {order.totalWeight.toLocaleString()} lbs
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-success">
                                {Math.round(order.estimatedMangleItems)}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-warning text-dark">
                                {Math.round(order.estimatedDobladoItems)}
                              </span>
                            </td>
                            <td className="text-center">
                              <small className="fw-bold text-success">
                                {order.manglePercentage.toFixed(1)}%
                              </small>
                            </td>
                            <td className="text-center">
                              <small className="fw-bold text-warning">
                                {order.dobladoPercentage.toFixed(1)}%
                              </small>
                            </td>
                            <td>
                              <small className="text-muted">
                                {order.washingReason}
                              </small>
                            </td>
                            <td className="text-center">
                              <div className="d-flex flex-column align-items-center">
                                <small>
                                  <span className="text-success">M: {Math.round(order.cumulativeMangleLoad)}</span>
                                  {' vs '}
                                  <span className="text-warning">D: {Math.round(order.cumulativeDobladoLoad)}</span>
                                </small>
                                <div className="progress mt-1" style={{ width: '80px', height: '8px' }}>
                                  <div
                                    className={`progress-bar ${order.loadBalance <= 50 ? 'bg-success' : order.loadBalance <= 100 ? 'bg-warning' : 'bg-danger'}`}
                                    style={{
                                      width: `${Math.min(100, (order.loadBalance / (balanceMetrics.currentMangleLoad + balanceMetrics.currentDobladoLoad)) * 200)}%`
                                    }}
                                  ></div>
                                </div>
                                <small className="fw-bold" style={{ fontSize: '10px' }}>
                                  Δ{Math.round(order.loadBalance)}
                                </small>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Washing Order Chart */}
                {optimizationView === 'chart' && (
                  <div style={{ height: '400px' }}>
                    <Line
                      data={{
                        labels: washingOrder.map(order => `#${order.sequence}: ${order.clientName.slice(0, 15)}${order.clientName.length > 15 ? '...' : ''}`),
                        datasets: [
                          {
                            label: 'Cumulative Mangle Load',
                            data: washingOrder.map(order => order.cumulativeMangleLoad),
                            borderColor: '#28a745',
                            backgroundColor: 'rgba(40, 167, 69, 0.1)',
                            tension: 0.2,
                            fill: false,
                          },
                          {
                            label: 'Cumulative Doblado Load',
                            data: washingOrder.map(order => order.cumulativeDobladoLoad),
                            borderColor: '#ffc107',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            tension: 0.2,
                            fill: false,
                          },
                          {
                            label: 'Balance Difference',
                            data: washingOrder.map(order => order.loadBalance),
                            borderColor: '#dc3545',
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            tension: 0.2,
                            fill: false,
                            yAxisID: 'y1',
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          intersect: false,
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            position: 'left',
                            title: {
                              display: true,
                              text: 'Cumulative Items'
                            }
                          },
                          y1: {
                            beginAtZero: true,
                            position: 'right',
                            title: {
                              display: true,
                              text: 'Balance Difference'
                            },
                            grid: {
                              drawOnChartArea: false,
                            }
                          },
                          x: {
                            ticks: {
                              maxRotation: 45,
                              minRotation: 0,
                            }
                          }
                        },
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          },
                          tooltip: {
                            callbacks: {
                              afterLabel: function(context) {
                                const orderIndex = context.dataIndex;
                                const order = washingOrder[orderIndex];
                                if (context.datasetIndex === 0 || context.datasetIndex === 1) {
                                  return [
                                    `Weight: ${order.totalWeight} lbs`,
                                    `Reason: ${order.washingReason}`,
                                    `Priority Score: ${order.priorityScore.toFixed(1)}`
                                  ];
                                }
                                return [`Efficiency: ${((1 - order.loadBalance / (order.cumulativeMangleLoad + order.cumulativeDobladoLoad)) * 100).toFixed(1)}%`];
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {/* Optimization Explanation */}
                <div className="mt-4 p-3 bg-light rounded">
                  <h6 className="mb-2">
                    <i className="fas fa-lightbulb me-2"></i>
                    Optimization Strategy
                  </h6>
                  <div className="row">
                    <div className="col-md-6">
                      <small>
                        <strong>Balancing Logic:</strong>
                        <ul className="mt-1 mb-2" style={{ fontSize: '12px' }}>
                          <li>Prioritizes clients that improve area balance</li>
                          <li>Considers weight and area preference</li>
                          <li>Processes heavier clients earlier when possible</li>
                          <li>Minimizes final workload difference</li>
                        </ul>
                      </small>
                    </div>
                    <div className="col-md-6">
                      <small>
                        <strong>Benefits:</strong>
                        <ul className="mt-1 mb-2" style={{ fontSize: '12px' }}>
                          <li>🎯 Balanced workload distribution</li>
                          <li>⚡ Improved processing efficiency</li>
                          <li>👥 Even staff utilization</li>
                          <li>📊 Predictable completion times</li>
                        </ul>
                      </small>
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <small className="text-muted">
                      <strong>Target:</strong> Equal distribution between Mangle and Doblado areas (±{Math.round(balanceMetrics.balanceDifference)} items difference achieved)
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend and Explanation */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="alert alert-info">
            <h6 className="alert-heading mb-2">
              <i className="fas fa-info-circle me-2"></i>
              How This Analysis Works
            </h6>
            <div className="row">
              <div className="col-md-6">
                <h6>Weight-Based Analysis:</h6>
                <ul className="list-unstyled small mb-3">
                  <li>
                    • <strong>Weight %:</strong> Each client's weight as
                    percentage of total daily weight
                  </li>
                  <li>
                    • <strong>Items %:</strong> Each client's items as
                    percentage of total daily items
                  </li>
                  <li>
                    • <strong>Estimation Method:</strong> Uses historical
                    classification patterns
                  </li>
                </ul>
              </div>
              <div className="col-md-6">
                <h6>Mangle vs Doblado Estimation:</h6>
                <ul className="list-unstyled small mb-3">
                  <li>
                    • <strong>Mangle:</strong> Items processed through mangle
                    machines (sheets, duvets, towels)
                  </li>
                  <li>
                    • <strong>Doblado:</strong> Items requiring manual folding
                  </li>
                  <li>
                    • <strong>Accuracy:</strong> Estimates improve with more
                    historical data
                  </li>
                </ul>
              </div>
            </div>
            <small className="text-muted">
              <strong>Note:</strong> Estimations are based on weight
              distribution and historical classification patterns. Actual values
              are shown when production data is available for comparison.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDailyAnalytics;

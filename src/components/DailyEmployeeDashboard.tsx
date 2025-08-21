import React, { useEffect, useState, useMemo } from "react";
import ProductionTrackingService, {
  ProductionSummary,
  ProductionEntry,
} from "../services/ProductionTrackingService";
import { productClassificationService } from "../services/ProductClassificationService";
import EndOfShiftDashboard from "./EndOfShiftDashboard";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { canUserSeeComponent, AppComponentKey } from "../permissions";
import { useAuth } from "./AuthContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Rotation view types
enum RotationView {
  MAIN_STATS = "main_stats",
  SECONDARY_STATS = "secondary_stats",
  PROGRESS_SECTION = "progress_section",
  PRODUCTION_CHARTS = "production_charts",
  END_OF_SHIFT = "end_of_shift",
  FULL_VIEW = "full_view",
}

// Add CSS animations
const animationStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 230, 109, 0.3); }
    50% { box-shadow: 0 0 40px rgba(255, 230, 109, 0.6); }
  }

  @keyframes countUp {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(30px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .card-hover:hover {
    transform: scale(1.03) translateY(-8px) !important;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2) !important;
  }

  .number-animation {
    animation: countUp 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .fade-in {
    animation: fadeInUp 0.8s ease-out;
  }

  .shimmer-effect {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    background-size: 200px 100%;
    animation: shimmer 2s infinite;
  }

  .floating {
    animation: float 3s ease-in-out infinite;
  }

  .glow-effect {
    animation: glow 2s ease-in-out infinite alternate;
  }
`;

interface DailyStats {
  totalUnits: number;
  mangleUnits: number;
  dobladoUnits: number;
  totalItems: number;
  uniqueClients: number;
  averageHourRate: number;
  peakHourRate: number;
  productionSpanHours: number;
  firstEntryTime: string;
  lastEntryTime: string;
  segregatedClients: number;
  segregatedWeight: number;
  pickupEntries: number;
  pickupWeight: number;
}

const DailyEmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

  // Check permission early and return unauthorized message if needed
  const canSee = (component: AppComponentKey) =>
    user && canUserSeeComponent(user, component);

  if (!canSee("DailyEmployeeDashboard")) {
    return (
      <div className="container-fluid py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div
              className="card shadow-lg border-0"
              style={{ borderRadius: "15px" }}
            >
              <div className="card-body text-center p-5">
                <div className="mb-4">
                  <span style={{ fontSize: "4rem", color: "#dc3545" }}>🚫</span>
                </div>
                <h2 className="text-danger mb-3">Access Restricted</h2>
                <p className="text-muted mb-0">
                  You don't have permission to view the Daily Dashboard. Please
                  contact your supervisor or administrator for access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [productionSummary, setProductionSummary] =
    useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Rotation feature state
  const [isRotationActive, setIsRotationActive] = useState(false);
  const [currentRotationView, setCurrentRotationView] = useState<RotationView>(
    RotationView.FULL_VIEW
  );
  const [rotationInterval, setRotationInterval] =
    useState<NodeJS.Timeout | null>(null);

  // Segregation and pickup data
  const [segregatedClientsToday, setSegregatedClientsToday] =
    useState<number>(0);
  const [totalSegregatedWeight, setTotalSegregatedWeight] = useState<number>(0);
  const [pickupEntriesToday, setPickupEntriesToday] = useState<number>(0);
  const [totalPickupWeight, setTotalPickupWeight] = useState<number>(0);

  // Hourly chart data
  const [hourlyDobladoData, setHourlyDobladoData] = useState<{
    [hour: number]: number;
  }>({});
  const [hourlyMangleData, setHourlyMangleData] = useState<{
    [hour: number]: number;
  }>({});
  const [hourlySegregationData, setHourlySegregationData] = useState<{
    [hour: number]: number;
  }>({});

  // Get start times from localStorage (set in Production Classification Dashboard)
  const mangleStartTime = localStorage.getItem("mangleStartTime") || "08:00";
  const dobladoStartTime = localStorage.getItem("dobladoStartTime") || "08:00";
  const segregationStartTime =
    localStorage.getItem("segregationStartTime") || "08:00";

  // Rotation control functions
  const rotationViews = [
    RotationView.MAIN_STATS,
    RotationView.SECONDARY_STATS,
    RotationView.PROGRESS_SECTION,
    RotationView.PRODUCTION_CHARTS,
    RotationView.END_OF_SHIFT,
  ];

  const startRotation = () => {
    if (rotationInterval) {
      clearInterval(rotationInterval);
    }

    setIsRotationActive(true);
    setCurrentRotationView(rotationViews[0]);

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % rotationViews.length;
      setCurrentRotationView(rotationViews[currentIndex]);
    }, 10000); // 10 seconds

    setRotationInterval(interval);
  };

  const stopRotation = () => {
    if (rotationInterval) {
      clearInterval(rotationInterval);
      setRotationInterval(null);
    }
    setIsRotationActive(false);
    setCurrentRotationView(RotationView.FULL_VIEW);
  };

  const selectView = (view: RotationView) => {
    if (rotationInterval) {
      clearInterval(rotationInterval);
      setRotationInterval(null);
    }
    setIsRotationActive(false);
    setCurrentRotationView(view);
  };

  // Clean up rotation interval on unmount
  useEffect(() => {
    return () => {
      if (rotationInterval) {
        clearInterval(rotationInterval);
      }
    };
  }, [rotationInterval]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize production tracking
  useEffect(() => {
    const productionService = ProductionTrackingService.getInstance();

    const unsubscribe = productionService.subscribe(
      (summary: ProductionSummary) => {
        setProductionSummary(summary);
        setLoading(false);
      }
    );

    productionService.startTracking();

    return () => {
      unsubscribe();
      productionService.stopTracking();
    };
  }, []);

  // Initialize classification service and listen for updates
  useEffect(() => {
    const initializeClassificationService = async () => {
      try {
        console.log(
          "🏭 [Daily Dashboard] Initializing classification service..."
        );
        await productClassificationService.waitForInitialization();
        console.log(
          "🏭 [Daily Dashboard] ✅ Classification service initialized successfully"
        );

        // Log current classification state for debugging
        const stats = productClassificationService.getStats();
        console.log("🏭 [Daily Dashboard] Classification stats:", stats);
      } catch (error) {
        console.error(
          "🏭 [Daily Dashboard] ❌ Error initializing classification service:",
          error
        );
      }
    };

    initializeClassificationService();

    // Subscribe to classification updates to refresh data when classifications change
    const unsubscribe = productClassificationService.subscribe(() => {
      console.log(
        "🔄 [Daily Dashboard] Classifications updated, refreshing data..."
      );
      const stats = productClassificationService.getStats();
      console.log("🔄 [Daily Dashboard] New classification stats:", stats);

      // Force re-computation of hourly data by updating production summary
      if (productionSummary) {
        setProductionSummary({ ...productionSummary });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [productionSummary]);

  // Fetch additional data
  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const today = new Date();
        const localTodayStr =
          today.getFullYear() +
          "-" +
          String(today.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(today.getDate()).padStart(2, "0");

        // Fetch segregation data
        const segregationQuery = query(
          collection(db, "segregation_done_logs"),
          where("date", "==", localTodayStr)
        );
        const segregationSnapshot = await getDocs(segregationQuery);

        let segWeight = 0;
        segregationSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          segWeight += Number(data.weight) || 0;
        });

        setSegregatedClientsToday(segregationSnapshot.docs.length);
        setTotalSegregatedWeight(segWeight);

        // Fetch pickup data
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { Timestamp } = await import("firebase/firestore");
        const pickupQuery = query(
          collection(db, "pickup_entries"),
          where("timestamp", ">=", Timestamp.fromDate(today)),
          where("timestamp", "<", Timestamp.fromDate(tomorrow))
        );

        const pickupSnapshot = await getDocs(pickupQuery);
        let pickupWeight = 0;

        pickupSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          pickupWeight += Number(data.weight) || 0;
        });

        setPickupEntriesToday(pickupSnapshot.docs.length);
        setTotalPickupWeight(pickupWeight);
      } catch (error) {
        console.error("Error fetching daily data:", error);
      }
    };

    fetchDailyData();
  }, []);

  // Fetch hourly Doblado production data
  useEffect(() => {
    const fetchHourlyDobladoData = async () => {
      if (
        !productionSummary?.allEntriesToday &&
        !productionSummary?.recentEntries
      )
        return;

      // Ensure classification service is initialized
      try {
        await productClassificationService.waitForInitialization();
      } catch (error) {
        console.log(
          "🔍 [Hourly Doblado] Classification service failed to initialize, skipping",
          error
        );
        return;
      }

      const entries =
        productionSummary.allEntriesToday || productionSummary.recentEntries;
      const hourlyData: { [hour: number]: number } = {};

      // Process entries for Doblado items only using centralized service
      entries.forEach((entry) => {
        if (
          productClassificationService.getClassification(entry.productName) ===
          "Doblado"
        ) {
          const hour = entry.addedAt.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + entry.quantity;
        }
      });

      console.log("🔍 [Hourly Doblado] Classification results:", {
        totalEntries: entries.length,
        dobladoHours: Object.keys(hourlyData).length,
        dobladoTotalUnits: Object.values(hourlyData).reduce(
          (sum, units) => sum + units,
          0
        ),
        hourlyBreakdown: hourlyData,
      });

      setHourlyDobladoData(hourlyData);
    };

    fetchHourlyDobladoData();
  }, [productionSummary]);

  // Fetch hourly Mangle production data
  useEffect(() => {
    const fetchHourlyMangleData = async () => {
      if (
        !productionSummary?.allEntriesToday &&
        !productionSummary?.recentEntries
      )
        return;

      // Ensure classification service is initialized
      try {
        await productClassificationService.waitForInitialization();
      } catch (error) {
        console.log(
          "🔍 [Hourly Mangle] Classification service failed to initialize, skipping",
          error
        );
        return;
      }

      const entries =
        productionSummary.allEntriesToday || productionSummary.recentEntries;
      const hourlyData: { [hour: number]: number } = {};

      // Process entries for Mangle items only using centralized service
      entries.forEach((entry) => {
        if (
          productClassificationService.getClassification(entry.productName) ===
          "Mangle"
        ) {
          const hour = entry.addedAt.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + entry.quantity;
        }
      });

      console.log("🔍 [Hourly Mangle] Classification results:", {
        totalEntries: entries.length,
        mangleHours: Object.keys(hourlyData).length,
        mangleTotalUnits: Object.values(hourlyData).reduce(
          (sum, units) => sum + units,
          0
        ),
        hourlyBreakdown: hourlyData,
      });

      setHourlyMangleData(hourlyData);
    };

    fetchHourlyMangleData();
  }, [productionSummary]);

  // Fetch hourly segregation data
  useEffect(() => {
    const fetchHourlySegregationData = async () => {
      try {
        const today = new Date();
        const localTodayStr =
          today.getFullYear() +
          "-" +
          String(today.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(today.getDate()).padStart(2, "0");

        const segregationQuery = query(
          collection(db, "segregation_done_logs"),
          where("date", "==", localTodayStr)
        );

        const segregationSnapshot = await getDocs(segregationQuery);
        const hourlyData: { [hour: number]: number } = {};

        segregationSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const weight = Number(data.weight) || 0;
          const timestamp = data.timestamp;

          let timestampDate;
          if (timestamp && timestamp.toDate) {
            timestampDate = timestamp.toDate();
          } else if (timestamp) {
            timestampDate = new Date(timestamp);
          } else {
            return;
          }

          const hour = timestampDate.getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + weight;
        });

        setHourlySegregationData(hourlyData);
      } catch (error) {
        console.error("Error fetching hourly segregation data:", error);
      }
    };

    fetchHourlySegregationData();
  }, []);

  // Calculate current production rates based on area-specific duration calculations
  const currentProductionRates = useMemo(() => {
    if (
      !productionSummary ||
      (!productionSummary.allEntriesToday?.length &&
        !productionSummary.recentEntries?.length)
    ) {
      return {
        mangleRate: 0,
        dobladoRate: 0,
        segregationRate: 0,
        mangleHoursElapsed: 0,
        dobladoHoursElapsed: 0,
        segregationHoursElapsed: 0,
        totalMangleProduction: 0,
        totalDobladoProduction: 0,
        totalSegregationProduction: totalSegregatedWeight,
      };
    }

    const entries =
      productionSummary.allEntriesToday || productionSummary.recentEntries;

    // Debug logging to verify data source
    console.log("🔍 [Daily Dashboard] Production data source:", {
      usingAllEntriesToday: !!productionSummary.allEntriesToday,
      allEntriesTodayCount: productionSummary.allEntriesToday?.length || 0,
      recentEntriesCount: productionSummary.recentEntries?.length || 0,
      totalEntriesUsed: entries.length,
      totalUnitsFromEntries: entries.reduce((sum, e) => sum + e.quantity, 0),
    });

    if (entries.length === 0) {
      return {
        mangleRate: 0,
        dobladoRate: 0,
        segregationRate: 0,
        mangleHoursElapsed: 0,
        dobladoHoursElapsed: 0,
        segregationHoursElapsed: 0,
        totalMangleProduction: 0,
        totalDobladoProduction: 0,
        totalSegregationProduction: totalSegregatedWeight,
      };
    }

    // Helper function to parse time string to today's date
    const parseTimeToToday = (timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);
      return today;
    };

    // Get configured start times for each area
    const mangleStartDate = parseTimeToToday(mangleStartTime);
    const dobladoStartDate = parseTimeToToday(dobladoStartTime);
    const segregationStartDate = parseTimeToToday(segregationStartTime);

    // Separate entries by area and find last item time for each area
    let mangleEntries: ProductionEntry[] = [];
    let dobladoEntries: ProductionEntry[] = [];
    let totalMangleProduction = 0;
    let totalDobladoProduction = 0;

    entries.forEach((entry) => {
      const classification = productClassificationService.getClassification(
        entry.productName
      );
      if (classification === "Mangle") {
        mangleEntries.push(entry);
        totalMangleProduction += entry.quantity;
      } else {
        dobladoEntries.push(entry);
        totalDobladoProduction += entry.quantity;
      }
    });

    // Debug classification results
    console.log("🔍 [Daily Dashboard] Classification results:", {
      totalEntries: entries.length,
      mangleEntries: mangleEntries.length,
      dobladoEntries: dobladoEntries.length,
      totalMangleProduction,
      totalDobladoProduction,
      totalFromBoth: totalMangleProduction + totalDobladoProduction,
      sampleClassifications: entries.slice(0, 5).map((e) => ({
        product: e.productName,
        quantity: e.quantity,
        classification: productClassificationService.getClassification(
          e.productName
        ),
      })),
    });

    // Calculate area-specific durations
    let mangleDurationHours = 0;
    let dobladoDurationHours = 0;
    let segregationDurationHours = 0;

    // Mangle duration: configured start time → last Mangle item time
    if (mangleEntries.length > 0) {
      const sortedMangleEntries = [...mangleEntries].sort(
        (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
      );
      const lastMangleItem =
        sortedMangleEntries[sortedMangleEntries.length - 1];
      const mangleDurationMs =
        lastMangleItem.addedAt.getTime() - mangleStartDate.getTime();
      mangleDurationHours = Math.max(mangleDurationMs / (1000 * 60 * 60), 0.5); // Minimum 30 minutes
    }

    // Doblado duration: configured start time → last Doblado item time
    if (dobladoEntries.length > 0) {
      const sortedDobladoEntries = [...dobladoEntries].sort(
        (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
      );
      const lastDobladoItem =
        sortedDobladoEntries[sortedDobladoEntries.length - 1];
      const dobladoDurationMs =
        lastDobladoItem.addedAt.getTime() - dobladoStartDate.getTime();
      dobladoDurationHours = Math.max(
        dobladoDurationMs / (1000 * 60 * 60),
        0.5
      ); // Minimum 30 minutes
    }

    // Segregation duration: for now, use the configured segregation start time and current time
    // TODO: In the future, this could use the actual last segregation item timestamp
    if (totalSegregatedWeight > 0) {
      const currentTime = new Date();
      const segregationDurationMs =
        currentTime.getTime() - segregationStartDate.getTime();
      segregationDurationHours = Math.max(
        segregationDurationMs / (1000 * 60 * 60),
        0.5
      ); // Minimum 30 minutes
    }

    // Calculate area-specific rates
    const mangleRate =
      mangleDurationHours > 0 ? totalMangleProduction / mangleDurationHours : 0;
    const dobladoRate =
      dobladoDurationHours > 0
        ? totalDobladoProduction / dobladoDurationHours
        : 0;
    const segregationRate =
      segregationDurationHours > 0
        ? totalSegregatedWeight / segregationDurationHours
        : 0;

    return {
      mangleRate: Math.round(mangleRate),
      dobladoRate: Math.round(dobladoRate),
      segregationRate: Math.round(segregationRate),
      mangleHoursElapsed: mangleDurationHours, // Area-specific duration
      dobladoHoursElapsed: dobladoDurationHours, // Area-specific duration
      segregationHoursElapsed: segregationDurationHours, // Area-specific duration
      totalMangleProduction,
      totalDobladoProduction,
      totalSegregationProduction: totalSegregatedWeight,
    };
  }, [
    productionSummary,
    totalSegregatedWeight,
    mangleStartTime,
    dobladoStartTime,
    segregationStartTime,
  ]);

  // Generate chart data for Doblado
  const dobladoChartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map((hour) => hourlyDobladoData[hour] || 0);

    return {
      labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      datasets: [
        {
          label: "Doblado Units/Hour",
          data: data,
          backgroundColor: "rgba(255, 193, 7, 0.7)",
          borderColor: "rgba(255, 193, 7, 1)",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    };
  }, [hourlyDobladoData]);

  // Generate chart data for Mangle
  const mangleChartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map((hour) => hourlyMangleData[hour] || 0);

    return {
      labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      datasets: [
        {
          label: "Mangle Units/Hour",
          data: data,
          backgroundColor: "rgba(17, 153, 142, 0.7)",
          borderColor: "rgba(17, 153, 142, 1)",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    };
  }, [hourlyMangleData]);

  // Generate chart data for Segregation
  const segregationChartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map((hour) => hourlySegregationData[hour] || 0);

    return {
      labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
      datasets: [
        {
          label: "Segregation Weight (lbs)/Hour",
          data: data,
          backgroundColor: "rgba(23, 162, 184, 0.7)",
          borderColor: "rgba(23, 162, 184, 1)",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    };
  }, [hourlySegregationData]);

  // Chart options
  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            size: 14,
            weight: "bold",
          },
          color: "black",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: "black",
          font: {
            size: 12,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0,0,0,0.1)",
        },
      },
      x: {
        ticks: {
          color: "black",
          font: {
            size: 11,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0,0,0,0.1)",
        },
      },
    },
  };

  // Calculate daily statistics
  const dailyStats = useMemo((): DailyStats | null => {
    if (
      !productionSummary ||
      (!productionSummary.allEntriesToday?.length &&
        !productionSummary.recentEntries?.length)
    ) {
      return null;
    }

    // Note: Since this is in a useMemo, we cannot use async/await here.
    // The classification service initialization should be handled in useEffect above.
    // For now, we'll check if the service appears to be ready by testing a basic call
    try {
      // Test if the service is ready by making a test call
      productClassificationService.getClassification("test");
    } catch (error) {
      console.log(
        "🔍 [Daily Stats] Classification service not yet initialized, skipping calculation"
      );
      return null;
    }

    // Use data directly from ProductionTrackingService instead of recalculating
    const entries =
      productionSummary.allEntriesToday || productionSummary.recentEntries;

    console.log("🔍 [Daily Stats] Using ProductionTrackingService data:", {
      totalItemsFromService: productionSummary.totalItemsAdded,
      entriesCount: entries.length,
      hourlyBreakdownKeys: Object.keys(productionSummary.hourlyBreakdown || {}),
      currentHourRateFromService: productionSummary.currentHourRate,
    });

    const sortedEntries = [...entries].sort(
      (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
    );

    // Use service data where possible, only calculate what's not available
    const totalUnits = productionSummary.totalItemsAdded; // From service
    const totalItems = entries.length;
    const uniqueClients = new Set(entries.map((entry) => entry.clientId)).size;

    // Use classification service for mangle/doblado breakdown
    let mangleUnits = 0;
    let dobladoUnits = 0;
    entries.forEach((entry) => {
      const classification = productClassificationService.getClassification(
        entry.productName
      );
      if (classification === "Mangle") {
        mangleUnits += entry.quantity;
      } else {
        dobladoUnits += entry.quantity;
      }
    });

    console.log("🔍 [Daily Stats] Classification breakdown:", {
      totalUnits,
      mangleUnits,
      dobladoUnits,
      manglePercentage:
        totalUnits > 0 ? ((mangleUnits / totalUnits) * 100).toFixed(1) : 0,
      dobladoPercentage:
        totalUnits > 0 ? ((dobladoUnits / totalUnits) * 100).toFixed(1) : 0,
      sampleClassifications: entries.slice(0, 5).map((e) => ({
        product: e.productName,
        quantity: e.quantity,
        classification: productClassificationService.getClassification(
          e.productName
        ),
      })),
    });

    console.log("🔍 [Daily Stats] Using service vs calculated:", {
      totalUnitsFromService: productionSummary.totalItemsAdded,
      totalUnitsCalculated: entries.reduce(
        (sum, entry) => sum + entry.quantity,
        0
      ),
      usingServiceValue: true,
    });

    // Use hourly data from service
    const hourlyBreakdown = productionSummary.hourlyBreakdown || {};
    const hourlyRates = Object.values(hourlyBreakdown);
    const peakHourRate = Math.max(...hourlyRates, 0);

    // Use service's current hour rate instead of recalculating
    const averageHourRate = productionSummary.currentHourRate || 0;

    // Calculate production span (this is specific to the dashboard view)
    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const productionSpanMs =
      lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);

    return {
      totalUnits,
      mangleUnits,
      dobladoUnits,
      totalItems,
      uniqueClients,
      averageHourRate, // Now using service's currentHourRate
      peakHourRate,
      productionSpanHours,
      firstEntryTime: firstEntry.addedAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      lastEntryTime: lastEntry.addedAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      segregatedClients: segregatedClientsToday,
      segregatedWeight: totalSegregatedWeight,
      pickupEntries: pickupEntriesToday,
      pickupWeight: totalPickupWeight,
    };
  }, [
    productionSummary,
    segregatedClientsToday,
    totalSegregatedWeight,
    pickupEntriesToday,
    totalPickupWeight,
  ]);

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading daily dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dailyStats) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center">
          <div className="alert alert-info">
            <h4>🌅 Ready to Start the Day!</h4>
            <p>No production activity recorded yet today. Let's get started!</p>
          </div>
        </div>
      </div>
    );
  }

  // Render functions for different rotation views
  const renderHeader = () => (
    <div className="row mb-4">
      <div className="col-12">
        <div
          className="card border shadow-sm"
          style={{ borderRadius: "8px" }}
        >
          <div
            className="card-body text-center py-4 bg-white text-dark"
            style={{
              borderRadius: "8px",
            }}
          >
            <h1
              className="text-dark mb-2"
              style={{
                fontWeight: "600",
                fontSize: "2rem",
              }}
            >
              Daily Production Dashboard
            </h1>
            <h2
              className="text-muted mb-2"
              style={{
                fontSize: "1.2rem",
                fontWeight: "400",
              }}
            >
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h2>
            <div className="d-flex justify-content-center align-items-center">
              <div className="bg-light rounded-pill px-4 py-2">
                <h3
                  className="text-dark mb-0"
                  style={{
                    fontFamily: "monospace",
                    fontSize: "2rem",
                  }}
                >
                  <i className="fas fa-clock me-2"></i>
                  {currentTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRotationControls = () => (
    <div className="row mb-3">
      <div className="col-12">
        <div
          className="card border-0 shadow-lg"
          style={{ borderRadius: "15px" }}
        >
          <div
            className="card-body py-3"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "15px",
            }}
          >
            <div className="row align-items-center">
              <div className="col-lg-6 col-md-12 mb-2 mb-lg-0">
                <div className="d-flex align-items-center justify-content-center justify-content-lg-start">
                  <h6
                    className="mb-0 me-3"
                    style={{ color: "#2C3E50", fontWeight: "600" }}
                  >
                    <i className="fas fa-tv me-2"></i>
                    Wall Display Mode:
                  </h6>
                  {isRotationActive ? (
                    <button
                      className="btn btn-danger btn-sm me-2"
                      onClick={stopRotation}
                      style={{ borderRadius: "20px" }}
                    >
                      <i className="fas fa-stop me-2"></i>
                      Stop Rotation
                    </button>
                  ) : (
                    <button
                      className="btn btn-success btn-sm me-2"
                      onClick={startRotation}
                      style={{ borderRadius: "20px" }}
                    >
                      <i className="fas fa-play me-2"></i>
                      Start Rotation
                    </button>
                  )}
                  {isRotationActive && (
                    <span
                      className="badge bg-primary"
                      style={{ borderRadius: "20px" }}
                    >
                      <i
                        className="fas fa-sync-alt me-1"
                        style={{ animation: "spin 2s linear infinite" }}
                      ></i>
                      Auto-cycling every 10s
                    </span>
                  )}
                </div>
              </div>
              <div className="col-lg-6 col-md-12">
                <div className="btn-group w-100" role="group">
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.FULL_VIEW
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.FULL_VIEW)}
                    style={{
                      borderRadius: "20px 0 0 20px",
                      fontSize: "0.8rem",
                    }}
                  >
                    Full
                  </button>
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.MAIN_STATS
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.MAIN_STATS)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    Stats
                  </button>
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.SECONDARY_STATS
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.SECONDARY_STATS)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    Details
                  </button>
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.PROGRESS_SECTION
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.PROGRESS_SECTION)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    Progress
                  </button>
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.PRODUCTION_CHARTS
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.PRODUCTION_CHARTS)}
                    style={{ fontSize: "0.8rem" }}
                  >
                    Charts
                  </button>
                  <button
                    className={`btn btn-sm ${
                      currentRotationView === RotationView.END_OF_SHIFT
                        ? "btn-dark"
                        : "btn-outline-dark"
                    }`}
                    onClick={() => selectView(RotationView.END_OF_SHIFT)}
                    style={{
                      borderRadius: "0 20px 20px 0",
                      fontSize: "0.8rem",
                    }}
                  >
                    End Shift
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainStats = () => (
    <div className="row mb-4">
      {/* Total Production */}
      <div className="col-lg-3 col-md-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <div
            className="card-body text-center py-4 bg-primary text-white"
            style={{
              borderRadius: "8px",
            }}
          >
            <h1
              className="mb-2 text-white"
              style={{
                fontSize: "2.5rem",
                fontWeight: "700",
              }}
            >
              {dailyStats.totalUnits.toLocaleString()}
            </h1>
            <h5 className="mb-2 text-white">Total Units Produced</h5>
            <div className="bg-white bg-opacity-20 rounded-pill px-3 py-1">
              <small className="text-white" style={{ opacity: "0.9" }}>
                <i className="fas fa-clock me-1"></i>
                {dailyStats.firstEntryTime} - {dailyStats.lastEntryTime}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Mangle Production */}
      <div className="col-lg-3 col-md-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <div
            className="card-body text-center py-4 bg-white text-dark"
            style={{
              borderRadius: "8px",
            }}
          >
            <h1
              className="mb-2 text-dark"
              style={{
                fontSize: "2.5rem",
                fontWeight: "700",
              }}
            >
              {dailyStats.mangleUnits.toLocaleString()}
            </h1>
            <h5 className="mb-2 text-muted">Mangle Units</h5>
            <div className="bg-light rounded-pill px-3 py-1">
              <small className="text-muted">
                <i className="fas fa-percentage me-1"></i>
                {dailyStats.totalUnits > 0
                  ? (
                      (dailyStats.mangleUnits / dailyStats.totalUnits) *
                      100
                    ).toFixed(1)
                  : 0}
                % of total
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Doblado Production */}
      <div className="col-lg-3 col-md-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <div
            className="card-body text-center py-4 bg-white text-dark"
            style={{
              borderRadius: "8px",
            }}
          >
            <h1
              className="mb-2 text-dark"
              style={{
                fontSize: "2.5rem",
                fontWeight: "700",
              }}
            >
              {dailyStats.dobladoUnits.toLocaleString()}
            </h1>
            <h5 className="mb-2 text-muted">Doblado Units</h5>
            <div className="bg-light rounded-pill px-3 py-1">
              <small className="text-muted">
                <i className="fas fa-percentage me-1"></i>
                {dailyStats.totalUnits > 0
                  ? (
                      (dailyStats.dobladoUnits / dailyStats.totalUnits) *
                      100
                    ).toFixed(1)
                  : 0}
                % of total
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Average Rate per Hour */}
      <div className="col-lg-3 col-md-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            transition: "all 0.2s ease",
          }}
        >
          <div
            className="card-body text-center py-4 bg-white text-dark"
            style={{
              borderRadius: "8px",
            }}
          >
            <h1
              className="mb-2 text-dark"
              style={{
                fontSize: "2.5rem",
                fontWeight: "700",
              }}
            >
              {Math.round(dailyStats.averageHourRate)}
            </h1>
            <h5 className="mb-2 text-muted">AVG Rate per Hour</h5>
            <div className="bg-light rounded-pill px-3 py-1">
              <small className="text-muted">
                <i className="fas fa-clock me-1"></i>
                Over {Math.floor(dailyStats.productionSpanHours)}h{" "}
                {Math.floor((dailyStats.productionSpanHours % 1) * 60)}m
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecondaryStats = () => (
    <div className="row mb-4">
      {/* Total Items */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {dailyStats.totalItems.toLocaleString()}
            </h3>
            <small className="text-muted fw-bold">Total Items</small>
          </div>
        </div>
      </div>

      {/* Unique Clients */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {dailyStats.uniqueClients}
            </h3>
            <small className="text-muted fw-bold">Unique Clients</small>
          </div>
        </div>
      </div>

      {/* Peak Hour Rate */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {Math.round(dailyStats.peakHourRate)}
            </h3>
            <small className="text-muted fw-bold">Peak Hour Rate</small>
          </div>
        </div>
      </div>

      {/* Segregated Clients */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {dailyStats.segregatedClients}
            </h3>
            <small className="text-muted fw-bold">Segregated Clients</small>
          </div>
        </div>
      </div>

      {/* Segregated Weight */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {dailyStats.segregatedWeight.toLocaleString()}
            </h3>
            <small className="text-muted fw-bold">lbs Segregated</small>
          </div>
        </div>
      </div>

      {/* Pickups */}
      <div className="col-lg-2 col-md-4 col-6 mb-3">
        <div
          className="card border shadow-sm h-100"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body text-center py-3">
            <h3
              className="mb-1 text-dark"
              style={{ fontWeight: "700" }}
            >
              {dailyStats.pickupEntries}
            </h3>
            <small className="text-muted fw-bold">Pickups</small>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProgressSection = () => (
    <div className="row mb-4">
      <div className="col-12">
        <div
          className="card border shadow-sm"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-4">
              <h4
                className="mb-0 text-dark"
                style={{ fontWeight: "600" }}
              >
                Production Breakdown
              </h4>
            </div>

            <div className="row align-items-center">
              <div className="col-lg-8 mb-3">
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Mangle Production</h6>
                  <div
                    className="progress mb-2"
                    style={{
                      height: "30px",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      className="progress-bar bg-success d-flex align-items-center justify-content-center"
                      style={{
                        width: `${
                          dailyStats?.totalUnits > 0
                            ? (dailyStats.mangleUnits / dailyStats.totalUnits) *
                              100
                            : 0
                        }%`,
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      {dailyStats?.mangleUnits.toLocaleString()} units
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Doblado Production</h6>
                  <div
                    className="progress mb-2"
                    style={{
                      height: "30px",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      className="progress-bar bg-info d-flex align-items-center justify-content-center"
                      style={{
                        width: `${
                          dailyStats?.totalUnits > 0
                            ? (dailyStats.dobladoUnits / dailyStats.totalUnits) *
                              100
                            : 0
                        }%`,
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      {dailyStats?.dobladoUnits.toLocaleString()} units
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-4">
                <div
                  className="text-center p-4 bg-light border rounded"
                  style={{
                    borderRadius: "8px",
                  }}
                >
                  <h2
                    className="mb-1 text-dark"
                    style={{
                      fontWeight: "700",
                    }}
                  >
                    {Math.floor(dailyStats?.productionSpanHours || 0)}h{" "}
                    {Math.floor(
                      ((dailyStats?.productionSpanHours || 0) % 1) * 60
                    )}
                    m
                  </h2>
                  <small className="text-muted fw-bold">
                    Active Production Time
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductionCharts = () => (
    <div className="row mb-4">
      <div className="col-12">
        <div
          className="card border shadow-sm"
          style={{
            borderRadius: "8px",
            background: "#ffffff",
          }}
        >
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <h3
                className="mb-2 text-dark"
                style={{
                  fontWeight: "600",
                }}
              >
                Hourly Production Charts
              </h3>
              <p className="mb-0 text-muted">
                Production tracking by hour for Mangle, Doblado, and Segregation
              </p>
            </div>

            <div className="row">
              {/* Mangle Hourly Chart */}
              <div className="col-lg-4 col-md-12 mb-4">
                <div
                  className="card border"
                  style={{
                    borderRadius: "8px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    className="card-header text-center bg-white"
                    style={{
                      border: "none",
                      borderBottom: "1px solid #dee2e6",
                    }}
                  >
                    <h5 className="mb-0 text-dark" style={{ fontWeight: "600" }}>
                      <i className="fas fa-compress-arrows-alt text-success me-2"></i>
                      Mangle Production
                    </h5>
                  </div>
                  <div
                    className="card-body"
                    style={{ height: "300px", padding: "20px" }}
                  >
                    <Bar data={mangleChartData} options={chartOptions} />
                  </div>
                  <div
                    className="card-footer bg-success text-white text-center"
                    style={{
                      border: "none",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0 fw-bold">
                          <i className="fas fa-tachometer-alt me-2"></i>
                          {currentProductionRates.mangleRate}/hr
                        </h5>
                        <small className="opacity-75">Current Rate</small>
                      </div>
                      <div className="text-end">
                        <h6 className="mb-0">
                          {currentProductionRates.totalMangleProduction.toLocaleString()}
                        </h6>
                        <small className="opacity-75">Total Units</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doblado Hourly Chart */}
              <div className="col-lg-4 col-md-12 mb-4">
                <div
                  className="card border"
                  style={{
                    borderRadius: "8px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    className="card-header text-center bg-white"
                    style={{
                      border: "none",
                      borderBottom: "1px solid #dee2e6",
                    }}
                  >
                    <h5 className="mb-0 text-dark" style={{ fontWeight: "600" }}>
                      <i className="fas fa-hands text-primary me-2"></i>
                      Doblado Production
                    </h5>
                  </div>
                  <div
                    className="card-body"
                    style={{ height: "300px", padding: "20px" }}
                  >
                    <Bar data={dobladoChartData} options={chartOptions} />
                  </div>
                  <div
                    className="card-footer bg-primary text-white text-center"
                    style={{
                      border: "none",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0 fw-bold">
                          <i className="fas fa-tachometer-alt me-2"></i>
                          {currentProductionRates.dobladoRate}/hr
                        </h5>
                        <small className="opacity-75">Current Rate</small>
                      </div>
                      <div className="text-end">
                        <h6 className="mb-0">
                          {currentProductionRates.totalDobladoProduction.toLocaleString()}
                        </h6>
                        <small className="opacity-75">Total Units</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Segregation Hourly Chart */}
              <div className="col-lg-4 col-md-12 mb-4">
                <div
                  className="card border"
                  style={{
                    borderRadius: "8px",
                    background: "#ffffff",
                  }}
                >
                  <div
                    className="card-header text-center bg-white"
                    style={{
                      border: "none",
                      borderBottom: "1px solid #dee2e6",
                    }}
                  >
                    <h5 className="mb-0 text-dark" style={{ fontWeight: "600" }}>
                      <i className="fas fa-tasks text-info me-2"></i>
                      Segregation
                    </h5>
                  </div>
                  <div
                    className="card-body"
                    style={{ height: "300px", padding: "20px" }}
                  >
                    <Bar data={segregationChartData} options={chartOptions} />
                  </div>
                  <div
                    className="card-footer bg-info text-white text-center"
                    style={{
                      border: "none",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="mb-0 fw-bold">
                          <i className="fas fa-tachometer-alt me-2"></i>
                          {currentProductionRates.segregationRate} lbs/hr
                        </h5>
                        <small className="opacity-75">Current Rate</small>
                      </div>
                      <div className="text-end">
                        <h6 className="mb-0">
                          {currentProductionRates.totalSegregationProduction.toLocaleString()}{" "}
                          lbs
                        </h6>
                        <small className="opacity-75">Total Weight</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndOfShiftDashboard = () => (
    <div className="row mb-4">
      <div className="col-12">
        <EndOfShiftDashboard className="shadow-lg border-0" />
      </div>
    </div>
  );

  return (
    <>
      <style>{animationStyles}</style>
      <div
        className="container-fluid py-3"
        style={{
          background: "#f8f9fa",
          minHeight: "100vh",
          position: "relative",
        }}
      >
        {/* Always show header and rotation controls */}
        {renderHeader()}
        {renderRotationControls()}

        {/* Conditional rendering based on rotation view */}
        {currentRotationView === RotationView.FULL_VIEW && (
          <>
            {renderMainStats()}
            {renderSecondaryStats()}
            {renderProgressSection()}
            {renderProductionCharts()}
            {renderEndOfShiftDashboard()}
          </>
        )}

        {currentRotationView === RotationView.MAIN_STATS && (
          <>{renderMainStats()}</>
        )}

        {currentRotationView === RotationView.SECONDARY_STATS && (
          <>{renderSecondaryStats()}</>
        )}

        {currentRotationView === RotationView.PROGRESS_SECTION && (
          <>{renderProgressSection()}</>
        )}

        {currentRotationView === RotationView.PRODUCTION_CHARTS && (
          <>{renderProductionCharts()}</>
        )}

        {currentRotationView === RotationView.END_OF_SHIFT && (
          <>{renderEndOfShiftDashboard()}</>
        )}
      </div>
    </>
  );
};

export default DailyEmployeeDashboard;

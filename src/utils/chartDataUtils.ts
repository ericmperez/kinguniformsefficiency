// Chart data preparation utilities
import { generateColors, chartColors } from './chartConfig';
import type { Invoice, Client, Product } from '../types';

// Interface for analytics data
interface DailyAnalytics {
  date: string;
  totalInvoices: number;
  totalClients: number;
  totalWeight: number;
  totalItems: number;
  totalCarts: number;
  totalRevenue: number;
  avgItemsPerInvoice: number;
  avgWeightPerInvoice: number;
  avgRevenuePerInvoice: number;
  clientBreakdown: {
    [clientId: string]: {
      clientName: string;
      invoiceCount: number;
      totalWeight: number;
      totalItems: number;
      totalCarts: number;
      totalRevenue: number;
    };
  };
  productBreakdown: {
    [productName: string]: {
      totalQuantity: number;
      totalRevenue: number;
      invoiceCount: number;
    };
  };
  statusBreakdown: {
    active: number;
    completed: number;
    verified: number;
    shipped: number;
  };
}

// Prepare trend line chart data for multiple metrics over time
export const prepareTrendData = (rangeAnalytics: DailyAnalytics[]) => {
  const labels = rangeAnalytics.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return {
    labels,
    datasets: [
      {
        label: 'Invoices',
        data: rangeAnalytics.map(day => day.totalInvoices),
        borderColor: chartColors.primary,
        backgroundColor: chartColors.primary + '20',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Revenue ($)',
        data: rangeAnalytics.map(day => day.totalRevenue),
        borderColor: chartColors.success,
        backgroundColor: chartColors.success + '20',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
      },
      {
        label: 'Weight (lbs)',
        data: rangeAnalytics.map(day => day.totalWeight),
        borderColor: chartColors.warning,
        backgroundColor: chartColors.warning + '20',
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };
};

// Prepare revenue trend data with area fill
export const prepareRevenueTrendData = (rangeAnalytics: DailyAnalytics[]) => {
  const labels = rangeAnalytics.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return {
    labels,
    datasets: [
      {
        label: 'Daily Revenue',
        data: rangeAnalytics.map(day => day.totalRevenue),
        borderColor: chartColors.success,
        backgroundColor: chartColors.success + '30',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: chartColors.success,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };
};

// Prepare client distribution pie chart data
export const prepareClientDistributionData = (analytics: DailyAnalytics) => {
  const clientData = Object.values(analytics.clientBreakdown)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 8); // Top 8 clients

  const labels = clientData.map(client => client.clientName);
  const data = clientData.map(client => client.totalRevenue);
  const colors = generateColors(labels.length);

  return {
    labels,
    datasets: [
      {
        label: 'Revenue by Client',
        data,
        backgroundColor: colors,
        borderColor: colors.map((color: string) => color.replace('0.8', '1')),
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };
};

// Prepare product performance bar chart data
export const prepareProductPerformanceData = (analytics: DailyAnalytics) => {
  const productData = Object.entries(analytics.productBreakdown)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10); // Top 10 products

  const labels = productData.map(product => 
    product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name
  );
  const quantities = productData.map(product => product.totalQuantity);
  const revenues = productData.map(product => product.totalRevenue);

  return {
    labels,
    datasets: [
      {
        label: 'Quantity',
        data: quantities,
        backgroundColor: chartColors.primary + '80',
        borderColor: chartColors.primary,
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: 'Revenue ($)',
        data: revenues,
        backgroundColor: chartColors.success + '80',
        borderColor: chartColors.success,
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };
};

// Prepare client performance horizontal bar chart data
export const prepareClientPerformanceData = (analytics: DailyAnalytics) => {
  const clientData = Object.values(analytics.clientBreakdown)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10); // Top 10 clients

  const labels = clientData.map(client => 
    client.clientName.length > 20 ? client.clientName.substring(0, 20) + '...' : client.clientName
  );
  const revenues = clientData.map(client => client.totalRevenue);
  const invoices = clientData.map(client => client.invoiceCount);

  const colors = generateColors(labels.length, 0.8);

  return {
    labels,
    datasets: [
      {
        label: 'Revenue ($)',
        data: revenues,
        backgroundColor: colors,
        borderColor: colors.map((color: string) => color.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  };
};

// Prepare status breakdown doughnut chart data
export const prepareStatusBreakdownData = (analytics: DailyAnalytics) => {
  const statusData = analytics.statusBreakdown;
  const labels = ['Active', 'Completed', 'Verified', 'Shipped'];
  const data = [statusData.active, statusData.completed, statusData.verified, statusData.shipped];
  
  const colors = [
    chartColors.warning,    // Active - Orange
    chartColors.info,       // Completed - Blue
    chartColors.success,    // Verified - Green
    chartColors.dark,       // Shipped - Dark
  ];

  return {
    labels,
    datasets: [
      {
        label: 'Invoice Status',
        data,
        backgroundColor: colors.map(color => color + '80'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
};

// Prepare heat map data for operational patterns (hours vs days)
export const prepareOperationalHeatMapData = (invoices: Invoice[]) => {
  // Create a 7x24 grid for days of week vs hours of day
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0') + ':00'
  );

  // Initialize heat map data
  const heatMapData: Array<{ x: number; y: number; value: number }> = [];
  
  // Count invoices by day of week and hour
  const counts: { [key: string]: number } = {};
  
  invoices.forEach(invoice => {
    if (invoice.date) {
      const date = new Date(invoice.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  // Convert to heat map format
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const value = counts[key] || 0;
      heatMapData.push({
        x: hour,
        y: day,
        value,
      });
    }
  }

  return {
    data: heatMapData,
    xLabels: hours.filter((_, i) => i % 4 === 0), // Show every 4th hour
    yLabels: daysOfWeek,
  };
};

// Prepare monthly comparison data
export const prepareMonthlyComparisonData = (rangeAnalytics: DailyAnalytics[]) => {
  // Group by month
  const monthlyData: { [month: string]: DailyAnalytics[] } = {};
  
  rangeAnalytics.forEach(day => {
    const date = new Date(day.date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = [];
    }
    monthlyData[monthKey].push(day);
  });

  const labels = Object.keys(monthlyData).map(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

  const invoicesData = Object.values(monthlyData).map(days => 
    days.reduce((sum, day) => sum + day.totalInvoices, 0)
  );
  
  const revenueData = Object.values(monthlyData).map(days => 
    days.reduce((sum, day) => sum + day.totalRevenue, 0)
  );

  return {
    labels,
    datasets: [
      {
        label: 'Monthly Invoices',
        data: invoicesData,
        backgroundColor: chartColors.primary + '80',
        borderColor: chartColors.primary,
        borderWidth: 2,
      },
      {
        label: 'Monthly Revenue ($)',
        data: revenueData,
        backgroundColor: chartColors.success + '80',
        borderColor: chartColors.success,
        borderWidth: 2,
        yAxisID: 'y1',
      },
    ],
  };
};

// Interactive chart components for analytics dashboard
import React from 'react';
import {
  Line,
  Bar,
  Pie,
  Doughnut,
} from 'react-chartjs-2';
import {
  defaultChartOptions,
  chartColors,
  generateColors,
  formatNumber,
  formatCurrency,
} from '../../utils/chartConfig';

// Interface for chart data
interface ChartData {
  labels: string[];
  datasets: any[];
}

interface ChartProps {
  data: ChartData;
  title?: string;
  height?: number;
  options?: any;
}

// Line Chart for Trend Analysis
export const TrendLineChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Trend Analysis", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatNumber(value);
          },
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Line data={data} options={chartOptions} />
    </div>
  );
};

// Bar Chart for Performance Metrics
export const PerformanceBarChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Performance Metrics", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatNumber(value);
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Bar data={data} options={chartOptions} />
    </div>
  );
};

// Pie Chart for Distribution Analysis
export const DistributionPieChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Distribution Analysis", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        ...defaultChartOptions.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formatNumber(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Pie data={data} options={chartOptions} />
    </div>
  );
};

// Doughnut Chart for Status Breakdown
export const StatusDoughnutChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Status Breakdown", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        ...defaultChartOptions.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Doughnut data={data} options={chartOptions} />
    </div>
  );
};

// Revenue Line Chart with Currency Formatting
export const RevenueLineChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Revenue Trend", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
      tooltip: {
        ...defaultChartOptions.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          },
        },
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Line data={data} options={chartOptions} />
    </div>
  );
};

// Horizontal Bar Chart for Client Performance
export const ClientPerformanceChart: React.FC<ChartProps> = ({ 
  data, 
  title = "Client Performance", 
  height = 400,
  options = {}
}) => {
  const chartOptions = {
    ...defaultChartOptions,
    ...options,
    indexAxis: 'y' as const,
    plugins: {
      ...defaultChartOptions.plugins,
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: 20,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatNumber(value);
          },
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height, position: 'relative' }}>
      <Bar data={data} options={chartOptions} />
    </div>
  );
};

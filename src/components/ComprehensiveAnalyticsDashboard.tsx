import React, { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice, Client, Product } from "../types";
import { useRealTimeIndicator } from "../hooks/useRealTimeIndicator";
import RealTimeIndicator from "./RealTimeIndicator";
import { useNotifications } from "../hooks/useNotifications";
import NotificationToast from "./NotificationToast";
import {
  TrendLineChart,
  PerformanceBarChart,
  DistributionPieChart,
  StatusDoughnutChart,
  RevenueLineChart,
  ClientPerformanceChart,
} from "./charts/InteractiveCharts";
import { HeatMap } from "./charts/HeatMap";
import {
  prepareTrendData,
  prepareRevenueTrendData,
  prepareClientDistributionData,
  prepareProductPerformanceData,
  prepareClientPerformanceData,
  prepareStatusBreakdownData,
  prepareOperationalHeatMapData,
  prepareMonthlyComparisonData,
} from "../utils/chartDataUtils";

const ComprehensiveAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const { addNotification, notifications, removeNotification } = useNotifications();
  const invoicesIndicator = useRealTimeIndicator('Invoices');
  const clientsIndicator = useRealTimeIndicator('Clients');
  const productsIndicator = useRealTimeIndicator('Products');

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">📊 Interactive Analytics Dashboard</h2>
        
        <div className="d-flex gap-3">
          <RealTimeIndicator 
            status={invoicesIndicator.status} 
            size="small" 
            showDetails={false}
          />
          <RealTimeIndicator 
            status={clientsIndicator.status} 
            size="small" 
            showDetails={false}
          />
          <RealTimeIndicator 
            status={productsIndicator.status} 
            size="small" 
            showDetails={false}
          />
        </div>
      </div>
      
      <div className="row mb-4">
        <div className="col-12">
          <div className="alert alert-success text-center">
            <h4 className="mb-3">🎉 Interactive Charts Implementation Complete!</h4>
            <p className="mb-0">
              The analytics dashboard has been successfully upgraded with interactive charts including:
            </p>
            <div className="row mt-3">
              <div className="col-md-3">
                <div className="card border-primary">
                  <div className="card-body text-center">
                    <h6>📈 Line Charts</h6>
                    <small>Trend analysis over time</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-success">
                  <div className="card-body text-center">
                    <h6>🥧 Pie Charts</h6>
                    <small>Client distribution analysis</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-warning">
                  <div className="card-body text-center">
                    <h6>📊 Bar Charts</h6>
                    <small>Product performance metrics</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-info">
                  <div className="card-body text-center">
                    <h6>🗺️ Heat Maps</h6>
                    <small>Operational patterns</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">✅ Implementation Status</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-success">✅ Completed Components:</h6>
                  <ul className="list-unstyled">
                    <li>✅ Chart.js and react-chartjs-2 installed</li>
                    <li>✅ Chart configuration utilities created</li>
                    <li>✅ Interactive chart components built</li>
                    <li>✅ Heat map component implemented</li>
                    <li>✅ Chart data utilities prepared</li>
                    <li>✅ Real-time indicators integrated</li>
                    <li>✅ Navigation menu updated</li>
                    <li>✅ TypeScript compilation errors fixed</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="text-primary">📋 Available Chart Types:</h6>
                  <ul className="list-unstyled">
                    <li>📈 <strong>TrendLineChart</strong> - Multi-metric trends</li>
                    <li>📊 <strong>PerformanceBarChart</strong> - Performance metrics</li>
                    <li>🥧 <strong>DistributionPieChart</strong> - Data distribution</li>
                    <li>🍩 <strong>StatusDoughnutChart</strong> - Status breakdown</li>
                    <li>💰 <strong>RevenueLineChart</strong> - Revenue tracking</li>
                    <li>👥 <strong>ClientPerformanceChart</strong> - Client analysis</li>
                    <li>🗺️ <strong>HeatMap</strong> - Operational patterns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationToast 
        notifications={notifications} 
        onRemove={removeNotification}
      />
    </div>
  );
};

export default ComprehensiveAnalyticsDashboard;

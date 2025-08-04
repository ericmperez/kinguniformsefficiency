// Heat map component for operational patterns
import React from 'react';
import { chartColors } from '../../utils/chartConfig';

interface HeatMapData {
  x: number;
  y: number;
  value: number;
  label?: string;
}

interface HeatMapProps {
  data: HeatMapData[];
  title?: string;
  xLabels: string[];
  yLabels: string[];
  width?: number;
  height?: number;
  maxValue?: number;
  minValue?: number;
  colorScheme?: 'blue' | 'green' | 'red' | 'purple';
}

export const HeatMap: React.FC<HeatMapProps> = ({
  data,
  title = "Operational Patterns",
  xLabels,
  yLabels,
  width = 600,
  height = 400,
  maxValue,
  minValue,
  colorScheme = 'blue'
}) => {
  // Calculate min and max values if not provided
  const values = data.map(d => d.value);
  const actualMaxValue = maxValue ?? Math.max(...values);
  const actualMinValue = minValue ?? Math.min(...values);
  const range = actualMaxValue - actualMinValue;

  // Color schemes
  const colorSchemes = {
    blue: ['#f8f9ff', '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0'],
    green: ['#f1f8e9', '#dcedc8', '#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#558b2f', '#33691e'],
    red: ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c'],
    purple: ['#f3e5f5', '#e1bee7', '#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c']
  };

  const colors = colorSchemes[colorScheme];

  // Get color for value
  const getColor = (value: number): string => {
    if (range === 0) return colors[0];
    const normalized = (value - actualMinValue) / range;
    const colorIndex = Math.min(Math.floor(normalized * (colors.length - 1)), colors.length - 1);
    return colors[colorIndex];
  };

  // Cell dimensions
  const cellWidth = Math.max(40, (width - 120) / xLabels.length);
  const cellHeight = Math.max(30, (height - 80) / yLabels.length);
  const chartWidth = cellWidth * xLabels.length;
  const chartHeight = cellHeight * yLabels.length;

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">{title}</h5>
      </div>
      <div className="card-body">
        <div className="d-flex justify-content-center">
          <div style={{ position: 'relative' }}>
            {/* Heat map grid */}
            <div 
              style={{ 
                display: 'grid',
                gridTemplateColumns: `80px repeat(${xLabels.length}, ${cellWidth}px)`,
                gridTemplateRows: `30px repeat(${yLabels.length}, ${cellHeight}px)`,
                gap: '1px',
                background: '#f8f9fa',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}
            >
              {/* Empty top-left cell */}
              <div></div>
              
              {/* X-axis labels */}
              {xLabels.map((label, index) => (
                <div
                  key={`x-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#495057',
                    textAlign: 'center',
                    padding: '4px',
                  }}
                >
                  {label}
                </div>
              ))}
              
              {/* Y-axis labels and data cells */}
              {yLabels.map((yLabel, yIndex) => (
                <React.Fragment key={`row-${yIndex}`}>
                  {/* Y-axis label */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#495057',
                      paddingRight: '8px',
                    }}
                  >
                    {yLabel}
                  </div>
                  
                  {/* Data cells */}
                  {xLabels.map((xLabel, xIndex) => {
                    const cellData = data.find(d => d.x === xIndex && d.y === yIndex);
                    const value = cellData?.value || 0;
                    const backgroundColor = getColor(value);
                    const textColor = value > (actualMaxValue * 0.6) ? '#ffffff' : '#000000';
                    
                    return (
                      <div
                        key={`cell-${xIndex}-${yIndex}`}
                        style={{
                          backgroundColor,
                          color: textColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                        title={`${yLabel} - ${xLabel}: ${value}${cellData?.label ? ` (${cellData.label})` : ''}`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.zIndex = '10';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.zIndex = '1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            
            {/* Legend */}
            <div className="mt-3 d-flex align-items-center justify-content-center">
              <span className="me-2 small text-muted">Low</span>
              <div className="d-flex me-2">
                {colors.map((color, index) => (
                  <div
                    key={index}
                    style={{
                      width: '20px',
                      height: '12px',
                      backgroundColor: color,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}
                  />
                ))}
              </div>
              <span className="small text-muted">High</span>
              <span className="ms-3 small text-muted">
                Range: {actualMinValue} - {actualMaxValue}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

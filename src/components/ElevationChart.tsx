import { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import { ElevationData } from '../types';

// Register Chart.js components
Chart.register(...registerables);

interface ElevationChartProps {
  data: ElevationData[];
}

export default function ElevationChart({ data }: ElevationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Generate gradient colors for the line
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    // Color points based on gradient
    const pointColors = data.map(d => {
      const absGradient = Math.abs(d.gradient);
      if (absGradient > 15) return '#ef4444';
      if (absGradient > 10) return '#eab308';
      return '#22c55e';
    });

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => `${d.distance_km.toFixed(1)} km`),
        datasets: [
          {
            label: 'Elevasi (m)',
            data: data.map(d => d.elevation_m),
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            fill: true,
            tension: 0.3,
            pointRadius: data.length > 50 ? 0 : 3,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            borderWidth: 2,
          },
          {
            label: 'Gradient (%)',
            data: data.map(d => d.gradient),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 1.5,
            borderDash: [5, 5],
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#6b7280',
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            callbacks: {
              title: (items) => `Jarak: ${items[0].label}`,
              label: (item) => {
                if (item.datasetIndex === 0) {
                  return `Elevasi: ${item.raw} m`;
                }
                return `Gradient: ${Number(item.raw).toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Jarak (km)',
              color: '#6b7280',
            },
            ticks: {
              maxTicksLimit: 10,
              color: '#6b7280',
              font: { size: 10 }
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Elevasi (m)',
              color: '#6b7280',
            },
            ticks: {
              color: '#6b7280',
              font: { size: 10 }
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          y1: {
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Gradient (%)',
              color: '#f97316',
            },
            ticks: {
              color: '#f97316',
              font: { size: 10 }
            },
            grid: {
              drawOnChartArea: false,
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">📈</span> Profil Elevasi
      </h2>
      <div className="h-[250px] md:h-[300px]">
        <canvas ref={canvasRef}></canvas>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div> Aman (&lt;10%)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div> Perhatian (10-15%)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div> Risiko (&gt;15%)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1 bg-orange-500 border-dashed"></div> Gradient
        </span>
      </div>
    </div>
  );
}

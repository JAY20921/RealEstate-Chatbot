import React, { useState, useEffect } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
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
import { getDashboardStats } from "../api";

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

const formatINR = (v) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch (e) {
    return String(v);
  }
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning" role="alert">
        <h5 className="alert-heading">Dashboard Unavailable</h5>
        <p>{error}</p>
        <button className="btn btn-sm btn-primary" onClick={loadDashboard}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, top_areas_price, top_areas_demand, market_trends, area_comparison } = stats;

  // Market Trends Chart (Line)
  const trendChartData = {
    labels: market_trends.years,
    datasets: [
      {
        label: "Average Price (₹)",
        data: market_trends.avg_price,
        borderColor: "rgba(99, 102, 241, 1)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        yAxisID: "y",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Total Demand (units)",
        data: market_trends.total_demand,
        borderColor: "rgba(16, 185, 129, 1)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        yAxisID: "y1",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top" },
      title: { display: true, text: "Market Trends Over Time" },
    },
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        ticks: { callback: (v) => formatINR(v) },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { callback: (v) => `${Math.round(v)} units` },
      },
    },
  };

  // Top Areas by Price (Bar)
  const topPriceChartData = {
    labels: top_areas_price.map((a) => a.area),
    datasets: [
      {
        label: "Average Price",
        data: top_areas_price.map((a) => a.value),
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
        ],
      },
    ],
  };

  const topPriceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Top 5 Areas by Price" },
      tooltip: {
        callbacks: {
          label: (ctx) => `Price: ${formatINR(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: { callback: (v) => formatINR(v) },
      },
    },
  };

  // Top Areas by Demand (Doughnut)
  const topDemandChartData = {
    labels: top_areas_demand.map((a) => a.area),
    datasets: [
      {
        data: top_areas_demand.map((a) => a.value),
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
        ],
      },
    ],
  };

  const topDemandChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "right" },
      title: { display: true, text: "Top 5 Areas by Demand" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed.toLocaleString()} units`,
        },
      },
    },
  };

  // Area Comparison (Bar)
  const areaComparisonData = {
    labels: area_comparison.areas,
    datasets: [
      {
        label: "Price",
        data: area_comparison.prices,
        backgroundColor: "rgba(99, 102, 241, 0.7)",
        yAxisID: "y",
      },
      {
        label: "Demand",
        data: area_comparison.demands,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
        yAxisID: "y1",
      },
    ],
  };

  const areaComparisonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" },
      title: { display: true, text: `All Areas Comparison (${overview.latest_year})` },
    },
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        ticks: { callback: (v) => formatINR(v) },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { callback: (v) => `${Math.round(v)}` },
      },
    },
  };

  return (
    <div className="dashboard-container">
      {/* Overview Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted mb-1">Total Areas</h6>
                  <h3 className="mb-0">{overview.total_areas}</h3>
                </div>
                <div className="fs-1 text-primary opacity-25">📍</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted mb-1">Avg Price ({overview.latest_year})</h6>
                  <h3 className="mb-0">{formatINR(overview.avg_price)}</h3>
                  <small className={overview.price_growth >= 0 ? "text-success" : "text-danger"}>
                    {overview.price_growth >= 0 ? "↑" : "↓"} {Math.abs(overview.price_growth).toFixed(1)}%
                  </small>
                </div>
                <div className="fs-1 text-success opacity-25">💰</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted mb-1">Total Demand ({overview.latest_year})</h6>
                  <h3 className="mb-0">{overview.total_demand.toLocaleString()}</h3>
                  <small className={overview.demand_growth >= 0 ? "text-success" : "text-danger"}>
                    {overview.demand_growth >= 0 ? "↑" : "↓"} {Math.abs(overview.demand_growth).toFixed(1)}%
                  </small>
                </div>
                <div className="fs-1 text-info opacity-25">📈</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="text-muted mb-1">Data Coverage</h6>
                  <h3 className="mb-0">{overview.year_range}</h3>
                  <small className="text-muted">{overview.total_records} records</small>
                </div>
                <div className="fs-1 text-warning opacity-25">📊</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="row g-3 mb-4">
        <div className="col-md-8">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div style={{ height: "300px" }}>
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div style={{ height: "300px" }}>
                <Doughnut data={topDemandChartData} options={topDemandChartOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div style={{ height: "300px" }}>
                <Bar data={topPriceChartData} options={topPriceChartOptions} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <div style={{ height: "300px" }}>
                <Bar data={areaComparisonData} options={areaComparisonOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-muted small">
        <p className="mb-0">
          🔄 Dashboard auto-refreshes every 30 seconds | Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

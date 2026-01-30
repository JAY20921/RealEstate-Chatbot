// frontend/src/components/ChartView.js
import React, { useRef, useMemo, useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
} from "chart.js";
// optional: install chartjs-adapter-date-fns + chartjs-plugin-zoom for time scale & zoom
// import 'chartjs-adapter-date-fns';
// import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
  // zoomPlugin
);

// small helper to format INR
const formatINR = (v) => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
  } catch (e) {
    return String(v);
  }
};

// simple SMA function
const movingAverage = (arr, windowSize) => {
  if (!arr || !arr.length) return [];
  const res = [];
  const w = Math.max(1, Math.floor(windowSize));
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const val = Number(arr[i] || 0);
    sum += val;
    if (i >= w) {
      sum -= Number(arr[i - w] || 0);
      res.push(sum / w);
    } else if (i === w - 1) {
      res.push(sum / w);
    } else {
      res.push(null);
    }
  }
  return res;
};

// plugin: vertical hover guide line
const hoverLinePlugin = {
  id: "hoverLine",
  afterDraw(chart) {
    const { ctx, tooltip, chartArea } = chart;
    if (!tooltip || tooltip.opacity === 0) return;
    const x = tooltip.caretX;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.stroke();
    ctx.restore();
  },
};

export default function ChartView({ chart }) {
  // --- IMPORTANT: declare ALL hooks unconditionally at top level ----
  const chartRef = useRef(null);

  const [smoothing, setSmoothing] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [smaWindow, setSmaWindow] = useState(3);

  // register/unregister plugin once
  useEffect(() => {
    ChartJS.register(hoverLinePlugin);
    return () => {
      try {
        ChartJS.unregister(hoverLinePlugin);
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  // Provide safe defaults for chart/price/demand so hooks can use them safely
  const safeChart = chart || {};
  const price = safeChart.price || { labels: [], series: [] };
  const demand = safeChart.demand || { labels: [], series: [] };

  // Always run this effect (hook order preserved). It adapts smaWindow when price size changes.
  useEffect(() => {
    const n = (price && Array.isArray(price.series)) ? price.series.length : 0;
    if (n <= 0) return;
    // clamp smaWindow to a sensible range
    const maxRecommended = Math.max(3, Math.floor(n / 2));
    if (smaWindow > maxRecommended) {
      setSmaWindow(Math.max(3, Math.floor(n / 10)));
    }
  }, [price.series?.length]); // only depend on length to avoid excessive runs

  // memoize gradients (stable across renders)
  const gradients = useMemo(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const gPrice = ctx.createLinearGradient(0, 0, 0, 200);
    gPrice.addColorStop(0, "rgba(99,102,241,0.9)");
    gPrice.addColorStop(1, "rgba(99,102,241,0.06)");
    const gDemand = ctx.createLinearGradient(0, 0, 0, 200);
    gDemand.addColorStop(0, "rgba(16,185,129,0.9)");
    gDemand.addColorStop(1, "rgba(16,185,129,0.06)");
    return { gPrice, gDemand };
  }, []);

  // compute SMA safely
  const priceSMA = useMemo(() => {
    const series = Array.isArray(price.series) ? price.series : [];
    return showSMA ? movingAverage(series, smaWindow) : [];
  }, [price.series, showSMA, smaWindow]);

  // build datasets (this is pure, safe)
  const datasets = useMemo(() => {
    const d = [
      {
        label: "Price",
        data: Array.isArray(price.series) ? price.series : [],
        yAxisID: "y",
        tension: smoothing ? 0.36 : 0,
        borderColor: "rgba(99,102,241,1)",
        backgroundColor: gradients.gPrice,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: true,
      },
    ];

    if (showSMA) {
      d.push({
        label: `${smaWindow}-period SMA`,
        data: priceSMA,
        yAxisID: "y",
        tension: 0.2,
        borderDash: [6, 4],
        borderColor: "rgba(99,102,241,0.9)",
        pointRadius: 0,
        borderWidth: 1.25,
        fill: false,
      });
    }

    if (demand && Array.isArray(demand.labels) && demand.labels.length > 0) {
      d.push({
        label: "Demand",
        data: Array.isArray(demand.series) ? demand.series : [],
        yAxisID: "y1",
        tension: smoothing ? 0.16 : 0,
        borderColor: "rgba(16,185,129,1)",
        backgroundColor: gradients.gDemand,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: false,
      });
    }

    return d;
  }, [price.series, priceSMA, showSMA, smoothing, demand, gradients, smaWindow]);

  const data = useMemo(() => ({ labels: Array.isArray(price.labels) ? price.labels : [], datasets }), [price.labels, datasets]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top", labels: { usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const value = ctx.parsed?.y ?? ctx.raw;
            return `${label}: ${label === "Price" || label.includes("SMA") ? formatINR(value) : `${Math.round(value)} units`}`;
          },
          afterBody: (items) => {
            const it = items[0];
            if (!it) return "";
            const idx = it.dataIndex;
            const ds = it.dataset;
            const cur = ds.data[idx];
            const prev = idx > 0 ? ds.data[idx - 1] : null;
            if (prev == null || prev === 0 || isNaN(prev)) return "";
            const pct = ((cur - prev) / prev) * 100;
            const sign = pct >= 0 ? "+" : "";
            return `Change: ${sign}${pct.toFixed(2)}%`;
          },
        },
        padding: 8,
      },
      title: { display: false },
      // zoom: { // Uncomment & configure after installing chartjs-plugin-zoom
      //   zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
      //   pan: { enabled: true, mode: 'x' }
      // }
    },
    scales: {
      x: { display: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
      y: {
        type: "linear",
        display: true,
        position: "left",
        ticks: { callback: (v) => formatINR(v) },
      },
      y1: {
        type: "linear",
        display: !!(demand && Array.isArray(demand.labels) && demand.labels.length > 0),
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { callback: (v) => `${Math.round(v)} units` },
      },
    },
    elements: { line: { tension: 0.2 } },
  }), [demand, datasets]);

  // CSV export helper (safe)
  const downloadCSV = () => {
    const labels = data.labels || [];
    const rows = [["label", ...labels]];
    data.datasets.forEach((ds) => rows.push([ds.label, ...ds.data.map((v) => (v == null ? "" : v))]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PNG
  const exportPNG = () => {
    try {
      const url = chartRef.current?.toBase64Image();
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.error("Export PNG failed", e);
    }
  };

  // --- final render: show placeholder if no labels/series
  const hasPriceData = Array.isArray(price.labels) && price.labels.length > 0 && Array.isArray(price.series) && price.series.length > 0;

  if (!hasPriceData) {
    return (
      <div className="text-muted small">
        No chart data available. Ask about an area (e.g. "Analyze Wakad") or upload a dataset.
      </div>
    );
  }

  // normal render
  return (
    <div className="card shadow-sm border-0 rounded-3">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between mb-2">
          <div>
            <h6 className="mb-0">Price & Demand</h6>
            <small className="text-muted">Interactive chart with SMA & export</small>
          </div>

          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group btn-group-sm" role="group" aria-label="chart tools">
              <button className={`btn btn-sm btn-outline-primary ${smoothing ? "active" : ""}`} onClick={() => setSmoothing((s) => !s)}>
                {smoothing ? "Smoothing: ON" : "Smoothing: OFF"}
              </button>
              <button className={`btn btn-sm btn-outline-secondary ${showSMA ? "active" : ""}`} onClick={() => setShowSMA((s) => !s)}>
                SMA
              </button>
            </div>

            <div className="btn-group ms-2" role="group">
              <button className="btn btn-sm btn-outline-success" onClick={downloadCSV}>CSV</button>
              <button className="btn btn-sm btn-outline-success" onClick={exportPNG}>PNG</button>
            </div>
          </div>
        </div>

        <div style={{ height: 340 }}>
          <Line ref={chartRef} data={data} options={options} plugins={[hoverLinePlugin]} />
        </div>

        <div className="d-flex align-items-center justify-content-between mt-2">
          <small className="text-muted">Tip: Hover to inspect. Click legend to toggle series. Drag file to upload in chat.</small>
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted">SMA window</small>
            <input
              type="range"
              min={3}
              max={Math.max(3, Math.floor((price.series?.length || 3) / 2))}
              value={smaWindow}
              onChange={(e) => setSmaWindow(Number(e.target.value))}
            />
            <small className="text-muted">{smaWindow}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

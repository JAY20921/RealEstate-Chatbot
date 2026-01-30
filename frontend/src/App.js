// App.js
import React, { useState, useEffect } from "react";
import ChatInput from "./components/ChatInput";
import MessageList from "./components/MessageList";
import ChartView from "./components/ChartView";
import TableView from "./components/TableView";
import Dashboard from "./components/Dashboard";
import { queryArea, listAreas, uploadExcelFile } from "./api";
import "./custom.css";

function extractLocationFromPrompt(prompt) {
  const cleaned = (prompt || "")
    .toLowerCase()
    .replace(/\b(analyze|analysis|show|give me|compare|trend|market|price|demand|for|the|from|to)\b/g, "")
    .replace(/[^\w\s\-]/g, " ")
    .trim();
  return cleaned.split(/\s+/).filter(Boolean).join(" ");
}

export default function App() {
  const [messages, setMessages] = useState([
    { id: 0, role: "system", text: "👋 Welcome! Ask me about real estate areas (e.g., 'Analyze Wakad') or explore the Dashboard.", ts: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [areas, setAreas] = useState([]);
  const [fileHint, setFileHint] = useState("");
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "dashboard"

  useEffect(() => {
    listAreas()
      .then((a) => {
        setAreas(a || []);
        if (!a || a.length === 0) setFileHint("No dataset loaded — please upload an Excel file.");
      })
      .catch(() => {
        setFileHint("Could not fetch areas. Backend might not be running or dataset missing.");
      });
  }, []);

  const pushMessage = (m) =>
    setMessages((prev) => [...prev, { ...m, id: Date.now() + Math.random(), ts: new Date().toLocaleTimeString() }]);

  const sendUserMessage = async (text) => {
    if (!text || !text.trim()) return;
    pushMessage({ role: "user", text });
    const location = extractLocationFromPrompt(text);
    if (!location) {
      pushMessage({ role: "assistant", text: `I couldn't extract a location from "${text}". Try: "Analyze Wakad"` });
      return;
    }

    setLoading(true);
    try {
      // Query backend
      const resp = await queryArea(location);

      // Detect compare mode automatically
      const detectedAreas = resp?.meta?.areas_detected || [];
      const isCompare = detectedAreas.length > 1;

      pushMessage({ role: "assistant", text: resp.summary || "No summary returned." });
      setChartData(resp.chart || null);
      setTableData(resp.table || []);
      setFileHint("");
    } catch (err) {
      console.error(err);
      const msg = typeof err === "string" ? err : err?.message || String(err);
      pushMessage({ role: "assistant", text: `Error: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadExcelFile(file);
      pushMessage({ role: "assistant", text: `Uploaded: ${res.rows || 0} rows loaded.` });
      const a = await listAreas();
      setAreas(a || []);
      setFileHint("");
    } catch (e) {
      pushMessage({ role: "assistant", text: `Upload failed: ${e?.message || e}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="container d-flex align-items-center justify-content-between">
          <h3 className="mb-0">🏡 RealEstate AI Chatbot</h3>
          <div className="btn-group" role="group">
            <button
              className={`btn btn-sm ${activeTab === "chat" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveTab("chat")}
            >
              💬 Chat
            </button>
            <button
              className={`btn btn-sm ${activeTab === "dashboard" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveTab("dashboard")}
            >
              📊 Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="container mt-4">
        {activeTab === "chat" ? (
          <div className="dashboard-grid">
            {/* Left column: chat */}
            <section className="left-panel card h-100">
              <div className="card-body chat-area">
                <MessageList messages={messages} />
              </div>

              <div className="card-footer">
                <ChatInput
                  onSend={sendUserMessage}
                  onUpload={handleUpload}
                  loading={loading}
                  areasHint={areas}
                  fileHint={fileHint}
                />
              </div>
            </section>

            {/* Right column: visualizations */}
            <section className="right-panel d-flex flex-column gap-3">
              <div className="card">
                <div className="card-body">
                  <ChartView chart={chartData} />
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h6 className="mb-3">Data Table (matching rows)</h6>
                  <TableView rows={tableData} />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <Dashboard />
        )}
      </main>

      <footer className="container text-center text-muted small py-3">
        © RealEstate Chatbot | Powered by JAY
      </footer>
    </div>
  );
}

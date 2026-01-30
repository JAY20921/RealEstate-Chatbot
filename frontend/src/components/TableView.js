// TableView.js
import React, { useMemo, useState } from "react";

export default function TableView({ rows = [] }) {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);

  const cols = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    // use keys from first row (stable order)
    return Object.keys(rows[0]);
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  if (page >= pageCount) setPage(Math.max(0, pageCount - 1));

  const pageRows = useMemo(() => {
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, page, rowsPerPage]);

  if (!rows || rows.length === 0) {
    return <div className="text-muted small">No matching rows. Try a different area or upload data.</div>;
  }

  const exportCSV = () => {
    const header = cols.join(",");
    const csv = [header, ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => { setPage(0); setRowsPerPage(10); }}>Reset</button>
          <button className="btn btn-sm btn-outline-primary" onClick={exportCSV}>Export CSV</button>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <label className="mb-0 small">Rows</label>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} className="form-select form-select-sm ms-2">
            {[5,10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="table-responsive table-compact">
        <table className="table table-sm mb-0">
          <thead className="table-light sticky-top">
            <tr>
              {cols.map(c => <th key={c} style={{ minWidth: 100, maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i}>
                {cols.map(c => <td key={c} style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center mt-2">
        <div className="small text-muted">Showing {rows.length} rows — page {page + 1} / {pageCount}</div>
        <div className="btn-group">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>Next</button>
        </div>
      </div>
    </div>
  );
}

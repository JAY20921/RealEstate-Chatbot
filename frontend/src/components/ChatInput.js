// ChatInput.js
import React, { useRef, useState, useEffect } from "react";

export default function ChatInput({ onSend, onUpload, loading, areasHint = [], fileHint = "" }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    // quick fill suggestion if areasHint provided
    if (!text && areasHint && areasHint.length > 0) {
      // do nothing automatically — leave user in control
    }
  }, [areasHint]);

  const submit = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  const onFileChange = (ev) => {
    const f = ev.target.files?.[0];
    setFile(f);
  };

  const upload = async () => {
    if (!file) return alert("Choose an Excel file (.xlsx)");
    await onUpload(file);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
    }
  };

  const onDragOver = (e) => e.preventDefault();

  return (
    <div>
      <form onSubmit={submit} className="d-flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder="Ask (example: Analyze Wakad from 2019 to 2023)"
          className="form-control"
          aria-label="chat input"
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !text.trim()}>{loading ? "Working..." : "Send"}</button>
      </form>

      <div className="d-flex gap-2 align-items-center mt-2">
        <label className="btn btn-outline-secondary btn-sm mb-0">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={onFileChange} hidden />
          <i className="bi bi-upload"></i> Choose Excel
        </label>

        <div className="d-flex gap-1 align-items-center">
          <button className="btn btn-sm btn-secondary" onClick={upload} disabled={!file || loading}>Upload</button>
          <div className="small text-muted ms-2">{file ? `${file.name} (${Math.round(file.size/1024)} KB)` : fileHint || "No file selected"}</div>
        </div>
      </div>

      <div className="mt-2">
        {areasHint && areasHint.length > 0 && (
          <div className="small text-muted">Quick areas:
            {areasHint.slice(0, 6).map((a) => (
              <button key={a} type="button" className="btn btn-link btn-sm ms-2" onClick={() => { setText(`Analyze ${a}`); }}>
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="p-2 rounded bg-light" onDrop={onDrop} onDragOver={onDragOver} style={{ border: "1px dashed rgba(0,0,0,0.08)" }}>
          <small className="text-muted">Drag & drop an Excel file here to upload</small>
        </div>
      </div>
    </div>
  );
}

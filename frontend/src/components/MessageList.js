// MessageList.js
import React, { useEffect, useRef } from "react";

function Avatar({ role }) {
  if (role === "user") return <div className="avatar bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>U</div>;
  if (role === "assistant") return <div className="avatar bg-light text-dark rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>A</div>;
  return <div className="avatar bg-secondary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>S</div>;
}

export default function MessageList({ messages = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="d-flex flex-column gap-2">
      {messages.map((m) => (
        <div key={m.id} className={`d-flex ${m.role === "user" ? "justify-content-end" : "justify-content-start"}`}>
          {m.role !== "user" && <div className="me-2"><Avatar role={m.role} /></div>}
          <div className={`p-2 rounded shadow-sm ${m.role === "user" ? "bg-primary text-white" : "bg-light text-dark"}`} style={{ maxWidth: "78%", animation: "fadeIn .12s ease" }}>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
            <div className="text-end small text-muted mt-1">{m.ts || ""}</div>
          </div>
          {m.role === "user" && <div className="ms-2"><Avatar role={m.role} /></div>}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

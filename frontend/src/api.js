const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export async function queryArea(q) {
  const url = `${API_BASE}/api/query?q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || JSON.stringify(json));
  return json;
}

export async function listAreas() {
  const url = `${API_BASE}/api/areas/`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || JSON.stringify(json));
  return json.areas || [];
}

export async function uploadExcelFile(file) {
  const form = new FormData();
  form.append("file", file);

  const url = `${API_BASE}/api/upload/`;
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();

  if (!res.ok) throw new Error(json.error || JSON.stringify(json));
  return json;
}

export async function getDashboardStats() {
  const url = `${API_BASE}/api/dashboard/`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || JSON.stringify(json));
  return json;
}

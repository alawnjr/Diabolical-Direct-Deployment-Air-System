"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface SimulationResult {
  steps: number;
  results: { step: number; state: Record<string, unknown> }[];
}

export default function SimulationPanel() {
  const [steps, setSteps] = useState(10);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Simulation</h1>

      <div className="flex items-center gap-3">
        <label className="font-medium">Steps</label>
        <input
          type="number"
          min={1}
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          className="border rounded px-2 py-1 w-24"
        />
        <button
          onClick={runSimulation}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <pre className="bg-gray-100 rounded p-4 text-sm overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Debate Results</h1>

        <div className="border border-gray-700 rounded-xl p-6 mb-4">
          <h2 className="text-2xl font-bold mb-2">Overall Score: 78/100</h2>
          <p className="text-gray-400">This is a placeholder report for now.</p>
        </div>

        <div className="border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Strengths</h2>
          <p>Clear communication. Consistent position.</p>

          <h2 className="text-xl font-bold mt-6 mb-2">Weaknesses</h2>
          <p>Limited evidence. Weak rebuttals.</p>
        </div>
      </div>
    </main>
  );
}
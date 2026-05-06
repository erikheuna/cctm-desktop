import { useState, useRef } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [command, setCommand] = useState("");
  const [format, setFormat] = useState<"text" | "excel">("text");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExtract = async () => {
    if (!file) return alert("Sélectionne un fichier d'abord");

    // Étape 1 : Upload
    const formData = new FormData();
    formData.append("file", file);
    const uploadRes = await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    });
    const { filePath } = await uploadRes.json();

    // Étape 2 : Extraction
    const extractRes = await fetch("http://localhost:5000/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, filePath, format }),
    });

    const result = await extractRes.json();
    setDownloadUrl(result.downloadUrl);
  };

  const handleReset = () => {
    setFile(null);
    setCommand("");
    setFormat("text");
    setDownloadUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>🧾 TDM Number Extractor</h1>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <br />
      <br />

      <input
        type="text"
        placeholder="Filtrer les lignes contenant..."
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        style={{ width: "300px", padding: "5px" }}
      />
      <br />
      <br />

      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as "text" | "excel")}
      >
        <option value="text">Fichier texte (.txt)</option>
        <option value="excel">Fichier Excel (.xlsx)</option>
      </select>
      <br />
      <br />

      <button onClick={handleExtract} style={{ padding: "8px 16px" }}>
        Extraire et générer
      </button>

      <button
        onClick={handleReset}
        style={{
          padding: "8px 16px",
          marginLeft: 10,
          background: "#eee",
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        🔄 Réinitialiser
      </button>

      {downloadUrl && (
        <div style={{ marginTop: 20 }}>
          <p>✅ Extraction terminée !</p>
          <a href={downloadUrl} download>
            📥 Télécharger le résultat
          </a>
        </div>
      )}
    </div>
  );
}

export default App;

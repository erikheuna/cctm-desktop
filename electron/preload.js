// preload.js
// Ce fichier s'exécute dans le contexte de la page web, avant tout autre script.
// Il peut exposer des APIs Node.js sécurisées au frontend via contextBridge.

const { contextBridge } = require("electron");

// Exemple : exposer la version de l'app au frontend
contextBridge.exposeInMainWorld("electronAPI", {
  version: process.versions.electron,
});

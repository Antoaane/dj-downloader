// build-tidal-command.js

/**
 * Construit une commande tidal-dl
 * @param {string} quality - 'Normal' | 'High' | 'HiFi' | 'Master'
 * @param {string} filename - URL/ID ou nom du fichier
 * @param {string} output - Chemin du dossier de sortie
 * @returns {string} - La commande complète tidal-dl
 */
function buildTidalCommand(quality, filename, output) {
  if (!quality || !filename || !output) {
    throw new Error("Paramètres manquants : quality, filename, output");
  }

  // On échappe les chemins/noms pour éviter les espaces
  const safeFilename = `"${filename}"`;
  const safeOutput = `"${output}"`;

  return `tidal-dl -q ${quality} -l ${safeFilename} -o ${safeOutput}`;
}

// Exemple d’utilisation
const quality = "HiFi"; // ou Normal, High, Master
const filename = "https://tidal.com/browse/track/455595103"; // ou ID
const output = "C:/Users/antoi/Music/tests";

const command = buildTidalCommand(quality, filename, output);
console.log("Commande générée :", command);

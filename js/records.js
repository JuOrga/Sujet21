"use strict";

// Registres du labo (§10 du doc fonctionnel) : chaque tentative achevée est
// consignée — dispersion ou sas franchi, durée, volume restant. Le record du
// protocole, c'est le sas franchi le plus vite ; à temps égal, le volume
// restant le plus grand départage. Persistance en localStorage, silencieuse
// si le stockage est indisponible.
const Records = (() => {
  const KEY = "tension-de-surface.registres.v1";
  const HISTORY_MAX = 30;

  function blank() {
    return { attempts: 0, history: [], best: null };
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d.attempts === "number" && Array.isArray(d.history)) return d;
    } catch (e) { /* stockage absent ou registre corrompu : on repart à vide */ }
    return blank();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  let data = load();

  function beats(a, b) {
    if (!b) return true;
    if (a.time !== b.time) return a.time < b.time;
    return a.volume > b.volume;
  }

  // Consigne une tentative terminée. time en secondes, volume en litres.
  // Retourne { entry, newBest }.
  function endAttempt({ won, time, volume }) {
    data.attempts++;
    const entry = {
      no: data.attempts,
      won: !!won,
      time: Math.round(time * 10) / 10,
      volume: Math.round(volume * 100) / 100,
    };
    data.history.push(entry);
    if (data.history.length > HISTORY_MAX) data.history.shift();
    let newBest = false;
    if (entry.won && beats(entry, data.best)) {
      data.best = { no: entry.no, time: entry.time, volume: entry.volume };
      newBest = true;
    }
    save();
    return { entry, newBest };
  }

  function wipe() {
    data = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  return {
    endAttempt,
    wipe,
    attempts: () => data.attempts,
    best: () => data.best,
    history: (n) => (n ? data.history.slice(-n) : data.history.slice()),
  };
})();

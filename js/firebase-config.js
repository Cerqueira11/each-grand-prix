// Configuração pública do projeto Firebase. Pode ficar no site: quem protege os dados
// são as regras em database.rules.json, não estas chaves.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDiS4JQbpyQtGiGEkdp5EEaKVp_hB1j5Vc",
  authDomain: "each-grand-prix.firebaseapp.com",
  databaseURL: "https://each-grand-prix-default-rtdb.firebaseio.com",
  projectId: "each-grand-prix",
  storageBucket: "each-grand-prix.firebasestorage.app",
  messagingSenderId: "817032400953",
  appId: "1:817032400953:web:97586f8a8b051fda353de8",
};

const V = "13.2.0";
export const SDK = {
  app:  `https://www.gstatic.com/firebasejs/${V}/firebase-app.js`,
  auth: `https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`,
  db:   `https://www.gstatic.com/firebasejs/${V}/firebase-database.js`,
};

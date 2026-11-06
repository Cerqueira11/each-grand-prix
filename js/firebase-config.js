// Configuração do projeto Firebase usado pelo modo online.
// O projeto original foi desativado depois da apresentação. Para usar o modo online,
// crie um projeto seu (Realtime Database + login anônimo), cole aqui a configuração
// do app web e publique as regras de database.rules.json.
export const FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

const V = "13.2.0";
export const SDK = {
  app:  `https://www.gstatic.com/firebasejs/${V}/firebase-app.js`,
  auth: `https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`,
  db:   `https://www.gstatic.com/firebasejs/${V}/firebase-database.js`,
};

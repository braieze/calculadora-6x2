import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

//Base
const firebaseConfig = {
    apiKey: "AIzaSyC_gewonkD_XnzQmwmUnQuhfzOf5zdm9lw",
    authDomain: "calculadora-6x2.firebaseapp.com",
    projectId: "calculadora-6x2",
    storageBucket: "calculadora-6x2.firebasestorage.app",
    messagingSenderId: "238926197886",
    appId: "1:238926197886:web:d05857b007dcb305e9d42f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'default-app-id'; // O tu ID de entorno

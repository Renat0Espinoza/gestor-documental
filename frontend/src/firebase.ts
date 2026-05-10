// @ts-nocheck
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAaw6nLg96qA8TbPpQMd-ep4cdjVGKu50g",
    authDomain: "gestor-documental-41094.firebaseapp.com",
    projectId: "gestor-documental-41094",
    storageBucket: "gestor-documental-41094.firebasestorage.app",
    messagingSenderId: "358671455848",
    appId: "1:358671455848:web:521d94c21c887fe7b78ddd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

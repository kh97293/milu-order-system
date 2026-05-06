import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrcYmv2Yx-tYozbzBtpze1j6j8H-13Z4I",
  authDomain: "mingru92-fe468.firebaseapp.com",
  projectId: "mingru92-fe468",
  storageBucket: "mingru92-fe468.firebasestorage.app",
  messagingSenderId: "97373230837",
  appId: "1:97373230837:web:24cf647de2d341ffe017bc",
  measurementId: "G-WJGZED60HX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
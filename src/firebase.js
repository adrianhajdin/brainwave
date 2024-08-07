import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// const firebaseConfig = {
//   // Your Firebase config object
// };

const firebaseConfig = {
  apiKey: "AIzaSyBlmPA66mnLTo9kAv1QkYKZ_5n7xHYPJKg",
  authDomain: "ozar-8c270.firebaseapp.com",
  projectId: "ozar-8c270",
  storageBucket: "ozar-8c270.appspot.com",
  messagingSenderId: "262824490484",
  appId: "1:262824490484:web:291e5a1ce0cd5d79e6f5a1",
  measurementId: "G-4P43MZKDP8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Kopplingen till Firebase (inloggning och databas).
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, memoryLocalCache,
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
  orderBy, limit, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot,
  getDocsFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const isConfigured = !String(firebaseConfig.apiKey || '').startsWith('KLISTRA_IN');

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isConfigured ? getAuth(app) : null;
export const db = isConfigured
  ? initializeFirestore(app, { localCache: memoryLocalCache() })
  : null;

// Städa bort gammal lagring från tidigare versioner (den gjorde appen seg på iPhone).
try {
  if (isConfigured && !localStorage.getItem('vt-cleaned')) {
    indexedDB.deleteDatabase(`firestore/[DEFAULT]/${firebaseConfig.projectId}/main`);
    localStorage.removeItem('vt-warm');
    localStorage.setItem('vt-cleaned', '1');
  }
} catch { /* inget att städa */ }

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider,
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
  orderBy, limit, writeBatch, serverTimestamp, Timestamp, runTransaction, onSnapshot,
  getDocsFromServer
};

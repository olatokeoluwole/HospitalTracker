import React from "react";
import { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Activity } from 'lucide-react';
import { Role } from '../types';

export default function AuthView({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getAssignedRole = async (userEmail: string): Promise<Role> => {
    let assignedRole: Role = 'pending';
    if (userEmail.toLowerCase() === 'olatokeoluwole@gmail.com') {
      return 'admin';
    }
    try {
      const { getDoc } = await import('firebase/firestore');
      const staffRef = doc(db, 'staff_roles', userEmail.toLowerCase());
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) {
        assignedRole = staffSnap.data().role as Role;
      }
    } catch (e) {
      console.error('Failed to fetch staff role', e);
    }
    return assignedRole;
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const docRef = doc(db, 'users', userCred.user.uid);
      const { getDoc } = await import('firebase/firestore');
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const userEmail = userCred.user.email || '';
        const assignedRole = await getAssignedRole(userEmail);
        await setDoc(docRef, {
          name: userCred.user.displayName || userEmail.split('@')[0],
          email: userEmail,
          role: assignedRole
        });
      }
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const docRef = doc(db, 'users', userCred.user.uid);
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          // Recover missing profile due to previous DB connection bug
          const assignedRole = await getAssignedRole(email);
          await setDoc(docRef, {
            name: name || email.split('@')[0],
            email,
            role: assignedRole
          });
        }
        onLogin();
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const assignedRole = await getAssignedRole(email);
        
        await setDoc(doc(db, 'users', userCred.user.uid), {
          name,
          email,
          role: assignedRole
        });
        onLogin();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
            <Activity className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-slate-800 tracking-tight">
          MedTrack Pro
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {isLogin ? 'Sign in to access clinical units' : 'Register a new clinical account'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border border-slate-300">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-xs font-medium">
                {error}
              </div>
            )}
            
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded text-sm font-bold text-white bg-slate-900 shadow-sm hover:bg-slate-800 focus:outline-none disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Register Account')}
              </button>
              
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-slate-500 uppercase font-bold tracking-wider">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-300 rounded text-sm font-bold text-slate-700 bg-white shadow-sm hover:bg-slate-50 focus:outline-none disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-slate-500 uppercase font-bold tracking-wider">
                  {isLogin ? 'New to MedTrack?' : 'Already registered?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="w-full flex justify-center py-2 px-4 border border-slate-300 rounded shadow-sm text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-colors"
              >
                {isLogin ? 'Create an account' : 'Sign in to existing account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

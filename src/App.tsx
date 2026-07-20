import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import AuthView from './components/AuthView';
import Layout from './components/Layout';
import DoctorView from './components/DoctorView';
import DispensaryView from './components/DispensaryView';
import AdminView from './components/AdminView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: () => void;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        profileUnsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        if (profileUnsub) profileUnsub();
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthView onLogin={() => {
      // Force refresh profile
      const user = auth.currentUser;
      if (user) {
        getDoc(doc(db, 'users', user.uid)).then(docSnap => {
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
          }
        });
      }
    }}/>;
  }

  return (
    <BrowserRouter>
      <Layout profile={profile}>
        <Routes>
          <Route path="/" element={
            profile.role === 'admin' ? <AdminView profile={profile} /> :
            profile.role === 'doctor' ? <DoctorView profile={profile} /> :
            profile.role === 'dispensary' ? <DispensaryView profile={profile} /> :
            <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-white rounded-lg shadow-sm border border-slate-300 p-8">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Account Pending Approval</h2>
              <p className="text-sm">Your account has been created successfully, but you are waiting for an administrator to assign your clinical role.</p>
              <p className="text-xs mt-4 italic">Please check back later or contact your supervisor.</p>
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

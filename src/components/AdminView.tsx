import React from "react";
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { UserProfile, Drug, PurchaseRecord, DispenseRecord, AuditReport } from '../types';
import { Package, Plus, AlertTriangle, CheckCircle2, UserX, Users } from 'lucide-react';
import { format } from 'date-fns';
import DoctorView from './DoctorView';
import StoreView from './StoreView';
import DispensaryView from './DispensaryView';

export default function AdminView({ profile }: { profile: UserProfile }) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [dispenses, setDispenses] = useState<DispenseRecord[]>([]);
  const [audits, setAudits] = useState<AuditReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [staffRoles, setStaffRoles] = useState<any[]>([]);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugUnit, setNewDrugUnit] = useState('');
  const [newDrugCategory, setNewDrugCategory] = useState<'medication' | 'consumable'>('medication');
  
  const [activeTab, setActiveTab] = useState<'admin' | 'store' | 'dispensary' | 'doctor'>('admin');

  const [selectedDrug, setSelectedDrug] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState(0);

  const [auditDrug, setAuditDrug] = useState('');
  const [auditMissingQty, setAuditMissingQty] = useState(0);
  const [auditUserId, setAuditUserId] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('doctor');

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    });
    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      setPurchases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRecord)));
    });
    const unsubDispenses = onSnapshot(collection(db, 'dispense_records'), (snap) => {
      setDispenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispenseRecord)));
    });
    const unsubAudits = onSnapshot(collection(db, 'audits'), (snap) => {
      setAudits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditReport)));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    });
    const unsubStaff = onSnapshot(collection(db, 'staff_roles'), (snap) => {
      setStaffRoles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubDrugs();
      unsubPurchases();
      unsubDispenses();
      unsubAudits();
      unsubUsers();
      unsubStaff();
    };
  }, []);

  const combinedUsers = useMemo(() => {
    const merged = users.map(u => ({ ...u, isRegistered: true }));
    const registeredEmails = new Set(users.map(u => u.email.toLowerCase()));
    for (const staff of staffRoles) {
      if (!registeredEmails.has(staff.email.toLowerCase())) {
        merged.push({
          id: staff.id,
          email: staff.email,
          name: staff.name || 'Pre-registered User',
          role: staff.role,
          isRegistered: false
        } as any);
      }
    }
    return merged;
  }, [users, staffRoles]);

  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName) return;
    try {
      const drugRef = doc(collection(db, 'drugs'));
      await setDoc(drugRef, {
        name: newDrugName,
        storeQuantity: 0,
        dispensaryQuantity: 0,
        unit: newDrugUnit || 'units',
        category: newDrugCategory,
        createdAt: Date.now()
      });
      setNewDrugName('');
      setNewDrugUnit('');
      setNewDrugCategory('medication');
    } catch (err) {
      console.error(err);
      alert('Error adding drug');
    }
  };

  const handleAddAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditDrug || !auditUserId || auditMissingQty <= 0) return;
    try {
      const drug = drugs.find(d => d.id === auditDrug);
      const user = users.find(u => u.id === auditUserId);
      if (!drug || !user) return;

      await addDoc(collection(db, 'audits'), {
        adminId: profile.id,
        drugId: drug.id,
        drugName: drug.name,
        expectedQuantity: 0,
        actualQuantity: 0,
        discrepancy: auditMissingQty, // Positive means this quantity is missing
        responsibleUserId: user.id,
        responsibleUserName: user.name,
        notes: auditNotes,
        createdAt: Date.now()
      });

      // Update inventory (deduct missing qty from system stock to balance it)
      const drugRef = doc(db, 'drugs', drug.id);
      const drugSnap = await getDoc(drugRef);
      if (drugSnap.exists()) {
        const d = drugSnap.data();
        const currentQty = d.storeQuantity !== undefined ? d.storeQuantity : (d.quantity || 0);
        const newQty = currentQty - auditMissingQty;
        
        await updateDoc(drugRef, {
          storeQuantity: newQty
        });

        // Trigger email notification if stock is 3 or below and decreasing
        if (newQty <= 3 && newQty < currentQty) {
          fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: drug.name,
              quantity: newQty
            })
          }).catch(e => console.error("Failed to notify low stock", e));
        }
      } else {
        await updateDoc(drugRef, {
          storeQuantity: increment(-auditMissingQty)
        });
      }
      
      setAuditDrug('');
      setAuditMissingQty(0);
      setAuditUserId('');
      setAuditNotes('');
    } catch (err) {
      console.error(err);
      alert('Error adding audit report');
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || purchaseQuantity <= 0) return;
    try {
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      await addDoc(collection(db, 'purchases'), {
        adminId: profile.id,
        adminName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        quantityPurchased: purchaseQuantity,
        createdAt: Date.now()
      });

      // Update inventory
      const drugRef = doc(db, 'drugs', drug.id);
      await updateDoc(drugRef, {
        storeQuantity: increment(purchaseQuantity)
      });
      
      setSelectedDrug('');
      setPurchaseQuantity(0);
    } catch (err) {
      console.error(err);
      alert('Error adding purchase');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, isRegistered: boolean) => {
    try {
      if (isRegistered) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { role: newRole });
      } else {
        const staffRef = doc(db, 'staff_roles', userId);
        await updateDoc(staffRef, { role: newRole });
      }
    } catch (err) {
      console.error(err);
      alert('Error updating user role');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !staffRole) return;

    try {
      await setDoc(doc(db, 'staff_roles', staffEmail.toLowerCase()), {
        email: staffEmail.toLowerCase(),
        name: staffName,
        role: staffRole
      });
      setStaffEmail('');
      setStaffName('');
      setStaffRole('doctor');
      alert('Staff registered successfully! They can now log in.');
    } catch (err) {
      console.error(err);
      alert('Error registering staff');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex border-b border-slate-300">
        <button
          className={`px-4 py-2 font-bold text-xs uppercase ${activeTab === 'admin' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('admin')}
        >
          Admin Dashboard
        </button>
        <button
          className={`px-4 py-2 font-bold text-xs uppercase ${activeTab === 'store' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('store')}
        >
          Store View (Read Only)
        </button>
        <button
          className={`px-4 py-2 font-bold text-xs uppercase ${activeTab === 'dispensary' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('dispensary')}
        >
          Dispensary View (Read Only)
        </button>
        <button
          className={`px-4 py-2 font-bold text-xs uppercase ${activeTab === 'doctor' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('doctor')}
        >
          Doctor View (Read Only)
        </button>
      </div>

      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Registration & Intake */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Package className="w-4 h-4 mr-2" />
                Control Unit (Admin)
              </h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">Supply Chain</span>
            </div>
            <div className="p-4 flex-1 space-y-6">
              
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase">Register New Drug</h3>
                <form onSubmit={handleAddDrug} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Item Name (e.g. Amoxicillin, Gloves)"
                    value={newDrugName}
                    onChange={e => setNewDrugName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newDrugUnit}
                      onChange={e => setNewDrugUnit(e.target.value.replace(/[0-9]/g, ''))}
                      placeholder="Unit (e.g. pills, boxes)"
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                    />
                    <select
                      value={newDrugCategory}
                      onChange={e => setNewDrugCategory(e.target.value as 'medication' | 'consumable')}
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                    >
                      <option value="medication">Medication</option>
                      <option value="consumable">Consumable</option>
                    </select>
                    <button
                      type="submit"
                      className="whitespace-nowrap px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Inventory Intake Form
                </h3>
                <form onSubmit={handleAddPurchase} className="space-y-2">
                  <select
                    required
                    value={selectedDrug}
                    onChange={e => setSelectedDrug(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                  >
                    <option value="">-- Select Drug --</option>
                    {drugs.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.unit})</option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      placeholder="Quantity"
                      value={purchaseQuantity || ''}
                      onChange={e => setPurchaseQuantity(parseInt(e.target.value))}
                      onKeyDown={(e) => {
                        if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Stock
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* Audit Form Section */}
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <UserX className="w-4 h-4 mr-2" /> Loss Prevention
              </h2>
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">Audit Desk</span>
            </div>
            <div className="p-4 flex-1">
              <form onSubmit={handleAddAudit} className="space-y-3">
                <select
                  required
                  value={auditDrug}
                  onChange={e => setAuditDrug(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                >
                  <option value="">-- Select Drug --</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Missing Qty"
                    value={auditMissingQty || ''}
                    onChange={e => setAuditMissingQty(parseInt(e.target.value))}
                    className="w-full sm:w-1/3 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                  />
                  <select
                    required
                    value={auditUserId}
                    onChange={e => setAuditUserId(e.target.value)}
                    className="flex-1 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                  >
                    <option value="">-- Responsible Person --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Notes/Reason..."
                  value={auditNotes}
                  onChange={e => setAuditNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-red-600 text-white rounded text-xs font-bold shadow-sm hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <AlertTriangle className="w-3 h-3 mr-2" />
                  Log Missing Item
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Dashboard & Reporting */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* User Management */}
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Users className="w-4 h-4 mr-2" /> User Role Management
              </h2>
            </div>
            <div className="p-4 border-b border-slate-200 bg-white">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Pre-register New Staff</h3>
              <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  type="text"
                  placeholder="Full Name (Optional)"
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full sm:flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={staffEmail}
                  onChange={e => setStaffEmail(e.target.value)}
                  className="w-full sm:flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                />
                <select
                  required
                  value={staffRole}
                  onChange={e => setStaffRole(e.target.value)}
                  className="w-full sm:w-32 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                >
                  <option value="doctor">Doctor</option>
                  <option value="dispensary">Dispensary</option>
                  <option value="store">Store</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Register Staff
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Current Role</th>
                    <th className="px-4 py-3 text-right">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {combinedUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {u.name}
                        {!u.isRegistered && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500">Unregistered</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'doctor' ? 'bg-blue-100 text-blue-700' :
                          u.role === 'dispensary' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value, u.isRegistered)}
                          disabled={u.email.toLowerCase() === 'oreloretechcustomerservice@gmail.com'}
                          className="p-1 border border-slate-300 rounded text-[10px] bg-white focus:outline-none focus:border-slate-400 disabled:opacity-50 disabled:bg-slate-100"
                        >
                          <option value="pending">Pending</option>
                          <option value="doctor">Doctor</option>
                          <option value="dispensary">Dispensary</option>
                          <option value="store">Store</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 text-white p-4 rounded-lg shadow-sm border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Total Purchases</div>
              <div className="text-2xl font-bold">{purchases.reduce((sum, p) => sum + p.quantityPurchased, 0).toLocaleString()} Units</div>
            </div>
            <div className="bg-red-600 text-white p-4 rounded-lg shadow-sm border border-red-700">
              <div className="text-[10px] text-red-200 uppercase tracking-wider font-bold mb-1">Total Missing / Lost</div>
              <div className="text-2xl font-bold">{audits.reduce((sum, a) => sum + a.discrepancy, 0).toLocaleString()} Units</div>
            </div>
          </div>

          {/* Inventory & Discrepancy Report */}
          <section className="flex-1 flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs">Inventory & Audit Report</h2>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Purchased</th>
                    <th className="px-4 py-3 text-right">Dispensed</th>
                    <th className="px-4 py-3 text-right">Lost</th>
                    <th className="px-4 py-3 text-right">Store Qty</th>
                    <th className="px-4 py-3 text-right">Dispensary Qty</th>
                    <th className="px-4 py-3 text-right">System Total</th>
                    <th className="px-4 py-3 text-right">Unaccounted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {drugs.map(drug => {
                    const totalPurchased = purchases.filter(p => p.drugId === drug.id).reduce((sum, p) => sum + p.quantityPurchased, 0);
                    const totalDispensed = dispenses.filter(d => d.drugId === drug.id).reduce((sum, d) => sum + d.quantityDispensed, 0);
                    const totalLost = audits.filter(a => a.drugId === drug.id).reduce((sum, a) => sum + a.discrepancy, 0);
                    
                    const expectedStock = totalPurchased - totalDispensed - totalLost;
                    const storeQty = drug.storeQuantity !== undefined ? drug.storeQuantity : (drug.quantity || 0);
                    const dispQty = drug.dispensaryQuantity || 0;
                    const systemStock = storeQty + dispQty;
                    const unaccounted = systemStock - expectedStock;

                    return (
                      <tr key={drug.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {drug.name} <span className="text-slate-400 font-normal ml-1">({drug.unit})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 capitalize">
                          {drug.category || 'medication'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{totalPurchased}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{totalDispensed}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">{totalLost > 0 ? totalLost : '-'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{storeQty}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{dispQty}</td>
                        <td className="px-4 py-3 text-right font-medium text-indigo-700">{systemStock}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {unaccounted !== 0 ? (
                            <span className="inline-flex items-center text-red-600 bg-red-50 px-2 py-0.5 rounded text-[10px]">
                              {unaccounted > 0 ? '+' : ''}{unaccounted}
                            </span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {drugs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 text-center text-slate-500">No drugs registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reports Log */}
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-bold text-slate-700 uppercase text-xs">Accountability Reports</h2>
            </div>
            <div className="p-4 bg-white flex flex-col gap-2 max-h-64 overflow-y-auto">
              {audits.map(audit => (
                <div key={audit.id} className="p-3 bg-red-50 border border-red-100 rounded text-xs flex justify-between items-start">
                  <div>
                    <div className="font-bold text-red-800 mb-0.5">Missing: {audit.drugName} ({audit.discrepancy} units)</div>
                    <div className="text-slate-600 text-[11px] mb-1">Notes: {audit.notes}</div>
                    <div className="text-slate-500 text-[10px]">{format(audit.createdAt, 'MMM d, yyyy h:mm a')}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned To</span>
                    <span className="px-2 py-1 bg-white border border-red-200 rounded text-red-700 font-bold">
                      {audit.responsibleUserName}
                    </span>
                  </div>
                </div>
              ))}
              {audits.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-4">No missing inventory reports filed.</div>
              )}
            </div>
          </section>
        </div>
      </div>
      )}

      {activeTab === 'store' && <StoreView profile={profile} readOnly={true} />}
      {activeTab === 'dispensary' && <DispensaryView profile={profile} readOnly={true} />}
      {activeTab === 'doctor' && <DoctorView profile={profile} readOnly={true} />}
    </div>
  );
}

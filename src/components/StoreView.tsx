import React from "react";
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, increment } from 'firebase/firestore';
import { UserProfile, Drug, InternalTransferRecord } from '../types';
import { Package, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function StoreView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transfers, setTransfers] = useState<InternalTransferRecord[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(0);

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    });
    
    const unsubTransfers = onSnapshot(collection(db, 'internal_transfers'), (snap) => {
      setTransfers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InternalTransferRecord)));
    });

    return () => {
      unsubDrugs();
      unsubTransfers();
    };
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || transferQuantity <= 0) return;
    try {
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      const storeQty = drug.storeQuantity !== undefined ? drug.storeQuantity : (drug.quantity || 0);

      if (transferQuantity > storeQty) {
        alert('Insufficient stock in the store to transfer.');
        return;
      }

      await addDoc(collection(db, 'internal_transfers'), {
        storeUserId: profile.id,
        storeUserName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        quantityTransferred: transferQuantity,
        createdAt: Date.now()
      });

      const drugRef = doc(db, 'drugs', drug.id);
      
      const payload: any = {
        storeQuantity: increment(-transferQuantity),
        dispensaryQuantity: increment(transferQuantity)
      };
      
      // Migrate legacy quantity on first transfer
      if (drug.storeQuantity === undefined) {
         payload.storeQuantity = storeQty - transferQuantity;
         payload.dispensaryQuantity = transferQuantity;
      }

      await updateDoc(drugRef, payload);
      
      setSelectedDrug('');
      setTransferQuantity(0);
    } catch (err) {
      console.error(err);
      alert('Error transferring stock');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transfer form */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Send className="w-4 h-4 mr-2" />
                Transfer to Dispensary
              </h2>
            </div>
            <div className="p-4 flex-1">
              <form onSubmit={handleTransfer} className="space-y-3">
                <select
                  required
                  value={selectedDrug}
                  onChange={e => setSelectedDrug(e.target.value)}
                  disabled={readOnly}
                  className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400 disabled:opacity-50"
                >
                  <option value="">-- Select Drug --</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} (Available: {d.storeQuantity !== undefined ? d.storeQuantity : (d.quantity || 0)})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={transferQuantity || ''}
                    onChange={e => setTransferQuantity(parseInt(e.target.value))}
                    disabled={readOnly}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={readOnly}
                    className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                  >
                    Transfer
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* Dashboard */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="flex-1 flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Package className="w-4 h-4 mr-2" /> Store Inventory
              </h2>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Drug Name</th>
                    <th className="px-4 py-3 text-right">Store Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {drugs.map(drug => (
                    <tr key={drug.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {drug.name} <span className="text-slate-400 font-normal ml-1">({drug.unit})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {drug.storeQuantity !== undefined ? drug.storeQuantity : (drug.quantity || 0)}
                      </td>
                    </tr>
                  ))}
                  {drugs.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center text-slate-500">No drugs available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

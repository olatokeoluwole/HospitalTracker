import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc, increment, getDoc } from 'firebase/firestore';
import { UserProfile, Prescription } from '../types';
import { Check, Clock, PackageOpen } from 'lucide-react';
import { format } from 'date-fns';

export default function DispensaryView({ profile }: { profile: UserProfile }) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    });
    return () => unsub();
  }, []);

  const handleDispense = async (prescription: Prescription) => {
    setProcessingId(prescription.id);
    try {
      // Create dispense record
      await addDoc(collection(db, 'dispense_records'), {
        prescriptionId: prescription.id,
        dispensaryId: profile.id,
        dispensaryName: profile.name,
        drugId: prescription.drugId,
        drugName: prescription.drugName,
        quantityDispensed: prescription.quantity,
        createdAt: Date.now()
      });

      // Update prescription status
      await updateDoc(doc(db, 'prescriptions', prescription.id), {
        status: 'dispensed'
      });

      // Get current inventory to check for low stock alert
      const drugRef = doc(db, 'drugs', prescription.drugId);
      const drugSnap = await getDoc(drugRef);
      
      if (drugSnap.exists()) {
        const currentQty = drugSnap.data().quantity || 0;
        const newQty = currentQty - prescription.quantity;
        
        // Update inventory quantity
        await updateDoc(drugRef, {
          quantity: newQty
        });

        // Trigger email notification if stock drops to 3 or below
        if (currentQty > 3 && newQty <= 3) {
          fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: prescription.drugName,
              quantity: newQty
            })
          }).catch(e => console.error("Failed to notify low stock", e));
        }
      } else {
        // Fallback update if doc exists but getDoc fails
        await updateDoc(doc(db, 'drugs', prescription.drugId), {
          quantity: increment(-prescription.quantity)
        });
      }
      
    } catch (err) {
      console.error(err);
      alert('Error dispensing medication. Check permissions or network.');
    } finally {
      setProcessingId(null);
    }
  };

  const pending = prescriptions.filter(p => p.status === 'pending');
  const dispensed = prescriptions.filter(p => p.status === 'dispensed');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Prescriptions */}
        <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 uppercase text-xs">Pharmacy Unit (Dispensary)</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[10px] font-bold flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Dispensing Queue ({pending.length})
            </span>
          </div>
          <div className="p-4 flex flex-col flex-1 gap-3">
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[500px]">
              {pending.map(p => (
                <div key={p.id} className="p-3 border border-slate-200 rounded-lg bg-white relative shadow-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400 italic">#{p.id.slice(0,6)} (Dr. {p.doctorName})</span>
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 rounded-full">Pending</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{p.drugName} ({p.quantity})</p>
                  <p className="text-[11px] text-slate-500">Patient: {p.patientName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{format(p.createdAt, 'MMM d, h:mm a')}</p>
                  <button
                    onClick={() => handleDispense(p)}
                    disabled={processingId === p.id}
                    className="mt-2 w-full py-1.5 border border-slate-900 text-slate-900 rounded text-[11px] font-bold hover:bg-slate-900 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <PackageOpen className="w-3 h-3" />
                    {processingId === p.id ? 'Processing...' : 'Record Dispensed Drug'}
                  </button>
                </div>
              ))}
              {pending.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  No pending prescriptions.
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-100 rounded-lg border-dashed border-2 border-slate-300">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Correlation Status</div>
                <div className="text-xs font-medium text-slate-600">Automatic stock deduction active</div>
                <div className="mt-2 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recently Dispensed */}
        <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 uppercase text-xs">Fulfilled Orders</h2>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Completed ({dispensed.length})
            </span>
          </div>
          <div className="p-4 flex flex-col flex-1 gap-3">
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px]">
              {dispensed.map(p => (
                <div key={p.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 opacity-70">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400">#{p.id.slice(0,6)} (Dr. {p.doctorName})</span>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 rounded-full">Fulfilled</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 line-through">{p.drugName} ({p.quantity})</p>
                  <p className="text-[11px] text-slate-500">Patient: {p.patientName}</p>
                </div>
              ))}
              {dispensed.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  No dispensed prescriptions yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

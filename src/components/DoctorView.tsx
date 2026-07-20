import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy } from 'firebase/firestore';
import { UserProfile, Drug, Prescription } from '../types';
import { Activity, Search, AlertCircle } from 'lucide-react';

export default function DoctorView({ profile }: { profile: UserProfile }) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [search, setSearch] = useState('');
  
  const [selectedDrug, setSelectedDrug] = useState('');
  const [patientName, setPatientName] = useState('');
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    });
    
    const q = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
    const unsubPrescriptions = onSnapshot(q, (snap) => {
      setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    });
    
    return () => {
      unsubDrugs();
      unsubPrescriptions();
    };
  }, []);

  const handlePrescribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || !patientName || quantity <= 0) return;
    
    try {
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      await addDoc(collection(db, 'prescriptions'), {
        doctorId: profile.id,
        doctorName: profile.name,
        patientName,
        drugId: drug.id,
        drugName: drug.name,
        quantity,
        status: 'pending',
        createdAt: Date.now()
      });
      
      setSelectedDrug('');
      setPatientName('');
      setQuantity(0);
    } catch (err) {
      console.error(err);
      alert('Error creating prescription');
    }
  };

  const filteredDrugs = drugs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const myPrescriptions = prescriptions.filter(p => p.doctorId === profile.id);

  return (
      <div className="flex flex-col gap-4">
        {/* Drug Availability */}
        <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
              1. Drug Availability
            </h2>
            <div className="relative w-full sm:w-48 mt-2 sm:mt-0">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <Search className="h-3 w-3 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search Drug Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
              />
            </div>
          </div>
          <div className="p-4 bg-white">
            <div className="h-48 overflow-auto border border-slate-200 rounded p-2 bg-white">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 font-bold uppercase border-b">
                  <tr>
                    <th className="pb-2">Medication</th>
                    <th className="pb-2 text-right">In Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDrugs.map(drug => (
                    <tr key={drug.id} className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-800">{drug.name}</td>
                      <td className={`py-2 text-right font-medium ${drug.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {drug.quantity > 0 ? `${drug.quantity} ${drug.unit}` : 'Out of Stock'}
                      </td>
                    </tr>
                  ))}
                  {filteredDrugs.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 text-slate-500 text-center">No drugs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Create Prescription Form */}
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs">2. Clinical Unit (Doctor)</h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">Prescribing Desk</span>
            </div>
            <div className="p-4 flex-1">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                <h3 className="text-xs font-bold text-blue-800 mb-2">New Digital Prescription</h3>
                <form onSubmit={handlePrescribe} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Patient Name / ID"
                      value={patientName}
                      onChange={e => setPatientName(e.target.value)}
                      className="p-2 border border-blue-200 rounded text-xs focus:outline-none focus:border-blue-400"
                    />
                    <select
                      required
                      value={selectedDrug}
                      onChange={e => setSelectedDrug(e.target.value)}
                      className="p-2 border border-blue-200 rounded text-xs bg-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="">-- Select Drug --</option>
                      {drugs.map(d => (
                        <option key={d.id} value={d.id} disabled={d.quantity <= 0}>
                          {d.name} ({d.quantity} {d.unit} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Quantity"
                        value={quantity || ''}
                        onChange={e => setQuantity(parseInt(e.target.value))}
                        className="w-full p-2 border border-blue-200 rounded text-xs focus:outline-none focus:border-blue-400"
                      />
                      {selectedDrug && quantity > 0 && drugs.find(d => d.id === selectedDrug)!.quantity < quantity && (
                        <p className="mt-1 text-[10px] text-red-600 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" /> Requested exceeds stock
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={selectedDrug ? (quantity > drugs.find(d => d.id === selectedDrug)!.quantity) : false}
                    className="w-full py-2 bg-blue-600 text-white rounded text-xs font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Authorize & Send to Dispensary
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* My Prescriptions */}
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs">3. Prescription History</h2>
            </div>
            <div className="p-4 flex-1">
              <div className="overflow-auto max-h-[220px] border border-slate-200 rounded p-2 bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 font-bold uppercase border-b">
                    <tr>
                      <th className="pb-2">Patient</th>
                      <th className="pb-2">Drug</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myPrescriptions.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2 font-medium text-slate-800">{p.patientName}</td>
                        <td className="py-2 text-slate-600">{p.drugName}</td>
                        <td className="py-2 text-slate-600">{p.quantity}</td>
                        <td className="py-2 text-right">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                            p.status === 'dispensed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {p.status === 'dispensed' ? 'Fulfilled' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {myPrescriptions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-slate-500 text-center">
                          No prescriptions written yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
  );
}

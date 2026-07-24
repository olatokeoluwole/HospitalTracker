export type Role = 'admin' | 'doctor' | 'dispensary' | 'store' | 'pending';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Drug {
  id: string;
  name: string;
  storeQuantity: number;
  dispensaryQuantity: number;
  quantity?: number;
  unit?: string;
  category?: 'medication' | 'consumable';
  createdAt: number;
}

export interface ConsumableUsageRecord {
  id: string;
  userId: string;
  userName: string;
  drugId: string;
  drugName: string;
  quantityUsed: number;
  department?: string;
  createdAt: number;
}

export interface InternalTransferRecord {
  id: string;
  storeUserId: string;
  storeUserName: string;
  drugId: string;
  drugName: string;
  quantityTransferred: number;
  createdAt: number;
}

export interface Prescription {
  id: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  drugId: string;
  drugName: string;
  quantity: number;
  status: 'pending' | 'dispensed';
  createdAt: number;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  dispensaryId: string;
  dispensaryName: string;
  drugId: string;
  drugName: string;
  quantityDispensed: number;
  createdAt: number;
}

export interface PurchaseRecord {
  id: string;
  adminId: string;
  adminName: string;
  drugId: string;
  drugName: string;
  quantityPurchased: number;
  createdAt: number;
}

export interface AuditReport {
  id: string;
  drugId: string;
  drugName: string;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  responsibleUserId: string;
  responsibleUserName: string;
  notes: string;
  adminId: string;
  createdAt: number;
}

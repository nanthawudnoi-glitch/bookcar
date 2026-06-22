/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  deleteField,
  orderBy,
  where,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Car, 
  Calendar, 
  User, 
  LogOut, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Info,
  ChevronRight,
  LayoutDashboard,
  Settings,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Edit2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, signIn, logOut } from './firebase';
import { SummaryView } from './components/SummaryView';
import { ScheduleView } from './components/ScheduleView';
import { ReportView } from './components/ReportView';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt: any;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  type: string;
  status: 'available' | 'maintenance' | 'in-use';
  imageUrl?: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'unavailable' | 'on-duty';
}

interface Booking {
  id: string;
  userId: string;
  userName: string;
  vehicleId: string;
  vehicleName: string;
  driverId?: string;
  driverName?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  purpose: string;
  destination: string;
  passengers?: string;
  requesterName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  createdAt: any;
  adminComment?: string;
}

function safeToDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (val.seconds !== undefined) return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  return new Date(val);
}

// Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (operationType === OperationType.CREATE || operationType === OperationType.UPDATE || operationType === OperationType.DELETE) {
    let msg = `เกิดข้อผิดพลาดในการทำรายการ (${operationType}): `;
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.toLowerCase().includes('permission-denied') || errMsg.toLowerCase().includes('permission denied')) {
      msg += 'ไม่มีสิทธิ์ในการเข้าถึงข้อมูลหรือส่งข้อมูล (Permission Denied) กรุณาตรวจสอบสถานะการล็อคอินหรือติดต่อผู้ดูแลระบบ';
    } else {
      msg += errMsg;
    }
    alert(msg);
  }
}

// Constants
const LOGO_URL = "https://drive.google.com/uc?id=1LrZ0vcqqKDsefPeG0hshD0sXoI_Xls1Z";

// Components
const Navbar = ({ user, profile, onLogout }: { user: FirebaseUser, profile: UserProfile | null, onLogout: () => void }) => (
  <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex justify-between items-center sticky top-0 z-50">
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <img 
          src={LOGO_URL} 
          alt="TTC Logo" 
          className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      <div>
        <h1 className="font-bold text-slate-900 leading-tight text-sm sm:text-lg uppercase tracking-tight">
          TTC <span className="text-indigo-600">Smart</span> Fleet
        </h1>
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-slate-900">{user.displayName}</p>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
          {profile?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'บุคลากร'}
        </p>
      </div>
      <button 
        onClick={onLogout}
        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
        title="ออกจากระบบ"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </nav>
);

const Badge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700 border-emerald-200",
    maintenance: "bg-amber-100 text-amber-700 border-amber-200",
    "in-use": "bg-slate-100 text-slate-700 border-slate-200",
    pending: "bg-blue-100 text-blue-700 border-blue-200",
    approved: "bg-indigo-100 text-indigo-700 border-indigo-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-400 border-slate-200",
    completed: "bg-slate-100 text-slate-700 border-slate-200",
    "on-duty": "bg-blue-100 text-blue-700 border-blue-200",
    unavailable: "bg-red-100 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    available: "ว่าง",
    maintenance: "ซ่อมบำรุง",
    "in-use": "กำลังใช้งาน",
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ปฏิเสธ",
    cancelled: "ยกเลิกแล้ว",
    completed: "เสร็จสิ้น",
    "on-duty": "ปฏิบัติงาน",
    unavailable: "ไม่ว่าง",
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", styles[status] || styles.pending)}>
      {labels[status] || status}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'approvals' | 'bookings' | 'vehicles' | 'admin' | 'summary' | 'schedule' | 'reports'>('schedule');
  const [adminSubTab, setAdminSubTab] = useState<'vehicles' | 'drivers' | 'users'>('vehicles');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  
  const [isVehicleEditModalOpen, setIsVehicleEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDriverEditModalOpen, setIsDriverEditModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectComment, setRejectComment] = useState<string>("");

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check/Create Profile
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            // Check if user was pre-registered by email
            const q = query(collection(db, 'users'), where('email', '==', currentUser.email));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              // Found pre-registered user, update with real UID
              const existingDoc = querySnap.docs[0];
              const updatedProfile = {
                ...existingDoc.data(),
                uid: currentUser.uid,
                displayName: currentUser.displayName || existingDoc.data().displayName || 'User',
              } as UserProfile;
              
              // Delete old doc if it had a different ID (e.g. random ID)
              if (existingDoc.id !== currentUser.uid) {
                await deleteDoc(doc(db, 'users', existingDoc.id));
              }
              
              await setDoc(userDocRef, updatedProfile);
              setProfile(updatedProfile);
            } else {
              // New user, create profile
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'User',
                email: currentUser.email || '',
                role: currentUser.email === 'nanthawudnoi@gmail.com' ? 'admin' : 'staff',
                createdAt: serverTimestamp(),
              };
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    // Vehicles
    const vQuery = query(collection(db, 'vehicles'), orderBy('plateNumber'));
    const unsubscribeVehicles = onSnapshot(vQuery, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles'));

    // Drivers
    const dQuery = query(collection(db, 'drivers'), orderBy('name'));
    const unsubscribeDrivers = onSnapshot(dQuery, (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'drivers'));

    // My Bookings
    const myBQuery = query(
      collection(db, 'bookings'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeMyBookings = onSnapshot(myBQuery, (snap) => {
      setMyBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings (my)'));

    // All Bookings (for Schedule)
    const allBQuery = query(collection(db, 'bookings'), orderBy('startTime', 'asc'));
    const unsubscribeAllBookings = onSnapshot(allBQuery, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings (all)'));

    // Admin Listeners
    let unsubscribeUsers = () => {};
    if (profile?.role === 'admin') {
      const uQuery = query(collection(db, 'users'), orderBy('displayName'));
      unsubscribeUsers = onSnapshot(uQuery, (snap) => {
        setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    }

    return () => {
      unsubscribeVehicles();
      unsubscribeDrivers();
      unsubscribeMyBookings();
      unsubscribeAllBookings();
      unsubscribeUsers();
    };
  }, [user, profile]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleCreateBooking = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedVehicle) return;

    const formData = new FormData(e.currentTarget);
    const startTimeStr = formData.get('startTime') as string;
    const endTimeStr = formData.get('endTime') as string;

    if (!startTimeStr || !endTimeStr) {
      alert('กรุณาระบุวันเวลาที่เริ่มและกลับให้ครบถ้วน');
      return;
    }

    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert('รูปแบบวันเวลาไม่ถูกต้อง กรุณาระบุใหม่');
      return;
    }

    if (start >= end) {
      alert('เวลาที่กลับต้องอยู่หลังเวลาที่เริ่ม');
      return;
    }

    // Check overlap for vehicle
    const isOverlapping = bookings.some(b => 
      b.vehicleId === selectedVehicle.id && 
      (b.status === 'approved' || b.status === 'pending') && 
      safeToDate(b.startTime) < end && 
      safeToDate(b.endTime) > start
    );
    
    if (isOverlapping) {
      alert('รถยนต์คันนี้มีการจองในช่วงเวลาดังกล่าวแล้ว (กรุณาตรวจสอบตารางเวลา)');
      return;
    }

    try {
      const newBooking = {
        userId: user.uid,
        userName: user.displayName || profile?.displayName || 'User',
        vehicleId: selectedVehicle.id,
        vehicleName: `${selectedVehicle.model} (${selectedVehicle.plateNumber})`,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        purpose: (formData.get('purpose') as string) || '',
        destination: (formData.get('destination') as string) || '',
        passengers: (formData.get('passengers') as string) || '',
        requesterName: (formData.get('requesterName') as string) || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'bookings'), newBooking);
      setIsBookingModalOpen(false);
      setSelectedVehicle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: string, comment?: string, driverId?: string, vehicleId?: string) => {
    try {
      const currentBooking = bookings.find(b => b.id === bookingId);
      if (!currentBooking) return;

      const targetVehicleId = vehicleId || currentBooking.vehicleId;
      
      if (status === 'approved') {
        const start = safeToDate(currentBooking.startTime);
        const end = safeToDate(currentBooking.endTime);

        // Check vehicle overlap (against other approved bookings)
        const isVehicleBusy = bookings.some(b => 
          b.id !== bookingId &&
          b.vehicleId === targetVehicleId &&
          b.status === 'approved' &&
          safeToDate(b.startTime) < end && 
          safeToDate(b.endTime) > start
        );

        if (isVehicleBusy) {
          alert('ไม่สามารถอนุมัติได้: รถยนต์คันนี้มีการจองที่ได้รับการอนุมัติในช่วงเวลาดังกล่าวแล้ว');
          return;
        }

        // Check driver overlap
        if (driverId) {
          const isDriverBusy = bookings.some(b => 
            b.id !== bookingId &&
            b.driverId === driverId && 
            b.status === 'approved' && 
            safeToDate(b.startTime) < end && 
            safeToDate(b.endTime) > start
          );
          
          if (isDriverBusy) {
            alert('ไม่สามารถอนุมัติได้: พนักงานขับรถท่านนี้ติดภารกิจในช่วงเวลาดังกล่าวแล้ว');
            return;
          }
        }
      }

      const updateData: any = { 
        status, 
        updatedAt: serverTimestamp()
      };
      
      if (comment !== undefined) {
        updateData.adminComment = comment;
      }
      
      if (vehicleId && vehicleId !== currentBooking.vehicleId) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (vehicle) {
          updateData.vehicleId = vehicle.id;
          updateData.vehicleName = `${vehicle.model} (${vehicle.plateNumber})`;
        }
      }

      if (driverId !== undefined) {
        if (driverId === "") {
          updateData.driverId = deleteField();
          updateData.driverName = deleteField();
        } else {
          const driver = drivers.find(d => d.id === driverId);
          if (driver) {
            updateData.driverId = driver.id;
            updateData.driverName = driver.name;
          }
        }
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('ยืนยันการยกเลิกคำขอจอง?')) return;
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { 
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingVehicle) return;
    const formData = new FormData(e.currentTarget);
    const updatedVehicle = {
      plateNumber: formData.get('plateNumber'),
      model: formData.get('model'),
      type: formData.get('type'),
      imageUrl: formData.get('imageUrl') || '',
    };

    try {
      await updateDoc(doc(db, 'vehicles', editingVehicle.id), updatedVehicle);
      setIsVehicleEditModalOpen(false);
      setEditingVehicle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${editingVehicle.id}`);
    }
  };

  const handleUpdateDriver = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDriver) return;
    const formData = new FormData(e.currentTarget);
    const updatedDriver = {
      name: formData.get('name'),
      phone: formData.get('phone'),
    };

    try {
      await updateDoc(doc(db, 'drivers', editingDriver.id), updatedDriver);
      setIsDriverEditModalOpen(false);
      setEditingDriver(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${editingDriver.id}`);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newVehicle = {
      plateNumber: formData.get('plateNumber'),
      model: formData.get('model'),
      type: formData.get('type'),
      imageUrl: formData.get('imageUrl') || '',
      status: 'available',
    };

    try {
      await addDoc(collection(db, 'vehicles'), newVehicle);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vehicles');
    }
  };

  const handleAddDriver = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newDriver = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      status: 'available',
    };

    try {
      await addDoc(collection(db, 'drivers'), newDriver);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'drivers');
    }
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const role = formData.get('role') as 'admin' | 'staff';
    const displayName = formData.get('displayName') as string;

    if (allUsers.some(u => u.email === email)) {
      alert('อีเมลนี้มีอยู่ในระบบแล้ว');
      return;
    }

    const newUser = {
      uid: 'PENDING_' + Date.now(),
      email,
      role,
      displayName: displayName || 'รอดำเนินการ',
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', newUser.uid), newUser);
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'admin' | 'staff') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('ยืนยันการลบผู้ใช้งาน?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('ยืนยันการลบข้อมูลรถยนต์?')) return;
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${vehicleId}`);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!confirm('ยืนยันการลบข้อมูลพนักงานขับรถ?')) return;
    try {
      await deleteDoc(doc(db, 'drivers', driverId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drivers/${driverId}`);
    }
  };

  const handleSignIn = async () => {
    setLoginError(null);
    try {
      await signIn();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError("โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console กรุณาแจ้งผู้ดูแลระบบ");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("ป๊อปอัพถูกบล็อก กรุณาอนุญาตให้เปิดป๊อปอัพเพื่อเข้าสู่ระบบ");
      } else if (error.code === 'auth/network-request-failed') {
        setLoginError("การเชื่อมต่อเครือข่ายล้มเหลว กรุณาตรวจสอบอินเทอร์เน็ต หรือลองเปิดแอปในแท็บใหม่ (Open in new tab)");
      } else {
        setLoginError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ: " + (error.message || "ไม่ทราบสาเหตุ"));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
        {/* Left Side: Hero Section (Desktop Only) */}
        <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 p-16 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white p-3 rounded-3xl flex items-center justify-center mb-10 shadow-xl">
              <img 
                src={LOGO_URL} 
                alt="TTC Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-6xl font-black text-white leading-tight mb-8 tracking-tight uppercase">
              TTC <span className="text-indigo-300">Smart</span><br />
              Fleet
            </h1>
            <p className="text-indigo-100 text-2xl max-w-md font-light leading-relaxed">
              ระบบจองรถยนต์ราชการอัจฉริยะ<br />
              <span className="text-lg opacity-80 mt-4 block">วิทยาลัยเทคนิคตรัง</span>
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-10">
            <div className="flex items-center gap-5 text-white/90">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">จองง่าย</p>
                <p className="text-sm opacity-70">ผ่านระบบออนไลน์ 24 ชม.</p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-white/90">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-lg">อนุมัติไว</p>
                <p className="text-sm opacity-70">แจ้งเตือนสถานะทันที</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white lg:bg-slate-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <div className="lg:hidden mb-12 text-center">
              <div className="w-24 h-24 bg-white p-4 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200/50 border border-slate-100">
                <img 
                  src={LOGO_URL} 
                  alt="TTC Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2 uppercase tracking-tight">TTC <span className="text-indigo-600">Smart</span> Fleet</h1>
              <p className="text-slate-500 font-medium">ระบบจองรถยนต์ราชการอัจฉริยะ</p>
            </div>

            <div className="bg-white p-10 lg:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100">
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">ยินดีต้อนรับ</h2>
                <p className="text-slate-500 text-lg">กรุณาเข้าสู่ระบบด้วยบัญชี Google</p>
              </div>

              {loginError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{loginError}</p>
                </div>
              )}

              <button 
                onClick={handleSignIn}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-4 hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 group"
              >
                <div className="bg-white p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                </div>
                <span className="text-lg">เข้าสู่ระบบด้วย Google</span>
              </button>

              <div className="mt-12 pt-8 border-t border-slate-100">
                <div className="flex items-start gap-4 text-slate-400">
                  <div className="mt-1">
                    <AlertCircle className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-700">คำแนะนำการเข้าใช้งาน</p>
                    <p className="text-sm leading-relaxed mt-2 text-slate-500">
                      ระบบนี้สงวนสิทธิ์เฉพาะบุคลากรของวิทยาลัยเทคนิคตรังเท่านั้น 
                      กรุณาใช้บัญชีอีเมลที่ลงทะเบียนไว้เพื่อเข้าถึงข้อมูลการจอง
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-10 text-center text-slate-400 text-sm font-medium">
              &copy; 2026 วิทยาลัยเทคนิคตรัง. สงวนลิขสิทธิ์.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar user={user} profile={profile} onLogout={logOut} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 mb-8 w-full sm:w-fit shadow-sm overflow-x-auto no-scrollbar">
          <div className="flex min-w-max sm:min-w-0">
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('approvals')}
                className={cn(
                  "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap relative",
                  activeTab === 'approvals' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900",
                  activeTab !== 'approvals' && bookings.filter(b => b.status === 'pending').length > 0 && "bg-red-50/50"
                )}
              >
                {activeTab !== 'approvals' && bookings.filter(b => b.status === 'pending').length > 0 && (
                  <motion.div 
                    layoutId="pulse-bg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-red-100/30 rounded-xl -z-10"
                  />
                )}
                <CheckCircle className={cn("w-4 h-4", activeTab !== 'approvals' && bookings.filter(b => b.status === 'pending').length > 0 ? "text-red-500" : "")} />
                คำขอรออนุมัติ
                {bookings.filter(b => b.status === 'pending').length > 0 && (
                  <motion.span 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full shadow-sm shadow-red-200"
                  >
                    {bookings.filter(b => b.status === 'pending').length}
                  </motion.span>
                )}
              </button>
            )}
            <button 
              onClick={() => setActiveTab('schedule')}
              className={cn(
                "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'schedule' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              ตารางการใช้รถ
            </button>
            <button 
              onClick={() => setActiveTab('bookings')}
              className={cn(
                "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'bookings' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              การจองของฉัน
            </button>
            <button 
              onClick={() => setActiveTab('vehicles')}
              className={cn(
                "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'vehicles' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Car className="w-4 h-4" />
              รายการรถยนต์
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn(
                "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === 'summary' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              สรุปผล
            </button>
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('reports')}
                className={cn(
                  "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                  activeTab === 'reports' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <FileText className="w-4 h-4" />
                รายงาน
              </button>
            )}
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={cn(
                  "px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap",
                  activeTab === 'admin' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                จัดการระบบ
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'approvals' && profile?.role === 'admin' && (
            <motion.div
              key="approvals"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">คำขอรออนุมัติ</h2>
                <p className="text-slate-500">ตรวจสอบและอนุมัติคำขอใช้รถยนต์ราชการ</p>
              </div>
              
              <div className="grid gap-4">
                {bookings.filter(b => b.status === 'pending').map(booking => (
                  <div key={booking.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                          {booking.userName[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{booking.userName}</h3>
                          <p className="text-sm text-slate-500">ขอใช้รถ: {booking.vehicleName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">จุดหมาย</p>
                        <p className="font-bold text-slate-900">{booking.destination}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 grid sm:grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div className="text-sm">
                          <span className="text-slate-400">เริ่ม: </span>
                          <span className="font-semibold">{format(safeToDate(booking.startTime), 'd MMM yy HH:mm', { locale: th })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Info className="w-4 h-4 text-slate-400" />
                        <div className="text-sm">
                          <span className="text-slate-400">วัตถุประสงค์: </span>
                          <span className="font-semibold">{booking.purpose}</span>
                        </div>
                      </div>
                      {booking.passengers && (
                        <div className="flex items-center gap-3 sm:col-span-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div className="text-sm">
                            <span className="text-slate-400">ผู้ร่วมเดินทาง: </span>
                            <span className="font-semibold">{booking.passengers}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">เปลี่ยนรถยนต์ (ถ้าจำเป็น)</label>
                        <select 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          onChange={(e) => setSelectedVehicleId(e.target.value)}
                          value={selectedVehicleId || booking.vehicleId}
                        >
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.model} ({v.plateNumber}) - {v.status === 'available' ? 'ว่าง' : v.status}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">มอบหมายพนักงานขับรถ</label>
                        <select 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          onChange={(e) => setSelectedDriverId(e.target.value)}
                          value={selectedDriverId}
                        >
                          <option value="">-- ไม่ระบุพนักงานขับรถ --</option>
                          {drivers.filter(d => d.status === 'available').map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          handleUpdateBookingStatus(booking.id, 'approved', '', selectedDriverId, selectedVehicleId);
                          setSelectedDriverId("");
                          setSelectedVehicleId("");
                        }}
                        className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> อนุมัติ
                      </button>
                      <button 
                        onClick={() => {
                          setRejectingBooking(booking);
                          setRejectComment("");
                        }}
                        className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
                      >
                        <XCircle className="w-4 h-4" /> ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
                {bookings.filter(b => b.status === 'pending').length === 0 && (
                  <p className="text-slate-400 text-center py-8 bg-white rounded-2xl border border-slate-100 border-dashed">ไม่มีคำขอรออนุมัติ</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">บทสรุปการจองรถ</h2>
                <p className="text-slate-500">ภาพรวมข้อมูลการจองรถยนต์ราชการ</p>
              </div>
              <SummaryView 
                bookings={profile?.role === 'admin' ? bookings : myBookings} 
                vehicles={vehicles} 
                drivers={drivers}
              />
            </motion.div>
          )}

          {activeTab === 'reports' && profile?.role === 'admin' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">ออกรายงานราชการ</h2>
                <p className="text-slate-500">พิมพ์เอกสารรายงานการขอใช้รถยนต์ตามระเบียบงานสารบรรณ</p>
              </div>
              <ReportView bookings={bookings} />
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">ตารางการใช้รถยนต์</h2>
                <p className="text-slate-500">ตรวจสอบตารางการจองรถยนต์ราชการทั้งหมด</p>
              </div>
              <ScheduleView 
                bookings={bookings} 
                isAdmin={profile?.role === 'admin'}
                vehicles={vehicles}
                drivers={drivers}
                onUpdateBooking={handleUpdateBookingStatus}
              />
            </motion.div>
          )}

          {activeTab === 'bookings' && (
            <motion.div 
              key="bookings"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">ประวัติการจอง</h2>
                <button 
                  onClick={() => setActiveTab('vehicles')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  <Plus className="w-4 h-4" />
                  จองรถใหม่
                </button>
              </div>

              {myBookings.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 border-dashed">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="text-slate-400 w-8 h-8" />
                  </div>
                  <h3 className="text-slate-900 font-bold mb-1">ยังไม่มีรายการจอง</h3>
                  <p className="text-slate-500 text-sm">คุณยังไม่ได้ทำการจองรถยนต์ราชการในขณะนี้</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {myBookings.map(booking => (
                    <div key={booking.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900">{booking.vehicleName}</h3>
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" /> {booking.destination}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge status={booking.status} />
                          {booking.status === 'pending' && (
                            <button 
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-[10px] text-red-500 font-bold hover:underline"
                            >
                              ยกเลิกคำขอ
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <Clock className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">เริ่มเดินทาง</p>
                            <p className="text-xs font-semibold text-slate-700">
                              {format(safeToDate(booking.startTime), 'd MMM yy HH:mm', { locale: th })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <Clock className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">กลับถึง</p>
                            <p className="text-xs font-semibold text-slate-700">
                              {format(safeToDate(booking.endTime), 'd MMM yy HH:mm', { locale: th })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Info className="w-3 h-3" />
                            <span>วัตถุประสงค์: {booking.purpose}</span>
                          </div>
                          {booking.passengers && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <User className="w-3 h-3" />
                              <span>ผู้ร่วมเดินทาง: {booking.passengers}</span>
                            </div>
                          )}
                          {booking.driverName && (
                            <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
                              <User className="w-3 h-3" />
                              <span>พนักงานขับรถ: {booking.driverName}</span>
                            </div>
                          )}
                        </div>
                        {booking.adminComment && (
                          <div className="text-xs text-red-500 font-medium">
                            หมายเหตุ: {booking.adminComment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'vehicles' && (
            <motion.div 
              key="vehicles"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold text-slate-900">รายการรถยนต์ที่พร้อมให้บริการ</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {vehicles.map(vehicle => (
                  <div key={vehicle.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm group hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                    <div className="h-48 bg-slate-100 relative">
                      <img 
                        src={vehicle.imageUrl || `https://picsum.photos/seed/${vehicle.plateNumber}/600/400`} 
                        className="w-full h-full object-cover"
                        alt={vehicle.model}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4">
                        <Badge status={vehicle.status} />
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{vehicle.model}</h3>
                          <p className="text-indigo-600 font-mono font-bold">{vehicle.plateNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">ประเภท</p>
                          <p className="text-sm font-semibold text-slate-700">{vehicle.type || 'รถยนต์นั่งส่วนบุคคล'}</p>
                        </div>
                      </div>
                      
                      <button 
                        disabled={vehicle.status !== 'available'}
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setIsBookingModalOpen(true);
                        }}
                        className={cn(
                          "w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                          vehicle.status === 'available' 
                            ? "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        {vehicle.status === 'available' ? (
                          <>
                            <Calendar className="w-4 h-4" />
                            จองรถคันนี้
                          </>
                        ) : 'ไม่พร้อมให้บริการ'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && profile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              {/* Admin Sub-tabs */}
              <div className="flex gap-4 border-b border-slate-200 overflow-x-auto pb-px no-scrollbar">
                {['vehicles', 'drivers', 'users'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAdminSubTab(tab as any)}
                    className={cn(
                      "pb-4 text-sm font-bold transition-all relative whitespace-nowrap",
                      adminSubTab === tab ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab === 'vehicles' && 'จัดการรถยนต์'}
                    {tab === 'drivers' && 'พนักงานขับรถ'}
                    {tab === 'users' && 'ผู้ใช้งานระบบ'}
                    {adminSubTab === tab && (
                      <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {adminSubTab === 'vehicles' && (
                <section className="space-y-6">
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6">เพิ่มรถยนต์ใหม่</h3>
                    <form onSubmit={handleAddVehicle} className="grid sm:grid-cols-5 gap-4">
                      <input name="plateNumber" placeholder="เลขทะเบียน" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input name="model" placeholder="ยี่ห้อ/รุ่น" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input name="type" placeholder="ประเภทรถ" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input name="imageUrl" placeholder="URL รูปภาพรถ" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <button type="submit" className="bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">เพิ่มรถ</button>
                    </form>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left min-w-[700px] sm:min-w-0">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">รูปภาพ</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">ทะเบียน</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">รุ่น</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">สถานะ</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vehicles.map(v => (
                          <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                <img 
                                  src={v.imageUrl || `https://picsum.photos/seed/${v.plateNumber}/100/100`} 
                                  className="w-full h-full object-cover"
                                  alt={v.model}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-indigo-600">{v.plateNumber}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-700">{v.model}</td>
                            <td className="px-6 py-4"><Badge status={v.status} /></td>
                            <td className="px-6 py-4 text-right">
                              <select 
                                value={v.status}
                                onChange={(e) => updateDoc(doc(db, 'vehicles', v.id), { status: e.target.value })}
                                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="available">ว่าง</option>
                                <option value="maintenance">ซ่อมบำรุง</option>
                                <option value="in-use">กำลังใช้งาน</option>
                              </select>
                              <button 
                                onClick={() => {
                                  setEditingVehicle(v);
                                  setIsVehicleEditModalOpen(true);
                                }}
                                className="ml-3 text-indigo-400 hover:text-indigo-600 transition-colors"
                              >
                                แก้ไข
                              </button>
                              <button 
                                onClick={() => handleDeleteVehicle(v.id)}
                                className="ml-3 text-red-400 hover:text-red-600 transition-colors"
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {adminSubTab === 'drivers' && (
                <section className="space-y-6">
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6">เพิ่มพนักงานขับรถ</h3>
                    <form onSubmit={handleAddDriver} className="grid sm:grid-cols-3 gap-4">
                      <input name="name" placeholder="ชื่อ-นามสกุล" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input name="phone" placeholder="เบอร์โทรศัพท์" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <button type="submit" className="bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">เพิ่มพนักงาน</button>
                    </form>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left min-w-[600px] sm:min-w-0">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">ชื่อ</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">เบอร์โทร</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">สถานะ</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drivers.map(d => (
                          <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{d.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{d.phone}</td>
                            <td className="px-6 py-4"><Badge status={d.status} /></td>
                            <td className="px-6 py-4 text-right">
                              <select 
                                value={d.status}
                                onChange={(e) => updateDoc(doc(db, 'drivers', d.id), { status: e.target.value })}
                                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="available">ว่าง</option>
                                <option value="unavailable">ไม่ว่าง</option>
                                <option value="on-duty">ปฏิบัติงาน</option>
                              </select>
                              <button 
                                onClick={() => {
                                  setEditingDriver(d);
                                  setIsDriverEditModalOpen(true);
                                }}
                                className="ml-3 text-indigo-400 hover:text-indigo-600 transition-colors"
                              >
                                แก้ไข
                              </button>
                              <button 
                                onClick={() => handleDeleteDriver(d.id)}
                                className="ml-3 text-red-400 hover:text-red-600 transition-colors"
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {adminSubTab === 'users' && (
                <section className="space-y-6">
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6">เพิ่มผู้ใช้งานใหม่ (กำหนดสิทธิ์ล่วงหน้า)</h3>
                    <form onSubmit={handleAddUser} className="grid sm:grid-cols-4 gap-4">
                      <input name="displayName" placeholder="ชื่อ-นามสกุล" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <input name="email" type="email" placeholder="อีเมล (Google Account)" required className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      <select name="role" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="staff">บุคลากร</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                      </select>
                      <button type="submit" className="bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">เพิ่มผู้ใช้งาน</button>
                    </form>
                    <p className="mt-4 text-xs text-slate-400 italic">* เมื่อผู้ใช้งานล็อกอินด้วยอีเมลนี้ ระบบจะอัปเดตข้อมูลและกำหนดสิทธิ์ให้อัตโนมัติ</p>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left min-w-[700px] sm:min-w-0">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">ชื่อผู้ใช้งาน</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">อีเมล</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">สิทธิ์</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allUsers.map(u => (
                          <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{u.displayName}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                u.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                              )}>
                                {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'บุคลากร'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <select 
                                value={u.role}
                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                                disabled={u.email === 'nanthawudnoi@gmail.com'}
                              >
                                <option value="staff">บุคลากร</option>
                                <option value="admin">ผู้ดูแลระบบ</option>
                              </select>
                              <button 
                                onClick={() => handleDeleteUser(u.uid)}
                                className="ml-3 text-red-400 hover:text-red-600 transition-colors disabled:opacity-30"
                                disabled={u.email === 'nanthawudnoi@gmail.com'}
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-slate-500 text-sm font-medium">
            พัฒนาระบบโดย <span className="text-slate-900 font-bold">นายนันธวุฒิ น้อย</span>
          </p>
          <p className="text-slate-400 text-xs">
            รองผู้อำนวยการ วิทยาลัยเทคนิคตรัง
          </p>
          <div className="pt-4">
            <div className="w-12 h-1 bg-indigo-600 rounded-full opacity-20 mx-auto" />
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && selectedVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-indigo-600 p-4 sm:p-6 text-white sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">แบบฟอร์มการจองรถ</h3>
                    <p className="text-indigo-100 text-xs sm:text-sm mt-1">{selectedVehicle.model} - {selectedVehicle.plateNumber}</p>
                  </div>
                  <button onClick={() => setIsBookingModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleCreateBooking} className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">วันเวลาที่เริ่ม</label>
                    <input type="datetime-local" name="startTime" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">วันเวลาที่กลับ</label>
                    <input type="datetime-local" name="endTime" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล ผู้ขออนุญาต</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input name="requesterName" placeholder="ระบุชื่อ-นามสกุล..." required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">สถานที่ปลายทาง</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input name="destination" placeholder="ระบุสถานที่..." required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">รายชื่อผู้ร่วมเดินทาง</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input name="passengers" placeholder="ระบุรายชื่อผู้ร่วมเดินทาง (ถ้ามี)..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">วัตถุประสงค์การใช้รถ</label>
                  <textarea name="purpose" rows={3} placeholder="ระบุรายละเอียดงาน..." required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    การจองจะสมบูรณ์เมื่อได้รับการอนุมัติจากผู้ดูแลระบบ กรุณาตรวจสอบความถูกต้องก่อนยืนยัน
                  </p>
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-100">
                  ยืนยันการจอง
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Edit Vehicle Modal */}
      <AnimatePresence>
        {isVehicleEditModalOpen && editingVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVehicleEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-slate-900 p-4 sm:p-6 text-white sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">แก้ไขข้อมูลรถยนต์</h3>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">{editingVehicle.plateNumber}</p>
                  </div>
                  <button onClick={() => setIsVehicleEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleUpdateVehicle} className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">เลขทะเบียน</label>
                  <input name="plateNumber" defaultValue={editingVehicle.plateNumber} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ยี่ห้อ/รุ่น</label>
                  <input name="model" defaultValue={editingVehicle.model} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ประเภทรถ</label>
                  <input name="type" defaultValue={editingVehicle.type} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">URL รูปภาพรถ</label>
                  <input name="imageUrl" defaultValue={editingVehicle.imageUrl} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg">
                  บันทึกการแก้ไข
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Driver Modal */}
      <AnimatePresence>
        {isDriverEditModalOpen && editingDriver && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDriverEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-slate-900 p-4 sm:p-6 text-white sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">แก้ไขข้อมูลพนักงานขับรถ</h3>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">{editingDriver.name}</p>
                  </div>
                  <button onClick={() => setIsDriverEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleUpdateDriver} className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ชื่อ-นามสกุล</label>
                  <input name="name" defaultValue={editingDriver.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">เบอร์โทรศัพท์</label>
                  <input name="phone" defaultValue={editingDriver.phone} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg">
                  บันทึกการแก้ไข
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Booking Modal */}
      <AnimatePresence>
        {rejectingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectingBooking(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-red-600 p-4 sm:p-6 text-white sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">ปฏิเสธคำขอจองรถ</h3>
                    <p className="text-red-100 text-xs sm:text-sm mt-1">ผู้ขอ: {rejectingBooking.userName}</p>
                  </div>
                  <button onClick={() => setRejectingBooking(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-5 sm:p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-sans">ระบุเหตุผลการปฏิเสธ (จำเป็น)</label>
                  <textarea 
                    value={rejectComment} 
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="เช่น รถคันนี้ไม่ว่าง หรือพนักงานขับรถไม่พร้อมปฏิบัติงานในวันดังกล่าว..." 
                    required 
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none font-sans text-slate-700" 
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setRejectingBooking(null)}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors font-sans"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => {
                      if (!rejectComment.trim()) {
                        alert('กรุณากรอกเหตุผลการปฏิเสธด้วยครับ');
                        return;
                      }
                      handleUpdateBookingStatus(rejectingBooking.id, 'rejected', rejectComment);
                      setRejectingBooking(null);
                    }}
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg active:scale-[0.98] font-sans"
                  >
                    ยืนยันการปฏิเสธ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

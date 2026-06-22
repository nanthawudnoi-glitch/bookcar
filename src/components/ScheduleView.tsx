import React from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Car,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, isSameDay, startOfDay, addDays, isAfter, isBefore } from 'date-fns';
import { th } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Booking {
  id: string;
  userId: string;
  userName: string;
  vehicleId: string;
  vehicleName: string;
  driverId?: string;
  driverName?: string;
  startTime: any;
  endTime: any;
  purpose: string;
  destination: string;
  passengers?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
}

interface ScheduleViewProps {
  bookings: Booking[];
  isAdmin?: boolean;
  vehicles?: any[];
  drivers?: any[];
  onUpdateBooking?: (bookingId: string, status: string, comment?: string, driverId?: string, vehicleId?: string) => Promise<void>;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ 
  bookings, 
  isAdmin, 
  vehicles = [], 
  drivers = [], 
  onUpdateBooking 
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [tempDriverId, setTempDriverId] = React.useState<string>("");
  const [tempVehicleId, setTempVehicleId] = React.useState<string>("");

  // Filter only approved and completed bookings for the schedule
  const scheduleBookings = bookings.filter(b => b.status === 'approved' || b.status === 'completed');

  // Generate next 14 days
  const days = Array.from({ length: 14 }).map((_, i) => addDays(startOfDay(new Date()), i));

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">ตารางการใช้รถยนต์</h3>
          <p className="text-slate-500 text-sm">แสดงข้อมูลการจองที่ได้รับการอนุมัติแล้วใน 14 วันล่วงหน้า</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span className="text-slate-600">อนุมัติแล้ว</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span className="text-slate-600">เสร็จสิ้น</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {days.map((day, i) => {
          const dayBookings = scheduleBookings.filter(b => {
            const start = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return isSameDay(start, day);
          });

          return (
            <motion.div
              key={day.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group"
            >
              <div className="flex gap-4 md:gap-8">
                {/* Date Column */}
                <div className="w-16 md:w-24 shrink-0 text-center pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                    {format(day, 'EEE', { locale: th })}
                  </p>
                  <p className={cn(
                    "text-2xl font-black leading-none",
                    isSameDay(day, new Date()) ? "text-indigo-600" : "text-slate-900"
                  )}>
                    {format(day, 'd')}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                    {format(day, 'MMM', { locale: th })}
                  </p>
                </div>

                {/* Bookings Column */}
                <div className="flex-1 space-y-3 pb-8 relative">
                  {/* Vertical Line */}
                  <div className="absolute left-[-21px] md:left-[-41px] top-0 bottom-0 w-px bg-slate-200 group-last:bg-transparent"></div>
                  <div className="absolute left-[-24px] md:left-[-44px] top-4 w-2 h-2 rounded-full border-2 border-slate-200 bg-white"></div>

                  {dayBookings.length > 0 ? (
                    dayBookings.map(booking => (
                      <div 
                        key={booking.id}
                        className={cn(
                          "p-5 rounded-2xl border transition-all hover:shadow-md",
                          booking.status === 'approved' 
                            ? "bg-white border-slate-200 hover:border-indigo-200" 
                            : "bg-slate-50 border-slate-100 opacity-75"
                        )}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                booking.status === 'approved' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
                              )}>
                                {booking.status === 'approved' ? 'อนุมัติแล้ว' : 'เสร็จสิ้น'}
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                                <Clock className="w-3.5 h-3.5" />
                                {format(booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.startTime), 'HH:mm')} - {format(booking.endTime?.toDate ? booking.endTime.toDate() : new Date(booking.endTime), 'HH:mm')} น.
                              </div>
                            </div>

                            <h4 className="font-bold text-slate-900 text-lg leading-tight">
                              {booking.purpose}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{booking.destination}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">ผู้จอง: {booking.userName}</span>
                              </div>
                              {booking.passengers && (
                                <div className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <span className="font-medium text-xs">ผู้ร่วมเดินทาง: {booking.passengers}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-3 pt-2">
                              {editingId === booking.id ? (
                                <div className="w-full space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                  <div className="grid sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">เปลี่ยนรถ</label>
                                      <select 
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={tempVehicleId}
                                        onChange={(e) => setTempVehicleId(e.target.value)}
                                      >
                                        {vehicles.map(v => (
                                          <option key={v.id} value={v.id}>{v.model} ({v.plateNumber})</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">เปลี่ยนคนขับ</label>
                                      <select 
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={tempDriverId}
                                        onChange={(e) => setTempDriverId(e.target.value)}
                                      >
                                        <option value="">-- ไม่ระบุคนขับ --</option>
                                        {drivers.map(d => (
                                          <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={async () => {
                                        if (onUpdateBooking) {
                                          await onUpdateBooking(booking.id, booking.status, undefined, tempDriverId, tempVehicleId);
                                        }
                                        setEditingId(null);
                                      }}
                                      className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                    >
                                      บันทึกการเปลี่ยนแปลง
                                    </button>
                                    <button 
                                      onClick={() => setEditingId(null)}
                                      className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                                    >
                                      ยกเลิก
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-sm">
                                    <Car className="w-4 h-4" />
                                    <span className="font-bold">{booking.vehicleName}</span>
                                  </div>
                                  {booking.driverName ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm">
                                      <User className="w-4 h-4" />
                                      <span className="font-bold">คนขับ: {booking.driverName}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm italic">
                                      <User className="w-4 h-4" />
                                      <span>ไม่มีพนักงานขับรถ</span>
                                    </div>
                                  )}
                                  {isAdmin && booking.status === 'approved' && (
                                    <button 
                                      onClick={() => {
                                        setEditingId(booking.id);
                                        setTempDriverId(booking.driverId || "");
                                        setTempVehicleId(booking.vehicleId);
                                      }}
                                      className="ml-auto text-xs font-bold text-indigo-600 hover:underline"
                                    >
                                      แก้ไขทรัพยากร
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 px-6 rounded-2xl border border-slate-100 border-dashed bg-slate-50/50">
                      <p className="text-slate-400 text-sm italic">ไม่มีรายการจองในวันนี้</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

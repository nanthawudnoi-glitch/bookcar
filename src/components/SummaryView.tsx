import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Car, 
  CheckCircle, 
  Clock, 
  XCircle,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { th } from 'date-fns/locale';

interface Booking {
  id: string;
  userId: string;
  userName: string;
  vehicleId: string;
  vehicleName: string;
  startTime: any;
  endTime: any;
  status: string;
  createdAt: any;
}

interface SummaryViewProps {
  bookings: Booking[];
  vehicles: any[];
  drivers: any[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

export const SummaryView: React.FC<SummaryViewProps> = ({ bookings, vehicles, drivers }) => {
  // 1. Status Distribution
  const statusCounts = bookings.reduce((acc: any, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = [
    { name: 'รออนุมัติ', value: statusCounts.pending || 0, color: '#3b82f6' },
    { name: 'อนุมัติแล้ว', value: statusCounts.approved || 0, color: '#6366f1' },
    { name: 'เสร็จสิ้น', value: statusCounts.completed || 0, color: '#10b981' },
    { name: 'ปฏิเสธ', value: statusCounts.rejected || 0, color: '#ef4444' },
    { name: 'ยกเลิก', value: statusCounts.cancelled || 0, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  // 2. Bookings by Vehicle
  const vehicleCounts = bookings.reduce((acc: any, b) => {
    acc[b.vehicleName] = (acc[b.vehicleName] || 0) + 1;
    return acc;
  }, {});

  const vehicleData = Object.entries(vehicleCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  // 3. Driver Performance
  const driverCounts = bookings.reduce((acc: any, b) => {
    if (b.driverName && b.status !== 'rejected' && b.status !== 'cancelled') {
      acc[b.driverName] = (acc[b.driverName] || 0) + 1;
    }
    return acc;
  }, {});

  const driverData = drivers.map(d => ({
    name: d.name,
    count: driverCounts[d.name] || 0
  })).sort((a, b) => b.count - a.count);

  // 4. Bookings by Month (Last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  });

  const monthlyData = last6Months.map(month => {
    const count = bookings.filter(b => {
      const date = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
      return isSameMonth(date, month);
    }).length;
    return {
      name: format(month, 'MMM', { locale: th }),
      count
    };
  });

  const stats = [
    { label: 'การจองทั้งหมด', value: bookings.length, icon: Calendar, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'อนุมัติแล้ว', value: statusCounts.approved || 0, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'รออนุมัติ', value: statusCounts.pending || 0, icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'ปฏิเสธ/ยกเลิก', value: (statusCounts.rejected || 0) + (statusCounts.cancelled || 0), icon: XCircle, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
          >
            <div className={stat.color + " w-10 h-10 rounded-2xl flex items-center justify-center mb-4"}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Status Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            สัดส่วนสถานะการจอง
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            แนวโน้มการจองรายเดือน
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Vehicle Usage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm md:col-span-2"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Car className="w-5 h-5 text-indigo-600" />
            รถยนต์ที่ถูกจองมากที่สุด (Top 5)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={150}
                  tick={{fill: '#1e293b', fontSize: 12, fontWeight: 500}}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#6366f1" 
                  radius={[0, 8, 8, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Driver Performance */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm md:col-span-2"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            ผลงานพนักงานขับรถ (จำนวนงานที่ได้รับมอบหมาย)
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {driverData.map((driver, index) => (
              <div key={driver.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 font-bold border border-slate-100">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{driver.name}</p>
                    <p className="text-xs text-slate-500">พนักงานขับรถ</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-600">{driver.count}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">งานทั้งหมด</p>
                </div>
              </div>
            ))}
            {driverData.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                ไม่พบข้อมูลพนักงานขับรถ
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

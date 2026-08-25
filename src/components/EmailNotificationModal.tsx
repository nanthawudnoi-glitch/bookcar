import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  Copy, 
  Check, 
  X, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  MapPin,
  Car,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

function safeToDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (val.seconds !== undefined) return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  return new Date(val);
}

function getDurationText(startVal: any, endVal: any): string {
  const start = safeToDate(startVal);
  const end = safeToDate(endVal);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '0 นาที';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(diffMins / (24 * 60));
  const hours = Math.floor((diffMins % (24 * 60)) / 60);
  const mins = diffMins % 60;
  
  let parts = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (hours > 0) parts.push(`${hours} ชั่วโมง`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins} นาที`);
  
  return parts.join(' ');
}

export interface EmailData {
  type: 'approved' | 'cancelled' | 'rejected';
  recipientEmail: string;
  recipientName: string;
  booking: any;
  reason?: string;
  adminName?: string;
}

export function generateEmailContent(data: EmailData): { subject: string; body: string } {
  const { type, recipientName, booking, reason, adminName } = data;
  const startStr = format(safeToDate(booking.startTime), 'd MMMM yyyy เวลา HH:mm', { locale: th });
  const endStr = format(safeToDate(booking.endTime), 'd MMMM yyyy เวลา HH:mm', { locale: th });
  const duration = getDurationText(booking.startTime, booking.endTime);
  const name = recipientName || booking.requesterName || booking.userName || 'ผู้ขอใช้รถยนต์';

  if (type === 'approved') {
    const subject = `[อนุมัติแล้ว] ผลการขอใช้รถยนต์ราชการ - วิทยาลัยเทคนิคตรัง (${booking.destination})`;
    const body = `เรียน ${name},

ตามที่ท่านได้ยื่นคำขอใช้รถยนต์ราชการผ่านระบบ TTC Smart Fleet วิทยาลัยเทคนิคตรัง
ผู้ดูแลระบบได้ดำเนินการ "อนุมัติ" คำขอของท่านเรียบร้อยแล้ว โดยมีรายละเอียดดังนี้:

📌 รายละเอียดการใช้รถ:
• ยานพาหนะ: ${booking.vehicleName || 'ตามที่จัดสรร'}
• พนักงานขับรถ: ${booking.driverName || 'ผู้ขอขับเอง / ไม่ระบุ'}
• สถานที่ปลายทาง: ${booking.destination}
• วัตถุประสงค์: ${booking.purpose}
• วัน-เวลาเริ่มเดินทาง: ${startStr} น.
• วัน-เวลาเดินทางกลับ: ${endStr} น.
• ระยะเวลาการใช้รถ: ${duration}
${booking.passengers ? `• ผู้ร่วมเดินทาง: ${booking.passengers}\n` : ''}${booking.adminComment ? `• หมายเหตุเพิ่มเติม: ${booking.adminComment}\n` : ''}
ขอให้ท่านเดินทางโดยสวัสดิภาพ และปฏิบัติตามระเบียบการใช้รถยนต์ราชการ

ขอแสดงความนับถือ
งานยานพาหนะ ฝ่ายบริหารทรัพยากร
วิทยาลัยเทคนิคตรัง
(ระบบ TTC Smart Fleet)`;
    return { subject, body };
  }

  if (type === 'cancelled') {
    const subject = `[แจ้งยกเลิกคำขอ] การขอใช้รถยนต์ราชการ - วิทยาลัยเทคนิคตรัง (${booking.destination})`;
    const body = `เรียน ${name},

ผู้ดูแลระบบขอแจ้ง "ยกเลิก" รายการคำขอใช้รถยนต์ราชการของท่านในระบบ TTC Smart Fleet
(รายการเดิม: ${booking.vehicleName} ไป ${booking.destination})

⚠️ เหตุผลการยกเลิก:
"${reason || booking.cancellationReason || 'มีความจำเป็นต้องปรับเปลี่ยนตารางการใช้รถยนต์ราชการ'}"

📌 ข้อมูลรายการที่ถูกยกเลิก:
• ยานพาหนะ: ${booking.vehicleName}
• สถานที่ปลายทาง: ${booking.destination}
• วัตถุประสงค์: ${booking.purpose}
• กำหนดการเดิม: ${startStr} น. ถึง ${endStr} น.
• ผู้ดำเนินการยกเลิก: ${adminName || 'ผู้ดูแลระบบ'}

หากท่านยังมีความประสงค์จะขอใช้รถยนต์ราชการในเวลาอื่น สามารถเข้าสู่ระบบเพื่อทำรายการจองใหม่อีกครั้งได้ตลอดเวลา
ขออภัยในความไม่สะดวกมา ณ ที่นี้

ขอแสดงความนับถือ
งานยานพาหนะ ฝ่ายบริหารทรัพยากร
วิทยาลัยเทคนิคตรัง
(ระบบ TTC Smart Fleet)`;
    return { subject, body };
  }

  // Rejected
  const subject = `[แจ้งผลคำขอ] ผลการขอใช้รถยนต์ราชการ (ไม่สามารถอนุมัติได้) - วิทยาลัยเทคนิคตรัง`;
  const body = `เรียน ${name},

ตามที่ท่านได้ยื่นคำขอใช้รถยนต์ราชการผ่านระบบ TTC Smart Fleet
ผู้ดูแลระบบมีความจำเป็นต้อง "ปฏิเสธ" คำขอของท่าน

⚠️ เหตุผลการปฏิเสธ:
"${reason || booking.adminComment || 'รถยนต์หรือพนักงานขับรถไม่พร้อมให้บริการในช่วงเวลาดังกล่าว'}"

📌 รายละเอียดคำขอเดิม:
• ยานพาหนะ: ${booking.vehicleName}
• สถานที่ปลายทาง: ${booking.destination}
• วัตถุประสงค์: ${booking.purpose}
• กำหนดเวลา: ${startStr} น. ถึง ${endStr} น.

ท่านสามารถตรวจสอบตารางการใช้รถและเลือกช่วงเวลาอื่นที่ว่างเพื่อทำการจองใหม่ได้ครับ

ขอแสดงความนับถือ
งานยานพาหนะ ฝ่ายบริหารทรัพยากร
วิทยาลัยเทคนิคตรัง
(ระบบ TTC Smart Fleet)`;
  return { subject, body };
}

interface EmailNotificationModalProps {
  data: EmailData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmailNotificationModal: React.FC<EmailNotificationModalProps> = ({
  data,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [customBody, setCustomBody] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [customEmail, setCustomEmail] = useState<string>("");

  React.useEffect(() => {
    if (data) {
      const { subject, body } = generateEmailContent(data);
      setCustomSubject(subject);
      setCustomBody(body);
      setCustomEmail(data.recipientEmail || '');
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`หัวข้อ: ${customSubject}\n\n${customBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customEmail)}&su=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleOpenMailto = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(customEmail)}?subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`;
    window.location.href = mailtoUrl;
  };

  const isApproved = data.type === 'approved';
  const isCancelled = data.type === 'cancelled';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className={`p-6 text-white ${
            isApproved 
              ? 'bg-emerald-600' 
              : isCancelled 
                ? 'bg-amber-600' 
                : 'bg-red-600'
          }`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {isApproved && 'ส่งอีเมลแจ้งการอนุมัติคำขอ'}
                    {isCancelled && 'ส่งอีเมลแจ้งการยกเลิกคำขอ'}
                    {!isApproved && !isCancelled && 'ส่งอีเมลแจ้งผลการปฏิเสธคำขอ'}
                  </h3>
                  <p className="text-white/80 text-xs sm:text-sm mt-0.5">
                    ส่งการแจ้งเตือนไปยังผู้ขอใช้รถทาง Email
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body content */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
            {/* Status note */}
            <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
              isApproved 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : isCancelled
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {isApproved && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />}
              {isCancelled && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />}
              {!isApproved && !isCancelled && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />}
              <div>
                <p className="font-bold">
                  {isApproved && 'บันทึกการอนุมัติเรียบร้อยแล้ว'}
                  {isCancelled && 'บันทึกการยกเลิกคำขอเรียบร้อยแล้ว'}
                  {!isApproved && !isCancelled && 'บันทึกการปฏิเสธเรียบร้อยแล้ว'}
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  คุณสามารถส่งอีเมลแจ้งผู้ขอใช้รถทันทีผ่านปุ่มด้านล่าง (เปิดผ่าน Gmail หรือ Email Client ประจำเครื่อง)
                </p>
              </div>
            </div>

            {/* Recipient email input */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                อีเมลผู้รับ (Recipient Email)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input 
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="เช่น user@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              {!customEmail && (
                <p className="text-xs text-amber-600 mt-1">
                  * ผู้ขอไม่ได้ระบุอีเมลไว้ในคำขอ คุณสามารถพิมพ์อีเมลที่ต้องการส่งได้โดยตรง
                </p>
              )}
            </div>

            {/* Subject input */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                หัวข้ออีเมล (Subject)
              </label>
              <input 
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Email message body preview / edit */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  เนื้อหาข้อความ (Message Body)
                </label>
                <span className="text-[11px] text-slate-400">สามารถแก้ไขข้อความได้</span>
              </div>
              <textarea 
                rows={9}
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-sans leading-relaxed text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอกข้อความ'}
            </button>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                onClick={handleOpenMailto}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                title="เปิดโปรแกรม Email Client ประจำเครื่อง (Outlook, Apple Mail, etc.)"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                Mail App
              </button>

              <button
                onClick={handleOpenGmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                ส่งผ่าน Gmail
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs sm:text-sm font-medium rounded-xl hover:bg-slate-200/60 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

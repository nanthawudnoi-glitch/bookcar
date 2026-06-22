import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Search, 
  Calendar,
  Filter,
  FileText,
  ChevronDown,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, isWithinInterval, startOfDay, endOfDay, addYears } from 'date-fns';
import { th } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface Booking {
  id: string;
  userName: string;
  vehicleName: string;
  driverName?: string;
  startTime: any;
  endTime: any;
  purpose: string;
  destination: string;
  passengers?: string;
  requesterName?: string;
  status: string;
  adminComment?: string;
}

interface ReportViewProps {
  bookings: Booking[];
}

export const ReportView: React.FC<ReportViewProps> = ({ bookings }) => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('approved');
  const [showFullPreview, setShowFullPreview] = useState(false);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const bDate = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      
      const isInRange = isWithinInterval(bDate, { start, end });
      const isCorrectStatus = statusFilter === 'all' || b.status === statusFilter;
      
      return isInRange && isCorrectStatus;
    }).sort((a, b) => {
      const dateA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
      const dateB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
      return dateA.getTime() - dateB.getTime();
    });
  }, [bookings, startDate, endDate, statusFilter]);

  const handlePrint = () => {
    window.print();
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    
    // Track original styles and temporary elements to restore them later
    const restoredStyleElements: { el: HTMLStyleElement; originalText: string }[] = [];
    const disabledLinks: HTMLLinkElement[] = [];
    const createdStyleTagsForLinks: HTMLStyleElement[] = [];

    try {
      const element = document.getElementById('printable-report');
      if (!element) {
        alert('ไม่พบเอกสารรายงานสำหรับการบันทึก PDF');
        return;
      }

      // Convert oklch colors to standard rgb in all style tags to prevent html2canvas crash
      const styleElements = Array.from(document.querySelectorAll('style'));
      for (const styleEl of styleElements) {
        const text = styleEl.textContent || '';
        if (text.includes('oklch')) {
          restoredStyleElements.push({ el: styleEl, originalText: text });
          styleEl.textContent = text.replace(/oklch\s*\(([^()]+|\([^()]*\))*\)/gi, (match) => {
            const clean = match.replace(/oklch\s*\(/i, '').replace(/\)/, '');
            const parts = clean.trim().split(/[\s/]+/);
            const l = parseFloat(parts[0]);
            if (!isNaN(l)) {
              if (l > 0.8) return 'rgb(240, 240, 240)';
              if (l > 0.5) return 'rgb(180, 180, 180)';
              if (l > 0.2) return 'rgb(80, 80, 80)';
              return 'rgb(15, 15, 15)';
            }
            return 'rgb(120, 120, 120)';
          });
        }
      }

      // Process link-based stylesheets
      const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      for (const linkEl of linkElements) {
        try {
          const rules = linkEl.sheet?.cssRules;
          if (rules) {
            let hasOklch = false;
            const cssTexts: string[] = [];
            for (let i = 0; i < rules.length; i++) {
              const ruleText = rules[i].cssText;
              cssTexts.push(ruleText);
              if (ruleText.includes('oklch')) {
                hasOklch = true;
              }
            }

            if (hasOklch) {
              const fullCss = cssTexts.join('\n');
              const cleanedCss = fullCss.replace(/oklch\s*\(([^()]+|\([^()]*\))*\)/gi, (match) => {
                const clean = match.replace(/oklch\s*\(/i, '').replace(/\)/, '');
                const parts = clean.trim().split(/[\s/]+/);
                const l = parseFloat(parts[0]);
                if (!isNaN(l)) {
                  if (l > 0.8) return 'rgb(240, 240, 240)';
                  if (l > 0.5) return 'rgb(180, 180, 180)';
                  if (l > 0.2) return 'rgb(80, 80, 80)';
                  return 'rgb(15, 15, 15)';
                }
                return 'rgb(120, 120, 120)';
              });

              const tempStyle = document.createElement('style');
              tempStyle.setAttribute('data-temp-clean-style', 'true');
              tempStyle.textContent = cleanedCss;
              document.head.appendChild(tempStyle);
              createdStyleTagsForLinks.push(tempStyle);

              linkEl.disabled = true;
              disabledLinks.push(linkEl);
            }
          }
        } catch (err) {
          console.warn('Could not read or process stylesheet rules:', linkEl.href, err);
        }
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const formattedStartDate = format(new Date(startDate), 'yyyyMMdd');
      const formattedEndDate = format(new Date(endDate), 'yyyyMMdd');
      pdf.save(`รายงานการขอใช้รถยนต์ราชการ_${formattedStartDate}-${formattedEndDate}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
      // Restore original stylesheets and styles
      for (const item of restoredStyleElements) {
        item.el.textContent = item.originalText;
      }
      for (const tempStyle of createdStyleTagsForLinks) {
        tempStyle.parentNode?.removeChild(tempStyle);
      }
      for (const linkEl of disabledLinks) {
        linkEl.disabled = false;
      }
      setIsGeneratingPDF(false);
    }
  };

  const ReportDocument = ({ id }: { id?: string }) => (
    <div id={id} className="font-saraban text-black leading-relaxed bg-white p-[2cm] shadow-2xl mx-auto w-[21cm] min-h-[29.7cm]">
      {/* Official Header */}
      <div className="relative mb-6 min-h-[64px] flex items-center justify-center">
         <img 
           src="https://cms-media.fda.moph.go.th/461152983531528192/2023/04/jpe4XHmGBReEanQzvr9sZjii.png" 
           className="w-16 h-16 object-contain absolute left-0 top-0" 
           alt="Garuda" 
         />
         <h1 className="text-[28pt] font-bold leading-tight tracking-tighter">บันทึกข้อความ</h1>
      </div>

      <div className="border-b-2 border-black pb-2 mb-4 space-y-1">
        <p className="text-lg leading-relaxed flex items-baseline">
          <span className="font-bold whitespace-nowrap mr-2">ส่วนราชการ</span>
          <span className="flex-1 border-b border-dotted border-black px-2">วิทยาลัยเทคนิคตรัง งานพัสดุ</span>
        </p>
        <div className="flex justify-between items-baseline gap-4">
          <p className="text-base flex-1 flex items-baseline">
            <span className="font-bold whitespace-nowrap mr-2">ที่</span>
            <span className="flex-1 border-b border-dotted border-black px-2 text-center md:text-left">..................................</span>
          </p>
          <p className="text-base w-auto flex items-baseline">
            <span className="font-bold whitespace-nowrap mr-2">วันที่</span>
            <span className="border-b border-dotted border-black px-4">{format(addYears(new Date(), 543), 'd MMMM yyyy', { locale: th })}</span>
          </p>
        </div>
        <p className="text-base leading-relaxed flex items-baseline">
          <span className="font-bold whitespace-nowrap mr-1">เรื่อง</span>
          <span className="flex-1 border-b border-dotted border-black px-2">รายงานการขอใช้รถยนต์ราชการ ระหว่างวันที่ {format(addYears(new Date(startDate), 543), 'd MMM yy', { locale: th })} ถึง {format(addYears(new Date(endDate), 543), 'd MMM yy', { locale: th })}</span>
        </p>
      </div>

      <p className="mb-6 text-base"><span className="font-bold">เรียน</span> ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>

      <p className="mb-4 indent-16 text-base text-justify">
        ตามที่งานพัสดุ ได้รับคำขอใช้รถยนต์ราชการจากบุคลากรในสังกัด ในระบบดิจิทัลออนไลน์ เพื่อขอใช้รถยนต์ส่วนกลางในภารกิจราชการ นั้น
      </p>

      <p className="mb-4 indent-16 text-base text-justify">
        ในการนี้ งานพัสดุ ได้รวบรวมสรุปรายละเอียดการขอใช้รถยนต์ในช่วงเวลาดังกล่าวมาเพื่อพิจารณาดังนี้
      </p>

      <div className="mb-8">
        <table className="w-full border-collapse border border-black text-[14px]">
          <thead>
            <tr className="bg-slate-100 print:bg-transparent">
              <th className="border border-black px-2 py-2 text-center w-8">ที่</th>
              <th className="border border-black px-2 py-2 text-center w-32">วัน/เวลา เดินทาง</th>
              <th className="border border-black px-2 py-2 text-center">ผู้ขอใช้/ผู้ร่วมเดินทาง</th>
              <th className="border border-black px-2 py-2 text-center">รถยนต์</th>
              <th className="border border-black px-2 py-2 text-center">พนักงานขับรถ</th>
              <th className="border border-black px-2 py-2 text-center">สถานที่/วัตถุประสงค์</th>
              <th className="border border-black px-2 py-2 text-center w-16">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking, index) => {
              const bDate = booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
              return (
                <tr key={booking.id}>
                  <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
                  <td className="border border-black px-2 py-2">
                    {format(addYears(bDate, 543), 'd MMM yy HH:mm', { locale: th })}
                  </td>
                  <td className="border border-black px-2 py-2">
                    <div className="font-bold">{booking.requesterName || booking.userName}</div>
                    {booking.passengers && <div className="text-[12px] leading-tight text-slate-700">ร่วมไป: {booking.passengers}</div>}
                  </td>
                  <td className="border border-black px-2 py-2 text-center font-bold">{booking.vehicleName}</td>
                  <td className="border border-black px-2 py-2 text-center">{booking.driverName || '-'}</td>
                  <td className="border border-black px-2 py-2">
                    <div className="font-bold">{booking.destination}</div>
                    <div className="text-[12px] leading-tight">({booking.purpose})</div>
                  </td>
                  <td className="border border-black px-2 py-2 text-center text-[12px]">
                    {booking.status === 'approved' ? 'อนุมัติ' : 
                     booking.status === 'completed' ? 'เสร็จสิ้น' : 
                     booking.status === 'pending' ? 'รออนุมัติ' : booking.status}
                  </td>
                </tr>
              );
            })}
            {filteredBookings.length === 0 && (
              <tr>
                <td colSpan={7} className="border border-black px-2 py-12 text-center text-slate-400">
                  ไม่พบข้อมูลในช่วงเวลาที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mb-12 indent-16 text-base">
        จึงเรียนมาเพื่อโปรดทราบและพิจารณา
      </p>

      <div className="flex justify-end text-center mt-12 pr-12 text-base">
        <div className="space-y-16">
          <div>
            <p>(ลงชื่อ)......................................................</p>
            <p className="mt-2 text-center">(......................................................)</p>
            <p className="mt-1">เจ้าหน้าที่ผู้รวบรวม</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">ตั้งแต่วันที่</label>
            <div className="relative">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">ถึงวันที่</label>
            <div className="relative">
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">สถานะ</label>
            <div className="relative">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">ทั้งหมด</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="completed">เสร็จสิ้น</option>
                <option value="pending">รออนุมัติ</option>
                <option value="rejected">ปฏิเสธ</option>
              </select>
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => setShowFullPreview(true)}
              className="flex-1 bg-slate-900 text-white py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-100 text-sm"
            >
              <FileText className="w-4 h-4" /> แสดงตัวอย่าง
            </button>
            <button 
              onClick={handlePrint}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 text-sm"
            >
              <Printer className="w-4 h-4" /> พิมพ์
            </button>
            <button 
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${
                isGeneratingPDF 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                  : 'bg-rose-605 bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100'
              }`}
            >
              <FileDown className="w-4 h-4" />
              {isGeneratingPDF ? 'กำลังสร้าง...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Preview (Scrollable) */}
      <div className="bg-slate-100 rounded-3xl border border-slate-200 shadow-inner overflow-hidden p-8 flex justify-center print:hidden">
        <div className="scale-[0.8] origin-top transition-transform duration-300">
          <ReportDocument />
        </div>
      </div>

      {/* Full Screen Preview Overlay */}
      {showFullPreview && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center overflow-y-auto p-4 sm:p-8 print:hidden">
          <div className="w-full max-w-[21cm] flex justify-between items-center mb-6 text-white sticky top-0 bg-slate-900/50 p-4 rounded-2xl backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">พรีวิวรายงานฉบับจริง</h3>
                <p className="text-xs text-slate-400">ขนาดกระดาษ A4 (แนวตั้ง)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all text-sm sm:text-base cursor-pointer"
              >
                <Printer className="w-4 h-4" /> พิมพ์ตอนนี้
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={isGeneratingPDF}
                className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all text-sm sm:text-base cursor-pointer ${
                  isGeneratingPDF 
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                <FileDown className="w-4 h-4" />
                {isGeneratingPDF ? 'กำลังบันทึก...' : 'ส่งออก PDF'}
              </button>
              <button 
                onClick={() => setShowFullPreview(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl font-bold transition-all text-sm sm:text-base cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
          
          <div className="pb-12">
            <ReportDocument />
          </div>
        </div>
      )}

      {/* Container for PDF Generation and Print - rendered offscreen but visible to DOM canvas generation tools */}
      <div className="absolute left-[-9999px] top-[-9999px] print:static print:left-auto print:top-auto print:block">
        <ReportDocument id="printable-report" />
      </div>

      <style>{`
        @media screen {
          .font-saraban {
            font-family: 'Sarabun', sans-serif;
          }
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            visibility: hidden;
            background: white !important;
          }
          #root, #root * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible !important;
          }
          #printable-report {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            color: black !important;
            background: white !important;
          }
          table { width: 100% !important; }
          .print\\:bg-transparent { background-color: transparent !important; }
          .font-saraban {
            font-family: "TH Sarabun New", "Sarabun", sans-serif;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

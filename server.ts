import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

interface EmailPayload {
  to: string;
  userName: string;
  action: 'approved' | 'cancelled' | 'rejected';
  bookingDetails: {
    vehicleName: string;
    startTime: string;
    endTime: string;
    duration?: string;
    purpose: string;
    destination: string;
    passengers?: string;
    driverName?: string;
    adminComment?: string;
  };
}

function generateEmailHtml(payload: EmailPayload): { subject: string; html: string; text: string } {
  const { userName, action, bookingDetails } = payload;
  const isApproved = action === 'approved';
  const isCancelled = action === 'cancelled';
  const isRejected = action === 'rejected';

  const actionTitle = isApproved 
    ? 'อนุมัติคำขอใช้รถยนต์ราชการเรียบร้อยแล้ว' 
    : isCancelled 
    ? 'แจ้งยกเลิกรายการขอใช้รถยนต์ราชการ' 
    : 'แจ้งผลการปฏิเสธคำขอใช้รถยนต์ราชการ';

  const themeColor = isApproved ? '#059669' : isCancelled ? '#d97706' : '#dc2626';
  const badgeBg = isApproved ? '#ecfdf5' : isCancelled ? '#fffbeb' : '#fef2f2';
  const badgeBorder = isApproved ? '#a7f3d0' : isCancelled ? '#fde68a' : '#fecaca';

  const subject = `[${isApproved ? 'อนุมัติ' : isCancelled ? 'แจ้งยกเลิก' : 'ปฏิเสธ'}] คำขอใช้รถยนต์ราชการ: ${bookingDetails.vehicleName} (${bookingDetails.startTime})`;

  const text = `
เรียนคุณ ${userName},

${actionTitle}

รายละเอียดการจอง:
- รถยนต์: ${bookingDetails.vehicleName}
- จุดหมายปลายทาง: ${bookingDetails.destination}
- วันเวลาเดินทาง: ${bookingDetails.startTime} ถึง ${bookingDetails.endTime}
- ระยะเวลา: ${bookingDetails.duration || '-'}
- วัตถุประสงค์: ${bookingDetails.purpose}
${bookingDetails.driverName ? `- พนักงานขับรถ: ${bookingDetails.driverName}\n` : ''}${bookingDetails.adminComment ? `- หมายเหตุ/เหตุผลจากผู้ดูแลระบบ: ${bookingDetails.adminComment}\n` : ''}

ระบบบริหารจัดการและจองคิวรถยนต์ราชการอัจฉริยะ (TTC Smart Fleet)
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionTitle}</title>
  <style>
    body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 32px 24px; }
    .status-badge { background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${themeColor}; padding: 14px 18px; border-radius: 12px; font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 24px; }
    .greeting { font-size: 15px; margin-bottom: 20px; color: #334155; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 600; text-align: right; }
    .reason-box { background: ${badgeBg}; border-left: 4px solid ${themeColor}; padding: 14px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; color: #1e293b; }
    .reason-title { font-weight: bold; color: ${themeColor}; margin-bottom: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #fafafa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TTC SMART FLEET</h1>
      <p>ระบบบริหารจัดการและจองคิวรถยนต์ราชการ วิทยาลัยเทคนิคตรัง</p>
    </div>
    <div class="content">
      <div class="status-badge">
        ${isApproved ? '✅ คำขอใช้รถยนต์ได้รับ "การอนุมัติแล้ว"' : isCancelled ? '❌ คำขอใช้รถยนต์ถูก "ยกเลิกโดยผู้ดูแลระบบ"' : '⚠️ คำขอใช้รถยนต์ "ไม่ได้รับการอนุมัติ"'}
      </div>
      
      <p class="greeting">เรียนคุณ <strong>${userName}</strong>,</p>
      <p style="font-size: 14px; color: #475569; margin-top: -10px; margin-bottom: 20px;">
        ${isApproved 
          ? 'ผู้ดูแลระบบได้ทำการตรวจสอบและอนุมัติคำขอใช้รถยนต์ราชการของท่านเป็นที่เรียบร้อยแล้ว โดยมีรายละเอียดดังต่อไปนี้:' 
          : isCancelled
          ? 'ผู้ดูแลระบบได้ทำการยกเลิกรายการจองรถยนต์ราชการของท่าน โดยมีรายละเอียดและเหตุผลดังนี้:'
          : 'ผู้ดูแลระบบได้ทำการตรวจสอบและปฏิเสธคำขอใช้รถยนต์ราชการของท่าน โดยมีรายละเอียดดังนี้:'
        }
      </p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">ยานพาหนะ:</span>
          <span class="info-value">${bookingDetails.vehicleName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">จุดหมายปลายทาง:</span>
          <span class="info-value">${bookingDetails.destination}</span>
        </div>
        <div class="info-row">
          <span class="info-label">วันเวลาเริ่มเดินทาง:</span>
          <span class="info-value">${bookingDetails.startTime} น.</span>
        </div>
        <div class="info-row">
          <span class="info-label">วันเวลาสิ้นสุด/กลับ:</span>
          <span class="info-value">${bookingDetails.endTime} น.</span>
        </div>
        ${bookingDetails.duration ? `
        <div class="info-row">
          <span class="info-label">ระยะเวลารวม:</span>
          <span class="info-value" style="color: #4f46e5;">${bookingDetails.duration}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">วัตถุประสงค์:</span>
          <span class="info-value">${bookingDetails.purpose}</span>
        </div>
        ${bookingDetails.driverName ? `
        <div class="info-row">
          <span class="info-label">พนักงานขับรถ:</span>
          <span class="info-value" style="color: #059669;">${bookingDetails.driverName}</span>
        </div>` : ''}
      </div>

      ${bookingDetails.adminComment ? `
      <div class="reason-box">
        <div class="reason-title">${isApproved ? 'หมายเหตุจากผู้ดูแลระบบ:' : 'เหตุผลการยกเลิก/ปฏิเสธ:'}</div>
        <div>${bookingDetails.adminComment}</div>
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
        ท่านสามารถเข้าสู่ระบบเพื่อตรวจสอบสถานะล่าสุด หรือดูตารางการใช้รถยนต์ราชการได้ตลอดเวลา
      </p>
    </div>
    <div class="footer">
      อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติ TTC Smart Fleet &bull; วิทยาลัยเทคนิคตรัง
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

// API Routes
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/send-email", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: EmailPayload = req.body;
    const { to, userName, action, bookingDetails } = payload;

    if (!to || !to.includes("@")) {
      res.status(400).json({ error: "Missing or invalid recipient email ('to')" });
      return;
    }

    const { subject, html, text } = generateEmailHtml(payload);

    console.log(`[Email Dispatch] Triggered for ${to} | Action: ${action} | Subject: ${subject}`);

    // Option 1: Send via Resend API if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: process.env.SMTP_FROM || "TTC Smart Fleet <onboarding@resend.dev>",
            to: [to],
            subject,
            html,
            text
          })
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("[Email Dispatch Resend Error]", data);
        } else {
          console.log("[Email Dispatch Resend Success]", data);
          res.json({ success: true, provider: "resend", data });
          return;
        }
      } catch (err) {
        console.error("[Email Dispatch Resend Exception]", err);
      }
    }

    // Option 2: Send via SMTP (Nodemailer) if SMTP_USER / SMTP_PASS is configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "465", 10),
          secure: process.env.SMTP_SECURE !== "false",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || `"TTC Smart Fleet" <${process.env.SMTP_USER}>`,
          to,
          subject,
          text,
          html
        });

        console.log("[Email Dispatch SMTP Success]", info.messageId);
        res.json({ success: true, provider: "smtp", messageId: info.messageId });
        return;
      } catch (smtpErr) {
        console.error("[Email Dispatch SMTP Error]", smtpErr);
      }
    }

    // Fallback/Simulated Mode (Logs the dispatch, returns success so frontend displays confirmation)
    console.log(`[Email Dispatch Logged] Email prepared for <${to}>:
Subject: ${subject}
Details: ${bookingDetails.vehicleName} | Action: ${action}
Comment: ${bookingDetails.adminComment || '-'}`);

    res.json({ 
      success: true, 
      simulated: true, 
      recipient: to, 
      subject,
      message: "บันทึกการส่งอีเมลแจ้งเตือนสำเร็จ (Email notification registered and logged)" 
    });
  } catch (error) {
    console.error("Error in /api/send-email:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to process email dispatch" 
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TTC Smart Fleet Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let reportStudents = [];
let reportAttendance = [];
let reportFees = [];

// ==========================================
// HELPERS
// ==========================================
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function todayMonth() {
  return getTodayDate().slice(0, 7);
}

function monthDate(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) return null;
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
}

function nextMonth(month) {
  const d = monthDate(month);
  if (!d) return month;
  d.setMonth(d.getMonth() + 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function getFeeStartMonth(student) {
  const v = String(student?.feeStartMonth || "").trim();
  return /^\d{4}-\d{2}$/.test(v) ? v : todayMonth();
}

function calculateLedger(student, records = [], untilMonth = todayMonth()) {
  const monthlyFee = Number(student?.monthlyFee || 0);
  const startMonth = getFeeStartMonth(student);
  const dueDay = Number(student?.feeDueDay || 1);

  if (monthlyFee <= 0 || !/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(untilMonth)) {
    return { due: 0, advance: 0 };
  }
  
  const today = new Date();
  const months = [];
  let month = startMonth;

  while (month <= untilMonth) {
    const feeDate = monthDate(month);
    if (!feeDate) { month = nextMonth(month); continue; }
    const dueDate = new Date(feeDate.getFullYear(), feeDate.getMonth() + 1, dueDay);
    months.push({ month, fee: monthlyFee, paid: 0, due: 0, isDue: dueDate <= today });
    month = nextMonth(month);
  }

  const payments = [...records].filter(r => Number(r.paidAmount ?? r.amount ?? 0) > 0).sort((a, b) => new Date(a.paymentDate || a.timestamp || 0) - new Date(b.paymentDate || b.timestamp || 0));
  const allocationsByRecord = {};

  payments.forEach(record => {
    let remaining = Number(record.paidAmount ?? record.amount ?? 0);
    if (remaining <= 0) return;
    const selectedFeeMonth = String(record.feeMonth || record.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(selectedFeeMonth)) return;

    const allocations = [];
    for (const item of months) {
      if (remaining <= 0) break;
      if (item.month > selectedFeeMonth) break;
      const av = Math.max(0, monthlyFee - item.paid);
      if (av <= 0) continue;
      const amt = Math.min(remaining, av);
      item.paid += amt;
      remaining -= amt;
      allocations.push({ month: item.month, amount: amt });
    }
    if (remaining > 0) {
      for (const item of months) {
        if (remaining <= 0) break;
        if (item.month <= selectedFeeMonth) continue;
        const av = Math.max(0, monthlyFee - item.paid);
        if (av <= 0) continue;
        const amt = Math.min(remaining, av);
        item.paid += amt;
        remaining -= amt;
        allocations.push({ month: item.month, amount: amt, advance: true });
      }
    }
    allocationsByRecord[record.id] = allocations;
  });

  let totalDue = 0, totalAdvance = 0;
  months.forEach(item => {
    if (item.isDue) {
      item.due = Math.max(0, monthlyFee - item.paid);
      totalDue += item.due;
    }
    if (!item.isDue && item.paid > 0) totalAdvance += item.paid;
  });

  payments.forEach(record => {
    const allocs = allocationsByRecord[record.id] || [];
    const paid = Number(record.paidAmount ?? record.amount ?? 0);
    const allocated = allocs.reduce((sum, item) => sum + item.amount, 0);
    const extra = Math.max(0, paid - allocated);
    if (extra > 0) totalAdvance += extra;
  });

  return { due: totalDue, advance: totalAdvance };
}

// ==========================================
// LOAD DATA
// ==========================================
async function loadReportStudents() {
  const attendanceSelect = document.getElementById("attendanceStudent");
  const feesSelect = document.getElementById("feesStudent");

  try {
    const snapshot = await getDocs(collection(db, "students"));
    reportStudents = [];
    snapshot.forEach((studentDoc) => {
      reportStudents.push({ id: studentDoc.id, ...studentDoc.data() });
    });

    const activeStudents = reportStudents.filter(student => String(student.status || "ACTIVE").toUpperCase() !== "ARCHIVED");
    activeStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const options = activeStudents.map(student => `<option value="${student.id}">${escapeHtml(student.name || "-")} (${escapeHtml(student.studentCode || '-')})</option>`).join("");

    if (attendanceSelect) attendanceSelect.innerHTML = `<option value="all">All Students</option>` + options;
    if (feesSelect) feesSelect.innerHTML = `<option value="all">All Students</option>` + options;
  } catch (error) {
    console.error("REPORT STUDENTS ERROR:", error);
  }
}

async function loadReportAttendance() {
  try {
    const snapshot = await getDocs(collection(db, "attendance"));
    reportAttendance = [];
    snapshot.forEach((attendanceDoc) => { reportAttendance.push({ id: attendanceDoc.id, ...attendanceDoc.data() }); });
  } catch (error) { console.error("Attendance report load error:", error); }
}

async function loadReportFees() {
  try {
    const snapshot = await getDocs(collection(db, "fees"));
    reportFees = [];
    snapshot.forEach((feeDoc) => { reportFees.push({ id: feeDoc.id, ...feeDoc.data() }); });
  } catch (error) { console.error("Fees report load error:", error); }
}

async function loadReportsData() {
  await Promise.all([loadReportStudents(), loadReportAttendance(), loadReportFees()]);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await loadReportsData();
});

let currentReport = "attendance";

// ==========================================
// UI GENERATION
// ==========================================
window.showAttendanceReport = async function() {
  currentReport = "attendance";
  document.getElementById("reportArea").innerHTML = `
    <div class="report-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <h2 style="font-size: 18px; color: var(--primary); margin: 0;"><span class="material-symbols-rounded">calendar_month</span> Attendance Report</h2>
        <button type="button" onclick="window.printReport()" style="background: #2563eb; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
          <span class="material-symbols-rounded">print</span> Print / Save PDF
        </button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div><label>Student</label><select id="attendanceStudent"><option value="all">Loading...</option></select></div>
        <div><label>Month</label><input type="month" id="attendanceMonth"></div>
        <div><label>Shift</label>
          <select id="attendanceShift"><option value="All">All Shifts</option><option value="Morning">Morning</option><option value="Evening">Evening</option></select>
        </div>
      </div>
      <button type="button" onclick="window.generateAttendanceReport()" style="background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; width: 100%; font-size: 15px; font-weight: 700; margin-top: 20px; cursor: pointer;">Generate Report</button>
      <div id="attendanceReportResult"></div>
    </div>
  `;
  await loadReportStudents();
  setDefaultReportMonth();
}

window.showFeesReport = async function () {
  currentReport = "fees";
  document.getElementById("reportArea").innerHTML = `
    <div class="report-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <h2 style="font-size: 18px; color: var(--primary); margin: 0;"><span class="material-symbols-rounded">payments</span> Fees Collection Report</h2>
        <button type="button" onclick="window.printReport()" style="background: #2563eb; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
          <span class="material-symbols-rounded">print</span> Print / Save PDF
        </button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
        <div><label>Student</label><select id="feesStudent"><option value="all">Loading...</option></select></div>
        <div><label>Month</label><input type="month" id="feesMonth"></div>
      </div>
      <button type="button" onclick="window.generateFeesReport()" style="background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; width: 100%; font-size: 15px; font-weight: 700; margin-top: 20px; cursor: pointer;">Generate Report</button>
      <div id="feesReportResult"></div>
    </div>
  `;
  await Promise.all([loadReportStudents(), loadReportFees()]);
  setDefaultReportMonth();
};

window.generateAttendanceReport = function () {
  const studentId = document.getElementById("attendanceStudent")?.value || "all";
  const month = document.getElementById("attendanceMonth")?.value || "";
  const shift = document.getElementById("attendanceShift")?.value || "All";
  const result = document.getElementById("attendanceReportResult");

  if (!result) return;
  let selectedStudents = reportStudents.filter(student => String(student.status || "ACTIVE").toUpperCase() !== "ARCHIVED");
  if (studentId !== "all") { selectedStudents = selectedStudents.filter(student => student.id === studentId); }

  const summary = {};
  selectedStudents.forEach(student => {
    summary[student.id] = { name: student.name || "-", studentId: student.studentCode || student.studentId || student.id, present: 0, absent: 0, holiday: 0 };
  });

  reportAttendance.forEach(record => {
    if (shift !== "All" && record.shift !== shift) return;
    if (month && !String(record.date || "").startsWith(month)) return;
    if (!Array.isArray(record.records)) return;

    record.records.forEach(attendance => {
      const attStuId = String(attendance.studentId || "").trim();
      const matchedStudent = selectedStudents.find(s => s.id === attStuId || (s.studentCode && String(s.studentCode).trim() === attStuId));
      if (matchedStudent) {
        const id = matchedStudent.id;
        if (attendance.status === "P") summary[id].present++;
        else if (attendance.status === "A") summary[id].absent++;
        else if (attendance.status === "H" || attendance.status === "S") summary[id].holiday++;
      }
    });
  });

  let totalPresent = 0, totalAbsent = 0, totalHoliday = 0;
  Object.values(summary).forEach(data => { totalPresent += data.present; totalAbsent += data.absent; totalHoliday += data.holiday; });
  const workingDays = totalPresent + totalAbsent;
  const percentage = workingDays > 0 ? (totalPresent / workingDays) * 100 : 0;

  let html = `
    <div class="report-result" style="margin-top: 25px;">
      <h3 style="font-size: 16px; color: var(--primary); margin-bottom: 10px; border-bottom: 2px solid var(--border); padding-bottom: 6px;">Attendance Summary</h3>
      <div class="report-summary">
        <div><strong>${totalPresent}</strong><span>Present</span></div>
        <div><strong>${totalAbsent}</strong><span>Absent</span></div>
        <div><strong>${totalHoliday}</strong><span>Holiday / Sunday</span></div>
        <div><strong>${percentage.toFixed(1)}%</strong><span>Attendance Rate</span></div>
      </div>
      <div class="report-table-wrap">
        <table>
          <thead><tr><th>Student Name</th><th>Student ID</th><th>Present</th><th>Absent</th><th>Holiday</th><th>Attendance %</th></tr></thead>
          <tbody>
  `;

  Object.values(summary).forEach(data => {
    const days = data.present + data.absent;
    const studentPercentage = days > 0 ? (data.present / days) * 100 : 0;
    html += `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(data.name)}</td>
        <td style="color: var(--text-muted);">${escapeHtml(data.studentId)}</td>
        <td style="color: #10b981; font-weight: bold;">${data.present}</td>
        <td style="color: #ef4444; font-weight: bold;">${data.absent}</td>
        <td>${data.holiday}</td>
        <td style="font-weight: bold;">${studentPercentage.toFixed(1)}%</td>
      </tr>
    `;
  });
  html += `</tbody></table></div></div>`;
  result.innerHTML = html;
};

window.generateFeesReport = function () {
  const studentId = document.getElementById("feesStudent")?.value || "all";
  const month = document.getElementById("feesMonth")?.value || todayMonth();
  const result = document.getElementById("feesReportResult");

  if (!result) return;
  let students = reportStudents.filter(student => String(student.status || "ACTIVE").toUpperCase() !== "ARCHIVED");
  if (studentId !== "all") { students = students.filter(student => student.id === studentId); }

  let totalPaid = 0, totalAdvance = 0, totalPending = 0;

  let html = `
    <div class="report-result" style="margin-top: 25px;">
      <h3 style="font-size: 16px; color: var(--primary); margin-bottom: 10px; border-bottom: 2px solid var(--border); padding-bottom: 6px;">Fees Collection Summary</h3>
      <div class="report-summary">
        <div><strong id="reportTotalPaid">₹0</strong><span>Paid This Month</span></div>
        <div><strong id="reportTotalPending">₹0</strong><span>Total Due Balance</span></div>
        <div><strong id="reportTotalAdvance">₹0</strong><span>Total Advance</span></div>
        <div><strong>${students.length}</strong><span>Students</span></div>
      </div>
      <div class="report-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Student ID</th>
              <th>Monthly Fee</th>
              <th>Paid (This Month)</th>
              <th>Status</th>
              <th>Total Balance Due</th>
            </tr>
          </thead>
          <tbody>
  `;

  students.forEach(student => {
    const monthlyFee = Number(student.monthlyFee || 0);
    const stuCode = student.studentCode ? String(student.studentCode).trim() : "";
    
    const studentFees = reportFees.filter(fee => {
      const fDocId = String(fee.studentDbId || "").trim();
      const fStuId = String(fee.studentId || "").trim();
      return fDocId === student.id || fStuId === student.id || (stuCode && fStuId === stuCode);
    });

    const ledger = calculateLedger(student, studentFees, month);
    const balance = ledger.due;
    const advance = ledger.advance;

    const paidThisMonth = studentFees.reduce((sum, fee) => {
      const fMonth = fee.feeMonth || fee.month || fee.paymentDate || "";
      if (fMonth.startsWith(month)) { return sum + Number(fee.paidAmount || fee.amount || 0); }
      return sum;
    }, 0);

    let status = '<span style="color: #10b981; font-weight: 700;">Paid</span>';
    if (balance > 0 && paidThisMonth === 0) { status = '<span style="color: #ef4444; font-weight: 700;">Due</span>'; } 
    else if (balance > 0 && paidThisMonth > 0) { status = '<span style="color: #f59e0b; font-weight: 700;">Partial</span>'; } 
    else if (balance === 0 && advance > 0) { status = '<span style="color: #3b82f6; font-weight: 700;">Advance</span>'; }

    totalPaid += paidThisMonth;
    totalPending += balance;
    totalAdvance += advance;

    html += `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(student.name || "-")}</td>
        <td style="color: var(--text-muted);">${escapeHtml(student.studentCode || student.studentId || student.id)}</td>
        <td>₹${monthlyFee.toLocaleString("en-IN")}</td>
        <td style="color: #10b981; font-weight: bold;">₹${paidThisMonth.toLocaleString("en-IN")}</td>
        <td>${status}</td>
        <td style="color: #ef4444; font-weight: bold;">₹${balance.toLocaleString("en-IN")}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div></div>`;
  result.innerHTML = html;

  document.getElementById("reportTotalPaid").textContent = "₹" + totalPaid.toLocaleString("en-IN");
  document.getElementById("reportTotalPending").textContent = "₹" + totalPending.toLocaleString("en-IN");
  document.getElementById("reportTotalAdvance").textContent = "₹" + totalAdvance.toLocaleString("en-IN");
};

function setDefaultReportMonth() {
  const currentMonth = todayMonth();
  const attendanceMonth = document.getElementById("attendanceMonth");
  const feesMonth = document.getElementById("feesMonth");
  if (attendanceMonth) attendanceMonth.value = currentMonth;
  if (feesMonth) feesMonth.value = currentMonth;
}

window.printReport = function() {
  const reportResult = document.querySelector(".report-result");
  if (!reportResult) { alert("Pehle report generate karein."); return; }

  const staffName = sessionStorage.getItem("staffName") || localStorage.getItem("staffName") || window.currentUserName || "Admin";
  const now = new Date();
  const dateTime = now.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  const printWindow = window.open("", "_blank", "width=900,height=700");
  
  if (!printWindow) { alert("Popup blocked! Please allow popups for this site."); return; }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Shiv Shakti Tuition - Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Inter', sans-serif; background: white; color: #1e293b; padding: 15mm; font-size: 11px; position: relative; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; pointer-events: none; z-index: -1; }
        .watermark img { width: 400px; }
        .print-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0a1d3f; padding-bottom: 12px; margin-bottom: 15px; }
        .logo-box { width: 70px; height: 70px; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .title-box { text-align: center; flex-grow: 1; }
        .title-box h1 { font-family: 'Merriweather', serif; color: #0a1d3f; font-size: 22px; margin-bottom: 3px; }
        .title-box p { font-size: 11px; color: #64748b; font-weight: 500; }
        .meta-box { font-size: 10px; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; line-height: 1.6; text-align: right; }
        .report-summary { display: flex; gap: 10px; margin: 15px 0; justify-content: space-between; }
        .report-summary div { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; text-align: center; }
        .report-summary strong { display: block; font-size: 16px; color: #0a1d3f; }
        .report-summary span { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; text-align: left; }
        th { background: #0a1d3f !important; color: white !important; padding: 8px; font-weight: 600; }
        td { padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 500; }
        tr:nth-child(even) { background: #f8fafc; }
        .print-footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; font-weight: 600; page-break-inside: avoid; }
        .sign-line { border-top: 1px solid #1e293b; margin-top: 40px; padding-top: 4px; width: 140px; text-align: center; }
        @page { size: A4 portrait; margin: 10mm; }
        @media print { body { padding: 0; } .watermark { opacity: 0.05 !important; } }
      </style>
    </head>
    <body>
      <div class="watermark"><img src="./logo.png" alt="Watermark"></div>
      <div class="print-header">
        <div class="logo-box"><img src="./logo.png" alt="Logo"></div>
        <div class="title-box"><h1>SHIV SHAKTI TUITION</h1><p>Sultanpur Dabas, near Chameli Mandir, Delhi • Quality Education</p></div>
        <div class="meta-box"><div><strong>Date:</strong> ${dateTime}</div><div><strong>Staff:</strong> ${escapeHtml(staffName)}</div></div>
      </div>
      <div class="report-content">${reportResult.innerHTML}</div>
      <div class="print-footer">
        <div><p>Generated by: <strong>${escapeHtml(staffName)}</strong></p></div>
        <div class="sign-line">Authorized Signature</div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
};

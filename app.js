// ==========================================
// APP.JS - COMPLETE UNIFIED DASHBOARD & NAVIGATION
// Shiv Shakti Tuition Management System
// ==========================================
// ==========================================
// RESTORE SESSION FROM REMEMBER ME
// ==========================================
if (!sessionStorage.getItem("staffRole") && localStorage.getItem("staffRole")) {
  sessionStorage.setItem("staffName", localStorage.getItem("staffName") || "");
  sessionStorage.setItem("staffId", localStorage.getItem("staffId") || "");
  sessionStorage.setItem("staffRole", localStorage.getItem("staffRole") || "");
}

"use strict";

import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = getAuth();

document.addEventListener("DOMContentLoaded", async () => {

  const mobileMenuBtn = document.getElementById("mobileMenu");
  const sidebar = document.getElementById("sidebar");

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
      if (sidebar.classList.contains("open")) {
        history.pushState({ menuOpen: true }, "", "");
      }
    });

    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }

  window.addEventListener("popstate", (event) => {
    if (sidebar && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      event.preventDefault();
    }
  });

  document.querySelectorAll("[data-page]").forEach(element => {
    element.addEventListener("click", (e) => {
      const page = element.getAttribute("data-page");
      if (!page) return;

      if (sidebar) sidebar.classList.remove("open");

      if (page === "dashboard" || page === "index") {
        window.location.href = "index.html";
      } else {
        window.location.href = page + ".html";
      }
    });
  });

  // 1. PROFILE DROPDOWN TOGGLE (Direct Style Display Method)
  const profileBtn = document.getElementById("profileDropdownBtn");
  const dropdownMenu = document.getElementById("profileDropdownMenu");

  if (profileBtn && dropdownMenu) {
    dropdownMenu.style.display = "none";

    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.style.display = dropdownMenu.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", (e) => {
      if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = "none";
      }
    });
  }

  // 2. LOGOUT HANDLER
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (confirm("Kya aap sach mein logout karna chahte hain?")) {
        try {
          await signOut(auth);
          window.location.href = "login.html"; 
        } catch (error) {
          alert("Logout error: " + error.message);
        }
      }
    });
  }

  // 3. CHANGE PASSWORD MODAL LOGIC
  const changePassBtn = document.getElementById("changePasswordBtn");
  const passModal = document.getElementById("changePasswordModal");
  const closePassModal = document.getElementById("closePassModal");
  const passForm = document.getElementById("changePasswordForm");

  if (changePassBtn && passModal) {
    changePassBtn.addEventListener("click", (e) => {
      e.preventDefault();
      passModal.style.display = "block";
      if (dropdownMenu) dropdownMenu.style.display = "none";
    });
  }

  if (closePassModal && passModal) {
    closePassModal.addEventListener("click", () => {
      passModal.style.display = "none";
    });
  }

  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPass = document.getElementById("newPasswordInput").value;
      const user = auth.currentUser;

      if (!user) {
        alert("⚠️ No active user found. Please login again.");
        return;
      }

      if (newPass.length < 6) {
        alert("⚠️ Password kam se kam 6 characters ka hona chahiye.");
        return;
      }

      try {
        await updatePassword(user, newPass);
        alert("✅ Password successfully update ho gaya hai!");
        passModal.style.display = "none";
        passForm.reset();
      } catch (error) {
        console.error("Password update error:", error);
        if (error.code === "auth/requires-recent-login") {
          alert("🔒 Security check: Please ek baar Logout karke dubara Login karein, fir password change karein.");
        } else {
          alert("Error: " + error.message);
        }
      }
    });
  }

  // 4. LOAD LOGGED IN USER & 6-PERMISSIONS (RBAC)
  onAuthStateChanged(auth, async (user) => {
    const profileBox = document.querySelector("#profileDropdownBtn strong");
    if (!profileBox) return;

    if (user) {
      try {
        const staffDoc = await getDoc(doc(db, "staff", user.uid));
        let userName = "Admin";
        let userRole = "admin";

        if (staffDoc.exists()) {
          const data = staffDoc.data();
          userName = data.name || user.email.split("@")[0];
          userRole = (data.role || "admin").toLowerCase();
          
          const perms = data.permissions || {
            students: true, attendance: true, fees: true, reports: true, staff: true, settings: true
          };

          if (userRole !== "admin") {
            const modules = ["students", "attendance", "fees", "reports", "staff", "settings"];
            
            modules.forEach(mod => {
              if (perms[mod] === false) {
                const menuBtn = document.querySelector(`[data-page="${mod}"]`);
                if (menuBtn) menuBtn.style.display = "none";
                
                if (window.location.pathname.includes(mod + ".html")) {
                  alert(`Access Denied: You do not have permission for the ${mod} module.`);
                  window.location.href = "index.html";
                }
              }
            });
          }
        } else {
          userName = user.displayName || user.email.split("@")[0] || "Admin";
        }

        profileBox.textContent = userName;

      } catch (e) {
        console.error("Auth permission check error:", e);
        profileBox.textContent = "Admin";
      }
    } else {
      // 🔴 AGAR BINA LOGIN KIYE KOI AAYE TOH DIRECT LOGIN PAGE PAR BHEJ DO
      profileBox.textContent = "Guest";
      if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
      }
    }
  });

  await loadDashboardStats();
});

// ==========================================
// UPDATED SMART LEDGER DASHBOARD STATS
// ==========================================
async function loadDashboardStats() {
  const totalStudentsEl = document.getElementById("totalStudents");
  if (!totalStudentsEl) return;

  try {
    // 1. Load Students
    const studentsSnap = await getDocs(collection(db, "students"));
    let studentsList = [];
    studentsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (String(data.status || "ACTIVE").toUpperCase() !== "ARCHIVED") {
        studentsList.push({ id: docSnap.id, ...data });
      }
    });
    totalStudentsEl.textContent = studentsList.length;

    // 2. Load Attendance
    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceSnap = await getDocs(collection(db, "attendance"));
    let presentCount = 0;
    let absentCount = 0;
    
    attendanceSnap.forEach(docSnap => {
      const data = docSnap.data();
      const recDate = data.date || docSnap.id.split("_")[0];
      if (recDate === todayStr && Array.isArray(data.records)) {
        data.records.forEach(r => {
          if (r.status === "P") presentCount++;
          if (r.status === "A") absentCount++;
        });
      }
    });
    
    const presentEl = document.getElementById("todayPresent");
    const absentEl = document.getElementById("todayAbsent");
    if (presentEl) presentEl.textContent = presentCount;
    if (absentEl) absentEl.textContent = absentCount;

    // 3. Load Fees
    const feesSnap = await getDocs(collection(db, "fees"));
    let totalReceived = 0;
    let totalAdvance = 0;
    let allFees = [];

    feesSnap.forEach(docSnap => {
      const data = docSnap.data();
      totalReceived += Number(data.paidAmount || data.amount || 0);
      totalAdvance += Number(data.advanceAmount || 0);
      allFees.push(data);
    });

  // 4. SMART FEE LEDGER FOR DASHBOARD
// ============================================
// IMPORTANT RULE:
//
// Fee Start Month = August
// Due Day = 15
//
// 15 August  -> Start month only
// 15 September -> August fee due
// 15 October   -> August + September due
//
// Payment always clears OLDEST pending month first.
// ============================================

let totalCalculatedPending = 0;
let totalCalculatedAdvance = 0;
let pendingStudentsHTML = "";

const today = new Date();

const currentMonthStr =
  today.getFullYear() +
  "-" +
  String(today.getMonth() + 1).padStart(2, "0");


// --------------------------------------------
// HELPER: NEXT MONTH
// --------------------------------------------
function dashboardNextMonth(month) {
  const d = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)) - 1,
    1
  );

  d.setMonth(d.getMonth() + 1);

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0")
  );
}


// --------------------------------------------
// HELPER: FEE MONTH DUE DATE
// Fee Month + 1 month + Due Day
// --------------------------------------------
function dashboardDueDate(month, dueDay) {
  const d = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    Number(dueDay || 1)
  );

  return d;
}


studentsList.forEach(student => {

  const monthlyFee =
    Number(student.monthlyFee || 0);

  if (monthlyFee <= 0) {
    return;
  }


  // ------------------------------------------
  // FEE START MONTH
  // ------------------------------------------
  let startMonth =
    String(
      student.feeStartMonth || ""
    ).trim();

  if (!/^\d{4}-\d{2}$/.test(startMonth)) {
    startMonth = currentMonthStr;
  }


  if (startMonth > currentMonthStr) {
    return;
  }


  const dueDay =
    Number(student.feeDueDay || 1);


  // ------------------------------------------
  // CREATE MONTH LEDGER
  // ------------------------------------------
  const ledgerMonths = [];

  let month = startMonth;


  while (month <= currentMonthStr) {

    const dueDate =
      dashboardDueDate(
        month,
        dueDay
      );

    ledgerMonths.push({

      month,

      fee: monthlyFee,

      paid: 0,

      due: 0,

      dueDate,

      isDue:
        dueDate <= today

    });


    month =
      dashboardNextMonth(month);

  }


  // ------------------------------------------
  // STUDENT PAYMENTS
  // ------------------------------------------
  const studentPayments =
    allFees
      .filter(fee => {

        const feeStudentId =
          fee.studentDbId ||
          fee.studentId;

        return (
          feeStudentId === student.id &&
          Number(
            fee.paidAmount ||
            fee.amount ||
            0
          ) > 0
        );

      })
      .sort((a, b) => {

        const dateA =
          new Date(
            a.paymentDate ||
            a.timestamp ||
            0
          );

        const dateB =
          new Date(
            b.paymentDate ||
            b.timestamp ||
            0
          );

        return dateA - dateB;

      });


  // ------------------------------------------
  // ALLOCATE PAYMENTS
  // OLDEST MONTH FIRST
  // ------------------------------------------
  let studentAdvance = 0;


  studentPayments.forEach(payment => {

    let remaining =
      Number(
        payment.paidAmount ||
        payment.amount ||
        0
      );

    if (remaining <= 0) {
      return;
    }


    const selectedFeeMonth =
      String(
        payment.feeMonth ||
        payment.month ||
        ""
      ).trim();


    if (
      !/^\d{4}-\d{2}$/.test(
        selectedFeeMonth
      )
    ) {

      studentAdvance +=
        remaining;

      return;

    }


    // ----------------------------------------
    // FIRST: OLDEST DUE MONTHS
    // ----------------------------------------
    for (
      const item of ledgerMonths
    ) {

      if (remaining <= 0) {
        break;
      }


      if (
        item.month >
        selectedFeeMonth
      ) {
        break;
      }


      if (!item.isDue) {
        continue;
      }


      const remainingFee =
        Math.max(
          0,
          monthlyFee -
          item.paid
        );


      if (remainingFee <= 0) {
        continue;
      }


      const allocated =
        Math.min(
          remaining,
          remainingFee
        );


      item.paid +=
        allocated;

      remaining -=
        allocated;

    }


    // ----------------------------------------
    // THEN: FUTURE/FEE-MONTH ADVANCE
    // ----------------------------------------
    if (remaining > 0) {

      for (
        const item of ledgerMonths
      ) {

        if (remaining <= 0) {
          break;
        }


        if (
          item.month <=
          selectedFeeMonth
        ) {
          continue;
        }


        const remainingFee =
          Math.max(
            0,
            monthlyFee -
            item.paid
          );


        if (remainingFee <= 0) {
          continue;
        }


        const allocated =
          Math.min(
            remaining,
            remainingFee
          );


        item.paid +=
          allocated;

        remaining -=
          allocated;

      }

    }


    // Anything left = advance
    if (remaining > 0) {
      studentAdvance +=
        remaining;
    }

  });


  // ------------------------------------------
  // CALCULATE CURRENT DUE
  // ------------------------------------------
  let studentTotalDue = 0;


  ledgerMonths.forEach(item => {

    if (!item.isDue) {

      item.due = 0;

      return;

    }


    item.due =
      Math.max(
        0,
        monthlyFee -
        item.paid
      );


    studentTotalDue +=
      item.due;

  });


  // ------------------------------------------
  // TOTAL DASHBOARD VALUES
  // ------------------------------------------
  totalCalculatedPending +=
    studentTotalDue;

  totalCalculatedAdvance +=
    studentAdvance;


  // ------------------------------------------
  // PENDING STUDENT LIST
  // ------------------------------------------
  if (studentTotalDue > 0) {

    pendingStudentsHTML += `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:12px 16px;
        border-bottom:1px solid var(--border);
        background:white;
      ">

        <div>

          <strong style="
            font-size:14px;
            color:var(--primary);
            display:block;
          ">
            ${String(
              student.name || ""
            ).replace(/</g, "&lt;")}
          </strong>

          <small style="
            color:var(--text-muted);
            font-size:12px;
          ">
            ID:
            ${String(
              student.studentCode || "-"
            ).replace(/</g, "&lt;")}
            |
            Class:
            ${String(
              student.className || "-"
            ).replace(/</g, "&lt;")}
          </small>

        </div>


        <div style="
          text-align:right;
        ">

          <span style="
            color:#ef4444;
            font-weight:700;
            font-size:14px;
            display:block;
          ">
            ₹${studentTotalDue.toLocaleString("en-IN")}
          </span>


          <a
            href="fees.html?studentId=${student.id}"
            style="
              font-size:11px;
              color:#2563eb;
              text-decoration:none;
              font-weight:600;
            "
          >
            Collect Fee →
          </a>

        </div>

      </div>
    `;

  }

});

    // 5. Update Dashboard Screen
    const receivedEl = document.getElementById("feeReceived");
    const pendingEl = document.getElementById("feePending");
    const advanceEl = document.getElementById("feeAdvance");

    if (receivedEl) receivedEl.textContent = "₹" + totalReceived.toLocaleString("en-IN");
    if (pendingEl) pendingEl.textContent = "₹" + totalCalculatedPending.toLocaleString("en-IN");
    if (advanceEl) advanceEl.textContent = "₹" + totalAdvance.toLocaleString("en-IN");

    const parentSection = document.querySelector(".pending-heading")?.nextElementSibling;
    if (parentSection) {
      if (pendingStudentsHTML !== "") {
        parentSection.innerHTML = `
          <div style="background: white; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
            ${pendingStudentsHTML}
          </div>
        `;
      } else {
        parentSection.innerHTML = `
          <div class="empty-card" style="padding: 30px; text-align: center; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
            <span class="material-symbols-rounded" style="font-size: 40px; margin-bottom: 10px; color: #10b981;">task_alt</span>
            <h3 style="color:#047857; margin-bottom:5px;">All Clear!</h3>
            <p style="color: var(--text-muted); font-size: 13px;">No students have pending fee dues.</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
  }
}

function escapeHtml(val) { 
  return String(val||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); 
}

// ==========================================
// AUTO-HIGHLIGHT SIDEBAR MENU
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Current page ka naam nikalo
  let currentPage = window.location.pathname.split("/").pop().replace(".html", "");
  if (currentPage === "index" || currentPage === "") {
    currentPage = "dashboard";
  }

  // Pehle sabse 'active' color hatao, fir jo page khula hai sirf use highlight karo
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-page") === currentPage) {
      btn.classList.add("active");
    }
  });
});

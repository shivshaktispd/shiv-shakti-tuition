// ==========================================
// FEES.JS - COMPLETE
// Fee Start Month Based Calculation
// Advance Carry Forward
// Edit / Delete Payment
// Due Students
// ==========================================

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

let currentStudent = null;
let editingFeeId = null;
let feeRecords = [];
let allActiveStudents = [];


// ==========================================
// TOAST
// ==========================================
window.showToast = function(message, type = "success") {

  const toast = document.getElementById("customToast");
  const toastMsg = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMsg) {
    alert(message);
    return;
  }

  toastMsg.innerText = message;

  if (toastIcon) {
    toastIcon.innerText =
      type === "error"
        ? "error"
        : "check_circle";
  }

  toast.style.background =
    type === "error"
      ? "#ef4444"
      : "#10b981";

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
};


// ==========================================
// HELPERS
// ==========================================
function esc(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function money(value) {

  return Number(value || 0)
    .toLocaleString("en-IN");

}


// Local date — UTC problem avoided
function getTodayDate() {

  const now = new Date();

  const y = now.getFullYear();

  const m = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const d = String(
    now.getDate()
  ).padStart(2, "0");

  return `${y}-${m}-${d}`;

}


function todayMonth() {

  return getTodayDate().slice(0, 7);

}


function monthDate(month) {

  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    return null;
  }

  const year =
    Number(month.slice(0, 4));

  const mon =
    Number(month.slice(5, 7));

  return new Date(
    year,
    mon - 1,
    1
  );

}


function monthText(month) {

  const date =
    monthDate(month);

  if (!date) return month || "-";

  return date.toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric"
    }
  );

}


function nextMonth(month) {

  const date =
    monthDate(month);

  if (!date) return month;

  date.setMonth(
    date.getMonth() + 1
  );

  return (
    date.getFullYear() +
    "-" +
    String(
      date.getMonth() + 1
    ).padStart(2, "0")
  );

}


function getFeeStartMonth(student) {
  if (!student) return todayMonth();

  const value = String(student.feeStartMonth || "").trim();

  // Valid Fee Start Month = YYYY-MM
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  // Old students without Fee Start Month
  // -> current month se calculation start hogi
  return todayMonth();
}

function calculateLedger(
  student,
  records = [],
  untilMonth = todayMonth()
) {
  const monthlyFee = Number(student?.monthlyFee || 0);
  const startMonth = getFeeStartMonth(student);
  const dueDay = Number(student?.feeDueDay || 1);

  if (
    monthlyFee <= 0 ||
    !/^\d{4}-\d{2}$/.test(startMonth) ||
    !/^\d{4}-\d{2}$/.test(untilMonth)
  ) {
    return {
      months: [],
      due: 0,
      advance: 0,
      allocationsByRecord: {}
    };
  }

  const today = new Date();

  // ==========================================
  // CREATE ALL FEE MONTHS
  // ==========================================
  const months = [];

  let month = startMonth;

  while (month <= untilMonth) {

    const feeDate = monthDate(month);

    if (!feeDate) {
      month = nextMonth(month);
      continue;
    }

    const dueDate = new Date(
      feeDate.getFullYear(),
      feeDate.getMonth() + 1,
      dueDay
    );

    months.push({
      month,
      label: monthText(month),
      fee: monthlyFee,
      paid: 0,
      due: 0,
      advance: 0,
      dueDate,
      isDue: dueDate <= today
    });

    month = nextMonth(month);
  }

  // ==========================================
  // PAYMENT ORDER
  // OLDEST PAYMENT FIRST
  // ==========================================
  const payments = [...records]
    .filter(record =>
      Number(
        record.paidAmount ??
        record.amount ??
        0
      ) > 0
    )
    .sort((a, b) => {

      const dateA = new Date(
        a.paymentDate ||
        a.timestamp ||
        0
      );

      const dateB = new Date(
        b.paymentDate ||
        b.timestamp ||
        0
      );

      return dateA - dateB;
    });

  const allocationsByRecord = {};

  // ==========================================
  // ALLOCATE EACH PAYMENT
  // OLDEST MONTH FIRST
  // ==========================================
  payments.forEach(record => {

    let remaining = Number(
      record.paidAmount ??
      record.amount ??
      0
    );

    if (remaining <= 0) return;

    const selectedFeeMonth =
      String(
        record.feeMonth ||
        record.month ||
        ""
      ).trim();

    if (
      !/^\d{4}-\d{2}$/.test(
        selectedFeeMonth
      )
    ) {
      return;
    }

    const allocations = [];

    /*
      Payment ko Fee Start Month se
      oldest unpaid month par lagao.

      Example:

      July ₹500 due
      August ₹500 due

      Payment ₹1000
      Fee Month = August

      Result:
      July    ₹500
      August  ₹500
    */

    for (const item of months) {

      if (remaining <= 0) break;

      /*
        Selected Fee Month tak
        normal allocation karo.
      */

      if (item.month > selectedFeeMonth) {
        break;
      }

      const availableForMonth =
        Math.max(
          0,
          monthlyFee - item.paid
        );

      if (availableForMonth <= 0) {
        continue;
      }

      const amount =
        Math.min(
          remaining,
          availableForMonth
        );

      item.paid += amount;

      remaining -= amount;

      allocations.push({
        month: item.month,
        label: item.label,
        amount
      });

    }

    /*
      Agar selected month tak payment
      ke baad bhi amount bacha hai,
      to wo next months ka ADVANCE hai.

      Example:
      Due ₹1000
      Payment ₹1200

      ₹1000 → old dues
      ₹200  → next month advance
    */

    if (remaining > 0) {

      for (const item of months) {

        if (remaining <= 0) break;

        if (item.month <= selectedFeeMonth) {
          continue;
        }

        const availableForMonth =
          Math.max(
            0,
            monthlyFee - item.paid
          );

        if (availableForMonth <= 0) {
          continue;
        }

        const amount =
          Math.min(
            remaining,
            availableForMonth
          );

        item.paid += amount;

        remaining -= amount;

        allocations.push({
          month: item.month,
          label: item.label,
          amount,
          advance: true
        });

      }

    }

    allocationsByRecord[record.id] =
      allocations;
  });

  // ==========================================
  // CALCULATE DUE + ADVANCE
  // ==========================================
  let totalDue = 0;
  let totalAdvance = 0;

  months.forEach(item => {

    if (item.isDue) {

      item.due =
        Math.max(
          0,
          monthlyFee - item.paid
        );

      totalDue += item.due;

    } else {

      item.due = 0;

    }

    /*
      Future month mein paid amount
      advance maana jayega.
    */

    if (!item.isDue && item.paid > 0) {

      totalAdvance +=
        item.paid;

    }

  });

  /*
    Agar payment current ledger ke
    available months se bhi zyada hai,
    remaining amount bhi advance hai.
  */

  payments.forEach(record => {

    const allocations =
      allocationsByRecord[record.id] || [];

    const paid =
      Number(
        record.paidAmount ??
        record.amount ??
        0
      );

    const allocated =
      allocations.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      );

    const extra =
      Math.max(
        0,
        paid - allocated
      );

    if (extra > 0) {
      totalAdvance += extra;
    }

  });

  return {
    months,
    due: totalDue,
    advance: totalAdvance,
    allocationsByRecord
  };
}
// ==========================================
// DEFAULT FORM VALUES
// ==========================================
function setDefaults() {

  const paymentDate =
    document.getElementById(
      "feePaymentDate"
    );

  const feeMonth =
    document.getElementById(
      "feeMonth"
    );


  if (
    paymentDate &&
    !paymentDate.value
  ) {

    paymentDate.value =
      getTodayDate();

  }


  if (
    feeMonth &&
    !feeMonth.value
  ) {

    feeMonth.value =
      todayMonth();

  }

}


// ==========================================
// URL STUDENT ID
// ==========================================
function getStudentIdFromURL() {

  return new URLSearchParams(
    window.location.search
  ).get("studentId");

}


// ==========================================
// LOAD STUDENTS
// ==========================================
async function loadFeeStudent() {

  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "students"
        )
      );


    allActiveStudents = [];


    snapshot.forEach(
      studentDoc => {

        const data =
          studentDoc.data();


        const status =
          String(
            data.status || "ACTIVE"
          ).toUpperCase();


        if (
          status !== "INACTIVE" &&
          status !== "ARCHIVED"
        ) {

          allActiveStudents.push({

            id:
              studentDoc.id,

            ...data

          });

        }

      }
    );


    allActiveStudents.sort(
      (a, b) =>
        (a.name || "").localeCompare(
          b.name || ""
        )
    );


    const select =
      document.getElementById(
        "feeStudentSelect"
      );


    if (select) {

      select.innerHTML =
        `
          <option value="">
            -- Select a Student --
          </option>
        ` +

        allActiveStudents
          .map(
            student => `

              <option
                value="${student.id}"
              >
                ${esc(student.name)}
                (ID:
                ${esc(
                  student.studentCode || "-"
                )})
              </option>

            `
          )
          .join("");


      select.onchange =
        async function(event) {

          currentStudent =
            allActiveStudents.find(
              student =>
                student.id ===
                event.target.value
            ) || null;


          renderStudentHeader();


          if (currentStudent) {

            await loadStudentFeeHistory();

          } else {

            resetSummary();

            renderDueMonths();

            const history =
              document.getElementById(
                "feeHistory"
              );

            if (history) {

              history.innerHTML =
                `
                  <div class="fee-empty-history">
                    Select a student to view history.
                  </div>
                `;

            }

          }

        };

    }


    // ======================================
    // OPEN FROM STUDENT PROFILE
    // ======================================
    const urlId =
      getStudentIdFromURL();


    if (urlId) {

      if (select) {

        select.value =
          urlId;

      }


      const dropdown =
        document.getElementById(
          "dropdownContainer"
        );


      if (dropdown) {

        dropdown.style.display =
          "none";

      }


      currentStudent =
        allActiveStudents.find(
          student =>
            student.id === urlId
        ) || null;


      if (currentStudent) {

        renderStudentHeader();

        await loadStudentFeeHistory();

      } else {

        showToast(
          "Student profile not found.",
          "error"
        );

      }

    }

  } catch (error) {

    console.error(
      "Student loading error:",
      error
    );

    showToast(
      "Failed to load students list.",
      "error"
    );

  }

}


// ==========================================
// STUDENT HEADER
// ==========================================
function renderStudentHeader() {

  const name =
    document.getElementById(
      "feeStudentName"
    );

  const id =
    document.getElementById(
      "feeStudentId"
    );

  const fee =
    document.getElementById(
      "feeMonthlyAmount"
    );

  const dueDay =
    document.getElementById(
      "feeStudentDueDay"
    );

  const startLabel =
    document.getElementById(
      "feeStudentStartMonth"
    );

  if (!currentStudent) {


    if (name)
      name.textContent =
        "Select a student...";

    if (id)
      id.textContent = "-";

    if (fee)
      fee.textContent = "₹0";

    if (dueDay)
      dueDay.textContent = "-";

    if (startLabel)
      startLabel.textContent = "-";

    return;

  }


  name.textContent =
    currentStudent.name || "-";


  id.textContent =
    currentStudent.studentCode ||
    currentStudent.studentId ||
    currentStudent.id;


  fee.textContent =
    "₹" +
    money(
      currentStudent.monthlyFee
    );


  dueDay.textContent =
    currentStudent.feeDueDay
      ? currentStudent.feeDueDay +
        "th of Month"
      : "Not Set";


  startLabel.textContent =
    monthText(
      getFeeStartMonth(
        currentStudent
      )
    );

}


// ==========================================
// LOAD STUDENT FEE HISTORY
// ==========================================
async function loadStudentFeeHistory() {

  if (!currentStudent) return;


  const history =
    document.getElementById(
      "feeHistory"
    );


  if (history) {

    history.innerHTML =
      `
        <div class="fee-empty-history">
          Fetching records...
        </div>
      `;

  }


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "fees"
        )
      );


    feeRecords = [];


    snapshot.forEach(
      feeDoc => {

        const record =
          feeDoc.data();


        const studentId =
          record.studentDbId ||
          record.studentId;


        if (
          studentId ===
          currentStudent.id
        ) {

          feeRecords.push({

            id:
              feeDoc.id,

            ...record

          });

        }

      }
    );


    feeRecords.sort(
      (a, b) =>
        new Date(
          b.paymentDate ||
          b.timestamp ||
          0
        ) -
        new Date(
          a.paymentDate ||
          a.timestamp ||
          0
        )
    );


    renderFeeSummary();

    renderDueMonths();

    renderFeeHistoryUI();


  } catch (error) {

    console.error(
      "Fee history error:",
      error
    );


    if (history) {

      history.innerHTML =
        `
          <div class="fee-empty-history">
            Error loading fee history.
          </div>
        `;

    }

  }

}


// ==========================================
// RESET SUMMARY
// ==========================================
function resetSummary() {

  [
    "feeTotalPaid",
    "feeTotalAdvance",
    "feeTotalPending"
  ].forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {

      element.textContent =
        "₹0";

    }

  });

}


// ==========================================
// SUMMARY
// ==========================================
function renderFeeSummary() {

  if (!currentStudent) {

    resetSummary();

    return;

  }


  const ledger =
    calculateLedger(
      currentStudent,
      feeRecords
    );


  const totalPaid =
    feeRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record.paidAmount ??
          record.amount ??
          0
        ),
      0
    );


  const paidElement =
    document.getElementById(
      "feeTotalPaid"
    );


  const advanceElement =
    document.getElementById(
      "feeTotalAdvance"
    );


  const pendingElement =
    document.getElementById(
      "feeTotalPending"
    );


  if (paidElement) {

    paidElement.textContent =
      "₹" +
      money(totalPaid);

  }


  if (advanceElement) {

    advanceElement.textContent =
      "₹" +
      money(
        ledger.advance
      );

  }


  if (pendingElement) {

    pendingElement.textContent =
      "₹" +
      money(
        ledger.due
      );

  }

}


// ==========================================
// DUE MONTHS
// ==========================================
function renderDueMonths() {

  const element =
    document.getElementById(
      "feeDueMonths"
    );


  if (!element) return;


  if (!currentStudent) {

    element.innerHTML =
      `
        <span class="fee-empty-state">
          Select a student.
        </span>
      `;

    return;

  }


  const ledger =
    calculateLedger(
      currentStudent,
      feeRecords
    );


  const dueMonths =
    ledger.months.filter(
      month =>
        month.due > 0
    );


  if (!dueMonths.length) {

    element.innerHTML =
      `
        <span class="fee-no-due">
          No pending dues
        </span>
      `;

    return;

  }


  element.innerHTML =
    dueMonths
      .map(
        month => `

          <span class="fee-due-chip">

            ${esc(month.label)}

            <strong>
              ₹${money(month.due)}
            </strong>

          </span>

        `
      )
      .join("");

}


// ==========================================
// DATE FORMAT
// ==========================================
function formatDate(value) {

  if (!value) return "-";

  const parts =
    String(value).split("-");


  if (parts.length === 3) {

    return (
      parts[2] +
      "/" +
      parts[1] +
      "/" +
      parts[0]
    );

  }


  return value;

}


// ==========================================
// HISTORY UI
// ==========================================
function renderFeeHistoryUI() {

  const container =
    document.getElementById(
      "feeHistory"
    );


  if (!container) return;


  if (!currentStudent) {

    container.innerHTML =
      `
        <div class="fee-empty-history">
          Select a student.
        </div>
      `;

    return;

  }


  const ledger =
    calculateLedger(
      currentStudent,
      feeRecords
    );


  const dueMonths =
    ledger.months.filter(
      month =>
        month.due > 0
    );


  let html = `

    <div class="history-due-summary">

      <div>

        <span>
          Pending Months
        </span>

        <strong>
          ${dueMonths.length}
        </strong>

      </div>


      <div>

        <span>
          Total Due
        </span>

        <strong>
          ₹${money(ledger.due)}
        </strong>

      </div>

    </div>

  `;


  // ========================================
  // PENDING MONTHS
  // ========================================
  if (dueMonths.length) {

    html += `

      <div
        style="
          margin:12px 0;
          padding:14px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:12px;
        "
      >

        <div
          style="
            font-weight:700;
            color:#9a3412;
            margin-bottom:8px;
          "
        >
          Pending Fee Months
        </div>


        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
          "
        >

          ${dueMonths
            .map(
              month => `

                <span
                  style="
                    background:#fff;
                    border:1px solid #fdba74;
                    color:#9a3412;
                    padding:7px 10px;
                    border-radius:20px;
                    font-size:12px;
                    font-weight:600;
                  "
                >

                  ${esc(month.label)}
                  :
                  ₹${money(month.due)}

                </span>

              `
            )
            .join("")}

        </div>

      </div>

    `;

  }


  // ========================================
  // NO PAYMENTS
  // ========================================
  if (!feeRecords.length) {

    container.innerHTML =
      html +

      `

        <div class="fee-empty-history">

          <span class="material-symbols-rounded">
            receipt_long
          </span>

          <p>
            No payment records found for this student.
          </p>

        </div>

      `;

    return;

  }


  // ========================================
  // TABLE
  // ========================================
  html += `

    <div class="fee-history-table-wrap">

      <table class="fee-history-table">

        <thead>

          <tr>

            <th>
              Date
            </th>

            <th>
              Month
            </th>
            
            <th>
  Adjusted For
</th>

            <th>
              Paid
            </th>

            <th>
              Advance
            </th>

            <th>
              Due
            </th>

            <th>
              Action
            </th>

          </tr>

        </thead>


        <tbody>

  `;


  feeRecords.forEach(
    record => {

      const month =
        record.feeMonth ||
        record.month ||
        "-";


      const paid =
        Number(
          record.paidAmount ??
          record.amount ??
          0
        );
        
        const adjustedMonths =
  ledger.allocationsByRecord?.[record.id] || [];

const adjustedText =
  adjustedMonths.length
    ? adjustedMonths
        .map(
          item =>
            `${esc(item.label)} ₹${money(item.amount)}`
        )
        .join("<br>")
    : "-";


      const ledgerMonth =
        ledger.months.find(
          item =>
            item.month === month
        );


      const monthDue =
        ledgerMonth
          ? ledgerMonth.due
          : 0;


      /*
        Show current calculated
        advance for this month.
      */
      const monthAdvance =
        ledgerMonth
          ? ledgerMonth.advance
          : 0;


      html += `

        <tr>

          <td>
            ${esc(
              formatDate(
                record.paymentDate
              )
            )}
          </td>


          <td>
            ${esc(
              monthText(month)
            )}
          </td>


          <td class="fee-paid-cell">
            ₹${money(paid)}
          </td>
          
          <td>
  ${adjustedText}
</td>


          <td class="fee-advance-cell">
            ₹${money(monthAdvance)}
          </td>


          <td
            class="${
              monthDue > 0
                ? "fee-due-cell"
                : "fee-clear-cell"
            }"
          >
            ₹${money(monthDue)}
          </td>


          <td class="fee-action-cell">

            <button
              class="fee-edit-btn"
              onclick="window.editFeePayment('${record.id}')"
            >
              Edit
            </button>


            <button
              class="fee-delete-btn"
              onclick="window.deleteFeePayment('${record.id}')"
            >
              Delete
            </button>

          </td>

        </tr>

      `;

    }
  );


  html += `

        </tbody>

      </table>

    </div>

  `;


  container.innerHTML =
    html;

}


// ==========================================
// PAYMENT PREVIEW
// ==========================================
window.calculateFeeBalance =
  function() {

    if (!currentStudent) return;


    const paid =
      Number(
        document.getElementById(
          "feePaidAmount"
        )?.value || 0
      );


    const monthlyFee =
      Number(
        currentStudent.monthlyFee || 0
      );


    const advance =
      Math.max(
        0,
        paid - monthlyFee
      );


    const pending =
      Math.max(
        0,
        monthlyFee - paid
      );


    const advanceInput =
      document.getElementById(
        "feeAdvanceAmount"
      );


    const pendingInput =
      document.getElementById(
        "feePendingAmount"
      );


    if (advanceInput) {

      advanceInput.value =
        advance;

    }


    if (pendingInput) {

      pendingInput.value =
        pending;

    }

  };


document.addEventListener(
  "input",
  function(event) {

    if (
      event.target &&
      event.target.id ===
        "feePaidAmount"
    ) {

      window.calculateFeeBalance();

    }

  }
);


// ==========================================
// SAVE & UPDATE PAYMENT
// ==========================================
window.saveFeePayment = async function() {
  if (!currentStudent) { showToast("Please select a student first.", "error"); return; }

  const paymentDate = document.getElementById("feePaymentDate")?.value;
  const feeMonth = document.getElementById("feeMonth")?.value;
  const paidAmount = Number(document.getElementById("feePaidAmount")?.value || 0);

  if (!paymentDate || !feeMonth) { showToast("Payment date and fee month are required.", "error"); return; }
  if (paidAmount < 0) { showToast("Invalid amount.", "error"); return; }

  const feeStartMonth = getFeeStartMonth(currentStudent);
  if (feeMonth < feeStartMonth) {
    showToast(`Payment month cannot be before Fee Start Month (${monthText(feeStartMonth)}).`, "error"); return;
  }

  const button = document.getElementById("saveFeeButton");
  if (button) { button.disabled = true; button.innerHTML = "⏳ Saving..."; }

  try {
    const monthlyFee =
      Number(
        currentStudent.monthlyFee || 0
      );

    const advance =
      Math.max(
        0,
        paidAmount - monthlyFee
      );

    const pending =
      Math.max(
        0,
        monthlyFee - paidAmount
      );


    if (editingFeeId) {
      // UPDATE EXISTING RECORD
      await updateDoc(doc(db, "fees", editingFeeId), {
        paymentDate, feeMonth, paidAmount,
        advanceAmount: advance, pendingAmount: pending,
        updatedAt: serverTimestamp()
      });
      editingFeeId = null;
      showToast("Fee payment updated successfully!");
    } else {
      // NEW RECORD
      const expireAt = new Date();
      expireAt.setFullYear(expireAt.getFullYear() + 2);

      await addDoc(collection(db, "fees"), {
        studentDbId: currentStudent.id,
        studentId: currentStudent.studentId || currentStudent.studentCode || currentStudent.id,
        studentName: currentStudent.name || "",
        paymentDate, feeMonth, paidAmount,
        advanceAmount: advance, pendingAmount: pending, monthlyFee,
        expireAt, createdAt: serverTimestamp(), timestamp: new Date().toISOString()
      });
      showToast("Fee payment saved successfully!");
    }

    // FORM RESET
    if (document.getElementById("feePaidAmount")) document.getElementById("feePaidAmount").value = "";
    if (document.getElementById("feeAdvanceAmount")) document.getElementById("feeAdvanceAmount").value = "0";
    if (document.getElementById("feePendingAmount")) document.getElementById("feePendingAmount").value = "0";
    
    await loadStudentFeeHistory();
  } catch (error) {
    console.error("Save fee error:", error);
    showToast("Error saving fee: " + error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.style.background = "var(--primary)";
      button.innerHTML = `<span class="material-symbols-rounded">save</span> Save Payment`;
    }
  }
};

// ==========================================
// EDIT PAYMENT (NO POPUPS)
// ==========================================
window.editFeePayment = function(id) {
  const record = feeRecords.find(item => item.id === id);
  if (!record) return;

  editingFeeId = id;

  document.getElementById("feePaymentDate").value = record.paymentDate || "";
  document.getElementById("feeMonth").value = record.feeMonth || record.month || "";
  document.getElementById("feePaidAmount").value = record.paidAmount ?? record.amount ?? 0;

  window.calculateFeeBalance();

  const button = document.getElementById("saveFeeButton");
  if (button) {
    button.innerHTML = `<span class="material-symbols-rounded">edit</span> Update Payment`;
    button.style.background = "#f59e0b"; // Orange color 
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};


// ==========================================
// DELETE PAYMENT
// ==========================================
window.deleteFeePayment =
  async function(id) {

    const record =
      feeRecords.find(
        item =>
          item.id === id
      );


    if (!record) return;


    const month =
      record.feeMonth ||
      record.month ||
      "-";


    const amount =
      Number(
        record.paidAmount ??
        record.amount ??
        0
      );


    if (
      !confirm(
        `Delete this fee payment?\n\n` +
        `Month: ${monthText(month)}\n` +
        `Paid: ₹${money(amount)}`
      )
    ) {

      return;

    }


    try {

      await deleteDoc(
        doc(
          db,
          "fees",
          id
        )
      );


      showToast(
        "Fee payment deleted."
      );


      await loadStudentFeeHistory();


    } catch (error) {

      console.error(
        "Delete fee error:",
        error
      );


      showToast(
        "Error deleting fee: " +
        error.message,
        "error"
      );

    }

  };

// ==========================================
// DUE STUDENTS MODAL
// ==========================================
window.openDueStudentsModal =
  async function() {

    const modal =
      document.getElementById(
        "dueStudentsModal"
      );

    const list =
      document.getElementById(
        "dueStudentsList"
      );

    if (!modal || !list) {
      console.error(
        "Due students modal elements missing."
      );
      return;
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";

    list.innerHTML = `
      <div
        style="
          padding:30px;
          text-align:center;
          color:#64748b;
        "
      >

        <span
          class="material-symbols-rounded"
          style="
            font-size:36px;
            display:block;
            margin-bottom:10px;
          "
        >
          sync
        </span>

        Calculating Dues...

      </div>
    `;

    try {

      const now = new Date();

      const currentMonth =
        todayMonth();

      const currentDay =
        now.getDate();


      // ======================================
      // DATE LABEL
      // ======================================
      const monthLabel =
        document.getElementById(
          "dueMonthLabel"
        );

      if (monthLabel) {

        monthLabel.textContent =
          `As of Today (${now.toLocaleDateString(
            "en-IN",
            {
              day: "numeric",
              month: "long",
              year: "numeric"
            }
          )})`;

      }


      // ======================================
      // LOAD ALL FEES
      // ======================================
      const snapshot =
        await getDocs(
          collection(
            db,
            "fees"
          )
        );

      const allFees = [];

      snapshot.forEach(
        feeDoc => {

          allFees.push({
            id: feeDoc.id,
            ...feeDoc.data()
          });

        }
      );


      // ======================================
      // CALCULATE DUE STUDENTS
      // ======================================
      const dues = [];


      allActiveStudents.forEach(
        student => {

          const studentFees =
            allFees.filter(
              fee => {

                const feeStudentId =
                  fee.studentDbId ||
                  fee.studentId;

                return (
                  feeStudentId ===
                  student.id
                );

              }
            );


          const ledger =
            calculateLedger(
              student,
              studentFees,
              currentMonth
            );


          // ======================================
// ACTUAL DUE MONTHS
// ======================================


const dueMonths =
  ledger.months.filter(
    item =>
      item.due > 0 &&
      item.isDue === true
  );


if (!dueMonths.length) {
  return;
}


dues.push({

  ...student,

  totalDue:
    ledger.due,

  currentMonthDue:
    dueMonths.reduce(
      (sum, item) =>
        sum + Number(item.due || 0),
      0
    ),

  dueMonths

});


          // ==================================
          // DUE DAY CHECK
          // ==================================
          const dueDay =
            Number(
              student.feeDueDay || 0
            );


          const dueDatePassed =
            dueDay === 0 ||
            currentDay >= dueDay;


          /*
            IMPORTANT:

            Student ka Fee Start Month
            agar August hai to March-July
            kabhi calculate nahi honge.

            Ledger already Fee Start Month
            se start ho raha hai.
          */


          if (
            currentMonthData.due > 0 &&
            dueDatePassed
          ) {

            dues.push({

              ...student,

              totalDue:
                ledger.due,

              currentMonthDue:
                currentMonthData.due,

              dueMonths:
                ledger.months.filter(
                  item =>
                    item.due > 0
                )

            });

          }

        }
      );


      // ======================================
      // SORT - HIGHEST DUE FIRST
      // ======================================
      dues.sort(
        (a, b) =>
          Number(b.totalDue || 0) -
          Number(a.totalDue || 0)
      );


      // ======================================
      // NO DUES
      // ======================================
      if (!dues.length) {

        list.innerHTML = `
          <div
            style="
              padding:35px 20px;
              text-align:center;
              color:#047857;
            "
          >

            <span
              class="material-symbols-rounded"
              style="
                font-size:48px;
                display:block;
                margin-bottom:10px;
              "
            >
              task_alt
            </span>

            <strong
              style="
                font-size:20px;
              "
            >
              All Clear!
            </strong>

            <div
              style="
                margin-top:7px;
                font-size:13px;
                color:#64748b;
              "
            >
              No students have pending dues.
            </div>

          </div>
        `;

        return;
      }


      // ======================================
      // DUE STUDENT LIST
      // ======================================
      list.innerHTML =
        dues
          .map(
            student => `

              <div
                style="
                  padding:15px;
                  border:1px solid #fecaca;
                  border-radius:12px;
                  background:#fffafa;
                  margin-bottom:10px;
                "
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:12px;
                  "
                >

                  <!-- STUDENT INFO -->
                  <div
                    style="
                      min-width:0;
                      flex:1;
                    "
                  >

                    <strong
                      style="
                        display:block;
                        color:#172554;
                        font-size:16px;
                        margin-bottom:4px;
                      "
                    >
                      ${esc(
                        student.name ||
                        "Unnamed Student"
                      )}
                    </strong>


                    <div
                      style="
                        font-size:12px;
                        color:#64748b;
                        line-height:1.6;
                      "
                    >

                      ID:
                      ${esc(
                        student.studentCode ||
                        "-"
                      )}

                      <br>

                      Class:
                      ${esc(
                        student.className ||
                        "-"
                      )}

                      <br>

                      Fee Start:
                      <b>
                        ${esc(
                          monthText(
                            getFeeStartMonth(
                              student
                            )
                          )
                        )}
                      </b>

                    </div>

                  </div>


                  <!-- TOTAL DUE -->
                  <div
                    style="
                      text-align:right;
                      flex-shrink:0;
                    "
                  >

                    <div
                      style="
                        font-size:11px;
                        color:#64748b;
                        margin-bottom:2px;
                      "
                    >
                      Total Due
                    </div>

                    <strong
                      style="
                        color:#dc2626;
                        font-size:18px;
                      "
                    >
                      ₹${money(
                        student.totalDue
                      )}
                    </strong>

                  </div>

                </div>


                <!-- DUE MONTHS -->
                <div
                  style="
                    margin-top:12px;
                    padding-top:10px;
                    border-top:1px solid #fee2e2;
                  "
                >

                  <div
                    style="
                      font-size:11px;
                      font-weight:700;
                      color:#991b1b;
                      margin-bottom:7px;
                      text-transform:uppercase;
                    "
                  >
                    Pending Fee Months
                  </div>


                  <div
                    style="
                      display:flex;
                      flex-wrap:wrap;
                      gap:6px;
                    "
                  >

                    ${
                      student.dueMonths
                        .map(
                          item => `

                            <span
                              style="
                                display:inline-flex;
                                align-items:center;
                                gap:5px;
                                padding:6px 9px;
                                border-radius:20px;
                                background:#fef2f2;
                                border:1px solid #fecaca;
                                color:#991b1b;
                                font-size:11px;
                                font-weight:600;
                              "
                            >

                              ${esc(
                                item.label
                              )}

                              <b>
                                ₹${money(
                                  item.due
                                )}
                              </b>

                            </span>

                          `
                        )
                        .join("")
                    }

                  </div>

                </div>


                <!-- COLLECT BUTTON -->
                <button
                  type="button"
                  onclick="
                    window.location.href =
                    'fees.html?studentId=${student.id}'
                  "
                  style="
                    width:100%;
                    margin-top:12px;
                    padding:10px;
                    border:1px solid #fecaca;
                    border-radius:9px;
                    background:#ffffff;
                    color:#dc2626;
                    font-weight:700;
                    cursor:pointer;
                  "
                >

                  <span
                    class="material-symbols-rounded"
                    style="
                      font-size:17px;
                      vertical-align:middle;
                      margin-right:4px;
                    "
                  >
                    payments
                  </span>

                  Collect Fee

                </button>

              </div>

            `
          )
          .join("");


    } catch (error) {

      console.error(
        "Due Students Error:",
        error
      );


      // ======================================
      // ERROR - NO STUCK CALCULATING
      // ======================================
      list.innerHTML = `
        <div
          style="
            padding:30px 20px;
            text-align:center;
            background:#fef2f2;
            border:1px solid #fecaca;
            border-radius:12px;
            color:#b91c1c;
          "
        >

          <span
            class="material-symbols-rounded"
            style="
              font-size:42px;
              display:block;
              margin-bottom:8px;
            "
          >
            error
          </span>

          <strong>
            Unable to Calculate Dues
          </strong>

          <div
            style="
              margin-top:7px;
              font-size:12px;
              color:#7f1d1d;
              word-break:break-word;
            "
          >
            ${esc(
              error.message ||
              "Unknown error"
            )}
          </div>

        </div>
      `;

    }

  };


// ==========================================
// CLOSE DUE STUDENTS MODAL
// ==========================================
window.closeDueStudentsModal =
  function() {

    const modal =
      document.getElementById(
        "dueStudentsModal"
      );

    if (modal) {

      modal.style.display =
        "none";

    }

    document.body.style.overflow =
      "auto";

  };


// ==========================================
// INIT
// ==========================================
document.addEventListener(
  "DOMContentLoaded",
  async function() {

    setDefaults();

    await loadFeeStudent();

  }
);
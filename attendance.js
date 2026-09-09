// ==========================================
// ATTENDANCE.JS
// Shiv Shakti Tuition
// ==========================================

import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";


// ==========================================
// GLOBAL
// ==========================================

let attendanceStudents = [];

let currentAttendanceShift = "Morning";


// ==========================================
// TOAST
// ==========================================

window.showToast = function (
  message,
  type = "success"
) {

  const toast =
    document.getElementById("customToast");

  const toastMsg =
    document.getElementById("toastMessage");

  const toastIcon =
    document.getElementById("toastIcon");

  if (!toast) return;

  if (toastMsg) {
    toastMsg.innerText = message;
  }

  if (type === "error") {

    toast.style.background = "#ef4444";

    if (toastIcon) {
      toastIcon.innerText = "error";
    }

  } else {

    toast.style.background = "#10b981";

    if (toastIcon) {
      toastIcon.innerText = "check_circle";
    }

  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
};


// ==========================================
// DATE
// ==========================================

function getToday() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(now.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDDMMYYYY(dateString) {

  if (!dateString) return "";

  const parts =
    dateString.split("-");

  if (parts.length === 3) {

    return (
      `${parts[2]}/${parts[1]}/${parts[0]}`
    );

  }

  return dateString;
}


// ==========================================
// INITIALIZE
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    const dateInput =
      document.getElementById(
        "attendanceDate"
      );

    const hubDate =
      document.getElementById(
        "hubDateInput"
      );

    const editDate =
      document.getElementById(
        "editAttendanceDate"
      );

    const monthInput =
      document.getElementById(
        "hubMonthInput"
      );

    const today =
      getToday();


    if (dateInput) {

      dateInput.value = today;

      dateInput.addEventListener(
        "change",
        function () {

          loadAttendanceStudents();

        }
      );

    }


    if (hubDate) {
      hubDate.value = today;
    }


    if (editDate) {
      editDate.value = today;
    }


    if (monthInput) {

      const now = new Date();

      monthInput.value =
        `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;

    }


    await loadAttendanceStudents();

  }
);


// ==========================================
// LOAD STUDENTS
// ==========================================

// ==========================================
// LOAD STUDENTS
// ==========================================

async function loadAttendanceStudents() {

  const container =
    document.getElementById(
      "attendanceStudents"
    );

  if (!container) return;


  container.innerHTML = `
    <div
      style="
        padding:30px;
        text-align:center;
        color:var(--text-muted);
      ">

      <span
        class="material-symbols-rounded spin-icon"
        style="
          font-size:30px;
          color:var(--primary);
        ">
        autorenew
      </span>

      Loading students...

    </div>
  `;


  try {

    if (!db) {
      throw new Error(
        "Firebase database connect nahi hua."
      );
    }


    const snapshot =
      await getDocs(
        collection(db, "students")
      );


    attendanceStudents = [];


    snapshot.forEach(
      studentDoc => {

        const student =
          studentDoc.data();


        const inactive =
          student.status === "INACTIVE" ||
          student.status === "Inactive";


        if (!inactive) {

          attendanceStudents.push({

            id:
              studentDoc.id,

            studentId:
  student.studentCode ||
  student.studentId ||
  studentDoc.id ||
  "",

            name:
              student.name || "",

            fatherName:
              student.fatherName || "",

            shift:
              student.batchTime || student.shift || "Morning",

            status:
              student.status || "ACTIVE"

          });

        }

      }
    );


    attendanceStudents.sort(
      (a, b) =>
        a.name.localeCompare(b.name)
    );


    await renderAttendanceStudents();


  } catch (error) {

    console.error(
      "Attendance student loading error:",
      error
    );


    container.innerHTML = `
      <div
        style="
          padding:20px;
          color:var(--danger);
          text-align:center;
          border:1px dashed var(--danger);
          border-radius:8px;
        ">

        <span class="material-symbols-rounded">
          error
        </span>

        Students load nahi hue.

        <br><br>

        ${escapeHtml(error.message)}

      </div>
    `;

  }
}



// ==========================================
// SHIFT FILTER
// ==========================================

window.selectAttendanceShift =
  async function (shift) {

    currentAttendanceShift =
      shift;


    const morningBtn =
      document.getElementById(
        "morningBtn"
      );

    const eveningBtn =
      document.getElementById(
        "eveningBtn"
      );

    const allBtn =
      document.getElementById(
        "allStudentsBtn"
      );


    if (morningBtn) {

      morningBtn.classList.toggle(
        "active",
        shift === "Morning"
      );

    }


    if (eveningBtn) {

      eveningBtn.classList.toggle(
        "active",
        shift === "Evening"
      );

    }


    if (allBtn) {

      allBtn.classList.toggle(
        "active",
        shift === "All"
      );

    }


    await renderAttendanceStudents();

  };


// ==========================================
// FIRESTORE ATTENDANCE DOC
// ==========================================

async function getAttendanceDocument(
  date,
  shift
) {

  const attendanceRef =
    doc(
      db,
      "attendance",
      `${date}_${shift}`
    );


  return await getDoc(
    attendanceRef
  );
}


// ==========================================
// GET EXISTING RECORDS
//
// IMPORTANT:
// Morning -> Morning record only
// Evening -> Evening record only
// All -> Both
// ==========================================

async function getExistingAttendanceRecords(
  date
) {

  const existingRecords = {};

  let shifts = [];


  if (
    currentAttendanceShift === "All"
  ) {

    shifts = [
      "Morning",
      "Evening"
    ];

  } else {

    shifts = [
      currentAttendanceShift
    ];

  }


  for (const shift of shifts) {

    try {

      const snap =
        await getAttendanceDocument(
          date,
          shift
        );


      if (!snap.exists()) {
        continue;
      }


      const data =
        snap.data();


      (
        data.records || []
      ).forEach(
        record => {

          existingRecords[
            record.studentId
          ] = {

            ...record,

            sourceShift:
              shift

          };

        }
      );


    } catch (error) {

      console.error(
        `Attendance load error (${shift}):`,
        error
      );

    }

  }


  return existingRecords;
}


// ==========================================
// RENDER STUDENTS
// ==========================================

async function renderAttendanceStudents() {

  const container =
    document.getElementById(
      "attendanceStudents"
    );


  if (!container) return;


  if (
    !attendanceStudents ||
    attendanceStudents.length === 0
  ) {

    container.innerHTML = `
      <div
        style="
          padding:30px;
          text-align:center;
          color:var(--text-muted);
          border:1px dashed #cbd5e1;
          border-radius:10px;
        ">

        <span
          class="material-symbols-rounded"
          style="font-size:40px;">
          group_off
        </span>

        <br>

        No active students found.

      </div>
    `;

    return;
  }


  const date =
    document.getElementById(
      "attendanceDate"
    )?.value ||
    getToday();


  const existingRecords =
    await getExistingAttendanceRecords(
      date
    );


  // ========================================
  // FILTER MORNING / EVENING / ALL
  // ========================================

  let visibleStudents =
    attendanceStudents.filter(
      student => {

        if (
          currentAttendanceShift ===
          "All"
        ) {

          return true;

        }


        const studentShift =
          String(
            student.shift ||
            "Morning"
          )
          .trim()
          .toLowerCase();


        return (
          studentShift ===
          currentAttendanceShift
            .toLowerCase()
        );

      }
    );


  // ========================================
  // SAVED ATTENDANCE HIDE
  //
  // P/A/L/H/S = hide
  // Pending/no record = show
  // ========================================

  visibleStudents =
    visibleStudents.filter(
      student => {

        const existing =
          existingRecords[
            student.id
          ];


        if (!existing) {
          return true;
        }


        return (
          !existing.status ||
          existing.status === "Pending"
        );

      }
    );


  // ========================================
  // NO PENDING STUDENTS
  // ========================================

  if (
    visibleStudents.length === 0
  ) {

    const label =
      currentAttendanceShift ===
      "All"
        ? "Students"
        : currentAttendanceShift +
          " Students";


    container.innerHTML = `
      <div
        style="
          padding:35px 20px;
          text-align:center;
          color:var(--text-muted);
          border:1px dashed #cbd5e1;
          border-radius:10px;
        ">

        <span
          class="material-symbols-rounded"
          style="
            font-size:42px;
            margin-bottom:8px;
            color:#10b981;
          ">
          task_alt
        </span>

        <div
          style="
            font-weight:700;
            color:var(--text-main);
            margin-bottom:5px;
          ">

          All ${escapeHtml(label)}
          attendance is completed.

        </div>

        <div style="font-size:13px;">
          No pending students remaining.
        </div>

      </div>
    `;

    return;
  }


  visibleStudents.sort(
    (a, b) =>
      a.name.localeCompare(b.name)
  );


  let html = "";


  visibleStudents.forEach(
    student => {

      const existing =
        existingRecords[
          student.id
        ];


      const status =
        existing?.status ||
        "Pending";


      const actualShift =
        existing?.actualShift ||
        student.shift ||
        (
          currentAttendanceShift ===
          "Evening"
            ? "Evening"
            : "Morning"
        );


      const isMorning =
        actualShift ===
        "Morning";


      const isEvening =
        actualShift ===
        "Evening";


      html += `

        <div
          class="student-attendance-row"
          data-student-id="${escapeHtml(student.id)}"
          style="
            display:flex;
            flex-direction:column;
            gap:14px;
            padding:20px 0;
            border-bottom:1px solid var(--border);
          ">


          <!-- STUDENT HEADER -->

          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              flex-wrap:wrap;
              gap:10px;
            ">


            <div>

              <div
                style="
                  font-weight:700;
                  font-size:17px;
                  color:var(--primary);
                ">

                ${escapeHtml(
                  student.name
                )}

              </div>


              <div
                style="
                  font-size:13px;
                  color:var(--text-muted);
                  margin-top:3px;
                ">

                ID:
${escapeHtml(
  student.studentCode ||
  student.studentId ||
  student.id ||
  ""
)}

              </div>

            </div>


            <!-- ACTUAL SHIFT -->

            <div
              class="actual-shift-group"
              data-value="${escapeHtml(actualShift)}"
              style="
                display:flex;
                background:#f1f5f9;
                border-radius:8px;
                padding:4px;
                border:1px solid var(--border);
              ">


              <button
                type="button"
                class="shift-tog-btn"
                data-val="Morning"
                style="
                  padding:6px 14px;
                  border:none;
                  background:${
                    isMorning
                      ? "#ffffff"
                      : "transparent"
                  };
                  box-shadow:${
                    isMorning
                      ? "0 1px 3px rgba(0,0,0,.1)"
                      : "none"
                  };
                  color:${
                    isMorning
                      ? "var(--primary)"
                      : "var(--text-muted)"
                  };
                  border-radius:6px;
                  cursor:pointer;
                  font-size:13px;
                  font-weight:600;
                ">

                Morning

              </button>


              <button
                type="button"
                class="shift-tog-btn"
                data-val="Evening"
                style="
                  padding:6px 14px;
                  border:none;
                  background:${
                    isEvening
                      ? "#ffffff"
                      : "transparent"
                  };
                  box-shadow:${
                    isEvening
                      ? "0 1px 3px rgba(0,0,0,.1)"
                      : "none"
                  };
                  color:${
                    isEvening
                      ? "var(--primary)"
                      : "var(--text-muted)"
                  };
                  border-radius:6px;
                  cursor:pointer;
                  font-size:13px;
                  font-weight:600;
                ">

                Evening

              </button>

            </div>

          </div>


          <!-- STATUS -->

          <div
            class="attendance-status-buttons"
            style="
              display:flex;
              gap:8px;
              align-items:center;
              flex-wrap:wrap;
            ">

            ${createStatusButton(
              student.id,
              "P",
              status
            )}

            ${createStatusButton(
              student.id,
              "A",
              status
            )}

            ${createStatusButton(
              student.id,
              "L",
              status
            )}

            ${createStatusButton(
              student.id,
              "H",
              status
            )}

            ${createStatusButton(
              student.id,
              "S",
              status
            )}


            <!-- EDIT -->

            <button
              type="button"
              class="edit-row-btn"
              title="Unlock Edit"
              style="
                margin-left:auto;
                cursor:pointer;
                border:1px solid var(--border);
                background:#f8fafc;
                padding:8px 12px;
                border-radius:8px;
                color:var(--text-muted);
                display:flex;
                align-items:center;
                justify-content:center;
              ">

              <span
                class="material-symbols-rounded"
                style="font-size:18px;">
                edit
              </span>

            </button>

          </div>

        </div>

      `;

    }
  );


  container.innerHTML =
    html;


  attachStatusEvents();

}


// ==========================================
// STATUS BUTTON
// ==========================================

function createStatusButton(
  studentId,
  value,
  currentStatus
) {

  const isSelected =
    currentStatus === value;


  const isPending =
    currentStatus ===
      "Pending" ||
    currentStatus === "";


  const disabledAttr =
    isPending
      ? ""
      : "disabled";


  let bgColor =
    "#ffffff";

  let color =
    "#64748b";

  let borderColor =
    "#cbd5e1";

  let checkDisplay =
    "none";


  if (isSelected) {

    if (
      value === "P" ||
      value === "S"
    ) {

      bgColor =
        "#10b981";

      borderColor =
        "#10b981";

    } else if (
      value === "A"
    ) {

      bgColor =
        "#ef4444";

      borderColor =
        "#ef4444";

    } else {

      bgColor =
        "#ff6b00";

      borderColor =
        "#ff6b00";

    }


    color =
      "#ffffff";

    checkDisplay =
      "inline-block";

  }


  return `

    <button
      type="button"
      class="attendance-status-btn ${
        isSelected
          ? "selected"
          : ""
      }"
      data-student="${escapeHtml(studentId)}"
      data-status="${value}"
      ${disabledAttr}
      style="
        padding:10px 18px;
        border-radius:8px;
        border:1px solid ${borderColor};
        background:${bgColor};
        color:${color};
        cursor:pointer;
        font-weight:700;
        font-size:14px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:4px;
      ">

      <span>
        ${value}
      </span>

      <span
        class="material-symbols-rounded check-icon"
        style="
          font-size:18px;
          display:${checkDisplay};
        ">

        check_circle

      </span>

    </button>

  `;
}


// ==========================================
// EVENTS & LOGIC
// ==========================================

function attachStatusEvents() {

  const buttons =
    document.querySelectorAll(
      ".attendance-status-btn"
    );

  const editButtons =
    document.querySelectorAll(
      ".edit-row-btn"
    );

  const shiftToggles =
    document.querySelectorAll(
      ".shift-tog-btn"
    );


  // ========================================
  // ATTENDANCE STATUS BUTTONS
  // ========================================

  buttons.forEach(button => {

    button.onclick = function () {

      if (this.disabled) return;

      const row =
        this.closest(
          ".student-attendance-row"
        );

      if (!row) return;

      const allBtns =
        row.querySelectorAll(
          ".attendance-status-btn"
        );


      allBtns.forEach(btn => {

        btn.classList.remove(
          "selected"
        );

        btn.disabled = true;

        btn.style.background =
          "#ffffff";

        btn.style.color =
          "#64748b";

        btn.style.borderColor =
          "#cbd5e1";

        const icon =
          btn.querySelector(
            ".check-icon"
          );

        if (icon) {
          icon.style.display =
            "none";
        }

      });


      // Selected button
      this.classList.add(
        "selected"
      );

      this.disabled = true;


      const icon =
        this.querySelector(
          ".check-icon"
        );

      if (icon) {
        icon.style.display =
          "inline-block";
      }


      const value =
        this.dataset.status;


      let bgColor =
        "var(--primary)";


      if (
        value === "P" ||
        value === "S"
      ) {

        bgColor =
          "#10b981";

      } else if (
        value === "A"
      ) {

        bgColor =
          "#ef4444";

      } else if (
        value === "L" ||
        value === "H"
      ) {

        bgColor =
          "#ff6b00";

      }


      this.style.background =
        bgColor;

      this.style.color =
        "#ffffff";

      this.style.borderColor =
        bgColor;


      // Holiday / Sunday note
      if (
        value === "H" ||
        value === "S"
      ) {

        document
          .getElementById(
            "holidayReason"
          )
          ?.focus();

      }

    };

  });


  // ========================================
  // EDIT ROW BUTTON
  // ========================================

  editButtons.forEach(editBtn => {

    editBtn.onclick = function () {

      const row =
        this.closest(
          ".student-attendance-row"
        );

      if (!row) return;


      const allBtns =
        row.querySelectorAll(
          ".attendance-status-btn"
        );


      // Edit dabane ke baad status change kar sakte hain
      allBtns.forEach(btn => {

        btn.disabled = false;

      });

    };

  });


  // ========================================
  // ACTUAL SHIFT TOGGLE
  // ========================================

  shiftToggles.forEach(btn => {

    btn.onclick = function () {

      const group =
        this.closest(
          ".actual-shift-group"
        );

      if (!group) return;


      group.dataset.value =
        this.dataset.val;


      const allToggles =
        group.querySelectorAll(
          ".shift-tog-btn"
        );


      allToggles.forEach(toggle => {

        toggle.style.background =
          "transparent";

        toggle.style.boxShadow =
          "none";

        toggle.style.color =
          "var(--text-muted)";

      });


      this.style.background =
        "#ffffff";

      this.style.boxShadow =
        "0 1px 3px rgba(0,0,0,0.1)";

      this.style.color =
        "var(--primary)";

    };

  });

}


// ==========================================
// MARK ALL
// ==========================================

window.markAllAttendance =
  function (status) {

    const rows =
      document.querySelectorAll(
        ".student-attendance-row"
      );


    rows.forEach(row => {

      const allBtns =
        row.querySelectorAll(
          ".attendance-status-btn"
        );


      // Pehle unlock
      allBtns.forEach(btn => {
        btn.disabled = false;
      });


      const targetBtn =
        row.querySelector(
          `.attendance-status-btn[data-status="${status}"]`
        );


      if (targetBtn) {
        targetBtn.click();
      }

    });

  };


window.markAllH =
  function () {

    markAllAttendance("H");

  };


window.markAllS =
  function () {

    markAllAttendance("S");

  };


// ==========================================
// SAVE ATTENDANCE
// ==========================================

window.saveAttendance =
  async function () {

    try {

      const date =
        document.getElementById(
          "attendanceDate"
        )?.value;


      if (!date) {

        showToast(
          "Please select a date.",
          "error"
        );

        return;

      }


      if (!currentAttendanceShift) {

        showToast(
          "Select Morning, Evening or All Students.",
          "error"
        );

        return;

      }


      if (
        attendanceStudents.length === 0
      ) {

        showToast(
          "No students found.",
          "error"
        );

        return;

      }


      const recordsByShift = {

        Morning: [],

        Evening: []

      };


      let hasMarked =
        false;

      let hasPending =
        false;


      // ====================================
      // CURRENT VISIBLE STUDENTS
      // ====================================

      attendanceStudents.forEach(student => {

        const row =
          document.querySelector(
            `[data-student-id="${CSS.escape(student.id)}"]`
          );


        // Filter ki wajah se jo student visible nahi hai
        // usko yahan ignore karenge
        if (!row) return;


        const selected =
          row.querySelector(
            ".attendance-status-btn.selected"
          );


        const status =
          selected?.dataset.status ||
          "Pending";


        if (
          status === "Pending"
        ) {

          hasPending = true;

        } else {

          hasMarked = true;

        }


        const actualShift =
          row.querySelector(
            ".actual-shift-group"
          )?.dataset.value ||
          student.shift ||
          "Morning";


        const safeShift =
          actualShift === "Evening"
            ? "Evening"
            : "Morning";


        recordsByShift[
          safeShift
        ].push({

          studentId:
  student.id,
  
  customId:
  student.studentCode ||
  student.studentId ||
  student.id ||
  "",

          name:
            student.name,

          status:
            status,

          regularShift:
            student.shift || "",

          actualShift:
            safeShift

        });

      });


      // ====================================
      // NOTHING MARKED
      // ====================================

      if (!hasMarked) {

        showToast(
          "Please mark at least one student's attendance.",
          "error"
        );

        return;

      }


      // ====================================
      // PENDING CONFIRMATION
      // ====================================

      if (hasPending) {

        const confirmSave =
          confirm(
            "Some students are still pending. Do you still want to save?"
          );


        if (!confirmSave) {
          return;
        }

      }


      const holidayReason =
        document
          .getElementById(
            "holidayReason"
          )
          ?.value
          .trim() ||
        "";


      const staffName =
        window.currentUserEmail ||
        window.currentUserName ||
        "Admin";


      const expireDate =
        new Date();


      expireDate.setFullYear(
        expireDate.getFullYear() + 2
      );


      // ====================================
      // SAVE MORNING / EVENING SEPARATELY
      // ====================================

      for (
        const shift of [
          "Morning",
          "Evening"
        ]
      ) {

        const newRecords =
          recordsByShift[
            shift
          ];


        if (
          newRecords.length === 0
        ) {

          continue;

        }


        const oldSnap =
          await getAttendanceDocument(
            date,
            shift
          );


        const oldRecords =
          oldSnap.exists()
            ? (
                oldSnap.data()
                  .records || []
              )
            : [];


        /*
          Jo students abhi save ho rahe hain
          unke purane records replace honge.

          Baaki records safe rahenge.
        */

        const changedIds =
          new Set(
            newRecords.map(
              record =>
                record.studentId
            )
          );


        const untouchedRecords =
          oldRecords.filter(
            record =>
              !changedIds.has(
                record.studentId
              )
          );


        const finalRecords = [
          ...untouchedRecords,
          ...newRecords
        ];


        await setDoc(

          doc(
            db,
            "attendance",
            `${date}_${shift}`
          ),

          {

            date:
              date,

            shift:
              shift,

            records:
              finalRecords,

            holidayReason:
              holidayReason,

            markedBy:
              staffName,

            expireAt:
              expireDate,

            updatedAt:
              serverTimestamp()

          },

          {
            merge: true
          }

        );

      }


      // ====================================
      // SUCCESS
      // ====================================

      showToast(
        "Attendance Saved Successfully!",
        "success"
      );


      /*
        IMPORTANT:

        Save ke baad list dobara render hogi.

        Jiski attendance P/A/L/H/S save ho gayi
        woh list me nahi dikhega.

        Sirf pending students rahenge.
      */

      await renderAttendanceStudents();


    } catch (error) {

      console.error(
        "Save error:",
        error
      );


      showToast(
        "Error saving attendance: " +
        error.message,
        "error"
      );

    }

  };


// ==========================================
// HISTORY VIEW MODE
// ==========================================

window.toggleAttendanceViewMode =
  function () {

    const historyView =
      document.getElementById(
        "historyViewMode"
      );


    const value =
      historyView?.value ||
      "day";


    const dayBox =
      document.getElementById(
        "dayByDayBox"
      );


    const monthBox =
      document.getElementById(
        "fullMonthBox"
      );


    if (
      !dayBox ||
      !monthBox
    ) {

      return;

    }


    if (
      value === "month"
    ) {

      dayBox.style.display =
        "none";

      monthBox.style.display =
        "block";

    } else {

      dayBox.style.display =
        "block";

      monthBox.style.display =
        "none";

    }

  };


// ==========================================
// DAY-BY-DAY HISTORY
// ==========================================

window.loadHubDayAttendance =
  async function () {

    const date =
      document.getElementById(
        "hubDateInput"
      )?.value;

    const shift =
      document.getElementById(
        "hubShiftSelect"
      )?.value;

    const container =
      document.getElementById(
        "hubDayContainer"
      );

    if (!container) return;

    if (!date || !shift) {

      showToast(
        "Please select date and shift.",
        "error"
      );

      return;
    }

    container.innerHTML = `
      <div
        style="
          padding:20px;
          text-align:center;
          color:var(--text-muted);
        ">

        <span
          class="material-symbols-rounded spin-icon">
          autorenew
        </span>

        Loading...

      </div>
    `;

    try {

      const snap =
        await getAttendanceDocument(
          date,
          shift
        );

      if (!snap.exists()) {

        container.innerHTML = `
          <div
            style="
              padding:20px;
              text-align:center;
              color:var(--danger);
              border:1px dashed #cbd5e1;
              border-radius:8px;
            ">

            No records found for this date.

          </div>
        `;

        return;
      }

      const data =
        snap.data();

      let html = `

        <div
          style="
            background:#f8fafc;
            padding:16px;
            border-radius:8px;
            margin-bottom:20px;
            border:1px solid var(--border);
          ">

          <strong
            style="
              display:flex;
              align-items:center;
              gap:6px;
            ">

            <span
              class="material-symbols-rounded"
              style="font-size:18px;">
              calendar_today
            </span>

            ${formatDDMMYYYY(date)}
            •
            ${escapeHtml(shift)}

          </strong>

          <div
            style="
              margin-top:8px;
              font-size:14px;
              color:var(--text-muted);
              display:flex;
              align-items:center;
              gap:6px;
            ">

            <span
              class="material-symbols-rounded"
              style="font-size:16px;">
              person
            </span>

            Taken By:
            ${escapeHtml(
              data.markedBy ||
              "Admin"
            )}

          </div>

          ${
            data.holidayReason
              ? `
                <div
                  style="
                    margin-top:8px;
                    font-size:14px;
                    color:var(--accent);
                    display:flex;
                    align-items:center;
                    gap:6px;
                  ">

                  <span
                    class="material-symbols-rounded"
                    style="font-size:16px;">
                    note
                  </span>

                  Note:
                  ${escapeHtml(
                    data.holidayReason
                  )}

                </div>
              `
              : ""
          }

        </div>

      `;

      html +=
        buildHistoryTable(
          data.records || []
        );

      container.innerHTML =
        html;

    } catch (error) {

      console.error(
        "Day history error:",
        error
      );

      container.innerHTML = `
        <div
          style="
            color:red;
            text-align:center;
          ">

          Error:
          ${escapeHtml(
            error.message
          )}

        </div>
      `;
    }
  };


// ==========================================
// FULL MONTH HISTORY
// ==========================================

window.loadHubMonthAttendance =
  async function () {

    const month =
      document.getElementById(
        "hubMonthInput"
      )?.value;

    const shiftFilter =
      document.getElementById(
        "hubMonthShiftSelect"
      )?.value ||
      "All";

    const container =
      document.getElementById(
        "hubMonthContainer"
      );

    if (!container) return;

    if (!month) {

      showToast(
        "Please select a month.",
        "error"
      );

      return;
    }

    container.innerHTML = `
      <div
        style="
          padding:20px;
          text-align:center;
          color:var(--text-muted);
        ">

        <span
          class="material-symbols-rounded spin-icon">
          autorenew
        </span>

        Loading...

      </div>
    `;

    try {

      const snapshot =
        await getDocs(
          collection(
            db,
            "attendance"
          )
        );

      const monthRecords = [];

      snapshot.forEach(
        attendanceDoc => {

          const data =
            attendanceDoc.data();

          if (
            !data.date ||
            !data.date.startsWith(
              month
            )
          ) {

            return;
          }

          if (
            shiftFilter !== "All" &&
            data.shift !== shiftFilter
          ) {

            return;
          }

          monthRecords.push(
            data
          );
        }
      );

      monthRecords.sort(
        (a, b) =>
          a.date.localeCompare(
            b.date
          )
      );

      renderMonthHistory(
        monthRecords,
        container
      );

    } catch (error) {

      console.error(
        "Month history error:",
        error
      );

      container.innerHTML = `
        <div
          style="
            color:red;
            text-align:center;
          ">

          Error:
          ${escapeHtml(
            error.message
          )}

        </div>
      `;
    }
  };


// ==========================================
// MONTH HISTORY RENDER
// ==========================================

function renderMonthHistory(
  records,
  container
) {

  if (!records.length) {

    container.innerHTML = `
      <div
        style="
          padding:20px;
          text-align:center;
          color:var(--text-muted);
          border:1px dashed #cbd5e1;
          border-radius:8px;
        ">

        No records found for this month.

      </div>
    `;

    return;
  }

  const studentMap = {};


  records.forEach(
    day => {

      (
        day.records || []
      ).forEach(
        record => {

          if (
            !studentMap[
              record.studentId
            ]
          ) {

            studentMap[
              record.studentId
            ] = {

              name:
                record.name || "",

              customId:
                record.customId || "",

              days: {},

              P: 0,
              A: 0,
              L: 0,
              H: 0,
              S: 0
            };
          }

          const student =
            studentMap[
              record.studentId
            ];

          student.days[
            day.date
          ] =
            record.status;

          if (
            student[
              record.status
            ] !== undefined
          ) {

            student[
              record.status
            ]++;
          }
        }
      );
    }
  );


  const dates =
    [
      ...new Set(
        records.map(
          record =>
            record.date
        )
      )
    ].sort();


  const parts =
    dates[0]
      ?.slice(0, 7)
      .split("-");


  const niceMonth =
    parts
      ? `${parts[1]}/${parts[0]}`
      : "";


  let html = `

    <div
      style="
        margin-bottom:20px;
        font-weight:600;
        color:var(--primary);
      ">

      Month:
      ${escapeHtml(
        niceMonth
      )}

      <span
        style="
          margin-left:10px;
          font-weight:400;
          color:var(--text-muted);
        ">

        (${dates.length} Days)

      </span>

    </div>


    <div style="overflow-x:auto;">

      <table
        style="
          width:100%;
          border-collapse:collapse;
          text-align:left;
        ">

        <thead>

          <tr
            style="
              background:#f1f5f9;
              border-bottom:2px solid #cbd5e1;
            ">

            <th
              style="
                padding:12px;
                font-weight:600;
              ">

              Student

            </th>

  `;


  dates.forEach(
    date => {

      html += `

        <th
          style="
            padding:12px;
            font-weight:600;
          ">

          ${escapeHtml(
            date.slice(8)
          )}

        </th>

      `;

    }
  );


  html += `

            <th style="padding:12px;">
              P
            </th>

            <th style="padding:12px;">
              A
            </th>

            <th style="padding:12px;">
              L
            </th>

            <th style="padding:12px;">
              H
            </th>

            <th style="padding:12px;">
              S
            </th>

          </tr>

        </thead>

        <tbody>

  `;


  Object.values(
    studentMap
  ).forEach(
    student => {

      html += `

        <tr
          style="
            border-bottom:1px solid #e2e8f0;
          ">

          <td
            style="
              padding:12px;
            ">

            <strong>
              ${escapeHtml(
                student.name
              )}
            </strong>

            <br>

            <small
              style="
                color:var(--text-muted);
              ">

              ${escapeHtml(
                student.customId
              )}

            </small>

          </td>

      `;


      dates.forEach(
        date => {

          html += `

            <td
              style="
                padding:12px;
                font-weight:500;
              ">

              ${escapeHtml(
                student.days[
                  date
                ] || "—"
              )}

            </td>

          `;

        }
      );


      html += `

          <td
            style="
              padding:12px;
              color:#10b981;
              font-weight:600;
            ">

            ${student.P}

          </td>

          <td
            style="
              padding:12px;
              color:#ef4444;
              font-weight:600;
            ">

            ${student.A}

          </td>

          <td
            style="
              padding:12px;
              color:#ff6b00;
              font-weight:600;
            ">

            ${student.L}

          </td>

          <td
            style="
              padding:12px;
              font-weight:600;
            ">

            ${student.H}

          </td>

          <td
            style="
              padding:12px;
              font-weight:600;
            ">

            ${student.S}

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
// HISTORY TABLE
// ==========================================

function buildHistoryTable(
  records
) {

  let html = `

    <div style="overflow-x:auto;">

      <table
        style="
          width:100%;
          border-collapse:collapse;
          text-align:left;
        ">

        <thead>

          <tr
            style="
              background:#f1f5f9;
              border-bottom:2px solid #cbd5e1;
            ">

            <th style="padding:12px;">
              Student
            </th>

            <th style="padding:12px;">
              Status
            </th>

            <th style="padding:12px;">
              Actual Shift
            </th>

          </tr>

        </thead>

        <tbody>

  `;


  records.forEach(
    record => {

      html += `

        <tr
          style="
            border-bottom:1px solid #e2e8f0;
          ">

          <td
            style="
              padding:12px;
              font-weight:600;
              color:var(--primary);
            ">

            ${escapeHtml(
              record.name || ""
            )}

          </td>

          <td
            style="
              padding:12px;
              font-weight:600;
            ">

            ${escapeHtml(
              record.status || ""
            )}

          </td>

          <td
            style="
              padding:12px;
              color:var(--text-muted);
            ">

            ${escapeHtml(
              record.actualShift ||
              "-"
            )}

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


  return html;
}


// ==========================================
// EDIT ATTENDANCE
// ==========================================

window.loadSeparateEditAttendance =
  async function () {

    const date =
      document.getElementById(
        "editAttendanceDate"
      )?.value;

    const shift =
      document.getElementById(
        "editAttendanceShift"
      )?.value;

    const container =
      document.getElementById(
        "separateEditContainer"
      );

    if (!container) return;


    if (!date) {

      showToast(
        "Please select a date.",
        "error"
      );

      return;
    }


    if (!shift) {

      showToast(
        "Please select shift.",
        "error"
      );

      return;
    }


    container.innerHTML = `
      <div
        style="
          padding:20px;
          text-align:center;
          color:var(--text-muted);
        ">

        <span
          class="material-symbols-rounded spin-icon">
          autorenew
        </span>

        Loading attendance...

      </div>
    `;


    try {

      const snap =
        await getAttendanceDocument(
          date,
          shift
        );


      if (!snap.exists()) {

        container.innerHTML = `
          <div
            style="
              padding:20px;
              text-align:center;
              color:var(--danger);
              border:1px dashed #cbd5e1;
              border-radius:8px;
            ">

            <span
              class="material-symbols-rounded"
              style="font-size:32px;">
              event_busy
            </span>

            <br>

            No attendance record found
            for this date and shift.

          </div>
        `;

        return;
      }


      const data =
        snap.data();


      const records =
        data.records || [];


      if (records.length === 0) {

        container.innerHTML = `
          <div
            style="
              padding:20px;
              text-align:center;
              color:var(--text-muted);
              border:1px dashed #cbd5e1;
              border-radius:8px;
            ">

            No student records found.

          </div>
        `;

        return;
      }


      // ====================================
      // HEADER
      // ====================================

      let html = `

        <div
          style="
            background:#f8fafc;
            padding:16px;
            border-radius:8px;
            margin-bottom:20px;
            border:1px solid var(--border);
          ">

          <strong
            style="
              display:flex;
              align-items:center;
              gap:6px;
            ">

            <span
              class="material-symbols-rounded">
              calendar_today
            </span>

            ${formatDDMMYYYY(date)}

            <span>
              •
            </span>

            ${escapeHtml(shift)}

          </strong>


          <div
            style="
              margin-top:8px;
              font-size:13px;
              color:var(--text-muted);
            ">

            Taken By:
            ${escapeHtml(
              data.markedBy ||
              "Admin"
            )}

          </div>

        </div>


        <!-- EDIT TABLE -->

        <div
          style="
            overflow-x:auto;
          ">

          <table
            style="
              width:100%;
              border-collapse:collapse;
              text-align:left;
              margin-bottom:20px;
            ">

            <thead>

              <tr
                style="
                  background:#f1f5f9;
                  border-bottom:2px solid #cbd5e1;
                ">

                <th
                  style="
                    padding:12px;
                    font-weight:600;
                  ">

                  Student

                </th>


                <th
                  style="
                    padding:12px;
                    font-weight:600;
                  ">

                  Status

                </th>


                <th
                  style="
                    padding:12px;
                    font-weight:600;
                  ">

                  Actual Shift

                </th>

              </tr>

            </thead>


            <tbody>

      `;


      // ====================================
      // RECORDS
      // ====================================

      records.forEach(
        record => {

          const status =
            record.status ||
            "P";


          const actualShift =
            record.actualShift ||
            record.regularShift ||
            shift;


          html += `

            <tr
              style="
                border-bottom:1px solid #e2e8f0;
              ">


              <!-- STUDENT -->

              <td
                style="
                  padding:12px;
                  font-weight:600;
                  color:var(--primary);
                ">

                ${escapeHtml(
                  record.name || ""
                )}

                <br>

                <small
                  style="
                    color:var(--text-muted);
                    font-weight:400;
                  ">

                  ID:
                  ${escapeHtml(
                    record.customId ||
                    record.studentId ||
                    ""
                  )}

                </small>

              </td>


              <!-- STATUS -->

              <td
                style="
                  padding:12px;
                ">

                <select
                  class="edit-status"
                  data-student-id="${escapeHtml(
                    record.studentId
                  )}"
                  style="
                    padding:9px 12px;
                    border-radius:7px;
                    border:1px solid var(--border);
                    background:white;
                    min-width:150px;
                  ">

                  <option
                    value="P"
                    ${
                      status === "P"
                        ? "selected"
                        : ""
                    }>

                    Present (P)

                  </option>


                  <option
                    value="A"
                    ${
                      status === "A"
                        ? "selected"
                        : ""
                    }>

                    Absent (A)

                  </option>


                  <option
                    value="L"
                    ${
                      status === "L"
                        ? "selected"
                        : ""
                    }>

                    Leave (L)

                  </option>


                  <option
                    value="H"
                    ${
                      status === "H"
                        ? "selected"
                        : ""
                    }>

                    Holiday (H)

                  </option>


                  <option
                    value="S"
                    ${
                      status === "S"
                        ? "selected"
                        : ""
                    }>

                    Sunday (S)

                  </option>

                </select>

              </td>


              <!-- ACTUAL SHIFT -->

              <td
                style="
                  padding:12px;
                ">

                <select
                  class="edit-shift"
                  data-student-id="${escapeHtml(
                    record.studentId
                  )}"
                  style="
                    padding:9px 12px;
                    border-radius:7px;
                    border:1px solid var(--border);
                    background:white;
                    min-width:140px;
                  ">

                  <option
                    value="Morning"
                    ${
                      actualShift ===
                      "Morning"
                        ? "selected"
                        : ""
                    }>

                    Morning

                  </option>


                  <option
                    value="Evening"
                    ${
                      actualShift ===
                      "Evening"
                        ? "selected"
                        : ""
                    }>

                    Evening

                  </option>

                </select>

              </td>

            </tr>

          `;

        }
      );


      html += `

            </tbody>

          </table>

        </div>


        <!-- UPDATE BUTTON -->

        <button
          type="button"
          class="action-btn"
          id="updateAttendanceBtn">

          <span
            class="material-symbols-rounded">
            save
          </span>

          Update Attendance

        </button>

      `;


      container.innerHTML =
        html;


      // ====================================
      // UPDATE BUTTON EVENT
      // ====================================

      const updateBtn =
        document.getElementById(
          "updateAttendanceBtn"
        );


      if (updateBtn) {

        updateBtn.addEventListener(
          "click",
          async function () {

            updateBtn.disabled =
              true;

            updateBtn.innerHTML = `
              <span
                class="material-symbols-rounded spin-icon">
                autorenew
              </span>

              Updating...
            `;


            await updateEditedAttendance(
              date,
              shift,
              data
            );

          }
        );

      }


    } catch (error) {

      console.error(
        "Edit attendance load error:",
        error
      );


      container.innerHTML = `
        <div
          style="
            padding:20px;
            color:red;
            text-align:center;
            border:1px dashed #ef4444;
            border-radius:8px;
          ">

          Error:
          ${escapeHtml(
            error.message
          )}

        </div>
      `;

    }

  };


// ==========================================
// UPDATE EDITED ATTENDANCE
// ==========================================

async function updateEditedAttendance(
  date,
  shift,
  oldData
) {

  try {

    const oldRecords =
      oldData.records || [];


    const records =
      oldRecords.map(
        record => {

          const statusSelect =
            document.querySelector(
              `.edit-status[data-student-id="${CSS.escape(record.studentId)}"]`
            );


          const shiftSelect =
            document.querySelector(
              `.edit-shift[data-student-id="${CSS.escape(record.studentId)}"]`
            );


          const newStatus =
            statusSelect?.value ||
            record.status ||
            "P";


          const newShift =
            shiftSelect?.value ||
            record.actualShift ||
            record.regularShift ||
            shift;


          return {

            ...record,

            status:
              newStatus,

            actualShift:
              newShift

          };

        }
      );


    // ====================================
    // SAVE UPDATED RECORD
    // ====================================

    await setDoc(

      doc(
        db,
        "attendance",
        `${date}_${shift}`
      ),

      {

        ...oldData,

        date:
          date,

        shift:
          shift,

        records:
          records,

        markedBy:
          oldData.markedBy ||
          window.currentUserEmail ||
          "Admin",

        updatedAt:
          serverTimestamp()

      },

      {
        merge:true
      }

    );


    showToast(
      "Attendance updated successfully!",
      "success"
    );


    // Reload edited record
    await loadSeparateEditAttendance();


    // Main pending list bhi refresh
    await renderAttendanceStudents();


  } catch (error) {

    console.error(
      "Attendance update error:",
      error
    );


    showToast(
      "Error updating attendance: " +
      error.message,
      "error"
    );

  }

}


// ==========================================
// HTML SAFETY
// ==========================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}
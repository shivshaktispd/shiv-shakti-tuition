// ==========================================
// STUDENTS.JS - COMPLETE
// 4 Digit Student ID
// Fee Start Month
// Morning / Evening Batch
// ==========================================

"use strict";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  deleteField
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

let isSavingStudent = false;
let allStudents = [];


// ==========================================
// TOAST
// ==========================================
window.showToast = function(message, type = "success") {

  const toast =
    document.getElementById("customToast");

  const toastMsg =
    document.getElementById("toastMessage");

  const toastIcon =
    document.getElementById("toastIcon");

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
function formatDDMMYYYY(dateString) {

  if (!dateString) return "-";

  const parts =
    String(dateString).split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return dateString;
}


function escapeHtml(val) {

  return String(val || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function compressImage(file) {

  return new Promise((resolve, reject) => {

    const reader =
      new FileReader();

    reader.onload =
      function(event) {

        const img =
          new Image();

        img.onload =
          function() {

            const canvas =
              document.createElement(
                "canvas"
              );

            const maxWidth = 600;

            const scale =
              Math.min(
                1,
                maxWidth / img.width
              );

            canvas.width =
              img.width * scale;

            canvas.height =
              img.height * scale;

            const ctx =
              canvas.getContext("2d");

            ctx.drawImage(
              img,
              0,
              0,
              canvas.width,
              canvas.height
            );

            resolve(
              canvas.toDataURL(
                "image/jpeg",
                0.7
              )
            );

          };

        img.onerror = reject;

        img.src =
          event.target.result;

      };

    reader.onerror = reject;

    reader.readAsDataURL(file);

  });

}


// ==========================================
// CURRENT MONTH
// ==========================================
function getCurrentMonth() {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  return `${year}-${month}`;

}


// ==========================================
// GENERATE 4 DIGIT STUDENT ID
// ==========================================
async function generateStudentCode() {

  const snapshot =
    await getDocs(
      collection(
        db,
        "students"
      )
    );

  const usedCodes =
    new Set();


  snapshot.forEach(
    studentDoc => {

      const data =
        studentDoc.data();

      if (data.studentCode) {

        usedCodes.add(
          String(
            data.studentCode
          ).trim()
        );

      }

    }
  );


  // Try random 4 digit numbers
  for (let i = 0; i < 50; i++) {

    const code =
      String(
        Math.floor(
          1000 +
          Math.random() * 9000
        )
      );

    if (!usedCodes.has(code)) {
      return code;
    }

  }


  // Fallback
  for (
    let number = 1000;
    number <= 9999;
    number++
  ) {

    const code =
      String(number);

    if (!usedCodes.has(code)) {
      return code;
    }

  }


  throw new Error(
    "All 4-digit Student IDs are already used."
  );

}


// ==========================================
// LOAD STUDENTS
// ==========================================
window.loadStudents =
  async function() {

    const studentList =
      document.getElementById(
        "studentList"
      );

    if (!studentList) return;

    try {

      const snapshot =
        await getDocs(
          collection(
            db,
            "students"
          )
        );

      allStudents = [];


      snapshot.forEach(
        studentDoc => {

          allStudents.push({

            id:
              studentDoc.id,

            ...studentDoc.data()

          });

        }
      );


      const activeStudents =
        allStudents.filter(
          student =>
            String(
              student.status ||
              "ACTIVE"
            ).toUpperCase() !==
            "ARCHIVED"
        );


      activeStudents.sort(
        (a, b) =>
          (a.name || "")
            .localeCompare(
              b.name || ""
            )
      );


      window.renderStudents(
        activeStudents
      );


    } catch (error) {

      console.error(
        "Load students error:",
        error
      );


      studentList.innerHTML = `

        <div
          style="
            text-align:center;
            color:#ef4444;
            padding:20px;
            border:1px solid #fca5a5;
            background:#fef2f2;
            border-radius:10px;
          "
        >

          <b>
            Error Loading Students:
          </b>

          <br>

          ${escapeHtml(
            error.message
          )}

        </div>

      `;

    }

  };


// ==========================================
// RENDER STUDENTS
// ==========================================
window.renderStudents =
  function(students) {

    const studentList =
      document.getElementById(
        "studentList"
      );

    const listHeader =
      document.getElementById(
        "listHeader"
      );

    const searchBox =
      document.getElementById(
        "studentSearch"
      );


    if (listHeader) {
      listHeader.style.display =
        "flex";
    }

    if (searchBox) {
      searchBox.style.display =
        "block";
    }


    if (!students.length) {

      studentList.innerHTML = `

        <div
          style="
            padding:40px 20px;
            text-align:center;
            border:1px dashed var(--border);
            border-radius:12px;
            color:var(--text-muted);
          "
        >

          <span
            class="material-symbols-rounded"
            style="
              font-size:48px;
              margin-bottom:10px;
            "
          >
            person_off
          </span>

          <h3>
            No Students Found
          </h3>

        </div>

      `;

      return;

    }


    studentList.innerHTML =
      students
        .map(student => {

          const fee =
            Number(
              student.monthlyFee || 0
            );

          const batch =
            student.batchTime || "";


          return `

            <div
              class="student-item-card"
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                flex-wrap:wrap;
                gap:15px;
                padding:18px;
                border:1px solid var(--border);
                border-radius:14px;
                background:white;
                margin-bottom:14px;
              "
            >

              <div
                style="
                  display:flex;
                  gap:15px;
                  align-items:center;
                  flex:1;
                  min-width:200px;
                  overflow:hidden;
                "
              >

                <div
                  style="
                    flex-shrink:0;
                  "
                >

                  <img
                    src="${escapeHtml(
                      student.photoUrl ||
                      "https://placehold.co/100x100?text=Stu"
                    )}"
                    style="
                      width:55px;
                      height:55px;
                      border-radius:50%;
                      object-fit:cover;
                      border:2px solid #e2e8f0;
                      background:#f8fafc;
                    "
                  >

                </div>


                <div
                  style="
                    overflow:hidden;
                  "
                >

                  <strong
                    style="
                      font-size:17px;
                      color:var(--primary);
                      display:block;
                      white-space:nowrap;
                      overflow:hidden;
                      text-overflow:ellipsis;
                    "
                  >
                    ${escapeHtml(
                      student.name ||
                      "Unnamed"
                    )}
                  </strong>


                  <div
                    style="
                      font-size:12px;
                      color:var(--text-muted);
                      margin-top:3px;
                    "
                  >
                    ID:
                    ${escapeHtml(
                      student.studentCode ||
                      "-"
                    )}
                  </div>


                  <div
                    style="
                      font-size:13px;
                      color:var(--text-muted);
                      margin-top:3px;
                    "
                  >

                    Class:
                    ${escapeHtml(
                      student.className ||
                      "-"
                    )}

                    <span
                      style="
                        margin:0 4px;
                        color:#cbd5e1;
                      "
                    >
                      |
                    </span>

                    Fee:
                    ₹${fee.toLocaleString(
                      "en-IN"
                    )}

                    ${
                      batch
                        ? `
                          <span
                            style="
                              margin:0 4px;
                              color:#cbd5e1;
                            "
                          >
                            |
                          </span>

                          ${escapeHtml(
                            batch
                          )}
                        `
                        : ""
                    }

                  </div>

                </div>

              </div>


              <button
                type="button"
                class="student-view-btn"
                data-student-id="${student.id}"
                style="
                  padding:10px 18px;
                  background:#f1f5f9;
                  color:var(--primary);
                  border:none;
                  border-radius:10px;
                  font-weight:600;
                  font-size:14px;
                  cursor:pointer;
                  display:flex;
                  align-items:center;
                  gap:6px;
                "
              >

                View

                <span
                  class="material-symbols-rounded"
                  style="
                    font-size:18px;
                  "
                >
                  arrow_forward
                </span>

              </button>

            </div>

          `;

        })
        .join("");


    document
      .querySelectorAll(
        ".student-view-btn"
      )
      .forEach(btn => {

        btn.addEventListener(
          "click",
          function() {

            window.viewStudent(
              this.dataset.studentId
            );

          }
        );

      });

  };


// ==========================================
// VIEW STUDENT
// ==========================================
window.viewStudent =
  function(studentId) {

    const student =
      allStudents.find(
        s =>
          s.id === studentId
      );

    if (!student) return;


    const fee =
      Number(
        student.monthlyFee || 0
      );


    const studentList =
      document.getElementById(
        "studentList"
      );

    const listHeader =
      document.getElementById(
        "listHeader"
      );

    const searchBox =
      document.getElementById(
        "studentSearch"
      );


    if (listHeader) {
      listHeader.style.display =
        "none";
    }

    if (searchBox) {
      searchBox.style.display =
        "none";
    }


    const feeStartMonth =
      student.feeStartMonth ||
      getCurrentMonth();


    const batch =
      student.batchTime ||
      "-";


    studentList.innerHTML = `

      <div
        style="
          background:white;
          border:1px solid var(--border);
          border-radius:16px;
          padding:24px;
          box-shadow:0 4px 10px rgba(0,0,0,0.02);
        "
      >

        <button
          type="button"
          onclick="window.loadStudents()"
          style="
            margin-bottom:20px;
            border:1px solid var(--border);
            background:#ffffff;
            color:var(--text-main);
            padding:8px 16px;
            border-radius:30px;
            font-size:14px;
            font-weight:600;
            display:inline-flex;
            align-items:center;
            gap:6px;
            cursor:pointer;
          "
        >

          <span
            class="material-symbols-rounded"
            style="font-size:18px;"
          >
            arrow_back
          </span>

          Back to List

        </button>


        <div
          style="
            background:#f8fafc;
            border-radius:14px;
            margin-bottom:20px;
            border:1px solid var(--border);
            overflow:hidden;
          "
        >

          <div
            style="
              background:var(--primary);
              color:white;
              text-align:center;
              padding:8px;
              font-size:13px;
              font-weight:600;
              letter-spacing:1px;
              text-transform:uppercase;
            "
          >
            Shiv Shakti Tuition
          </div>


          <div
            style="
              display:flex;
              gap:20px;
              align-items:center;
              padding:20px;
            "
          >

            <img
              src="${escapeHtml(
                student.photoUrl ||
                "https://placehold.co/200x200?text=Profile"
              )}"
              style="
                width:75px;
                height:75px;
                border-radius:50%;
                object-fit:cover;
                border:3px solid #fff;
                flex-shrink:0;
              "
            >


            <div>

              <h2
                style="
                  font-size:22px;
                  color:var(--primary);
                  margin:0 0 6px 0;
                "
              >
                ${escapeHtml(
                  student.name
                )}
              </h2>


              <div
                style="
                  display:inline-block;
                  background:#e0e7ff;
                  color:#4338ca;
                  padding:4px 12px;
                  border-radius:20px;
                  font-size:12px;
                  font-weight:600;
                "
              >

                ID:
                ${escapeHtml(
                  student.studentCode
                )}

              </div>

            </div>

          </div>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:15px;
            margin-bottom:24px;
          "
        >

          ${profileInfo(
            "Father Name",
            student.fatherName
          )}

          ${profileInfo(
            "Mobile",
            student.mobile
          )}

          ${profileInfo(
            "Class",
            student.className
          )}

          ${profileInfo(
            "Batch / Time",
            batch
          )}

          ${profileInfo(
            "Admission Date",
            formatDDMMYYYY(
              student.admissionDate
            )
          )}

          ${profileInfo(
            "Monthly Fee",
            `₹${fee.toLocaleString(
              "en-IN"
            )}`
          )}

          ${profileInfo(
            "Due Date",
            student.feeDueDay
              ? student.feeDueDay +
                "th of Month"
              : "-"
          )}

          ${profileInfo(
            "Fee Start Month",
            feeStartMonth
          )}

        </div>


        <div
          style="
            border-top:1px solid var(--border);
            padding-top:20px;
            margin-bottom:20px;
          "
        >

          <div
            style="
              font-size:13px;
              font-weight:700;
              color:var(--text-muted);
              text-transform:uppercase;
              margin-bottom:12px;
            "
          >
            Quick Actions
          </div>


          <div
            style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:12px;
            "
          >

            <button
              onclick="
                window.editStudentProfile(
                  '${student.id}'
                )
              "
              style="
                background:#f8fafc;
                border:1px solid var(--border);
                color:var(--text-main);
                padding:12px;
                border-radius:12px;
                font-weight:600;
                cursor:pointer;
                display:flex;
                align-items:center;
                gap:10px;
              "
            >

              <span
                class="material-symbols-rounded"
              >
                edit_document
              </span>

              Edit Profile

            </button>


            <button
              onclick="
                window.location.href=
                'student-attendance.html?studentId=${student.id}'
              "
              style="
                background:#eff6ff;
                border:1px solid #bfdbfe;
                color:#1e40af;
                padding:12px;
                border-radius:12px;
                font-weight:600;
                cursor:pointer;
                display:flex;
                align-items:center;
                gap:10px;
              "
            >

              <span
                class="material-symbols-rounded"
              >
                calendar_month
              </span>

              Attendance

            </button>


            <button
              onclick="
                window.location.href=
                'fees.html?studentId=${student.id}'
              "
              style="
                background:#ecfdf5;
                border:1px solid #a7f3d0;
                color:#065f46;
                padding:12px;
                border-radius:12px;
                font-weight:600;
                cursor:pointer;
                display:flex;
                align-items:center;
                gap:10px;
              "
            >

              <span
                class="material-symbols-rounded"
              >
                payments
              </span>

              Manage Fees

            </button>


            <button
              onclick="
                window.downloadStudentPDF(
                  '${student.id}'
                )
              "
              style="
                background:#fffbeb;
                border:1px solid #fde68a;
                color:#92400e;
                padding:12px;
                border-radius:12px;
                font-weight:600;
                cursor:pointer;
                display:flex;
                align-items:center;
                gap:10px;
              "
            >

              <span
                class="material-symbols-rounded"
              >
                picture_as_pdf
              </span>

              Print PDF

            </button>

          </div>

        </div>


        <button
          onclick="
            window.archiveStudent(
              '${student.id}'
            )
          "
          style="
            width:100%;
            color:#ef4444;
            border:1px solid #fca5a5;
            background:#fef2f2;
            padding:12px;
            border-radius:10px;
            font-weight:600;
            cursor:pointer;
          "
        >

          <span
            class="material-symbols-rounded"
          >
            archive
          </span>

          Archive Student

        </button>

      </div>

    `;

  };


// ==========================================
// PROFILE INFO
// ==========================================
function profileInfo(label, value) {

  return `

    <div
      style="
        background:#f8fafc;
        padding:12px;
        border-radius:8px;
        border:1px solid var(--border);
      "
    >

      <div
        style="
          font-size:12px;
          color:var(--text-muted);
          font-weight:600;
          margin-bottom:4px;
        "
      >
        ${label}
      </div>


      <div
        style="
          font-size:14px;
          color:var(--text-main);
          font-weight:500;
        "
      >
        ${escapeHtml(
          value || "-"
        )}
      </div>

    </div>

  `;

}


// ==========================================
// PDF
// ==========================================
window.downloadStudentPDF =
  function(id) {

    const student =
      allStudents.find(
        s =>
          s.id === id
      );

    if (!student) {

      window.showToast(
        "Student data not found!",
        "error"
      );

      return;

    }


    window.open(
      `print-report.html?studentId=${id}`,
      "_blank"
    );

  };


// ==========================================
// EDIT STUDENT
// ==========================================
window.editStudentProfile =
  function(id) {

    const student =
      allStudents.find(
        s =>
          s.id === id
      );

    if (!student) return;


    const oldModal =
      document.getElementById(
        "editStudentModal"
      );

    if (oldModal) {
      oldModal.remove();
    }


    const feeStartMonth =
      student.feeStartMonth ||
      getCurrentMonth();


    const batchTime =
      student.batchTime ||
      "";


    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "editStudentModal";

    modal.className =
      "modal";

    modal.style.display =
      "block";


    modal.innerHTML = `

      <div class="modal-box">

        <h2>

          <span
            class="material-symbols-rounded"
          >
            edit
          </span>

          Edit Student

        </h2>


        <div class="form-group">

          <label>
            Student ID
          </label>

          <input
            class="form-input"
            value="${escapeHtml(
              student.studentCode ||
              "-"
            )}"
            disabled
          >

        </div>


        <div class="form-group">

          <label>
            Name
          </label>

          <input
            id="eName"
            class="form-input"
            value="${escapeHtml(
              student.name || ""
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            Father Name
          </label>

          <input
            id="eFather"
            class="form-input"
            value="${escapeHtml(
              student.fatherName || ""
            )}"
          >

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:15px;
          "
        >

          <div class="form-group">

            <label>
              Mobile
            </label>

            <input
              id="eMobile"
              class="form-input"
              value="${escapeHtml(
                student.mobile || ""
              )}"
            >

          </div>


          <div class="form-group">

            <label>
              Class
            </label>

            <input
              id="eClass"
              class="form-input"
              value="${escapeHtml(
                student.className || ""
              )}"
            >

          </div>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:15px;
          "
        >

          <div class="form-group">

            <label>
              Batch / Time
            </label>

            <select
              id="eBatchTime"
              class="form-input"
            >

              <option value="">
                Select Batch
              </option>

              <option
                value="Morning"
                ${
                  batchTime === "Morning"
                    ? "selected"
                    : ""
                }
              >
                Morning
              </option>

              <option
                value="Evening"
                ${
                  batchTime === "Evening"
                    ? "selected"
                    : ""
                }
              >
                Evening
              </option>

            </select>

          </div>


          <div class="form-group">

            <label>
              Monthly Fee (₹)
            </label>

            <input
              id="eFee"
              type="number"
              min="0"
              class="form-input"
              value="${
                student.monthlyFee || 0
              }"
            >

          </div>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:15px;
          "
        >

          <div class="form-group">

            <label>
              Due Day (1-31)
            </label>

            <input
              id="eDueDay"
              type="number"
              min="1"
              max="31"
              class="form-input"
              value="${
                student.feeDueDay || ""
              }"
            >

          </div>


          <div class="form-group">

            <label>
              Fee Start Month
            </label>

            <input
              id="eFeeStartMonth"
              type="month"
              class="form-input"
              value="${feeStartMonth}"
            >

            <small
              style="
                display:block;
                margin-top:5px;
                color:var(--text-muted);
                font-size:12px;
              "
            >
              Fee calculation starts
              from this month.
            </small>

          </div>

        </div>


        <div class="form-group">

          <label>
            Change Photo
          </label>

                    <input
            type="file"
            id="ePhoto"
            accept="image/*"
            class="form-input"
            style="padding:8px;"
            onchange="window.openCropper(event)"
          >


        </div>


        <div class="form-buttons">

          <button
            type="button"
            class="cancel-btn"
            id="cancelEditBtn"
          >
            Cancel
          </button>


          <button
            type="button"
            class="save-btn"
            id="saveEditBtn"
          >
            Save Changes
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "cancelEditBtn"
      )
      .onclick =
      () => modal.remove();


    document
      .getElementById(
        "saveEditBtn"
      )
      .onclick =
      async function() {

        const btn = this;

        btn.textContent =
          "Saving...";

        btn.disabled =
          true;


        try {

          let photoUrl =
            student.photoUrl || "";


          const photoFile =
            document.getElementById(
              "ePhoto"
            )?.files?.[0];


        if (window.croppedImageBase64) {
  photoUrl = window.croppedImageBase64;
}



          const newFeeStartMonth =
            document.getElementById(
              "eFeeStartMonth"
            ).value;


          const newBatchTime =
            document.getElementById(
              "eBatchTime"
            ).value;


          const newFee =
            Number(
              document.getElementById(
                "eFee"
              ).value
            );


          const dueDayValue =
            document.getElementById(
              "eDueDay"
            ).value;


          if (!newFeeStartMonth) {

            window.showToast(
              "Please select Fee Start Month.",
              "error"
            );

            btn.disabled =
              false;

            btn.textContent =
              "Save Changes";

            return;

          }


          if (
            !Number.isFinite(
              newFee
            ) ||
            newFee < 0
          ) {

            window.showToast(
              "Please enter a valid monthly fee.",
              "error"
            );

            btn.disabled =
              false;

            btn.textContent =
              "Save Changes";

            return;

          }


          await updateDoc(
            doc(
              db,
              "students",
              id
            ),
            {

              name:
                document
                  .getElementById(
                    "eName"
                  )
                  .value
                  .trim(),

              fatherName:
                document
                  .getElementById(
                    "eFather"
                  )
                  .value
                  .trim(),

              mobile:
                document
                  .getElementById(
                    "eMobile"
                  )
                  .value
                  .trim(),

              className:
                document
                  .getElementById(
                    "eClass"
                  )
                  .value
                  .trim(),

              batchTime:
                newBatchTime,

              monthlyFee:
                newFee,

              feeDueDay:
                dueDayValue
                  ? Number(
                      dueDayValue
                    )
                  : null,

              feeStartMonth:
                newFeeStartMonth,

              photoUrl:
                photoUrl,

              updatedAt:
                serverTimestamp()

            }
          );


          window.showToast(
            "Profile updated successfully!"
          );


          modal.remove();


          await window.loadStudents();


          window.viewStudent(
            id
          );


        } catch (error) {

          console.error(
            "Update student error:",
            error
          );


          window.showToast(
            "Update failed: " +
            error.message,
            "error"
          );


          btn.disabled =
            false;

          btn.textContent =
            "Save Changes";

        }

      };

  };


// ==========================================
// ARCHIVE STUDENT
// ==========================================
window.archiveStudent =
  async function(id) {

    if (
      !confirm(
        "Are you sure you want to archive this student?"
      )
    ) {
      return;
    }


    try {

      const expireDate =
        new Date();


      expireDate.setFullYear(
        expireDate.getFullYear() +
        1
      );


      await updateDoc(
        doc(
          db,
          "students",
          id
        ),
        {

          status:
            "ARCHIVED",

          archivedAt:
            serverTimestamp(),

          expireAt:
            expireDate

        }
      );


      window.showToast(
        "Student archived."
      );


      await window.loadStudents();


    } catch (error) {

      window.showToast(
        "Error archiving: " +
        error.message,
        "error"
      );

    }

  };


// ==========================================
// OPEN ARCHIVED STUDENTS
// ==========================================
window.openArchivedStudents =
  async function() {

    const modal =
      document.getElementById(
        "archivedStudentsModal"
      );


    const list =
      document.getElementById(
        "archivedStudentList"
      );


    if (!modal || !list) return;


    modal.style.display =
      "block";


    list.innerHTML =
      "Loading...";


    try {

      const snapshot =
        await getDocs(
          collection(
            db,
            "students"
          )
        );


      const archived = [];


      snapshot.forEach(
        studentDoc => {

          const data =
            studentDoc.data();


          if (
            data.status ===
            "ARCHIVED"
          ) {

            archived.push({

              id:
                studentDoc.id,

              ...data

            });

          }

        }
      );


      if (!archived.length) {

        list.innerHTML = `

          <p
            style="
              text-align:center;
            "
          >
            No archived students.
          </p>

        `;

        return;

      }


      list.innerHTML =
        archived
          .map(
            student => `

              <div
                style="
                  padding:16px;
                  border:1px solid var(--border);
                  border-radius:8px;
                  margin-bottom:12px;
                  background:#f8fafc;
                "
              >

                <strong>
                  ${escapeHtml(
                    student.name
                  )}
                </strong>

                <small
                  style="
                    color:var(--text-muted);
                  "
                >
                  (
                  ${escapeHtml(
                    student.studentCode ||
                    "-"
                  )}
                  )
                </small>


                <div
                  style="
                    display:flex;
                    gap:10px;
                    margin-top:10px;
                  "
                >

                  <button
                    onclick="
                      window.restoreStudent(
                        '${student.id}'
                      )
                    "
                    class="btn-outline"
                    style="
                      flex:1;
                      justify-content:center;
                      color:#10b981;
                      border-color:#a7f3d0;
                    "
                  >

                    <span
                      class="material-symbols-rounded"
                    >
                      restore
                    </span>

                    Restore

                  </button>


                  <button
                    onclick="
                      window.deleteArchivedStudent(
                        '${student.id}'
                      )
                    "
                    class="btn-outline"
                    style="
                      flex:1;
                      justify-content:center;
                      color:#ef4444;
                      border-color:#fca5a5;
                    "
                  >

                    <span
                      class="material-symbols-rounded"
                    >
                      delete
                    </span>

                    Delete

                  </button>

                </div>

              </div>

            `
          )
          .join("");


    } catch (error) {

      console.error(error);

      list.innerHTML =
        "Failed to load.";

    }

  };


// ==========================================
// CLOSE ARCHIVED
// ==========================================
window.closeArchivedStudents =
  function() {

    const modal =
      document.getElementById(
        "archivedStudentsModal"
      );

    if (modal) {

      modal.style.display =
        "none";

    }

  };


// ==========================================
// RESTORE STUDENT
// ==========================================
window.restoreStudent =
  async function(id) {

    try {

      await updateDoc(
        doc(
          db,
          "students",
          id
        ),
        {

          status:
            "ACTIVE",

          restoredAt:
            serverTimestamp(),

          expireAt:
            deleteField()

        }
      );


      window.showToast(
        "Student restored!"
      );


      await window.loadStudents();


      window.openArchivedStudents();


    } catch (error) {

      console.error(error);


      window.showToast(
        "Error restoring",
        "error"
      );

    }

  };


// ==========================================
// DELETE ARCHIVED STUDENT
// ==========================================
window.deleteArchivedStudent =
  async function(id) {

    if (
      !confirm(
        "Delete permanently? This cannot be undone."
      )
    ) {
      return;
    }


    try {

      await deleteDoc(
        doc(
          db,
          "students",
          id
        )
      );


      window.showToast(
        "Student deleted permanently."
      );


      await window.loadStudents();


      window.openArchivedStudents();


    } catch (error) {

      console.error(error);


      window.showToast(
        "Error deleting",
        "error"
      );

    }

  };


// ==========================================
// START APP
// ==========================================
function startApp() {

  const studentForm =
    document.getElementById(
      "studentForm"
    );


  if (studentForm) {

    studentForm.addEventListener(
      "submit",
      async function(event) {

        event.preventDefault();


        if (isSavingStudent) {
          return;
        }


        isSavingStudent =
          true;


        const saveBtn =
          studentForm.querySelector(
            'button[type="submit"]'
          );


        if (saveBtn) {

          saveBtn.disabled =
            true;

          saveBtn.textContent =
            "Saving...";

        }


        try {

          const name =
            document
              .getElementById(
                "studentName"
              )
              .value
              .trim();


          const fatherName =
            document
              .getElementById(
                "fatherName"
              )
              .value
              .trim();


          const motherName =
            document
              .getElementById(
                "motherName"
              )
              .value
              .trim();


          const mobile =
            document
              .getElementById(
                "mobile"
              )
              .value
              .trim();


          const className =
            document
              .getElementById(
                "className"
              )
              .value
              .trim();


          // ==================================
          // MORNING / EVENING
          // ==================================
          const batchTime =
            document
              .getElementById(
                "batchTime"
              )
              ?.value || "";


          // ==================================
          // MONTHLY FEE
          // ==================================
          const monthlyFee =
            Number(
              document
                .getElementById(
                  "monthlyFee"
                )
                .value
            );


          // ==================================
          // DUE DAY
          // ==================================
          const feeDueDay =
            document
              .getElementById(
                "feeDueDay"
              )
              .value
              ? Number(
                  document
                    .getElementById(
                      "feeDueDay"
                    )
                    .value
                )
              : null;


          // ==================================
          // FEE START MONTH
          // ==================================
          const feeStartMonth =
            document
              .getElementById(
                "feeStartMonth"
              )
              ?.value || "";


          const admissionDate =
            document
              .getElementById(
                "admissionDate"
              )
              .value;


          const address =
            document
              .getElementById(
                "address"
              )
              .value
              .trim();


          const notes =
            document
              .getElementById(
                "notes"
              )
              .value
              .trim();


          const photoFile =
            document
              .getElementById(
                "studentPhoto"
              )
              ?.files?.[0] ||
            null;


          // ==================================
          // VALIDATION
          // ==================================
          if (
            !name ||
            !fatherName ||
            !Number.isFinite(
              monthlyFee
            ) ||
            monthlyFee < 0
          ) {

            window.showToast(
              "Please fill all required fields correctly.",
              "error"
            );

            return;

          }


          if (!feeStartMonth) {

            window.showToast(
              "Please select Fee Start Month.",
              "error"
            );

            return;

          }


                // ==================================
          // PHOTO
          // ==================================
          let photoUrl = "";

          if (window.croppedImageBase64) {
            photoUrl = window.croppedImageBase64;
          }

          // ==================================
          // GENERATE 4 DIGIT ID
          // ==================================

          const studentCode =
            await generateStudentCode();


          // ==================================
          // STUDENT DATA
          // ==================================
          const studentData = {

            // 4 digit ID
            studentCode,

            name,

            fatherName,

            motherName,

            photoUrl,

            dateOfBirth:
              "",

            mobile,

            alternateMobile:
              "",

            address,

            school:
              "",

            className,

            // Morning / Evening
            batchTime,

            admissionDate,

            monthlyFee,

            feeDueDay,

            // IMPORTANT
            // Fee calculation starts here
            feeStartMonth,

            status:
              "ACTIVE",

            notes,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp()

          };


          // ==================================
          // SAVE
          // ==================================
          await addDoc(
            collection(
              db,
              "students"
            ),
            studentData
          );


          window.showToast(
            `Student added successfully! ID: ${studentCode}`,
            "success"
          );


          studentForm.reset();


          const modal =
            document.getElementById(
              "studentModal"
            );


          if (modal) {

            modal.style.display =
              "none";

          }


          document.body.style.overflow =
            "auto";


          await window.loadStudents();


        } catch (error) {

          console.error(
            "Save student error:",
            error
          );


          window.showToast(
            "Error saving student: " +
            error.message,
            "error"
          );


        } finally {

          resetSaveBtn(
            saveBtn
          );

        }

      }
    );

  }


  // ========================================
  // SEARCH
  // ========================================
  const studentSearch =
    document.getElementById(
      "studentSearch"
    );


  if (studentSearch) {

    studentSearch.addEventListener(
      "input",
      function() {

        const q =
          this.value
            .toLowerCase()
            .trim();


        const filtered =
          allStudents.filter(
            student => {

              const isActive =
                String(
                  student.status ||
                  "ACTIVE"
                ).toUpperCase() !==
                "ARCHIVED";


              return (
                isActive &&

                (
                  (student.name || "")
                    .toLowerCase()
                    .includes(q)

                  ||

                  (student.studentCode || "")
                    .toLowerCase()
                    .includes(q)

                  ||

                  (student.mobile || "")
                    .includes(q)

                  ||

                  (student.batchTime || "")
                    .toLowerCase()
                    .includes(q)
                )
              );

            }
          );


        window.renderStudents(
          filtered
        );

      }
    );

  }


  window.loadStudents();

}


// ==========================================
// RESET SAVE BUTTON
// ==========================================
function resetSaveBtn(btn) {

  isSavingStudent =
    false;


  if (btn) {

    btn.disabled =
      false;

    btn.textContent =
      "Save Student";

  }

}


// ==========================================
// INIT
// ==========================================
if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    startApp
  );

} else {

  startApp();

}
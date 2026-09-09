// ==========================================
// STAFF.JS - COMPLETE STAFF MANAGEMENT
// ==========================================

"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { app, auth, db } from "./firebase.js";

let staffList = [];

document.addEventListener("DOMContentLoaded", () => {
  const addStaffBtn = document.getElementById("addStaffBtn");
  const staffModal = document.getElementById("staffModal");
  const closeStaffModal = document.getElementById("closeStaffModal");
  const staffForm = document.getElementById("staffForm");
  const editStaffModal = document.getElementById("editStaffModal");
  const editStaffForm = document.getElementById("editStaffForm");

  if (addStaffBtn) {
    addStaffBtn.addEventListener("click", () => {
      if (staffForm) staffForm.reset();
      const status = document.getElementById("staffStatus");
      if (status) status.value = "active";
      if (staffModal) staffModal.style.display = "block";
    });
  }

  if (closeStaffModal) {
    closeStaffModal.addEventListener("click", () => {
      if (staffModal) staffModal.style.display = "none";
    });
  }

  window.addEventListener("click", (event) => {
    if (staffModal && event.target === staffModal) staffModal.style.display = "none";
    if (editStaffModal && event.target === editStaffModal) editStaffModal.style.display = "none";
  });

  // ADD STAFF
  if (staffForm) {
    staffForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("staffName")?.value.trim();
      const staffId = document.getElementById("staffId")?.value.trim();
      const role = document.getElementById("staffRole")?.value;
      const mobile = document.getElementById("staffMobile")?.value.trim();
      const status = document.getElementById("staffStatus")?.value;
      const password = document.getElementById("staffPassword")?.value;

      // Extract all permissions
      const permissions = {
        students: document.getElementById("permStudents")?.checked ?? false,
        attendance: document.getElementById("permAttendance")?.checked ?? false,
        fees: document.getElementById("permFees")?.checked ?? false,
        reports: document.getElementById("permReports")?.checked ?? false,
        staff: document.getElementById("permStaff")?.checked ?? false,
        settings: document.getElementById("permSettings")?.checked ?? false
      };

      if (!name || !staffId) { alert("Staff Name aur ID required hai."); return; }
      if (!password || password.length < 6) { alert("Password min 6 characters ka hona chahiye."); return; }

      const saveButton = staffForm.querySelector('button[type="submit"]');
      if (saveButton) { saveButton.disabled = true; saveButton.textContent = "Saving..."; }

      try {
        const email = staffId + "@shivshakti.com";
        const staffApp = initializeApp(app.options, "staffCreator_" + Date.now());
        const staffAuth = getAuth(staffApp);
        const userCredential = await createUserWithEmailAndPassword(staffAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, "staff", uid), {
          uid: uid,
          name: name,
          staffId: staffId,
          role: role,
          mobile: mobile,
          status: status,
          permissions: permissions, // Saving the new permissions object
          createdAt: serverTimestamp()
        });

        await staffAuth.signOut();
        alert("Staff successfully added ✅");
        if (staffModal) staffModal.style.display = "none";
        await loadStaff();
      } catch (error) {
        console.error("Staff save error:", error);
        alert("Error: " + error.message);
      } finally {
        if (saveButton) { saveButton.disabled = false; saveButton.textContent = "Save Staff"; }
      }
    });
  }

  // EDIT STAFF
  if (editStaffForm) {
    editStaffForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("editStaffDocId").value;
      const name = document.getElementById("editStaffName").value.trim();
      const role = document.getElementById("editStaffRole").value;
      const status = document.getElementById("editStaffStatus").value;
      const mobile = document.getElementById("editStaffMobile").value.trim();

      // Extract edited permissions
      const permissions = {
        students: document.getElementById("editPermStudents")?.checked ?? false,
        attendance: document.getElementById("editPermAttendance")?.checked ?? false,
        fees: document.getElementById("editPermFees")?.checked ?? false,
        reports: document.getElementById("editPermReports")?.checked ?? false,
        staff: document.getElementById("editPermStaff")?.checked ?? false,
        settings: document.getElementById("editPermSettings")?.checked ?? false
      };

      if (!id || !name) { alert("Missing ID or Name"); return; }

      const updateBtn = editStaffForm.querySelector('button[type="submit"]');
      if(updateBtn) { updateBtn.disabled = true; updateBtn.textContent = "Updating..."; }

      try {
        await updateDoc(doc(db, "staff", id), {
          name: name,
          role: role,
          status: status,
          mobile: mobile,
          permissions: permissions, // Updating the permissions object
          updatedAt: serverTimestamp()
        });
        alert("Staff updated successfully ✅");
        if (editStaffModal) editStaffModal.style.display = "none";
        await loadStaff();
      } catch (error) {
        console.error("Update error:", error);
        alert("Update failed: " + error.message);
      } finally {
        if(updateBtn) { updateBtn.disabled = false; updateBtn.textContent = "Update Staff"; }
      }
    });
  }

  loadStaff();
});

async function loadStaff() {
  const staffContainer = document.getElementById("staffList");
  if (!staffContainer) return;
  staffContainer.innerHTML = `<div class="empty-staff">⏳ Loading staff...</div>`;
  try {
    const snapshot = await getDocs(collection(db, "staff"));
    staffList = [];
    snapshot.forEach((staffDoc) => { staffList.push({ id: staffDoc.id, ...staffDoc.data() }); });
    renderStaff();
  } catch (error) {
    staffContainer.innerHTML = `<div class="empty-staff">❌ Load error.<br>${escapeHtml(error.message)}</div>`;
  }
}

function renderStaff() {
  const staffContainer = document.getElementById("staffList");
  if (!staffContainer) return;

  if (staffList.length === 0) {
    staffContainer.innerHTML = `<div class="empty-staff">👨‍🏫<br><br>No staff added yet.</div>`;
    return;
  }

  staffContainer.innerHTML = staffList.map((staff) => {
    const initial = (staff.name || "S").charAt(0).toUpperCase();
    const role = staff.role === "admin" ? "Admin" : "Teacher";
    const isActive = (staff.status || "active") === "active";
    
    return `
      <div class="staff-card" style="background:white; border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px;">
        <div class="staff-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="staff-info" style="display:flex; align-items:center; gap:12px;">
            <div class="staff-avatar" style="width:40px; height:40px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700;">${initial}</div>
            <div>
              <div class="staff-name" style="font-weight:600; color:var(--text-main); font-size:15px;">${escapeHtml(staff.name)}</div>
              <div class="staff-id" style="font-size:12px; color:var(--text-muted);">ID: ${escapeHtml(staff.staffId || "-")}</div>
              <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                <span class="role-badge" style="background:#e0e7ff; color:#4338ca; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">${role}</span>
                <span class="status-badge" style="background:${isActive ? '#dcfce7' : '#fee2e2'}; color:${isActive ? '#166534' : '#991b1b'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">${isActive ? "Active" : "Disabled"}</span>
              </div>
            </div>
          </div>
          <div class="staff-actions" style="display:flex; gap:8px;">
            <button type="button" onclick="window.openEditStaffModal('${staff.id}')" style="background:#f8fafc; border:1px solid var(--border); padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:600;">Edit</button>
            <button type="button" onclick="window.toggleStaffStatus('${staff.id}')" style="background:#f8fafc; border:1px solid var(--border); padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:600;">${isActive ? "Disable" : "Enable"}</button>
            <button type="button" onclick="window.deleteStaff('${staff.id}')" style="color: #ef4444; background:#fef2f2; border: 1px solid #fca5a5; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:600;">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Load values into Edit Modal
window.openEditStaffModal = function (id) {
  const staff = staffList.find(item => item.id === id);
  if (!staff) return;

  if (document.getElementById("editStaffDocId")) document.getElementById("editStaffDocId").value = staff.id;
  if (document.getElementById("editStaffName")) document.getElementById("editStaffName").value = staff.name || "";
  if (document.getElementById("editStaffRole")) document.getElementById("editStaffRole").value = staff.role || "teacher";
  if (document.getElementById("editStaffStatus")) document.getElementById("editStaffStatus").value = staff.status || "active";
  if (document.getElementById("editStaffMobile")) document.getElementById("editStaffMobile").value = staff.mobile || "";

  // Load Permissions Checkboxes
  const perms = staff.permissions || { students: true, attendance: true, fees: false, reports: false, staff: false, settings: false };
  if(document.getElementById("editPermStudents")) document.getElementById("editPermStudents").checked = perms.students !== false;
  if(document.getElementById("editPermAttendance")) document.getElementById("editPermAttendance").checked = perms.attendance !== false;
  if(document.getElementById("editPermFees")) document.getElementById("editPermFees").checked = perms.fees !== false;
  if(document.getElementById("editPermReports")) document.getElementById("editPermReports").checked = perms.reports !== false;
  if(document.getElementById("editPermStaff")) document.getElementById("editPermStaff").checked = perms.staff !== false;
  if(document.getElementById("editPermSettings")) document.getElementById("editPermSettings").checked = perms.settings !== false;

  const editModal = document.getElementById("editStaffModal");
  if (editModal) editModal.style.display = "block";
};

window.toggleStaffStatus = async function (id) {
  const staff = staffList.find(item => item.id === id);
  if (!staff) return;
  const newStatus = (staff.status || "active") === "active" ? "disabled" : "active";
  try {
    await updateDoc(doc(db, "staff", id), { status: newStatus, updatedAt: serverTimestamp() });
    await loadStaff();
  } catch (error) { alert("Error: " + error.message); }
};

window.deleteStaff = async function (id) {
  const staff = staffList.find(item => item.id === id);
  if (!staff) return;
  if (!confirm(`Delete "${staff.name}" permanently?`)) return;
  try {
    await deleteDoc(doc(db, "staff", id));
    alert("Deleted ✅");
    await loadStaff();
  } catch (error) { alert("Error: " + error.message); }
};

function escapeHtml(val) { return String(val||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

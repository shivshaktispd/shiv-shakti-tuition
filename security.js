import {
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase.js";

"use strict";


// ==========================================
// GLOBAL STAFF DATA
// ==========================================

window.currentStaff = null;

window.hasPermission = function(permission) {

  const staff = window.currentStaff;

  if (!staff) return false;

  if (staff.role === "admin") {
    return true;
  }

  return staff.permissions?.[permission] === true;
};


// ==========================================
// AUTH PROTECTION
// ==========================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.currentStaff = null;

    if (
      !location.pathname.endsWith("login.html")
    ) {
      location.href = "login.html";
    }

    return;
  }


  try {

    const staffRef =
      doc(db, "staff", user.uid);

    const staffSnap =
      await getDoc(staffRef);


    if (!staffSnap.exists()) {

      await signOut(auth);

      location.href = "login.html";

      return;
    }


    const staff =
      staffSnap.data();


    // ======================================
    // DISABLED ACCOUNT
    // ======================================

    if (
      String(staff.status).toLowerCase() !==
      "active"
    ) {

      alert(
        "🔴 Ye staff account disabled hai."
      );

      await signOut(auth);

      location.href = "login.html";

      return;
    }


    window.currentStaff = {
      uid: user.uid,
      name: staff.name || "Staff",
      staffId: staff.staffId || "",
      role:
        String(
          staff.role || "teacher"
        ).toLowerCase(),
      status: staff.status,
      permissions:
        staff.permissions || {}
    };


    updateDashboardProfile();

    applyPermissions();

  } catch (error) {

    console.error(
      "Security error:",
      error
    );

    await signOut(auth);

    location.href = "login.html";
  }

});


// ==========================================
// DASHBOARD NAME + ROLE
// ==========================================

function updateDashboardProfile() {

  const staff =
    window.currentStaff;

  if (!staff) return;


  const name =
    staff.name;

  const role =
    staff.role === "admin"
      ? "Administrator"
      : "Teacher";


  const subtitle =
    document.getElementById(
      "pageSubtitle"
    );

  if (subtitle) {

    subtitle.textContent =
      `Welcome back, ${name} 👋`;
  }


  document
    .querySelectorAll(
      ".profile-mini span"
    )
    .forEach(el => {

      el.textContent = name;

    });


  document
    .querySelectorAll(
      ".admin-box strong"
    )
    .forEach(el => {

      el.textContent = name;

    });


  document
    .querySelectorAll(
      ".admin-box small"
    )
    .forEach(el => {

      el.textContent = role;

    });


  document
    .querySelectorAll(
      ".avatar"
    )
    .forEach(el => {

      el.textContent =
        name
          .charAt(0)
          .toUpperCase();

    });

}


// ==========================================
// PERMISSIONS
// ==========================================

function applyPermissions() {

  const permissions = [
    "students",
    "attendance",
    "fees",
    "reports",
    "staff",
    "settings",
    "pdf",
    "print"
  ];


  permissions.forEach(permission => {

    const allowed =
      window.hasPermission(
        permission
      );


    document
      .querySelectorAll(
        `[data-page="${permission}"]`
      )
      .forEach(el => {

        el.style.display =
          allowed
            ? ""
            : "none";

      });


    document
      .querySelectorAll(
        `[data-permission="${permission}"]`
      )
      .forEach(el => {

        el.style.display =
          allowed
            ? ""
            : "none";

      });

  });

}


// ==========================================
// LOGOUT
// ==========================================

window.logoutAdmin =
  async function () {

    try {

      await signOut(auth);

      sessionStorage.clear();

      location.href =
        "login.html";

    } catch (error) {

      alert(
        "Logout failed: " +
        error.message
      );

    }

  };


// ==========================================
// PASSWORD RESET
// ==========================================

window.resetPassword =
  async function () {

    const email =
      auth.currentUser?.email;

    if (!email) {

      alert(
        "Pehle login karo."
      );

      return;
    }


    try {

      await sendPasswordResetEmail(
        auth,
        email
      );

      alert(
        "✅ Password reset email bhej diya gaya hai."
      );

    } catch (error) {

      alert(
        "Password reset failed: " +
        error.message
      );

    }

  };


// ==========================================
// CHANGE PASSWORD
// ==========================================

window.changePassword =
  async function () {

    const newPassword =
      prompt(
        "Naya password daalein (minimum 6 characters):"
      );


    if (!newPassword) return;


    if (
      newPassword.length < 6
    ) {

      alert(
        "Password minimum 6 characters ka hona chahiye."
      );

      return;
    }


    try {

      await updatePassword(
        auth.currentUser,
        newPassword
      );

      alert(
        "✅ Password successfully changed."
      );

    } catch (error) {

      alert(
        "Password change failed.\n\n" +
        error.message
      );

    }

  };
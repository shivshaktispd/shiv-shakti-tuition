import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
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

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const showPassword = document.getElementById("showPassword");
const passwordInput = document.getElementById("loginPassword");
const rememberMe = document.getElementById("rememberMe");

// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

if (showPassword && passwordInput) {
  showPassword.addEventListener("click", () => {
    const iconSpan = showPassword.querySelector(".material-symbols-rounded");
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      if (iconSpan) iconSpan.textContent = "visibility_off";
    } else {
      passwordInput.type = "password";
      if (iconSpan) iconSpan.textContent = "visibility";
    }
  });
}

// ==========================================
// REMEMBER ME
// ==========================================

const savedRemember = localStorage.getItem("rememberMe");
if (rememberMe && savedRemember === "true") {
  rememberMe.checked = true;
}

// ==========================================
// LOGIN
// ==========================================

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    let loginId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!loginId || !password) {
      showMessage("Staff ID aur Password required hai.", "error");
      return;
    }

    if (!loginId.includes("@")) {
      loginId = loginId.toLowerCase() + "@shivshakti.com";
    }

    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `<span class="material-symbols-rounded spin-icon" style="font-size: 18px;">autorenew</span> Logging in...`;

      if (rememberMe?.checked) {
        await setPersistence(auth, browserLocalPersistence);
        localStorage.setItem("rememberMe", "true");
      } else {
        await setPersistence(auth, browserSessionPersistence);
        localStorage.removeItem("rememberMe");
      }

      const result = await signInWithEmailAndPassword(auth, loginId, password);
      const uid = result.user.uid;

      const staffRef = doc(db, "staff", uid);
      const staffSnap = await getDoc(staffRef);

      if (!staffSnap.exists()) {
        await auth.signOut();
        throw new Error("Staff profile nahi mila.");
      }

      const staff = staffSnap.data();
      window.currentUserName = staff.name || "";
      window.currentUserEmail = result.user.email || "";

      if (staff.status === "disabled") {
        await auth.signOut();
        throw new Error("Ye staff account disabled hai.");
      }

      const role = String(staff.role || "teacher").toLowerCase();

      sessionStorage.setItem("staffName", staff.name || "");
      sessionStorage.setItem("staffId", staff.staffId || "");
      sessionStorage.setItem("staffRole", role);

      if (rememberMe?.checked) {
        localStorage.setItem("staffName", staff.name || "");
        localStorage.setItem("staffId", staff.staffId || "");
        localStorage.setItem("staffRole", role);
      } else {
        localStorage.removeItem("staffName");
        localStorage.removeItem("staffId");
        localStorage.removeItem("staffRole");
      }

      showMessage(`Welcome ${staff.name || ""} 👋`, "success");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);

    } catch (error) {
      console.error("Login error:", error);
      let message = "Login failed.";

      if (error.code === "auth/invalid-credential") {
        message = "Staff ID ya Password galat hai.";
      } else if (error.code === "auth/user-disabled") {
        message = "Ye account disabled hai.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Bahut attempts ho gaye. Thodi der baad try karein.";
      } else if (error.message) {
        message = error.message;
      }

      showMessage(message, "error");

    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">lock_open</span> Login`;
    }
  });
}

// ==========================================
// MESSAGE
// ==========================================

function showMessage(message, type) {
  if (!loginMessage) return;
  loginMessage.textContent = message;
  loginMessage.className = type;
}

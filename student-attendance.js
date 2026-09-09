import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

const studentId =
  new URLSearchParams(location.search).get("studentId");

let current = new Date();
current.setDate(1);

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));

async function loadStudent(){

  if(!studentId){
    $("profile").innerHTML =
      "<b>Student not selected.</b>";
    return;
  }

  const snap =
    await getDoc(doc(db,"students",studentId));

  if(!snap.exists()){
    $("profile").innerHTML =
      "<b>Student not found.</b>";
    return;
  }

  const s = snap.data();

  $("profile").innerHTML = `
    <img
      class="photo"
      src="${esc(
        s.photoUrl ||
        "https://placehold.co/150x150?text=Student"
      )}"
      onerror="this.src='https://placehold.co/150x150?text=Student'"
    >

    <div>
      <div class="name">${esc(s.name)}</div>

      <div class="sub">
        Class: ${esc(s.className || s.class || "-")}
      </div>

      <div class="sub">
        Student Attendance
      </div>
    </div>
  `;
}

async function loadAttendance(){

  if(!studentId) return;

  $("monthLabel").textContent =
    current.toLocaleString("en-US",{
      month:"long",
      year:"numeric"
    });

  const wanted =
    current.getFullYear() +
    "-" +
    String(current.getMonth()+1).padStart(2,"0");

  const snaps =
    await getDocs(collection(db,"attendance"));

  const days = [];

  snaps.forEach(d => {

    const x = d.data();

    const date =
      x.date ||
      d.id.split("_")[0];

    if(!date || !date.startsWith(wanted))
      return;

    const records =
      Array.isArray(x.records)
        ? x.records
        : [];

    records.forEach(r => {

      if(r.studentId === studentId){

        days.push({
          date,
          status:r.status || "-",
          shift:r.shift || ""
        });

      }

    });

  });

  days.sort((a,b) =>
    a.date.localeCompare(b.date)
  );

  const counts = {
    P:0,
    A:0,
    L:0,
    H:0,
    S:0
  };

  days.forEach(x => {

    if(counts[x.status] !== undefined){
      counts[x.status]++;
    }

  });

  const denominator =
    counts.P +
    counts.A +
    counts.L +
    counts.S;

  const pct =
    denominator
      ? Math.round(
          counts.P / denominator * 100
        )
      : 0;

  $("summary").innerHTML = [

    ["P",counts.P,"Present"],

    ["A",counts.A,"Absent"],

    ["L",counts.L,"Leave"],

    ["%",pct+"%","Attendance"]

  ].map(x => `

    <div class="stat">

      <div class="num">
        ${x[1]}
      </div>

      <div class="label">
        ${x[2]}
      </div>

    </div>

  `).join("");

  if(!days.length){

    $("history").innerHTML =
      '<div class="empty">No attendance recorded for this month.</div>';

    return;
  }

  $("history").innerHTML =
    days.map(x => `

      <div class="row">

        <div>

          <div class="date">
            ${
              new Date(
                x.date+"T00:00:00"
              ).toLocaleDateString(
                "en-IN",
                {
                  day:"2-digit",
                  month:"short",
                  year:"numeric"
                }
              )
            }
          </div>

          ${
            x.shift
              ? `<small>${esc(x.shift)}</small>`
              : ""
          }

        </div>

        <span class="badge ${esc(x.status)}">
          ${esc(x.status)}
        </span>

      </div>

    `).join("");
}

$("prev").onclick = () => {

  current.setMonth(
    current.getMonth()-1
  );

  loadAttendance();
};

$("next").onclick = () => {

  current.setMonth(
    current.getMonth()+1
  );

  loadAttendance();
};

loadStudent();
loadAttendance();
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// src/App.js
import React, { useState, useEffect, useCallback} from "react";
import { jsPDF } from "jspdf";
import {autoTable} from "jspdf-autotable";
import { getFunctions, httpsCallable } from "firebase/functions";

import { collection, getDocs, onSnapshot,orderBy } from "firebase/firestore";// already imported, just make sure
import { db, auth } from "./firebase";
import {
  addDoc,
  query,
  where,
  updateDoc,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import "./App.css";
import PayrollCalculator from "./PayrollCalculator";



/* ---------------- helper: distance (meters) ---------------- */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}



const notify = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.cssText = `position: fixed; top: 18px; right: 18px; background: #2ecc71; color: #fff; padding: 10px 14px; border-radius: 6px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 9999;`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
};


/* ---------------- App ---------------- */
export default function App() {
  // Auth + role
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [roles, setRoles] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

 
  // common UI
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState("my-panel");
 
  // Employee management
  const [employees, setEmployees] = useState([]);
  const [editingEmp, setEditingEmp] = useState(null);
  const [editingLocationsEmpId, setEditingLocationsEmpId] = useState(null);

  // attendance / lists
 /*  const [clockedIn, setClockedIn] = useState(false); */
  const [attendance, setAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [overtimeReqs, setOvertimeReqs] = useState([]);
  const [allOvertime, setAllOvertime] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [selectedPayroll, setSelectedPayroll] = useState(null); 
  
  // P/O Report (Permission Out)
  const [poDate, setPoDate] = useState("");
  const [poFrom, setPoFrom] = useState("");
  const [poTo, setPoTo] = useState("");
  const [poList, setPoList] = useState([]);
  const [allPoList, setAllPoList] = useState([]);

  const [myPayslips, setMyPayslips] = useState([]);

  // leader scope
  const [leaderMembers, setLeaderMembers] = useState([]);
  const [leaderLeaves, setLeaderLeaves] = useState([]);
  const [leaderOvertime, setLeaderOvertime] = useState([]);
  const [leaderAttendance, setLeaderAttendance] = useState([]);    // attendance records for leader's members


  const [allPayroll, setAllPayroll] = useState([]);
  const [allPayslips, setAllPayslips] = useState([]);
  const [allPoReports, setAllPoReports] = useState([]);

 
  //12/18
 const functions = getFunctions();
 

  const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));


  const displayUser = (uid) =>
  usersMap[uid]?.name || usersMap[uid]?.email || uid;

  const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const hasRole = (r) => roles.includes(r) || role === r; // supports old users too
const isAdmin = hasRole("admin");
const isLeader = hasRole("leader");


// load members under a leader (users where leaderId == leader uid)
const loadLeaderMembers = async (leaderUid) => {
  const q = query(collection(db, "users"), where("leaderId", "==", leaderUid));
  const snap = await getDocs(q);
  const ids = snap.docs.map((d) => d.id); // member UIDs
  setLeaderMembers(ids);
  return ids;
};

const loadLeaderLeaves = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) {
    setLeaderLeaves([]);
    return;
  }
  let results = [];
  for (const batch of chunk(memberIds, 10)) {
    const q = query(collection(db, "leaves"), where("userId", "in", batch));
    const snap = await getDocs(q);
    results = results.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // ✅ sort newest first
  results.sort((a, b) => {
  if (a.status === "pending" && b.status !== "pending") return -1;
  if (a.status !== "pending" && b.status === "pending") return 1;
  return new Date(b.startDate) - new Date(a.startDate);
});

  setLeaderLeaves(results);
};

const loadLeaderOvertime = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) {
    setLeaderOvertime([]);
    return;
  }
  let results = [];
  for (const batch of chunk(memberIds, 10)) {
    const q = query(collection(db, "overtimeRequests"), where("userId", "in", batch));
    const snap = await getDocs(q);
    results = results.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // ✅ sort newest first
 results.sort((a, b) => {
  if (a.status === "pending" && b.status !== "pending") return -1;
  if (a.status !== "pending" && b.status === "pending") return 1;
  return new Date(b.date) - new Date(a.date);
});

  setLeaderOvertime(results);
};

const loadLeaderAttendance = async (memberIds) => {
  if (!memberIds || memberIds.length === 0) {
    setLeaderAttendance([]);
    return;
  }
  let results = [];
  for (const batch of chunk(memberIds, 10)) {
    const q = query(collection(db, "attendance"), where("userId", "in", batch));
    const snap = await getDocs(q);
    results = results.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // ✅ sort newest first
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  setLeaderAttendance(results);
};





  
  // Admin: remember each staff's selected leave type
  const [leaveSelections, setLeaveSelections] = useState(() => {
    // Load from localStorage when page opens
    const stored = localStorage.getItem("leaveSelections");
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
  localStorage.setItem("leaveSelections", JSON.stringify(leaveSelections));
}, [leaveSelections]);


  // forms
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveType, setLeaveType] = useState("Full Day");
  const [leaveName, setLeaveName] = useState("Casual Leave");
  const [leaveReason, setLeaveReason] = useState("");
  const [otDate, setOtDate] = useState("");
  const [otStart, setOtStart] = useState("");
  const [otEnd, setOtEnd] = useState("");
  const [otReason, setOtReason] = useState("");

  // location / geo-fence
  const [withinRange, setWithinRange] = useState(false);
  const [userSavedLocation, setUserSavedLocation] = useState(null);

  // helper: time
  // Show only time in Myanmar timezone (no date)
  const toMyanmarTime = (utcString) =>
    utcString
      ? new Date(utcString).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Yangon",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

  // Returns today's date in YYYY-MM-DD format (Yangon time)
  const getTodayDateYangon = () => {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Yangon" })
    );
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ---------------- New helper: Check distance to multiple locations ----------------
  const isWithinRangeOfAny = (currentLat, currentLon, locations, range = 1000) => {
    if (!locations || locations.length === 0) return false;
    for (let loc of locations) {
      const d = getDistanceInMeters(currentLat, currentLon, loc.latitude, loc.longitude);
      if (d <= range) return loc.name;
    }
    return false;
  };

  const getMyanmarTimeString = (date = new Date()) =>
  date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Yangon",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });


  /* ---------------- login / logout ---------------- */
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      setUser(cred.user);
      // load user doc
      const ud = await getDoc(doc(db, "users", uid));
      if (!ud.exists()) {
        notify("User record not found in Firestore (users collection)");
        return;
      }
      const data = ud.data();
      /* setRole(data.role); */
      setRole(data.role || ""); // keep old
     
      setRole(data.role || "");
      const rolesArr = data.roles || (data.role ? [data.role] : []);
      setRoles(rolesArr);

      const has = (r) => rolesArr.includes(r) || data.role === r;

      setName(data.name || "");
      setMessage(`Welcome ${data.name || cred.user.email} (${data.role})`);
      // load personal lists
      await loadAttendance(uid);
      await loadLeaves(uid);
      await loadOvertime(uid);
      loadPoReports(uid);
      await loadMyPayslips(uid); 

     /*  if (data.role === "admin") loadAllPoReports(); */
      // load saved location (if any)
      if (data.location) setUserSavedLocation(data.location);
      // leader login
     if (has("leader")) {
        await loadAllUsers();
        const ids = await loadLeaderMembers(uid);
        await loadLeaderLeaves(ids);
        await loadLeaderOvertime(ids);
        await loadLeaderAttendance(ids);
      }
      // if admin, load management lists
     
      if (has("admin")) {
        await loadAllUsers();
        await loadAllAttendance();
        await loadAllLeaves();
        await loadAllOvertime();
             
        await loadAllPayroll();
        await loadAllPayslips();
        await loadAllPoReports();

      }

      
    } catch (err) {
      notify("Login failed: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setRole("");
    setName("");
    setEmail("");
    setPassword("");
    setMessage("");
    // clear state
    setAttendance([]);
    setLeaves([]);
    setOvertimeReqs([]);
    setAllAttendance([]);
    setAllLeaves([]);
    setAllOvertime([]);
    setUsersMap({});
  };


  //Calculate Payroll and summary
  const loadAllPayroll = async () => {
  try {
    const snap = await getDocs(collection(db, "payrollSummary"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // ✅ safe sort: handles missing createdAt
    list.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });

    setAllPayroll(list);
  } catch (err) {
    console.error("❌ loadAllPayroll failed:", err);
    notify("❌ Payroll Summary cannot load: " + err.message);
  }
};


useEffect(() => {
  if (isAdmin && activeSidebar === "admin-payroll-summary") {
    loadAllPayroll();
  }
}, [activeSidebar, isAdmin]);


 // loadMyPayslips

 const loadMyPayslips = useCallback(async (uid = user?.uid) => {
  
  try {
    if (!uid) return;

    const q = query(
      collection(db, "payslips"),
      where("userId", "==", uid)
    );

    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return db - da;
    });

    setMyPayslips(list);
  } catch (err) {
    console.error("❌ loadMyPayslips failed:", err);
    notify("❌ My Payslips cannot load: " + err.message);
  }
}, [user?.uid]);

useEffect(() => {
  if (user && activeSidebar === "my-payslip") {
    loadMyPayslips(user.uid);
  }
},  [activeSidebar, user, loadMyPayslips]);
 


  // PaySlip  Admin
  const exportPayslip = (p) => {
  const doc = new jsPDF("p", "mm", "a4");
  doc.setFontSize(16);
  doc.text("Simple 'Z Co.Ltd.", 105, 12, { align: "center" });

  doc.setFontSize(12);
  doc.text("Payslip", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Name: ${p.name || ""}`, 14, 30);
  doc.text(`Team: ${p.staffteam || ""}`, 14, 36);
  doc.text(`Position: ${p.staffposition || ""}`, 14, 42);
  doc.text(`Date: ${p.createdAt?.slice(0,10)}`, 150, 30);
  doc.text(`For The Month of: ${p.paymonth.slice(0,10)}`, 150, 35);

  // Days Table
  autoTable(doc, {
  startY: 55,
  head: [["Days", "Amount (MMK)"]],
  body: [
  [ "Working Days", p.standardDays?.toLocaleString() || 0],
  [ "Attendance Days", p.workedDays?.toLocaleString() || 0],
  [ "Working Hour", p.actualHours?.toLocaleString() || 0],
  ],
  theme: "striped",
  styles: {
  fontSize: 9,
  },
  columnStyles: {
  0: { halign: "left",minCellWidth:50 },
  1: { halign: "left" }, // Right-align second column (Amount)
  },
  headStyles: {
  fillColor: [14, 165, 233], // same blue as your screenshot
  textColor: [255, 255, 255],
  halign: "left",
  },

  });


  // Leaves Table
  autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 10,
  head: [["Leave", "Amount (MMK)"]],
  body: [
  [ "Annual Leave", p.annualLeave?.toLocaleString() || 0],
  [ "Casual Leave", p.casualLeave?.toLocaleString() || 0],
  [ "Abesent Days", p.absentDays?.toLocaleString() || 0],
  [ "Medical Leave", p.sickLeave?.toLocaleString() || 0],
  [ "Holiday work days", p.holidayWorkDays?.toLocaleString() || 0],
  [ "Total Holiday days", p.holidayDays?.toLocaleString() || 0],
  ],
  theme: "striped",
  styles: {
  fontSize: 9,
  },
  columnStyles: {
  0: { halign: "left",minCellWidth:50 },
  1: { halign: "left" }, // Right-align second column (Amount)
  },
  headStyles: {
  fillColor: [14, 165, 233], // same blue as your screenshot
  textColor: [255, 255, 255],
  halign: "left",
  },

  });

  // Salary Table
  autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 10,
  head: [["Salary", "Amount (MMK)"]],
  body: [
  [ "Basic Salary (Latest)", p.basicLatest?.toLocaleString() || 0],
  [ "Job Title Allowance", p.jobAllowance?.toLocaleString() || 0],
  [ "Language Allowance (JLPT)", p.languageAllowance?.toLocaleString() || 0],
  [ "Fixed Overtime", p.fixedOvertime?.toLocaleString() || 0],
  [ "Work from Home", p.wfhAllowance?.toLocaleString() || 0],
  [ "Net payment Amount", p.salaryTransfer?.toLocaleString() || 0],
  ],
  theme: "striped",
  styles: {
  fontSize: 9,
  },
  columnStyles: {
  0: { halign: "left",minCellWidth:50 },
  1: { halign: "left" }, // Right-align second column (Amount)
  },
  headStyles: {
  fillColor: [14, 165, 233], // same blue as your screenshot
  textColor: [255, 255, 255],
  halign: "left",
  },

  });

  // Deductions
  autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 10,
  head: [["Deductions", "Amount (MMK)"]],
  body: [
  ["Absence Deduction", p.absenceDeduction?.toLocaleString() || 0],
  ["Late Deduction", p.lateDeduction?.toLocaleString() || 0],
  ["SSB", p.ssb?.toLocaleString() || 0],
  ["Income Tax", p.incomeTax?.toLocaleString() || 0],
  ],
  theme: "striped",
  styles: {
  fontSize: 9,
  },
  columnStyles: {
  0: { halign: "left",minCellWidth:50 },
  1: { halign: "left" }, // Right-align second column (Amount)
  },
  headStyles: {
  fillColor: [14, 165, 233], // same blue as your screenshot
  textColor: [255, 255, 255],
  halign: "left",
  },

  });

  // Net Pay
  autoTable(doc, {
  startY: doc.lastAutoTable.finalY + 10,
  head: [["Special payment Amount", "Amount"]],
  body: [
  ["Rate", p.cbRate?.toLocaleString() || 0],
  ["Preferential Rate Total", p.preferentialTotal?.toLocaleString() || 0],
  ],
  theme: "striped",
  styles: {
  fontSize: 9,
  },
  columnStyles: {
  0: { halign: "left",minCellWidth:35 },
  1: { halign: "left" }, // Right-align second column (Amount)
  },
  headStyles: {
  fillColor: [14, 165, 233], // same blue as your screenshot
  textColor: [255, 255, 255],
  halign: "left",
  },

  });

  doc.text("Payment Date: " + (p.createdAt?.slice(0,10) || ""), 14, doc.lastAutoTable.finalY + 20);
  doc.text("Signature: ____________________", 150, doc.lastAutoTable.finalY + 20);

  doc.save(`${p.name || "payslip"}.pdf`);
  };


  //Sendpayslip admin

const sendPayslip = async (p) => {
  if (!p.userId) return notify("User ID missing");

  await addDoc(collection(db, "payslips"), {
  userId: p.userId,
  payrollData: p, // 🔑 store full payroll
  paymonth: p.paymonth,
  status: "sent",
  createdAt: new Date().toISOString()
});

  notify(`Payslip sent to ${p.name}`);
};


  /* ---------------- data loaders ---------------- */
  
  // Load all employees

/*   const loadEmployees = async () => {
  try {
    if (!auth.currentUser) return;       // ✅ STOP after logout
    const snap = await getDocs(collection(db, "users"));
    setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("loadEmployees error:", err);
  }
}; */

const loadEmployees = async () => {
  try {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "users"),
      orderBy("eid", "asc") // 👈 sort by employee ID
    );

    const snap = await getDocs(q);
    setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("loadEmployees error:", err);
  }
};


  // Delete employee
    const deleteEmployee = async (id) => {
      if (!window.confirm("Delete this employee?")) return;
      await deleteDoc(doc(db, "users", id));
      notify("🗑 Employee deleted");
      loadEmployees();
    };

    useEffect(() => {
    if (isAdmin) loadEmployees();
  }, [role]);


  const updateEmployee = async () => {
  if (!editingEmp || !editingEmp.id) return notify("No employee selected.");

  const payload = stripUndefined({
    eid:editingEmp.eid ?? "",
    name: editingEmp.name ?? "",
    email: editingEmp.email ?? "",
    role: editingEmp.role ?? "staff",
    team: editingEmp.team ?? "",                 // ✅ never undefined
    position: editingEmp.position ?? "",
    languageLevel: editingEmp.languageLevel ?? "",
    joinDate: editingEmp.joinDate ?? "",
    leaderId: editingEmp.leaderId ?? "",         // optional
    roles: editingEmp.roles,                     // keep if you use array roles
    updatedAt: new Date().toISOString(),
  });

  await updateDoc(doc(db, "users", editingEmp.id), payload);

  notify("✅ Employee updated successfully");
  setEditingEmp(null);
  loadEmployees();
  loadAllUsers();
};


  
  const loadAttendance = async (uid) => {
    const q = query(collection(db, "attendance"), where("userId", "==", uid));
    const snap = await getDocs(q);

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date) - new Date(a.date)); // ✅ newest first
    setAttendance(list);
  };

  const loadLeaves = async (uid) => {
    const q = query(collection(db, "leaves"), where("userId", "==", uid));
    const snap = await getDocs(q);
    
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));// ✅ newest first
    setLeaves(list);
  };

  const loadOvertime = async (uid) => {
    const q = query(collection(db, "overtimeRequests"), where("userId", "==", uid));
    const snap = await getDocs(q);
  
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date) - new Date(a.date)); // ✅ newest first
    setOvertimeReqs(list);
  };

  const loadAllPayslips = async () => {
  const snap = await getDocs(collection(db, "payslips"));
  setAllPayslips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

  //12/18
  const loadAllUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data();

      // ✅ KEY FIX: prefer authUid if stored
      const key = d.authUid || docSnap.id;

      map[key] = { id: key, ...d };
    });
    setUsersMap(map);
  };

/*   const loadAllAttendance = async () => {
    const snap = await getDocs(collection(db, "attendance"));
    setAllAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }; */

  const loadAllAttendance = async () => {
  const snap = await getDocs(collection(db, "attendance"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  setAllAttendance(list);
};

 const loadAllLeaves = async () => {
    const snap = await getDocs(collection(db, "leaves"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));// ✅ newest first
    setAllLeaves(list);
  };

  const loadAllOvertime = async () => {
    const snap = await getDocs(collection(db, "overtimeRequests"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date) - new Date(a.date)); // ✅ newest first
    setAllOvertime(list);
  };

  // Calculate duration in hours and minutes
  const calcPoDuration = (from, to) => {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const totalMin = th * 60 + tm - (fh * 60 + fm);
  if (totalMin <= 0) return "Invalid";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h > 0 ? `${h}hr ` : ""}${m}min`;
};

// Add new P/O record
const addPoReport = async () => {
  if (!poDate || !poFrom || !poTo) return notify("Please fill all P/O fields.");
  const totalTimeByHour = calcPoDuration(poFrom, poTo);
  if (totalTimeByHour === "Invalid") return notify("Invalid time range.");
  await addDoc(collection(db, "poReports"), {
    userId: user.uid,
    date: poDate,
    fromTime: poFrom,
    toTime: poTo,
    totalTimeByHour,
    createdAt: new Date().toISOString(),
  });
  notify("✅ P/O report added.");
  setPoDate(""); setPoFrom(""); setPoTo("");
  loadPoReports(user.uid);
};

// Load user’s P/O reports
const loadPoReports = async (uid) => {
  const q = query(collection(db, "poReports"), where("userId", "==", uid));
  const snap = await getDocs(q);
 /*  setPoList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); */
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    setPoList(list);
};


// Load all P/O reports (for admin)
const loadAllPoReports = async () => {
  const snap = await getDocs(collection(db, "poReports"));
  /* setAllPoList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); */
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  setAllPoList(list);
};


/* ---------------- geo-fence checking (safe) ---------------- */
const checkLocationRange = async () => {
  if (!user) return setWithinRange(false);
  try {
    const ud = await getDoc(doc(db, "users", user.uid));
    const saved = ud.exists() ? ud.data().location : null;
    setUserSavedLocation(saved || null);
    if (!saved) return setWithinRange(false);

    if (!navigator.geolocation) return setWithinRange(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceInMeters(
          latitude,
          longitude,
          saved.latitude,
          saved.longitude
        );
        console.log("Distance from saved location:", dist, "m");
        setWithinRange(dist <= 100);
      },
      (err) => {
        console.error("Geo check error", err);
        setWithinRange(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } catch (err) {
    console.error("checkLocationRange error", err);
    setWithinRange(false);
  }
};

  // run periodic check when user is staff (or admin acting as staff)
  useEffect(() => {
    if (user && (role === "staff" || isAdmin)) {

      checkLocationRange();
      const id = setInterval(checkLocationRange, 60000); // every 60s
      return () => clearInterval(id);
    }
    // if admin logged and viewing personal panel, we still allow manual checks via saveMyLocation and click
  }, [user, role]);


  /* ---------------- clock in / out (100m rule enforced) ---------------- */
 // ---------------- Clock In / Out ----------------
   const clockIn = async () => {
     if (!user) return notify("Login required");
     const ud = await getDoc(doc(db, "users", user.uid));
     const locations = ud.exists() ? ud.data().locations : [];
     if (!locations || locations.length === 0) return notify("No saved locations. Ask admin to add them.");
 
     if (!navigator.geolocation) return notify("Geolocation not supported.");
     navigator.geolocation.getCurrentPosition(async (pos) => {
       const { latitude, longitude } = pos.coords;
       const matchedName = isWithinRangeOfAny(latitude, longitude, locations);
       if (!matchedName) return notify("🚫 Too far from any registered location.");
 
       const today = getTodayDateYangon();
       const q = query(collection(db, "attendance"), where("userId", "==", user.uid), where("date", "==", today));
       const snap = await getDocs(q);
       if (!snap.empty) return notify("⚠️ Already clocked in today.");
 
       await addDoc(collection(db, "attendance"), {
        userId: user.uid,
        date: today,
        clockIn: new Date().toISOString(),          // ✅ UTC ISO
        clockInTime: getMyanmarTimeString(),        // ✅ readable Myanmar time
        locationName: matchedName,
         locationIn: { latitude, longitude },
       });

      /*  setClockedIn(true); */
       notify(`✅ Clock In recorded at ${matchedName}`);
       loadAttendance(user.uid);
       if (isAdmin) loadAllAttendance();
     }, (err) => notify("Unable to get location: " + err.message));
   };
 
   const clockOut = async () => {
     if (!user) return notify("Login required");
     const ud = await getDoc(doc(db, "users", user.uid));
     const locations = ud.exists() ? ud.data().locations : [];
     if (!locations || locations.length === 0) return notify("No saved locations. Ask admin to add them.");
 
     if (!navigator.geolocation) return notify("Geolocation not supported.");
     navigator.geolocation.getCurrentPosition(async (pos) => {
       const { latitude, longitude } = pos.coords;
       const matchedName = isWithinRangeOfAny(latitude, longitude, locations);
       if (!matchedName) return notify("🚫 Too far from any registered location.");
 
       const today = getTodayDateYangon();
       const q = query(collection(db, "attendance"), where("userId", "==", user.uid), where("date", "==", today));
       const snap = await getDocs(q);
       if (snap.empty) return notify("⚠️ You haven't clocked in today.");
       const attDoc = snap.docs[0];
       await updateDoc(doc(db, "attendance", attDoc.id), {
        clockOut: new Date().toISOString(),
        clockOutTime: getMyanmarTimeString(),
        locationName: matchedName,
        locationOut: { latitude, longitude },
      });

      /*  setClockedIn(false); */
       notify(`✅ Clock Out recorded at ${matchedName}`);
       loadAttendance(user.uid);
       if (isAdmin) loadAllAttendance();
     }, (err) => notify("Unable to get location: " + err.message));
   };


  // attendance edit by admin
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  const makeISOFromDateAndTimeYangon = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Yangon" })).toISOString();
};

const adminUpdateAttendanceTime = async () => {
  if (!editingAttendance) return;

  try {
    const clockInISO = editClockIn
      ? makeISOFromDateAndTimeYangon(editingAttendance.date, editClockIn)
      : null;

    const clockOutISO = editClockOut
      ? makeISOFromDateAndTimeYangon(editingAttendance.date, editClockOut)
      : null;

    await updateDoc(doc(db, "attendance", editingAttendance.id), {
      clockIn: clockInISO,
      clockInTime: editClockIn || null,
      clockOut: clockOutISO,
      clockOutTime: editClockOut || null,
      editedByAdmin: true,
      editedAt: new Date().toISOString(),
   });


    notify("✅ Attendance updated manually");
    setEditingAttendance(null);
    setEditClockIn("");
    setEditClockOut("");

    loadAllAttendance();
  } catch (err) {
    console.error(err);
    notify("❌ Cannot update attendance: " + err.message);
  }
};

// attendance edit by leader
const [editingLeaderAttendance, setEditingLeaderAttendance] = useState(null);
const [leaderEditIn, setLeaderEditIn] = useState("");
const [leaderEditOut, setLeaderEditOut] = useState("");

const leaderUpdateAttendanceTime = async () => {
  if (!editingLeaderAttendance) return;

  try {
    const clockInISO = leaderEditIn
      ? makeISOFromDateAndTimeYangon(editingLeaderAttendance.date, leaderEditIn)
      : null;

    const clockOutISO = leaderEditOut
      ? makeISOFromDateAndTimeYangon(editingLeaderAttendance.date, leaderEditOut)
      : null;

    /* await updateDoc(doc(db, "attendance", editingLeaderAttendance.id), {
      clockIn: clockInISO,
      clockInTime: leaderEditIn || null,
      clockOut: clockOutISO,
      clockOutTime: leaderEditOut || null,
      editedByLeader: user.uid,
      editedAt: new Date().toISOString(),
    });

    notify("✅ Attendance updated by Leader");
    setEditingLeaderAttendance(null);
    setLeaderEditIn("");
    setLeaderEditOut(""); */

    await updateDoc(doc(db, "attendance", editingLeaderAttendance.id), {
      clockIn: clockInISO,
      clockInTime: leaderEditIn || null,
      clockOut: clockOutISO,
      clockOutTime: leaderEditOut || null,
      editedByLeader: user.uid,
      editedAt: new Date().toISOString(),
    });

    notify("✅ Attendance updated by Leader");

    // ✅ Update local list instead of reload
    setLeaderAttendance(prev =>
      prev.map(item =>
        item.id === editingLeaderAttendance.id
          ? {
              ...item,
              clockIn: clockInISO,
              clockInTime: leaderEditIn || null,
              clockOut: clockOutISO,
              clockOutTime: leaderEditOut || null,
              editedByLeader: user.uid,
              editedAt: new Date().toISOString(),
            }
          : item
      )
    );

    setEditingLeaderAttendance(null);
    setLeaderEditIn("");
    setLeaderEditOut("");


    //loadLeaderAttendance(); // reload leader list
  } catch (err) {
    console.error(err);
    notify("❌ Cannot update attendance: " + err.message);
  }
};

//leave edit by admin
  const [leaveBalances, setLeaveBalances] = useState({});
  const currentYear = new Date().getFullYear();

  const leaveTypes = ["Annual Leave", "Casual Leave", "Medical Leave"];
  const [selectedLeaveTypeByUser, setSelectedLeaveTypeByUser] = useState({});

  const getBalanceValue = (uid, type, field) => {
    return leaveBalances?.[uid]?.balances?.[type]?.[field] ?? 0;
  };

  const getBal = (uid, type, field) =>
  leaveBalances?.[uid]?.balances?.[type]?.[field] ?? 0;


  const loadLeaveBalances = async (year = currentYear) => {
    const snap = await getDocs(
      query(collection(db, "leaveBalances"), where("year", "==", year))
    );

    const map = {};
    snap.forEach(d => {
      map[d.data().userId] = d.data();
    });

    setLeaveBalances(map);
  };

    useEffect(() => {
    if (isAdmin && activeSidebar === "admin-leave-balance") {
      loadLeaveBalances();
    }
  }, [activeSidebar]);

  
  const summaryLeaveTypes = ["Casual Leave", "Annual Leave", "Medical Leave","Unpaid Leave", "Maternity Leave",];
  const saveLeaveBalance = async (uid) => {
    const data = leaveBalances[uid];
    if (!data) return;

    await setDoc(
      doc(db, "leaveBalances", `${uid}_${currentYear}`),
      {
        userId: uid,
        year: currentYear,
        balances: data.balances,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    notify("✅ Leave balance saved");
  };


  useEffect(() => {
  if (!user) return;

  // listen to MY leave balance doc in realtime
  const ref = doc(db, "leaveBalances", `${user.uid}_${currentYear}`);

  const unsub = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();

      // merge into leaveBalances map
      setLeaveBalances((prev) => ({
        ...prev,
        [user.uid]: data,
      }));
    } else {
      // if no doc yet, clear my entry (optional)
      setLeaveBalances((prev) => {
        const copy = { ...prev };
        delete copy[user.uid];
        return copy;
      });
    }
  });

  return () => unsub();
}, [user?.uid, currentYear]);



 
   // ---------------- Admin: Save Two Locations ----------------
   const saveEmployeeLocations = async (emp) => {
     if (!emp.locations || emp.locations.length !== 2) return notify("Please fill both locations.");
     await updateDoc(doc(db, "users", emp.id), { locations: emp.locations });
     notify("✅ Locations saved successfully.");
     loadAllUsers();
   };

  /* ---------------- leave & overtime (staff) ---------------- */
  const applyLeave = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason) return notify("Please fill leave start, end and reason.");
    await addDoc(collection(db, "leaves"), {
      userId: user.uid,
      startDate: leaveStart,
      endDate: leaveEnd,
      leaveType,
      leaveName,
      reason: leaveReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    notify("✅ Leave request submitted.");
    loadLeaves(user.uid);
    if (isAdmin) loadAllLeaves();
  };

  const requestOvertime = async () => {
    if (!otDate || !otStart || !otEnd || !otReason) return notify("Please fill overtime fields.");
    // calc duration simple
    const [sh, sm] = otStart.split(":").map(Number);
    const [eh, em] = otEnd.split(":").map(Number);
    const totalMins = eh * 60 + em - (sh * 60 + sm);
    if (totalMins <= 0) return notify("Invalid OT time range.");
    const totalTime = `${Math.floor(totalMins/60)}h ${totalMins%60}m`;
    await addDoc(collection(db, "overtimeRequests"), {
      userId: user.uid,
      date: otDate,
      startTime: otStart,
      endTime: otEnd,
      totalTime,
      reason: otReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setOtDate(""); setOtStart(""); setOtEnd(""); setOtReason("");
    notify("✅ Overtime request submitted.");
    loadOvertime(user.uid);
    if (isAdmin) loadAllOvertime();
  };

  const updateLeaveStatus = async (id, status) => {
    await updateDoc(doc(db, "leaves", id), { status });
    notify(`Leave ${status}`);
    loadAllLeaves();
  };

  const updateOvertimeStatus = async (id, status) => {
    await updateDoc(doc(db, "overtimeRequests", id), { status });
    notify(`Overtime ${status}`);
    loadAllOvertime();
  };

  const leaderUpdateLeaveStatus = async (leaveDocId, status, memberUserId) => {
  if (!leaderMembers.includes(memberUserId)) {
    return notify("🚫 You cannot approve non-member leave.");
  }
  await updateLeaveStatus(leaveDocId, status);
  // refresh leader list only
  await loadLeaderLeaves(leaderMembers);
};

  const leaderUpdateOvertimeStatus = async (otDocId, status, memberUserId) => {
    if (!leaderMembers.includes(memberUserId)) {
      return notify("🚫 You cannot approve non-member overtime.");
    }
    await updateOvertimeStatus(otDocId, status);
    await loadLeaderOvertime(leaderMembers);
  };

/* leave request edit by Staff */
const [editingMyLeave, setEditingMyLeave] = useState(null);
const [myEditStart, setMyEditStart] = useState("");
const [myEditEnd, setMyEditEnd] = useState("");
const [myEditType, setMyEditType] = useState("Full Day");
const [myEditLeaveName, setMyEditLeaveName] = useState("Casual");
const [myEditReason, setMyEditReason] = useState("");

const openLeaveEditModal = (lv) => {
  setEditingMyLeave(lv);
  setMyEditStart(lv.startDate);
  setMyEditEnd(lv.endDate);
  setMyEditType(lv.leaveType || "Full Day");
  setMyEditLeaveName(lv.leaveName || "Casual");
  setMyEditReason(lv.reason || "");
};

const saveMyLeaveEdit = async () => {
  if (!editingMyLeave) return;

  try {
    await updateDoc(doc(db, "leaves", editingMyLeave.id), {
      startDate: myEditStart,
      endDate: myEditEnd,
      leaveType: myEditType,
      leaveName: myEditLeaveName,
      reason: myEditReason,
      editedByUser: user.uid,
      editedAt: new Date().toISOString(),
    });

    notify("✅ Leave request updated!");
    setEditingMyLeave(null);

    loadLeaves(user.uid); // reload my leave list
    if (isAdmin) loadAllLeaves(); // refresh admin if admin user
  } catch (err) {
    console.error(err);
    notify("❌ Update failed: " + err.message);
  }
};



/* leave request edit by Admin */
  const [editingLeave, setEditingLeave] = useState(null);
  const [editLeaveStart, setEditLeaveStart] = useState("");
  const [editLeaveEnd, setEditLeaveEnd] = useState("");
  const [editLeaveType, setEditLeaveType] = useState("Full Day");
  const [editLeaveName, setEditLeaveName] = useState("Casual");
  const [editLeaveReason, setEditLeaveReason] = useState("");

  const adminSaveLeaveEdit = async () => {
  if (!editingLeave) return;

  try {
    await updateDoc(doc(db, "leaves", editingLeave.id), {
      startDate: editLeaveStart,
      endDate: editLeaveEnd,
      leaveType: editLeaveType,
      leaveName:editLeaveName,
      reason: editLeaveReason,
      editedByAdmin: user.uid,
      editedAt: new Date().toISOString(),
    });

    notify("✅ Leave request updated successfully!");
    setEditingLeave(null);

    loadAllLeaves(); // refresh
  } catch (err) {
    console.error(err);
    notify("❌ Update failed: " + err.message);
  }
};




  /* ---------------- summary / csv / clear ---------------- */
  const getMonthlySummary = () => {
    const sum = {};
    allAttendance.forEach((a) => {
      sum[a.userId] = sum[a.userId] || { attend: 0, leave: 0, overtime: 0 };
      sum[a.userId].attend++;
    });
    allLeaves.filter(l => l.status === "approved").forEach((l) => {
      sum[l.userId] = sum[l.userId] || { attend: 0, leave: 0, overtime: 0 };
      sum[l.userId].leave++;
    });
    allOvertime.filter(o => o.status === "approved").forEach((o) => {
      sum[o.userId] = sum[o.userId] || { attend: 0, leave: 0, overtime: 0 };
      sum[o.userId].overtime++;
    });
    return sum;
  };

  const summary = getMonthlySummary();

  const exportCSV = () => {
  const rows = [["User", "Date", "Type", "Details"]];

  // ✅ helper to get user label
  const getUserName = (uid) => {
    const u = usersMap[uid];
    return u?.name || u?.email || uid;
  };

  // ✅ Attendance
  allAttendance.forEach((a) => {
    rows.push([
      getUserName(a.userId),
      a.date,
      "Attendance",
      `${a.clockIn ? toMyanmarTime(a.clockIn) : "-"} - ${a.clockOut ? toMyanmarTime(a.clockOut) : "-"}`
    ]);
  });

  // ✅ Leaves
  allLeaves.forEach((l) => {
    rows.push([
      getUserName(l.userId),
     `${l.startDate} to ${l.endDate}`,
      "Leave",
      `${l.leaveType || ""} -${l.leaveName || ""} - ${l.reason} (${l.status})`
    ]);
  });

  // ✅ Overtime
  allOvertime.forEach((o) => {
    rows.push([
      getUserName(o.userId),
      o.date,
      "Overtime",
      `${o.startTime || ""} - ${o.endTime || ""} | ${o.totalTime || ""} (${o.status})`
    ]);
  });

  // ✅ Payroll Summary (admin only)
  allPayroll.forEach((p) => {
    rows.push([
      getUserName(p.userId),
      p.month || p.period || "-",
      "PayrollSummary",
      `Basic:${p.basicSalary || 0}, OT:${p.overtimePay || 0}, Total:${p.preferentialTotal || 0}`
    ]);
  });

  // ✅ Payslips (admin + staff)
  allPayslips.forEach((ps) => {
    rows.push([
      getUserName(ps.userId),
      ps.month || ps.period || "-",
      "Payslip",
      `Status:${ps.status || "sent"}, Created:${ps.createdAt || ""}`
    ]);
  });

  // ✅ PO Reports
  allPoReports.forEach((r) => {
    rows.push([
      getUserName(r.userId),
      r.month || r.date || "-",
      "POReport",
      `Project:${r.projectName || ""}, Amount:${r.amount || 0}, Remark:${r.remark || ""}`
    ]);
  });

  // ✅ Convert rows to CSV with escaping
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `full_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  notify("✅ CSV exported successfully!");
};


 const clearAllData = async () => {
  if (
    !window.confirm(
      "⚠️ This will RESET Attendance, Leaves, Overtime, PO Reports, Payroll Summary, and Payslips.\nUsers will NOT be deleted.\n\nContinue?"
    )
  )
    return;

  const collectionsToClear = [
    "attendance",
    "leaves",
    "overtimeRequests",
    "poReports",
    "payrollSummary",
    "payslips", // optional but recommended
  ];

  let totalDeleted = 0;

  try {
    for (const name of collectionsToClear) {
      const snap = await getDocs(collection(db, name));

      for (const docSnap of snap.docs) {
        await deleteDoc(docSnap.ref);
        totalDeleted++;
      }

      console.log(`🗑️ Cleared ${snap.docs.length} docs from ${name}`);
    }

    notify(`✅ Reset complete. Deleted ${totalDeleted} records.`);

    // ✅ Reset local state lists too
    setAllAttendance([]);
    setAllLeaves([]);
    setAllOvertime([]);
    setAllPoReports([]);
    setAllPayroll([]);
    setAllPayslips([]);

    // ✅ Reload admin lists again (optional)
    loadAllAttendance();
    loadAllLeaves();
    loadAllOvertime();
    loadAllPoReports();
    loadAllPayroll();
    loadAllPayslips();
  } catch (err) {
    console.error("❌ ClearAllData error:", err);
    notify("❌ Failed to reset data: " + err.message);
  }
};
  
  const backupAndClear = async (mode) => {
    exportCSV();
    if (mode === "all") await clearAllData();
   
  };

  const clearMonthData = async (month) => {
  if (
    !window.confirm(
      `⚠️ Reset all records for ${month}?\nThis will delete Attendance, Leaves, OT, PO Reports, Payroll Summary, Payslips for that month only.\nUsers will remain.\n\nContinue?`
    )
  ) return;

  const collections = [
    { name: "attendance", field: "date" },         // "DD/MM/YYYY" or "YYYY-MM-DD"
    { name: "leaves", field: "startDate" },
    { name: "overtimeRequests", field: "date" },
    { name: "poReports", field: "date" },
    { name: "payrollSummary", field: "month" },    // "YYYY-MM"
    { name: "payslips", field: "month" }           // "YYYY-MM"
  ];

  let totalDeleted = 0;

  try {
    for (const col of collections) {
      const snap = await getDocs(collection(db, col.name));

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const value = data[col.field];

        // ✅ Convert to month format YYYY-MM
        let recordMonth = "";

        if (!value) continue;

        // Case 1: already YYYY-MM
        if (value.length === 7 && value.includes("-")) {
          recordMonth = value;
        }
        // Case 2: YYYY-MM-DD
        else if (value.length >= 10 && value.includes("-")) {
          recordMonth = value.slice(0, 7);
        }
        // Case 3: DD/MM/YYYY
        else if (value.includes("/")) {
          const parts = value.split("/");
          if (parts.length === 3) {
            recordMonth = `${parts[2]}-${parts[1]}`;
          }
        }

        if (recordMonth === month) {
          await deleteDoc(docSnap.ref);
          totalDeleted++;
        }
      }

      console.log(`✅ Cleared month ${month} from ${col.name}`);
    }

    notify(`✅ Deleted ${totalDeleted} records for ${month}`);

    // Reload admin data
    loadAllAttendance();
    loadAllLeaves();
    loadAllOvertime();
    loadAllPoReports();
    loadAllPayroll();
    loadAllPayslips();

  } catch (err) {
    console.error("❌ clearMonthData error:", err);
    notify("❌ Month reset failed: " + err.message);
  }
};


  const [resetMonth, setResetMonth] = useState(
  new Date().toISOString().slice(0, 7) // "YYYY-MM"
);

 
  /* ---------------- initial effect: if profile changes, update saved location and lists ---------------- */
  useEffect(() => {
    if (!user) return;
    // update saved location for UI convenience
    (async () => {
      try {
        const ud = await getDoc(doc(db, "users", user.uid));
        if (ud.exists()) {
          const d = ud.data();
          if (d.location) setUserSavedLocation(d.location);
        }
      } catch (err) { console.error(err); }
    })();
  }, [user]);

  /* ---------------- UI components ---------------- */
  const colorStatus = (s) => s === "approved" ? <span className="badge green">Approved</span> : s === "rejected" ? <span className="badge red">Rejected</span> : <span className="badge yellow">Pending</span>;

  /* ---------------- render ---------------- */
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-box">
          <h2>Staff Attendance Login</h2>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <button className="btn submit" type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }



  return (
    <div className="app-layout">
      {/* --- SLIDE TOGGLE SIDEBAR --- */}
      {/* DARK OVERLAY */}
{sidebarOpen && (
  <div className="overlay-dark" onClick={() => setSidebarOpen(false)}></div>
)}
  {/* TOP BAR WITH HAMBURGER */}
<div className="mobile-topbar">
 <button className={`hamburger ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
  <span></span>
  <span></span>
  <span></span>
  </button>

  <span className="topbar-title">Simple'Z Attendance</span>
</div>

{/* SIDEBAR */}
<div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
  <div className="brand">
    <h3>Simple'Z Attendance</h3>
    <small>Hi, {name || user.email}</small>
  </div>

  <nav>
   <button className="nav-item" onClick={() => {setActiveSidebar("my-panel"); setSidebarOpen(false);}}><span className="icon">🏠</span> My Dashboard</button>
   <button className="nav-item" onClick={() => {setActiveSidebar("my-att");setSidebarOpen(false);}}><span className="icon">🕒</span> My Attendance</button>
   <button className="nav-item" onClick={() => {setActiveSidebar("my-leave");setSidebarOpen(false);}}><span className="icon">📝</span> My Leave / OT</button>
  <button className="nav-item" onClick={() => { setActiveSidebar("my-payslip");setSidebarOpen(false);}}> <span className="icon"> 🧾</span> My Payslip</button> 

      {isLeader && (
      <button className="nav-item" onClick={() => {setActiveSidebar("leader-panel"); setSidebarOpen(false);}}>
        <span className="icon">👥</span> Leader Dashboard
      </button>
    )}


    {isAdmin &&  (
      <>
        <hr />
        <div className="sidebar-section-title">Admin Management</div>
        <button  className="nav-item" onClick={() => {setActiveSidebar("admin-employee");setSidebarOpen(false);}}><span className="icon">👥</span> Employee List</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-att");setSidebarOpen(false);}}><span className="icon">📊</span> All Attendance</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave");setSidebarOpen(false);}}><span className="icon">📄</span>All Leave Requests</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave-balance");setSidebarOpen(false);}}><span className="icon">📊</span> Leave Balance</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave-summary");setSidebarOpen(false);}}><span className="icon">📝</span>All Staff Leave Summary</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-po");setSidebarOpen(false);}}><span className="icon">💼</span>All Staff P/O Reports</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-ot");setSidebarOpen(false);}}><span className="icon">⏫</span>All Overtime Requests</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-summary");setSidebarOpen(false);}}><span className="icon">📅</span>Monthly Summary</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-payroll"); setSidebarOpen(false);}}><span className="icon">🏦</span>Payroll Calculator</button>
        <button className="nav-item" onClick={() => { setActiveSidebar("admin-payroll-summary"); setSidebarOpen(false); }}><span className="icon">💰</span> Payroll Summary</button> 
        
        <div className="sidebar-actions">
          <button className="btn export" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn red" onClick={()=>backupAndClear("all")}>🧹 Backup+Clear All</button>
        </div>

        <div style={{ marginBottom: "15px",marginTop:"15px",color:"AccentColor" }}>
          <p><b>Reset Month:</b></p>
          <input type="month" value={resetMonth} onChange={(e) => setResetMonth(e.target.value)}/>
        </div>
        <button className="btn red" onClick={() => clearMonthData(resetMonth)}>🧹 Reset Selected Month</button>
    
        </>
        )}
        </nav>

        <div style={{marginTop:20}}>
        <button className="btn out" onClick={handleLogout}>Logout</button>
        </div>
      </div>


      {/* main content */}
      <main className="main">
        <header className="main-header">
          <h1>{activeSidebar.startsWith("admin") ? "Admin Dashboard" : "My Dashboard"}</h1>
          <div className="main-sub">{message}</div>
        </header>

        {/* My Panel (clock, save location, personal lists) */}
        {activeSidebar === "my-panel" && (
          <section className="card">
            <h2>My Controls</h2>
            <div style={{display:"flex", gap:12, alignItems:"center", flexWrap:"wrap"}}>
              <button className="btn in" onClick={clockIn}>Clock In</button>
              <button className="btn out" onClick={clockOut}>Clock Out</button>
              

            </div>
              
            {/* ---- P/O Report Section ---- */}
            <section className="card" style={{ marginTop: 20 }}>
              <h2>Permission Out (P/O) Report</h2>
              <div className="form" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
                <input type="time" value={poFrom} onChange={(e) => setPoFrom(e.target.value)} />
                <input type="time" value={poTo} onChange={(e) => setPoTo(e.target.value)} />
                <button className="btn submit" onClick={addPoReport}>Add P/O</button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {poList.length === 0 ? (
                    <tr><td colSpan="4">No P/O records</td></tr>
                  ) : (
                    poList.map((p) => (
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td>{p.fromTime}</td>
                        <td>{p.toTime}</td>
                        <td>{p.totalTimeByHour}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            
          </section>
          
        )}

        {/* My Attendance list */}
        {activeSidebar === "my-att" && (
          <section className="card">
            <h2>My Attendance</h2>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>In Loc</th><th>Out Loc</th></tr></thead>
              <tbody>
                {attendance.length === 0 ? <tr><td colSpan="5">No records</td></tr> :
                  attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{a.date}</td>
                      <td>{toMyanmarTime(a.clockIn)}</td>
                      <td>{toMyanmarTime(a.clockOut)}</td>
                      <td>{a.locationIn ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.locationIn.latitude},${a.locationIn.longitude}`}>📍 View</a> : "-"}</td>
                      <td>{a.locationOut ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.locationOut.latitude},${a.locationOut.longitude}`}>📍 View</a> : "-"}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </section>
        )}

        {/* My Leave & OT */}
        {activeSidebar === "my-leave" && (
          <section className="card">
            <h2>Leave Request</h2>
         <div className="form" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Leave Type</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              <option>Full Day</option>
              <option>Morning Half</option>
              <option>Evening Half</option>
            </select>
          </div>

          <div className="form-group">
            <label>Leave Name</label>
            <select value={leaveName} onChange={(e) => setLeaveName(e.target.value)}>
              <option>Casual Leave</option>
              <option>Annual Leave</option>
              <option>Unpaid Leave</option>
              <option>Medical Leave</option>
              <option>Maternity Leave</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reason</label>
            <input
              type="text"
              placeholder="Reason"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ alignSelf: "flex-end" }}>
            <button className="btn submit" onClick={applyLeave}>
              Submit Leave
            </button>
          </div>
        </div>

            <h3 style={{marginTop:16}}>My Leave Requests</h3>
            <table className="data-table">
              <thead>
              <tr>
                <th>Start</th><th>End</th><th>LeaveType</th><th>LeaveName</th><th>Reason</th><th>Status</th><th>Action</th>
              </tr>
            </thead>

              <tbody>
                {leaves.length===0 ? <tr><td colSpan="5">No leave requests</td></tr> :
                  leaves.map((lv) => (
                    <tr key={lv.id}>
                      <td>{lv.startDate}</td>
                      <td>{lv.endDate}</td>
                      <td>{lv.leaveType}</td>
                      <td>{lv.leaveName}</td>
                      <td>{lv.reason}</td>
                      <td>{colorStatus(lv.status)}</td>
                      <td>
                      <button
                        className="btn small blue"
                        disabled={lv.status !== "pending"}
                        style={{
                          opacity: lv.status !== "pending" ? 0.4 : 1,
                          cursor: lv.status !== "pending" ? "not-allowed" : "pointer"
                        }}
                        onClick={() => {
                          if (lv.status !== "pending") return;
                          openLeaveEditModal(lv);
                        }}
                      >
                        ✏ Edit
                      </button>
                    </td>

                    </tr>
                  ))
                }
              </tbody>
            </table>
            {editingMyLeave && (
              <div className="modal-overlay" onClick={() => setEditingMyLeave(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>✏ Edit My Leave Request</h3>

                  <div className="form">
                    <label>Start Date</label>
                    <input type="date" value={myEditStart} onChange={(e) => setMyEditStart(e.target.value)} />

                    <label>End Date</label>
                    <input type="date" value={myEditEnd} onChange={(e) => setMyEditEnd(e.target.value)} />

                    <div style={{ display: "flex", justifyContent: "start", gap: "2px",alignItems:"center" }}>
                     <label>Leave Type</label>
                    <select value={myEditType} onChange={(e) => setMyEditType(e.target.value)}>
                      <option>Full Day</option>
                      <option>Morning Half</option>
                      <option>Evening Half</option>
                    </select>

                    <label>Leave Name</label>
                    <select value={myEditLeaveName} onChange={(e) => setMyEditLeaveName(e.target.value)}>
                      <option>Casual Leave</option>
                      <option>Annual Leave</option>
                      <option>Medical Leave</option>
                      <option>Unpaid Leave</option>
                    </select>
                   
                    </div>

                    <div style={{ display: "flex", justifyContent: "start", gap: "2px",alignItems:"center" }}>
                      <label>Reason</label>
                      <input type="text" value={myEditReason} onChange={(e) => setMyEditReason(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
                    <button className="btn blue" onClick={saveMyLeaveEdit}>💾 Save</button>
                    <button className="btn red" onClick={() => setEditingMyLeave(null)}>✖ Cancel</button>
                  </div>
                </div>
              </div>
            )}


            {/* ---- Your Leave Summary ---- */}
            <h3 style={{ marginTop: 30 }}>Your Leave Summary</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Leave Name</th>
                  <th>Allowance</th>
                  <th>Taken</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
            {/*     {[
                  { name: "Casual Leave", allowance: 6 },
                  { name: "Annual Leave", allowance: 10 },
                  { name: "Medical Leave", allowance: 90 },
                  { name: "Unpaid Leave", allowance: 10 },
                ].map((type, i) => {
                  const taken = leaves
                    .filter((lv) => lv.leaveName === type.name && lv.status === "approved")
                    .reduce((acc, lv) => {
                      const start = new Date(lv.startDate);
                      const end = new Date(lv.endDate);
                      const days =
                        (end - start) / (1000 * 60 * 60 * 24) + 1; // include both start & end days
                      return acc + (days > 0 ? days : 0);
                    }, 0);
                  const balance = type.allowance - taken;
                  return (
                    <tr key={i}>
                      <td>{type.name}</td>
                      <td>{type.allowance}</td>
                      <td>{taken}</td>
                      <td>{balance < 0 ? 0 : balance}</td>
                    </tr>
                  );
                })} */}

                  {summaryLeaveTypes.map((leaveName, i) => {
                  const base = leaveBalances?.[user.uid]?.balances?.[leaveName]?.base ?? 0;
                  const carry = leaveBalances?.[user.uid]?.balances?.[leaveName]?.carry ?? 0;
                  const allowance = Number(base) + Number(carry);

                  const taken = leaves
                  .filter((lv) => lv.leaveName === leaveName && lv.status === "approved")
                  .reduce((acc, lv) => {
                  const start = new Date(lv.startDate);
                  const end = new Date(lv.endDate);
                  const days = (end - start) / (1000 * 60 * 60 * 24) + 1;
                  return acc + (days > 0 ? days : 0);
                  }, 0);

                  const balance = Math.max(0, allowance - taken);

                  return (
                  <tr key={i}>
                  <td>{leaveName}</td>
                  <td>{allowance}</td>
                  <td>{taken}</td>
                  <td>{balance}</td>
                  </tr>
                  );
                  })}

              </tbody>
            </table>

            
            <h2 style={{marginTop:20}}>Overtime Request</h2>
            <div className="form" style={{display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start"}}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={otDate} onChange={e=>setOtDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input type="time" value={otStart} onChange={e=>setOtStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input type="time" value={otEnd} onChange={e=>setOtEnd(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input placeholder="Reason" value={otReason} onChange={e=>setOtReason(e.target.value)} />
              </div>
             <div className="form-group" style={{ alignSelf: "flex-end" }}>
                <button className="btn submit" onClick={requestOvertime}>Submit OT</button>
              </div>
             
            </div>

            <h3 style={{marginTop:16}}>My Overtime Requests</h3>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Time</th><th>Total</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {overtimeReqs.length===0 ? <tr><td colSpan="5">No OT requests</td></tr> :
                  overtimeReqs.map((ot) => (
                    <tr key={ot.id}><td>{ot.date}</td><td>{ot.startTime} - {ot.endTime}</td><td>{ot.totalTime}</td><td>{ot.reason}</td><td>{colorStatus(ot.status)}</td></tr>
                  ))
                }
              </tbody>
            </table>
          </section>
        )}


       {activeSidebar === "my-payslip" && (
        <section className="card">
          <h2>My Payslips</h2>
          <table className="data-table payslip">
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {myPayslips.length === 0 ? (
                <tr><td colSpan="3">No payslips yet</td></tr>
              ) : (
                myPayslips.map((ps) => (
                  <tr key={ps.id}>
                    <td>{ps.paymonth}</td>
                    <td>{ps.status}</td>
                    <td>
                      <button className="btn small green" onClick={() => exportPayslip(ps.payrollData)}>Payslip</button>
                   
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* LEADER SECTION */}
{isLeader  && activeSidebar === "leader-panel" && (
   <section className="card">
  <div className="section admin">
    <h2>Leader Dashboard</h2>

    <h3>My Members Leave Requests</h3>
    <table className="data-table">
      <thead>
        <tr>
          <th>User</th><th>Start</th><th>End</th><th>Type</th><th>Reason</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        {leaderLeaves.length === 0 ? (
          <tr><td colSpan="7">No leave requests</td></tr>
        ) : (
          leaderLeaves.map((lv) => (
            <tr key={lv.id}>
              <td>{displayUser(lv.userId)}</td>
              <td>{lv.startDate}</td>
              <td>{lv.endDate}</td>
              <td>{lv.leaveType}</td>
              <td>{lv.reason}</td>
              <td>{colorStatus(lv.status)}</td>
              <td>
                <button
                  className="btn small"
                  onClick={() => leaderUpdateLeaveStatus(lv.id, "approved", lv.userId)}
                >✅</button>
                <button
                  className="btn small red"
                  onClick={() => leaderUpdateLeaveStatus(lv.id, "rejected", lv.userId)}
                >❌</button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>

    <h3>My Members Overtime Requests</h3>
    <table className="data-table">
      <thead>
        <tr>
          <th>User</th><th>Date</th><th>Time</th><th>Total</th><th>Reason</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        {leaderOvertime.length === 0 ? (
          <tr><td colSpan="7">No overtime requests</td></tr>
        ) : (
          leaderOvertime.map((ot) => (
            <tr key={ot.id}>
              <td>{displayUser(ot.userId)}</td>
              <td>{ot.date}</td>
              <td>{ot.startTime} - {ot.endTime}</td>
              <td>{ot.totalTime}</td>
              <td>{ot.reason}</td>
              <td>{colorStatus(ot.status)}</td>
              <td>
                <button
                  className="btn small"
                  onClick={() => leaderUpdateOvertimeStatus(ot.id, "approved", ot.userId)}
                >✅</button>
                <button
                  className="btn small red"
                  onClick={() => leaderUpdateOvertimeStatus(ot.id, "rejected", ot.userId)}
                >❌</button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>

    <h2>My Members Attendance</h2>
    <table className="data-table">
      <thead><tr><th>User</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>In Loc</th><th>Out Loc</th><th>Action</th></tr></thead>
      <tbody>
        {leaderAttendance.length === 0 ? <tr><td colSpan="5">No records</td></tr> :
          leaderAttendance.map((a) => (
            <tr key={a.id}>
              <td>{displayUser(a.userId)}</td>
              <td>{a.date}</td>
              <td>{toMyanmarTime(a.clockIn)}</td>
              <td>{toMyanmarTime(a.clockOut)}</td>
              <td>{a.locationIn ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.locationIn.latitude},${a.locationIn.longitude}`}>📍 View</a> : "-"}</td>
              <td>{a.locationOut ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.locationOut.latitude},${a.locationOut.longitude}`}>📍 View</a> : "-"}</td>
              <td>
              <button
                className="btn small blue"
                onClick={() => {
                  setEditingLeaderAttendance(a);
                  setLeaderEditIn(a.clockInTime || "");
                  setLeaderEditOut(a.clockOutTime || "");
                }}
              >
                ✏ Edit
              </button>
            </td>
            </tr>
          ))
        }
      </tbody>
    </table>

    {editingLeaderAttendance && (
  <div className="modal-overlay" onClick={() => setEditingLeaderAttendance(null)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h3>✏ Edit Member Attendance</h3>

      <p>
        <b>Member:</b> {displayUser(editingLeaderAttendance.userId)} <br />
        <b>Date:</b> {editingLeaderAttendance.date}
      </p>

      <div className="form" style={{ gap: 10 }}>
        <div className="form-group">
          <label>Clock In</label>
          <input
            type="time"
            value={leaderEditIn}
            onChange={(e) => setLeaderEditIn(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Clock Out</label>
          <input
            type="time"
            value={leaderEditOut}
            onChange={(e) => setLeaderEditOut(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
        <button className="btn blue" onClick={leaderUpdateAttendanceTime}>
          💾 Save
        </button>
        <button className="btn red" onClick={() => setEditingLeaderAttendance(null)}>
          ✖ Cancel
        </button>
      </div>
    </div>
  </div>
)}


  </div>
  </section>
)}
 
           
      {/* Admin Employee Management */}
{isAdmin && activeSidebar === "admin-employee" && (
  <section className="card">
    <h2>Employee Management</h2>

      <table className="data-table">
      <thead>
        <tr>
          <th>Emplyee ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Team</th>
          <th>Position</th>
          <th>Language</th>
          <th>Join Date</th>
          <th>Locations</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {employees.map((emp) => (
          <React.Fragment key={emp.id}>
            {/* MAIN ROW */}
            <tr>
              <td>{emp.eid}</td>
              <td>{emp.name}</td>
              <td>{emp.email}</td>
              <td>{emp.role}</td>
              <td>{emp.team}</td>
              <td>{emp.position}</td>
              <td>{emp.languageLevel}</td>
              <td>{emp.joinDate}</td>
              <td>
                <div>
                  {emp.locations?.[0]?.name || "—"}
                </div>
                <div>
                  {emp.locations?.[1]?.name || "—"}
                </div>
              </td>
              <td>
                <button
                  className="btn small"
                  onClick={() =>
                    setEditingLocationsEmpId(
                      editingLocationsEmpId === emp.id ? null : emp.id
                    )
                  }
                >
                  📍 Edit Locations
                </button>
                <div style={{ display: "flex", gap: 8,marginTop:8 }}>
                <button
                  className="btn small"
                  onClick={() => setEditingEmp(emp)}
                  
                     >
                  ✏ Edit
                </button>
                <button
                  className="btn small red"
                  onClick={() => deleteEmployee(emp.id)}
                >
                  🗑 Delete
                </button>
                </div>
              </td>
            </tr>

            {/* INLINE LOCATION EDITOR */}
            {editingLocationsEmpId === emp.id && (
              <tr>
                <td colSpan="10">
                  <div
                    style={{
                      background: "#f9fafb",
                      padding: 12,
                      borderRadius: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <b>📍 Edit Locations for {emp.name}</b>

                    {/* Location 1 */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        placeholder="Location 1 Name"
                        value={emp.locations?.[0]?.name || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[0] = { ...l[0], name: e.target.value };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                      <input
                        placeholder="Latitude"
                        value={emp.locations?.[0]?.latitude || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[0] = {
                            ...l[0],
                            latitude: parseFloat(e.target.value),
                          };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                      <input
                        placeholder="Longitude"
                        value={emp.locations?.[0]?.longitude || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[0] = {
                            ...l[0],
                            longitude: parseFloat(e.target.value),
                          };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                    </div>

                    {/* Location 2 */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        placeholder="Location 2 Name"
                        value={emp.locations?.[1]?.name || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[1] = { ...l[1], name: e.target.value };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                      <input
                        placeholder="Latitude"
                        value={emp.locations?.[1]?.latitude || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[1] = {
                            ...l[1],
                            latitude: parseFloat(e.target.value),
                          };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                      <input
                        placeholder="Longitude"
                        value={emp.locations?.[1]?.longitude || ""}
                        onChange={(e) => {
                          const l = emp.locations || [{}, {}];
                          l[1] = {
                            ...l[1],
                            longitude: parseFloat(e.target.value),
                          };
                          setEmployees((prev) =>
                            prev.map((x) =>
                              x.id === emp.id ? { ...x, locations: l } : x
                            )
                          );
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn blue"
                        onClick={() => saveEmployeeLocations(emp)}
                      >
                        💾 Save Locations
                      </button>
                      <button
                        className="btn"
                        onClick={() => setEditingLocationsEmpId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}

          {editingEmp?.id === emp.id && (
            <tr>
            <td colSpan="10">
            <div className="card" style={{ marginTop: 20 }}>
              <h3>Edit Employee:  {emp.name}</h3>
              <div className="form" style={{ flexWrap: "wrap", gap: 8 }}>
                <input type="text" placeholder="ID" value={editingEmp.eid || ""} onChange={(e)=>setEditingEmp({...editingEmp,eid:e.target.value})}/>
                <input type="text" placeholder="Name" value={editingEmp.name || ""} onChange={(e)=>setEditingEmp({...editingEmp,name:e.target.value})}/>
                <input type="email" placeholder="Email" value={editingEmp.email || ""} onChange={(e)=>setEditingEmp({...editingEmp,email:e.target.value})}/>
                <select placeholder="Role" value={editingEmp.role || "staff"} onChange={(e)=>setEditingEmp({...editingEmp,role:e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="leader">Leader</option>
                </select>
                <input type="text" placeholder="team" value={editingEmp.team || ""} onChange={(e)=>setEditingEmp({...editingEmp,team:e.target.value})}/>
                <input type="text" placeholder="position" value={editingEmp.position || ""} onChange={(e)=>setEditingEmp({...editingEmp,position:e.target.value})}/>
                <input type="text" placeholder="languageLevel" value={editingEmp.languageLevel || ""} onChange={(e)=>setEditingEmp({...editingEmp,languageLevel:e.target.value})}/>
                <input type="date" placeholder="joinDate" value={editingEmp.joinDate || ""} onChange={(e)=>setEditingEmp({...editingEmp,joinDate:e.target.value})}/>
                <button className="btn blue" onClick={updateEmployee}>💾 Save</button>
                <button className="btn red" onClick={()=>setEditingEmp(null)}>✖ Cancel</button>
              </div>
            </div>
            </td>
            </tr>
          )}

          </React.Fragment>
        ))}
      </tbody>
    </table>

    
  </section>
)}


        {/* ADMIN: All Attendance */}
        {isAdmin && activeSidebar==="admin-att" && (
          <section className="card">
            <h2>All Staff Attendance</h2>
            <table className="data-table">
              <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
                <th>In</th>
                <th>Out</th>
                <th>In Loc</th>
                <th>Out Loc</th>
                <th>Action</th>
              </tr>
            </thead>

              <tbody>
                {allAttendance.length===0 ? <tr><td colSpan="6">No attendance</td></tr> :
                  allAttendance.map((a) => (
                    <tr key={a.id}>
                      {/* <td>{usersMap[a.userId] || a.userId}</td> */}
                       <td>{usersMap[a.userId]?.name || usersMap[a.userId]?.email || a.userId}</td>
                      <td>{a.date}</td>
                      <td>{toMyanmarTime(a.clockIn)}</td>
                      <td>{toMyanmarTime(a.clockOut)}</td>
                      <td>{a.locationIn ? <a href={`https://maps.google.com/?q=${a.locationIn.latitude},${a.locationIn.longitude}`} target="_blank" rel="noreferrer">📍 View</a> : "-"}</td>
                      <td>{a.locationOut ? <a href={`https://maps.google.com/?q=${a.locationOut.latitude},${a.locationOut.longitude}`} target="_blank" rel="noreferrer">📍 View</a> : "-"}</td>
                      <td>
                      <button className="btn small blue" onClick={() => {setEditingAttendance(a);
                          setEditClockIn(a.clockIn ? toMyanmarTime(a.clockIn) : "");
                          setEditClockOut(a.clockOut ? toMyanmarTime(a.clockOut) : "");
                        }}
                      >
                        ✏ Edit
                      </button>
                      </td>

                    </tr>
                  ))
                }
              </tbody>
            </table>

            {editingAttendance && (
              <div className="modal-overlay" onClick={() => setEditingAttendance(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>🕒 Edit Attendance</h3>

                  <p>
                    <b>User:</b> {displayUser(editingAttendance.userId)} <br />
                    <b>Date:</b> {editingAttendance.date}
                  </p>

                  <div className="form" style={{ gap: 10 }}>
                    <div className="form-group">
                      <label>Clock In</label>
                      <input
                        type="time"
                        value={editClockIn}
                        onChange={(e) => setEditClockIn(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Clock Out</label>
                      <input
                        type="time"
                        value={editClockOut}
                        onChange={(e) => setEditClockOut(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
                    <button className="btn blue" onClick={adminUpdateAttendanceTime}>
                      💾 Save
                    </button>
                    <button className="btn red" onClick={() => setEditingAttendance(null)}>
                      ✖ Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

        {/* ---- Admin: All Staff P/O Reports ---- */}
        {isAdmin && activeSidebar === "admin-po" && (
          <section className="card">
            <h2>All Staff P/O Reports</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {allPoList.length === 0 ? (
                  <tr><td colSpan="5">No P/O records found.</td></tr>
                ) : (
                  allPoList.map((p) => (
                    <tr key={p.id}>
                     {/*  <td>{usersMap[p.userId] || p.userId}</td> */}
                      <td>{displayUser(p.userId)}</td>

                      <td>{p.date}</td>
                      <td>{p.fromTime}</td>
                      <td>{p.toTime}</td>
                      <td>{p.totalTimeByHour}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}


        {/* ADMIN: All Leave Requests */}
        {isAdmin && activeSidebar==="admin-leave" && (
          <section className="card">
            <h2>All Leave Requests</h2>
            <table className="data-table">
              <thead><tr><th>User</th><th>Start</th><th>End</th><th>LeaveType</th><th>LeaveName</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {allLeaves.length===0 ? <tr><td colSpan="7">No leave requests</td></tr> :
                  allLeaves.map((lv) => (
                    <tr key={lv.id}>
                     {/*  <td>{usersMap[lv.userId] || lv.userId}</td> */}
                     <td>{displayUser(lv.userId)}</td>

                      <td>{lv.startDate}</td>
                      <td>{lv.endDate}</td>
                      <td>{lv.leaveType}</td>
                      <td>{lv.leaveName}</td>
                      <td>{lv.reason}</td>
                      <td>{colorStatus(lv.status)}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "start", gap: "2px" }}>
                          <button className="btn small" onClick={() => updateLeaveStatus(lv.id, "approved")}>✅</button>
                          <button className="btn small red" onClick={() => updateLeaveStatus(lv.id, "rejected")}>❌</button>
                          <button
                            className="btn small blue"
                            disabled={lv.status !== "pending"}
                            style={{
                              opacity: lv.status !== "pending" ? 0.4 : 1,
                              cursor: lv.status !== "pending" ? "not-allowed" : "pointer"
                            }}
                            onClick={() => {
                              if (lv.status !== "pending") return;

                              setEditingLeave(lv);
                              setEditLeaveStart(lv.startDate);
                              setEditLeaveEnd(lv.endDate);
                              setEditLeaveType(lv.leaveType || "Full Day");
                              setEditLeaveName(lv.leaveName || "Casual");
                              setEditLeaveReason(lv.reason || "");
                            }}
                          >
                            ✏ Edit
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))
                }
              </tbody>
            </table>

            {editingLeave && (
              <div className="modal-overlay" onClick={() => setEditingLeave(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>✏ Edit Leave Request</h3>

                  <p><b>User:</b> {displayUser(editingLeave.userId)}</p>

                  <div className="form">
                    <label>Start Date</label>
                    <input type="date" value={editLeaveStart} onChange={(e) => setEditLeaveStart(e.target.value)} />

                    <label>End Date</label>
                    <input type="date" value={editLeaveEnd} onChange={(e) => setEditLeaveEnd(e.target.value)} />

                    <div style={{ display: "flex", justifyContent: "start", gap: "2px",alignItems:"center" }}>
                    <label>Leave Type</label>
                    <select value={editLeaveType} onChange={(e) => setEditLeaveType(e.target.value)}>
                      <option>Full Day</option>
                      <option>Morning Half</option>
                      <option>Evening Half</option>
                    </select>

                    <label>Leave Name</label>
                    <select value={editLeaveName} onChange={(e) => setEditLeaveName(e.target.value)}>
                      <option>Casual Leave</option>
                      <option>Annual Leave</option>
                      <option>Medical Leave</option>
                      <option>Unpaid Leave</option>
                    </select>
                   
                    </div>

                    <div style={{ display: "flex", justifyContent: "start", gap: "2px",alignItems:"center" }}>
                     <label>Reason</label>
                     <input type="text" value={editLeaveReason} onChange={(e) => setEditLeaveReason(e.target.value)} />
                    </div>

                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
                    <button className="btn blue" onClick={adminSaveLeaveEdit}>💾 Save</button>
                    <button className="btn red" onClick={() => setEditingLeave(null)}>✖ Cancel</button>
                  </div>
                </div>
              </div>
            )}


          </section>
        )}

         {/* ---- Admin: all staff leave balance edit ---- */}
        {isAdmin && activeSidebar === "admin-leave-balance" && (
        <section className="card">
          <h2>Leave Balance Management ({currentYear})</h2>

          <div class="colheaders">
          <table>
            <thead>
            <tr>
              <th>User</th>
              <th>Annual  <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>Base</span> <span> Carry </span> <span>Total</span></div></th>
              <th>Casual <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>Base</span> <span> Carry </span> <span>Total</span></div></th>
              <th>Medical<div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>Base</span> <span> Carry </span> <span>Total</span></div></th>
              <th>Unpaid<div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>Base</span> <span> Carry </span> <span>Total</span></div></th>
              <th>Maternity<div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>Base</span> <span> Carry </span> <span>Total</span></div></th>
              <th>Action</th>
            </tr>
            </thead>

            <tbody>
           
            {Object.keys(usersMap).map((uid) => {
              const aBase = getBal(uid, "Annual Leave", "base");
              const aCarry = getBal(uid, "Annual Leave", "carry");
              const aTotal = Number(aBase) + Number(aCarry);

              const cBase = getBal(uid, "Casual Leave", "base");
              const cCarry = getBal(uid, "Casual Leave", "carry");
              const cTotal = Number(cBase) + Number(cCarry);

              const sBase = getBal(uid, "Medical Leave", "base");
              const sCarry = getBal(uid, "Medical Leave", "carry");
              const sTotal = Number(sBase) + Number(sCarry);

              const upBase = getBal(uid, "Unpaid Leave", "base");
              const upCarry = getBal(uid, "Unpaid Leave", "carry");
              const upTotal = Number(upBase) + Number(upCarry);

              const mBase = getBal(uid, "Maternity Leave", "base");
              const mCarry = getBal(uid, "Maternity Leave", "carry");
              const mTotal = Number(mBase) + Number(mCarry);

              

              const setValue = (type, field, value) => {
                setLeaveBalances((prev) => ({
                  ...prev,
                  [uid]: {
                    ...(prev[uid] || {}),
                    balances: {
                      ...(prev[uid]?.balances || {}),
                      [type]: {
                        ...(prev[uid]?.balances?.[type] || {}),
                        [field]: Number(value),
                      },
                    },
                  },
                }));
              };

              return (
                <tr key={uid}>
                  <td style={{ fontWeight: 600 }}>{displayUser(uid)}</td>

                  {/* Annual */}
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <input
                        type="number"
                        value={aBase}
                        onChange={(e) => setValue("Annual Leave", "base", e.target.value)}
                        style={{ width: 30 }}
                        title="Annual Base"
                      />
                      <input
                        type="number"
                        value={aCarry}
                        onChange={(e) => setValue("Annual Leave", "carry", e.target.value)}
                        style={{ width: 30 }}
                        title="Annual Carry"
                      />
                      <span style={{ minWidth: 30, textAlign: "right" }}>{aTotal}</span>
                    </div>
                  </td>

                  {/* Casual */}
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <input
                        type="number"
                        value={cBase}
                        onChange={(e) => setValue("Casual Leave", "base", e.target.value)}
                        style={{ width: 30 }}
                        title="Casual Base"
                      />
                      <input
                        type="number"
                        value={cCarry}
                        onChange={(e) => setValue("Casual Leave", "carry", e.target.value)}
                        style={{ width: 30 }}
                        title="Casual Carry"
                      />
                      <span style={{ minWidth: 30, textAlign: "right" }}>{cTotal}</span>
                    </div>
                  </td>

                  {/* Mdedical */}
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <input
                        type="number"
                        value={sBase}
                        onChange={(e) => setValue("Medical Leave", "base", e.target.value)}
                        style={{ width: 30 }}
                        title="Medical Base"
                      />
                      <input
                        type="number"
                        value={sCarry}
                        onChange={(e) => setValue("Medical Leave", "carry", e.target.value)}
                        style={{ width: 30 }}
                        title="Medical Carry"
                      />
                      <span style={{ minWidth: 30, textAlign: "right" }}>{sTotal}</span>
                    </div>
                  </td>

                  {/* Unpaid */}
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <input
                        type="number"
                        value={upBase}
                        onChange={(e) => setValue("Unpaid Leave", "base", e.target.value)}
                        style={{ width: 30 }}
                        title="Unpaid Base"
                      />
                      <input
                        type="number"
                        value={upCarry}
                        onChange={(e) => setValue("Unpaid Leave", "carry", e.target.value)}
                        style={{ width: 30 }}
                        title="Unpaid Carry"
                      />
                      <span style={{ minWidth: 30, textAlign: "right" }}>{upTotal}</span>
                    </div>
                  </td>

                   {/* Maternity */}
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <input
                        type="number"
                        value={mBase}
                        onChange={(e) => setValue("Maternity Leave", "base", e.target.value)}
                        style={{ width: 30 }}
                        title="Maternity Base"
                      />
                      <input
                        type="number"
                        value={mCarry}
                        onChange={(e) => setValue("Maternity Leave", "carry", e.target.value)}
                        style={{ width: 30 }}
                        title="Maternity Carry"
                      />
                      <span style={{ minWidth: 30, textAlign: "right" }}>{mTotal}</span>
                    </div>
                  </td>

                  {/* Save */}
                  <td>
                    <button className="btn small blue" onClick={() => saveLeaveBalance(uid)}>
                      💾 Save
                    </button>
                  </td>
                </tr>
              );
            })}
         

          </tbody>
          </table>
          
          </div>

        
        </section>
      )}


        {/* ---- Admin: Compact All Staff Leave Summary (with memory) ---- */}
        {isAdmin && activeSidebar === "admin-leave-summary" && (
          <section className="card">
            <h2>All Staff Leave Summary</h2>

            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Leave Type</th>
                  <th>Allowance</th>
                  <th>Taken</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(usersMap).map((uid)  => {
                  // define available leave types
                  const leaveTypes = {
                    "Casual Leave": 6,
                    "Annual Leave": 10,
                    "Medical Leave": 90,
                    "Unpaid Leave": 10,
                    "Maternity Leave": 98,
                  };

                  // get selected type from memory or default to "Casual Leave"
                  const selectedType = leaveSelections[uid] || "Casual Leave";

                  // calculate for the selected type
                  const staffLeaves = allLeaves.filter(
                    (lv) => lv.userId === uid && lv.status === "approved"
                  );
                  /* const allowance = leaveTypes[selectedType]; */
                  const allowance = (leaveBalances[uid]?.balances?.[selectedType]?.base || 0) +
                                     (leaveBalances[uid]?.balances?.[selectedType]?.carry || 0);

                  const taken = staffLeaves
                    .filter((lv) => lv.leaveName === selectedType)
                    .reduce((acc, lv) => {
                      const start = new Date(lv.startDate);
                      const end = new Date(lv.endDate);
                      const days =
                        (end - start) / (1000 * 60 * 60 * 24) + 1; // inclusive
                      return acc + (days > 0 ? days : 0);
                    }, 0);
                  const balance = Math.max(0, allowance - taken);

                  return (
                    <tr key={uid}>
                      <td>{displayUser(uid)}</td>
                      {/* <td>{uname}</td> */}
                      <td>
                        <select
                          value={selectedType}
                          onChange={(e) =>
                            setLeaveSelections((prev) => ({
                              ...prev,
                              [uid]: e.target.value,
                            }))
                          }
                        >
                          {Object.keys(leaveTypes).map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                        </select>
                      </td>
                      <td>{allowance}</td>
                      <td>{taken}</td>
                      <td style={{ color: balance === 0 ? "red" : "inherit" }}>
                        {balance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}



        {/* ADMIN: All OT Requests */}
        {isAdmin && activeSidebar==="admin-ot" && (
          <section className="card">
            <h2>All Overtime Requests</h2>
            <table className="data-table">
              <thead><tr><th>User</th><th>Date</th><th>Time</th><th>Total</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {allOvertime.length===0 ? <tr><td colSpan="7">No OT requests</td></tr> :
                  allOvertime.map((ot) => (
                    <tr key={ot.id}>
                      {/* <td>{usersMap[ot.userId] || ot.userId}</td> */}
                      <td>{displayUser(ot.userId)}</td>

                      <td>{ot.date}</td>
                      <td>{ot.startTime} - {ot.endTime}</td>
                      <td>{ot.totalTime}</td>
                      <td>{ot.reason}</td>
                      <td>{colorStatus(ot.status)}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                        <button className="btn small" onClick={()=>updateOvertimeStatus(ot.id,"approved")}>✅</button>
                        <button className="btn small red" onClick={()=>updateOvertimeStatus(ot.id,"rejected")}>❌</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </section>
        )}

        {/* ADMIN: Summary */}
        {isAdmin && activeSidebar==="admin-summary" && (
          <section className="card">
            <h2>Monthly Summary</h2>
            <table className="data-table">
              <thead><tr><th>User</th><th>Attendance</th><th>Approved Leave</th><th>Approved OT</th></tr></thead>
              <tbody>
                {Object.keys(summary).length===0 ? <tr><td colSpan="4">No data</td></tr> :
                  Object.entries(summary).map(([uid,s]) => (
                    <tr key={uid}>{/* <td>{usersMap[uid] || uid}</td> */}<td>{displayUser(uid)}</td><td>{s.attend}</td><td>{s.leave}</td><td>{s.overtime}</td></tr>
                  ))
                }
              </tbody>
            </table>
          </section>
        )}

        {/* ADMIN: Payroll Calculator */}
        {isAdmin && activeSidebar === "admin-payroll" && (
          <section className="card">
            <h2>Payroll Calculator</h2>
            <PayrollCalculator usersMap={usersMap} />
          </section>
        )} 


       {isAdmin && activeSidebar === "admin-payroll-summary" && (
        <section className="card">
        <h2>Payroll Summary (All Calculated Fields)</h2>
        <div className="table-scroll">
        <table className="data-table payroll-summary">
          <thead>
          <tr>
          <th>Name</th>
          <th>社員番号</th>
          <th>語力</th>
          <th>種別</th>
          <th>役職</th>
          <th>チーム</th>
          <th>所定日数</th>
          <th>出勤日数</th>
          <th>実働時間</th>
          <th>有給日数</th>
          <th>臨時休暇</th>
          <th>欠勤日数</th>
          <th>休日出勤日数</th>
          <th>休日出勤時間</th>
          <th>残業時間</th>
          <th>遅刻時間</th>
          <th>語力手当</th>
          <th>役職手当</th>
          <th>取締役手当</th>
          <th>基本給(最新)</th>
          <th>固定残業</th>
          <th>欠勤控除</th>
          <th>遅刻控除</th>
          <th>固定残業控除</th>
          <th>SSB</th>
          <th>所得税</th>
          <th>残業手当</th>
          <th>休日手当</th>
          <th>在宅手当</th>
          <th>賞与</th>
          <th>給与振込額</th>
          <th>総支給額(優遇レート)</th>
          <th>CBレート</th>
          <th>Date</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {allPayroll.length === 0 ? (
          <tr><td colSpan="44">No payroll records found.</td></tr>
        ) : (
          allPayroll.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.staffId}</td>
              <td>{p.languageLevel}</td>
              <td>{p.type}</td>
              <td>{p.staffposition}</td>
              <td>{p.staffteam}</td>
              <td>{p.standardDays}</td>
              <td>{p.workedDays}</td>
              <td>{p.actualHours}</td>
              <td>{p.annualLeave}</td>
              <td>{p.casualLeave}</td>
              <td>{p.absentDays}</td>
              <td>{p.holidayWorkDays}</td>
              <td>{p.holidayWorkHours}</td>
              <td>{p.overtimeHours}</td>
              <td>{p.lateHours}</td>
              <td>{p.languageAllowance?.toLocaleString()}</td>
              <td>{p.jobAllowance?.toLocaleString()}</td>
              <td>{p.directorAllowance?.toLocaleString()}</td>
              <td>{p.basicLatest?.toLocaleString()}</td>
              <td>{p.fixedOvertime?.toLocaleString()}</td>
              <td>{p.absenceDeduction?.toLocaleString()}</td>
              <td>{p.lateDeduction?.toLocaleString()}</td>
              <td>{p.fixedOvertimeDeduction?.toLocaleString()}</td>
              <td>{p.ssb?.toLocaleString()}</td>
              <td>{p.incomeTax?.toLocaleString()}</td>
              <td>{p.overtimeAllowance?.toLocaleString()}</td>
              <td>{p.holidayAllowance?.toLocaleString()}</td>
              <td>{p.wfhAllowance?.toLocaleString()}</td>
              <td>{p.bonus?.toLocaleString()}</td>
              <td>{p.salaryTransfer?.toLocaleString()}</td>
              <td>{p.preferentialTotal?.toLocaleString()}</td>
              <td>{p.cbRate}</td>
              <td>{p.createdAt?.slice(0,10)}</td>
              <td>
                <div style={{ display: "flex", justifyContent: "center", gap: "3px" }}>
                <button className="btn small blue" onClick={() => setSelectedPayroll(p)}>View</button>
                <button className="btn small green" onClick={() => exportPayslip(p)}>Payslip</button>
                <button className="btn small blue" onClick={() => sendPayslip(p)}>Send</button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    </div>

    {/* Modal for details */}
   {selectedPayroll && (
      <div className="modal-overlay" onClick={() => setSelectedPayroll(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{selectedPayroll.name} - Detailed Payroll</h3>
          <div className="modal-content">
            {Object.entries(selectedPayroll).map(([key, value]) => (
              <div key={key} className="modal-row">
                <strong>{key}</strong>
                <span>{typeof value === "number" ? value.toLocaleString() : String(value)}</span>
              </div>
            ))}
          </div>
          <button className="btn red" onClick={() => setSelectedPayroll(null)}>Close</button>
        </div>
      </div>
    )}

  </section> 
)}

    </main>
    </div>
  );
}

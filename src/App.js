/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// src/App.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState, useEffect, useCallback} from "react";
import { jsPDF } from "jspdf";
import {autoTable} from "jspdf-autotable";
import { getFunctions, httpsCallable } from "firebase/functions";

import { collection, getDocs, onSnapshot,orderBy } from "firebase/firestore";// already imported, just make sure
import { app, db, auth } from "./firebase";

import {
  writeBatch,
  serverTimestamp,
  addDoc,
  query,
  where,
  updateDoc,
  runTransaction,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";

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


// secondary auth init (OUTSIDE App)
const secondaryApp =
  getApps().find((a) => a.name === "secondary") ||
  initializeApp(app.options, "secondary");

const secondaryAuth = getAuth(secondaryApp);

/* ---------------- App ---------------- */
export default function App() {
  // Auth + role
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [roles, setRoles] = useState([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [newEmpAuthEmail, setNewEmpAuthEmail] = useState("");
  const [newEmpTempPassword, setNewEmpTempPassword] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPw, setShowTempPw] = useState(false);

  const [leaderQueryInput, setLeaderQueryInput] = useState("");
  const [leaderQuery, setLeaderQuery] = useState("");
 
  const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);

  const [showEmpModal, setShowEmpModal] = useState(false);

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


  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  const leaders = employees.filter(
  (e) => (e.role === "leader") || (e.roles || []).includes("leader")
);


  const emptyEmployeeForm = {
    employeeCode: "",
    employeeName: "",
    myanmarName: "",
    gender: "",
    department: "",
    designation: "",
    leaderId: "",
    rank:"",
    pitch:"",
    email: "",
    doe: "",
    employmentType: "",
    probationPeriod: "",
    dob: "",
    age: "",
    nrc: "",
    phone: "",
    address: "",
    contactAddress: "",
    maritalStatus: "",
  };

  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);

 const filteredEmployees = employees.filter((e) => {
  const q = empSearch.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    e.eid, e.employeeCode,
    e.name, e.employeeName,
    e.email,
    e.department,
    e.designation,
    e.myanmarName,
    e.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
});

const openEmployeeForEdit = (emp) => {
  setSelectedEmpId(emp.id);

  setEmployeeForm({
    employeeCode: emp.employeeCode || emp.eid || "",
    employeeName: emp.employeeName || emp.name || "",
    myanmarName: emp.myanmarName || "",
    gender: emp.gender || "",
    department: emp.department || "",
    designation: emp.designation || "",
    rank: emp.rank || "",
    pitch: emp.pitch || "",
    email: emp.email || "",
    doe: emp.doe || emp.joinDate || "",
    employmentType: emp.employmentType || "",
    probationPeriod: emp.probationPeriod || "",
    dob: emp.dob || "",
    age: emp.age || "",
    nrc: emp.nrc || "",
    phone: emp.phone || "",
    address: emp.address || "",
    contactAddress: emp.contactAddress || "",
    maritalStatus: emp.maritalStatus || "",
    leaderId: emp.leaderId || "", 

  });

  const leader = employees.find((x) => x.id === emp.leaderId);
  setLeaderQueryInput(leader?.name || "");  // show leader name
  setShowLeaderDropdown(false);
};

const saveEmployeeProfile = async () => {
  try {
    if (!employeeForm.employeeCode || !employeeForm.employeeName) {
      return notify("Employee Code and Employee Name are required.");
    }

    const payload = {
      // keep new HR fields
      ...employeeForm,

      // keep your old fields so other screens still work
      eid: employeeForm.employeeCode,
      name: employeeForm.employeeName,

      updatedAt: new Date().toISOString(),
    };

    if (selectedEmpId) {
      // UPDATE existing
      await updateDoc(doc(db, "users", selectedEmpId), payload);
      notify("✅ Employee updated");
    } else {
      // CREATE new
      await addDoc(collection(db, "users"), {
        ...payload,
        createdAt: new Date().toISOString(),
      });
      notify("✅ New employee created");
    }

    // refresh list + reset
    await loadEmployees();
    setSelectedEmpId(null);
    setEmployeeForm(emptyEmployeeForm);
  } catch (err) {
    console.error(err);
    notify("❌ Save failed: " + err.message);
  }
};

const startNewEmployee = () => {
  setSelectedEmpId(null);
  setEmployeeForm(emptyEmployeeForm);
};

const startCreateEmployee = () => {
  setSelectedEmpId(null);
  setEmployeeForm(emptyEmployeeForm);

  // 🔴 clear auth fields
  setLoginEmail("");
  setTempPassword("");
  setShowTempPw(false);

  // ✅ clear leader search fields
  setLeaderQueryInput("");
  setShowLeaderDropdown(false);
};

useEffect(() => {
  if (activeSidebar === "admin-employee-form") {
    startCreateEmployee();
  }
}, [activeSidebar]);

const openCreateEmployeeModal = () => {
  startCreateEmployee();
  setShowEmpModal(true);
};
const openEditEmployeeModal = (emp) => {
  openEmployeeForEdit(emp);     // loads data into form + sets selectedEmpId
  setShowEmpModal(true);
};

useEffect(() => {
  const t = setTimeout(() => {
    setLeaderQuery(leaderQueryInput.trim());
  }, 300); // ⏱ debounce time (ms)

  return () => clearTimeout(t);
}, [leaderQueryInput]);

const employeeById = React.useMemo(() => {
  const map = {};
  employees.forEach((e) => (map[e.id] = e));
  return map;
}, [employees]);


const createEmployee = async () => {
  try {
    if (!loginEmail || !tempPassword) {
      return notify("Login email and temporary password are required.");
    }
    if (!employeeForm.employeeCode || !employeeForm.employeeName) {
      return notify("Employee Code and Employee Name are required.");
    }

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      loginEmail,
      tempPassword
    );

    const uid = cred.user.uid;

    await setDoc(
      doc(db, "users", uid),
      {
        ...employeeForm,
        joinDate: employeeForm.doe || "",
        doe: employeeForm.doe || "",
        eid: employeeForm.employeeCode,
        name: employeeForm.employeeName,
        email: loginEmail,
        role: employeeForm.role || "staff",
        roles: employeeForm.roles || [employeeForm.role || "staff"],
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || null,
        authUid: uid,
      },
      { merge: true }
    );

    await secondaryAuth.signOut();

    notify("✅ Employee created (UID: " + uid + ")");
    setEmployeeForm(emptyEmployeeForm);
    setSelectedEmpId(null);
    setLoginEmail("");
    setTempPassword("");
    setShowTempPw(false);
    loadEmployees();
    
  } catch (err) {
    console.error(err);
    notify("❌ Create failed: " + (err?.message || "unknown error"));
  }
};

const updateEmployee = async () => {
  try {
    if (!selectedEmpId) return;

    await updateDoc(doc(db, "users", selectedEmpId), {
      ...employeeForm,
      joinDate: employeeForm.doe || "",
      doe: employeeForm.doe || "",
      eid: employeeForm.employeeCode,
      name: employeeForm.employeeName,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.uid || null,
      leaderId: employeeForm.leaderId || "",
    });

    notify("✅ Employee updated");
    setEmployeeForm(emptyEmployeeForm);
    setSelectedEmpId(null);
    loadEmployees();
  } catch (err) {
    console.error(err);
    notify("❌ Update failed: " + (err?.message || "unknown error"));
  }
};


const createEmployeeSecondaryAuth = async () => {
  try {
    if (!newEmpAuthEmail || !newEmpTempPassword) {
      return notify("Email and temporary password are required.");
    }
    if (!employeeForm.employeeCode || !employeeForm.employeeName) {
      return notify("Employee Code and Employee Name are required.");
    }

    // 1) Create Auth user (UID generated automatically)
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      newEmpAuthEmail,
      newEmpTempPassword
    );

    const uid = cred.user.uid;

    // 2) Save Firestore profile to users/{uid} (fits your UID-based code)
    const payload = {
      ...employeeForm,

      // keep compatibility with your existing UI (uses eid/name)
      eid: employeeForm.employeeCode,
      name: employeeForm.employeeName,
      email: newEmpAuthEmail,

      role: employeeForm.role || "staff",
      roles: employeeForm.roles || [employeeForm.role || "staff"],

      leaderId: employeeForm.leaderId || "",

      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.uid || null,
      authUid: uid,
    };

    await setDoc(doc(db, "users", uid), payload, { merge: true });

    // 3) Sign out ONLY secondary auth (admin stays logged in)
    await secondaryAuth.signOut();

    notify("✅ Employee created (UID: " + uid + ")");

    // reset
    setNewEmpAuthEmail("");
    setNewEmpTempPassword("");
    setEmployeeForm(emptyEmployeeForm);

    // refresh list
    loadEmployees();
  } catch (err) {
    console.error("createEmployeeSecondaryAuth error:", err);
    notify("❌ Create failed: " + (err?.message || "unknown error"));
  }
};



  //12/18
 const functions = getFunctions();
 

  const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));


  const displayUser = (uid) =>
  usersMap[uid]?.name || usersMap[uid]?.email || uid;

  const displayEmpId = (uid) => usersMap[uid]?.eid || "-";

  // Leave pages search
  const [leaveSearch, setLeaveSearch] = useState("");

 const filteredUserIdsForLeave = Object.keys(usersMap)
  .filter((uid) => {
    const q = leaveSearch.trim().toLowerCase();
    if (!q) return true;

    const u = usersMap[uid] || {};
    return (
      (u.eid || "").toLowerCase().includes(q) ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  })
  .sort((a, b) => {
    const eidA = (usersMap[a]?.eid || "").toLowerCase();
    const eidB = (usersMap[b]?.eid || "").toLowerCase();

    // Put users without eid at bottom
    if (!eidA && !eidB) return 0;
    if (!eidA) return 1;
    if (!eidB) return -1;

    return eidA.localeCompare(eidB, undefined, { numeric: true });
  });


  /* for emplyee management search */
  const [employeeSearch, setEmployeeSearch] = useState("");

  const filteredEmployeeslocation = employees
  .filter((emp) => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return true;

    return (
      (emp.eid || "").toLowerCase().includes(q) ||
      (emp.name || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q) ||
      (emp.team || "").toLowerCase().includes(q) ||
      (emp.position || "").toLowerCase().includes(q) ||
      (emp.languageLevel || "").toLowerCase().includes(q) ||
      (emp.myanmarName || "").toLowerCase().includes(q)
    );
  })
  .sort((a, b) => {
    const eidA = (a.eid || "").toLowerCase();
    const eidB = (b.eid || "").toLowerCase();

    if (!eidA && !eidB) return 0;
    if (!eidA) return 1;
    if (!eidB) return -1;

    return eidA.localeCompare(eidB, undefined, { numeric: true });
  });





  const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const hasRole = (r) => roles.includes(r) || role === r; // supports old users too
const isAdmin = hasRole("admin");
const isLeader = hasRole("leader");

const isHR = hasRole("hr");

// payroll permission = ONLY admin
const canAccessPayroll = isAdmin && !isHR;


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

  const handlePasswordReset = async () => {
  if (!email) {
    notify("Please enter your email first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    notify("📧 Password reset email sent. Check your inbox.");
  } catch (err) {
    notify("❌ " + err.message);
  }
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
  doc.text(`For The Month of: ${p.month.slice(0,10)}`, 150, 35);

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
  paymonth: p.month,
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
};
 */
  /*load emplyee order in eid */
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

  // Add loaders for holidays (query by month range) 
    const monthRange = (yyyyMm) => {
    const [y, m] = yyyyMm.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const start = first.toISOString().slice(0, 10);
    const end = last.toISOString().slice(0, 10);
    return { start, end };
    };
  
    // ---------- Company Calendar (Holidays) ----------
  const [companyHolidays, setCompanyHolidays] = useState([]); // list of {id/date/name...}
  const [holidayMonth, setHolidayMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // "YYYY-MM"
  });
  const [holidayDate, setHolidayDate] = useState(""); // "YYYY-MM-DD"
  const [holidayName, setHolidayName] = useState("");
  
  
  // Attendance Overview controls
  const [overviewMonth, setOverviewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [overviewUserId, setOverviewUserId] = useState("");
  
  
    const loadCompanyHolidaysForMonth = async (yyyyMm) => {
      try {
        const { start, end } = monthRange(yyyyMm);
        const q = query(
          collection(db, "companyCalendar"),
          where("date", ">=", start),
          where("date", "<=", end),
          orderBy("date", "asc")
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCompanyHolidays(rows);
      } catch (err) {
        console.error(err);
        notify("❌ Cannot load company holidays: " + err.message);
      }
    };
  
      useEffect(() => {
      if (!isAdmin) return;
      loadCompanyHolidaysForMonth(holidayMonth);
    }, [isAdmin, holidayMonth]);
  
    useEffect(() => {
      // Attendance Overview uses overviewMonth
      if (!isAdmin) return;
      loadCompanyHolidaysForMonth(overviewMonth);
    }, [isAdmin, overviewMonth]);
  
    //Admin CRUD for Company Calendar
   const adminAddOrUpdateHoliday = async () => {
    try {
      if (!holidayDate || !holidayName.trim()) {
        notify("Please select date and enter holiday name.");
        return;
      }
  
      // ✅ must be ISO "YYYY-MM-DD"
      if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
        notify("❌ Holiday date must be YYYY-MM-DD (please use date picker).");
        return;
      }
  
      await setDoc(
        doc(db, "companyCalendar", holidayDate),
        {
          date: holidayDate,
          name: holidayName.trim(),
          type: "holiday",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdBy: user?.uid || "",
        },
        { merge: true }
      );
  
      notify("✅ Holiday saved");
      setHolidayName("");
      loadCompanyHolidaysForMonth(holidayMonth);
    } catch (err) {
      console.error(err);
      notify("❌ Cannot save holiday: " + err.message);
    }
  };
  
  const adminDeleteHoliday = async (dateId) => {
    try {
      if (!window.confirm("Delete this holiday?")) return;
      await deleteDoc(doc(db, "companyCalendar", dateId));
      notify("🗑 Holiday deleted");
      loadCompanyHolidaysForMonth(holidayMonth);
    } catch (err) {
      console.error(err);
      notify("❌ Cannot delete holiday: " + err.message);
    }
  };
  
  // Calendar builder + Attendance Overview mapping (FIXED: no timezone shift)
  const buildCalendarCells = (yyyyMm) => {
    const [y, m] = yyyyMm.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
  
    const startWeekday = first.getDay(); // 0 Sun .. 6 Sat
    const totalDays = last.getDate();
  
    const pad2 = (n) => String(n).padStart(2, "0");
    const toLocalDateStr = (d) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  
    const cells = [];
  
    for (let i = 0; i < startWeekday; i++) cells.push(null);
  
    for (let day = 1; day <= totalDays; day++) {
      const dd = new Date(y, m - 1, day);
      cells.push(toLocalDateStr(dd));
    }
  
    return cells;
  };
  
  const holidayMap = React.useMemo(() => {
    const m = {};
    (companyHolidays || []).forEach((h) => {
      if (h?.date) m[h.date] = h;
    });
    return m;
  }, [companyHolidays]);
  
  const findAttendanceByUserAndDate = (uid, dateStr) => {
    if (!uid || !dateStr) return null;
    return (allAttendance || []).find((a) => a.userId === uid && a.date === dateStr) || null;
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

  const [creatingAttendance, setCreatingAttendance] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createDate, setCreateDate] = useState(""); // YYYY-MM-DD
  const [createIn, setCreateIn] = useState("");
  const [createOut, setCreateOut] = useState("");
  const [createLocationName, setCreateLocationName] = useState("");

  const [bulkMonth, setBulkMonth] = useState(""); // "2026-02"
  const [bulkWeekdaysOnly, setBulkWeekdaysOnly] = useState(true);
  const [bulkOverwrite, setBulkOverwrite] = useState(false); // usually false


  const openCreateAttendance = () => {
    setSelectedUserId("");
    setCreateDate("");
    setCreateIn("");
    setCreateOut("");
    setCreateLocationName("");
    setCreatingAttendance(true);
  };


  const [selectedUserId, setSelectedUserId] = useState("");

  const adminCreateOrUpdateAttendance = async () => {
  try {
    // ✅ ONLY use selectedUserId + createDate
    if (!selectedUserId || !createDate) {
      notify("Select staff and date.");
      return;
    }

    const clockInISO = createIn
      ? makeISOFromDateAndTimeYangon(createDate, createIn)
      : null;

    const clockOutISO = createOut
      ? makeISOFromDateAndTimeYangon(createDate, createOut)
      : null;

    // 1) Check if attendance doc already exists for that user/day
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", selectedUserId),
      where("date", "==", createDate)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      // ✅ Update existing doc
      const existing = snap.docs[0];

      await updateDoc(doc(db, "attendance", existing.id), {
        clockIn: clockInISO,
        clockInTime: createIn || null,
        clockOut: clockOutISO,
        clockOutTime: createOut || null,
        locationName:
          createLocationName || existing.data().locationName || "",
        editedByAdmin: true,
        editedAt: new Date().toISOString(),
      });
    } else {
      // ✅ Create new doc (for forgotten day)
      await addDoc(collection(db, "attendance"), {
        userId: selectedUserId,
        date: createDate,
        clockIn: clockInISO,
        clockInTime: createIn || null,
        clockOut: clockOutISO,
        clockOutTime: createOut || null,
        locationName: createLocationName || "",
        editedByAdmin: true,
        editedAt: new Date().toISOString(),
        createdByAdmin: true,
        createdAt: new Date().toISOString(),
      });
    }

    notify("✅ Attendance saved");
    setCreatingAttendance(false);
    loadAllAttendance();
  } catch (err) {
    console.error(err);
    notify("❌ Cannot save attendance: " + err.message);
  }
};

  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // "YYYY-MM"
  });

  const getEmp = (uid) => usersMap?.[uid] || {};
  const getEid = (uid) => getEmp(uid)?.eid || "";
  const getEmpName = (uid) => getEmp(uid)?.name || displayUser(uid) || "";
  const getEmpEmail = (uid) => getEmp(uid)?.email || "";

  const filteredAttendance = (allAttendance || [])
  .filter((a) => {
    // month filter: a.date should be "YYYY-MM-DD"
    if (!attendanceMonth) return true;
    return (a.date || "").startsWith(attendanceMonth);
  })
  .filter((a) => {
    const q = attendanceSearch.trim().toLowerCase();
    if (!q) return true;

    const uid = a.userId;
    const hay = [
      getEid(uid),
      getEmpName(uid),
      getEmpEmail(uid),
      a.date || "",
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  })
  // optional: sort latest first
  .sort((x, y) => (y.date || "").localeCompare(x.date || ""));

    /* Monthly attendance summary */
    const monthAttendance = (allAttendance || []).filter((a) =>
  (a.date || "").startsWith(attendanceMonth)
);

const monthlySummaryByUser = Object.keys(usersMap || {})
  .map((uid) => {
    const rows = monthAttendance.filter((a) => a.userId === uid);

    const presentDays = rows.length;
    const missingClockIn = rows.filter((r) => !r.clockInTime).length;
    const missingClockOut = rows.filter((r) => !r.clockOutTime).length;

    return {
      uid,
      eid: usersMap?.[uid]?.eid || "",
      name: usersMap?.[uid]?.name || displayUser(uid) || "",
      presentDays,
      missingClockIn,
      missingClockOut,
    };
  })
  // sort by employee id order
  .sort((a, b) => (a.eid || "").localeCompare(b.eid || ""));

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

/* Attendance manual edit for 1month by admin */ 
  const getDatesInMonth = (yyyyMm, weekdaysOnly) => {
  const [y, m] = yyyyMm.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);

  const out = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0 Sun ... 6 Sat
    if (weekdaysOnly && (day === 0 || day === 6)) continue;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
};

const adminBulkCreateMonthAttendance = async () => {
  try {
    if (!selectedUserId || !bulkMonth) {
      notify("Select employee and month.");
      return;
    }

    const dates = getDatesInMonth(bulkMonth, bulkWeekdaysOnly);

    const batch = writeBatch(db);
    let createdCount = 0;
    let skippedCount = 0;

    for (const dateStr of dates) {
      const docId = `${selectedUserId}_${dateStr}`; // ✅ unique per day
      const ref = doc(db, "attendance", docId);

      const existsSnap = await getDoc(ref);

      if (existsSnap.exists() && !bulkOverwrite) {
        skippedCount++;
        continue;
      }

      const clockInISO = createIn
        ? makeISOFromDateAndTimeYangon(dateStr, createIn)
        : null;

      const clockOutISO = createOut
        ? makeISOFromDateAndTimeYangon(dateStr, createOut)
        : null;

      batch.set(
        ref,
        {
          userId: selectedUserId,
          date: dateStr,
          clockIn: clockInISO,
          clockInTime: createIn || null,
          clockOut: clockOutISO,
          clockOutTime: createOut || null,
          locationName: createLocationName || "",
          createdByAdmin: true,
          editedByAdmin: true,
          createdAt: serverTimestamp(),
          editedAt: serverTimestamp(),
        },
        { merge: true }
      );

      createdCount++;
    }

    await batch.commit();

    notify(`✅ Bulk done. Created/updated: ${createdCount}, Skipped: ${skippedCount}`);
    setCreatingAttendance(false);
    loadAllAttendance();
  } catch (err) {
    console.error(err);
    notify("❌ Cannot bulk add: " + err.message);
  }
};

//attendance delete by admin

// delete single day
const adminDeleteAttendance = async () => {
  try {
    if (!editingAttendance?.id) {
      notify("No attendance selected.");
      return;
    }

    if (!window.confirm("Delete this attendance record?")) return;

    await deleteDoc(doc(db, "attendance", editingAttendance.id));

    notify("🗑 Attendance deleted");
    setEditingAttendance(null);
    loadAllAttendance();
  } catch (err) {
    console.error(err);
    notify("❌ Delete failed: " + err.message);
  }
};


//delete whole month
const adminDeleteMonthAttendance = async () => {
  try {
    if (!selectedUserId || !bulkMonth) {
      notify("Select employee and month.");
      return;
    }

    if (
      !window.confirm(
        `Delete ALL attendance for ${displayUser(selectedUserId)} in ${bulkMonth}?`
      )
    ) {
      return;
    }

    // ✅ Only ONE where => no composite index needed
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", selectedUserId)
    );

    const snap = await getDocs(q);

    // ✅ filter month on client side (bulkMonth = "YYYY-MM")
    const docsToDelete = snap.docs.filter((d) =>
      (d.data()?.date || "").startsWith(bulkMonth)
    );

    if (docsToDelete.length === 0) {
      notify("No attendance found for that month.");
      return;
    }

    // ✅ batch delete (limit 500, month is safe)
    const batch = writeBatch(db);
    docsToDelete.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    notify(`🗑 Deleted ${docsToDelete.length} attendance records`);
    loadAllAttendance();
  } catch (err) {
    console.error(err);
    notify("❌ Delete failed: " + err.message);
  }
};

//show leave name and type in all staff attendance table
const LEAVE_TYPE_ABBR = {
  "annual leave": "AL",
  "casual leave": "CL",
  "medical leave": "MeL",
  "maternity leave": "MaL",
  "unpaid leave": "WL",
  "without pay leave": "WL",
};


const getLeaveDayAbbr = (leave) => {
  // try many possible field names (use whichever exists in your leave docs)
  const raw =
    leave.dayType ??
    leave.leaveType ??
    leave.leaveTime ??
    leave.duration ??
    leave.session ??
    leave.type ??
    "Full Day";

  const t = String(raw).trim().toLowerCase().replace(/\s+/g, " ");

  // morning half
  if (t.includes("morning")) return "AML";

  // evening / afternoon half
  if (t.includes("evening") || t.includes("afternoon")) return "PML";

  // full day (default)
  return "FL";
};

const getLeaveAbbreviationForDate = (userId, date) => {
  const leave = allLeaves.find((l) => {
    if (l.userId !== userId) return false;
    if (l.status !== "approved") return false;

    const d = new Date(date);
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);

    return d >= start && d <= end;
  });

  if (!leave) return "";

  const typeAbbr = LEAVE_TYPE_ABBR[(leave.leaveName || "").toLowerCase().trim()] || "";
  const dayAbbr = getLeaveDayAbbr(leave);

  return `${dayAbbr}/${typeAbbr}`;
};



// attendance edit by leader
const [editingLeaderAttendance, setEditingLeaderAttendance] = useState(null);
const [leaderEditIn, setLeaderEditIn] = useState("");
const [leaderEditOut, setLeaderEditOut] = useState("");
const [nameFilter, setNameFilter] = useState("");
const [dateFilter, setDateFilter] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");

// Admin filters: show approved/rejected (pending is default)
const [showApprovedLeave, setShowApprovedLeave] = useState(false);
const [showRejectedLeave, setShowRejectedLeave] = useState(false);

const [showApprovedOT, setShowApprovedOT] = useState(false);
const [showRejectedOT, setShowRejectedOT] = useState(false);

const resetFilters = () => {
  setNameFilter("");
  setDateFilter("");
  setFromDate("");
  setToDate("");

  // reset status checkboxes
  setShowApprovedLeave(false);
  setShowRejectedLeave(false);
  setShowApprovedOT(false);
  setShowRejectedOT(false);
};

const safe = (v) => (v || "").toString().toLowerCase();

const filteredMemberAttendance = leaderAttendance.filter(row => {
  const name = usersMap[row.userId]?.name;   // real source
  const matchName = safe(name).includes(safe(nameFilter));

  const matchDate =
    dateFilter === "" || row.date === dateFilter;

  return matchName && matchDate;
});

const filteredMemberLeaves = leaderLeaves.filter(row => {
  // ---------- Name filter ----------
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  // ---------- Date range filter ----------
  if (!fromDate && !toDate) return matchName;

  const rowStart = new Date(row.startDate);
  const rowEnd = new Date(row.endDate);
  const filterFrom = fromDate ? new Date(fromDate) : null;
  const filterTo = toDate ? new Date(toDate) : null;

  // overlap logic
  if (filterFrom && rowEnd < filterFrom) return false;
  if (filterTo && rowStart > filterTo) return false;

  return matchName;
});


const filteredMemberOT = leaderOvertime.filter(row => {
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  const matchDate =
    dateFilter === "" || row.date === dateFilter;

  return matchName && matchDate;
});

/* const filteredAllMemberLeaves = allLeaves.filter(row => {
  // ---------- Name filter ----------
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  // ---------- Date range filter ----------
  if (!fromDate && !toDate) return matchName;

  const rowStart = new Date(row.startDate);
  const rowEnd = new Date(row.endDate);
  const filterFrom = fromDate ? new Date(fromDate) : null;
  const filterTo = toDate ? new Date(toDate) : null;

  // overlap logic
  if (filterFrom && rowEnd < filterFrom) return false;
  if (filterTo && rowStart > filterTo) return false;

  return matchName;
}); */

const filteredAllMemberLeaves = allLeaves.filter((row) => {
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  // ---------- Date range overlap ----------
  const rowStart = new Date(row.startDate);
  const rowEnd = new Date(row.endDate);
  const filterFrom = fromDate ? new Date(fromDate) : null;
  const filterTo = toDate ? new Date(toDate) : null;

  if (filterFrom && rowEnd < filterFrom) return false;
  if (filterTo && rowStart > filterTo) return false;

  // ---------- Status filter ----------
  const s = (row.status || "pending").toLowerCase();

  // Default table shows only "pending-like"
  // If you have 2-step approval, admin pending list should include "leader_approved" too.
  const allowed = new Set(["pending", "leader_approved"]);

  if (showApprovedLeave) allowed.add("approved");
  if (showRejectedLeave) allowed.add("rejected");

  const matchStatus = allowed.has(s);

  return matchName && matchStatus;
});

useEffect(() => {
  const today = new Date().toISOString().slice(0, 10);
  setFromDate(today);
  setToDate(today);
}, []);


/* const filteredAllMemberOT = allOvertime.filter(row => {
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  const matchDate =
    dateFilter === "" || row.date === dateFilter;

  return matchName && matchDate;
}); */

const filteredAllMemberOT = allOvertime.filter((row) => {
  const name = usersMap[row.userId]?.name;
  const matchName = safe(name).includes(safe(nameFilter));

  const matchDate = dateFilter === "" || row.date === dateFilter;

  const s = (row.status || "pending").toLowerCase();

  const allowed = new Set(["pending"]);
  if (showApprovedOT) allowed.add("approved");
  if (showRejectedOT) allowed.add("rejected");

  return matchName && matchDate && allowed.has(s);
});

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

  
  const summaryLeaveTypes = ["Casual Leave", "Annual Leave", "Medical Leave","WithoutPay Leave", "Maternity Leave",];
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
    await loadLeaveBalances();  // reload whole map

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
    /* await addDoc(collection(db, "leaves"), {
      userId: user.uid,
      startDate: leaveStart,
      endDate: leaveEnd,
      leaveType,
      leaveName,
      reason: leaveReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    }); */
    await addDoc(collection(db, "leaves"), {
          userId: user.uid,
          startDate: leaveStart,
          endDate: leaveEnd,
          leaveType,
          leaveName,
          reason: leaveReason,
    
          // 2-step workflow
          status: "pending",          // display status
          leaderStatus: "pending",
          adminStatus: "pending",
    
          leaderActionBy: null,
          leaderActionAt: null,
          adminActionBy: null,
          adminActionAt: null,
    
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

  /* const updateLeaveStatus = async (id, status) => {
    await updateDoc(doc(db, "leaves", id), { status });
    notify(`Leave ${status}`);
    loadAllLeaves();
  };

  const updateOvertimeStatus = async (id, status) => {
    await updateDoc(doc(db, "overtimeRequests", id), { status });
    notify(`Overtime ${status}`);
    loadAllOvertime();
  }; */
    const updateOvertimeStatus = async (id, status) => {
    await updateDoc(doc(db, "overtimeRequests", id), {
      status,
      actionBy: user.uid,
      actionAt: new Date().toISOString(),
    });
    notify(`Overtime ${status}`);
    loadAllOvertime();
  };
/* 
  const leaderUpdateLeaveStatus = async (leaveDocId, status, memberUserId) => {
  if (!leaderMembers.includes(memberUserId)) {
    return notify("🚫 You cannot approve non-member leave.");
  }
  await updateLeaveStatus(leaveDocId, status);
  // refresh leader list only
  await loadLeaderLeaves(leaderMembers);
}; */

const leaderUpdateLeaveStatus = async (leaveDocId, decision, memberUserId) => {
  if (!leaderMembers.includes(memberUserId)) {
    return notify("🚫 You cannot approve non-member leave.");
  }

  const payload = {
    leaderStatus: decision,
    leaderActionBy: user.uid,
    leaderActionAt: new Date().toISOString(),
  };

  // if leader rejects -> final reject
  if (decision === "rejected") {
    payload.status = "rejected";
    payload.adminStatus = "rejected"; // optional: lock admin step
  }

  // if leader approves -> waiting admin
  if (decision === "approved") {
    payload.status = "leader_approved";
  }

  await updateDoc(doc(db, "leaves", leaveDocId), payload);

  notify(`Leader ${decision}`);
  await loadLeaderLeaves(leaderMembers);
  if (isAdmin) await loadAllLeaves();
};

const getLeaveYear = (leave) => new Date(leave.startDate).getFullYear();

const adminUpdateLeaveStatus = async (leaveId, decision, leaveRow) => {
  const leaderOk =
    leaveRow?.leaderStatus === "approved" ||
    leaveRow?.status === "leader_approved" ||
    leaveRow?.status === "approved" ||
    leaveRow?.status === "rejected";

  if (!leaderOk) return notify("⛔ Leader must approve first.");

  // for UI refresh (avoid only using currentYear)
  const yearForReload = leaveRow?.startDate
    ? new Date(leaveRow.startDate).getFullYear()
    : currentYear;

  try {
    await runTransaction(db, async (tx) => {
      const leaveRef = doc(db, "leaves", leaveId);
      const leaveSnap = await tx.get(leaveRef);
      if (!leaveSnap.exists()) throw new Error("Leave not found");

      const leave = { id: leaveSnap.id, ...leaveSnap.data() };

      const prevStatus = String(leave.status || "pending").toLowerCase();
      const nextStatus = String(decision).toLowerCase();

      const year = getLeaveYear(leave);

      const adminPayload = {
        adminStatus: nextStatus,
        adminActionBy: user.uid,
        adminActionAt: new Date().toISOString(),
        status: nextStatus,
      };

      const units = Number(leave.balanceDeductedUnits ?? calcLeaveUnits(leave));
      const leaveName = leave.leaveName;

      const balRef = doc(db, "leaveBalances", `${leave.userId}_${year}`);
      const balSnap = await tx.get(balRef);

      const balData = balSnap.exists() ? balSnap.data() : { balances: {} };
      const balances = { ...(balData.balances || {}) };
      const typeObj = { ...(balances[leaveName] || {}) };
      const prevTaken = Number(typeObj.taken || 0);

      // ✅ robust boolean
      const wasDeducted = Boolean(leave.balanceDeducted);

      const shouldRefund =
        prevStatus === "approved" && wasDeducted && nextStatus !== "approved";

      if (shouldRefund) {
        typeObj.taken = Math.max(0, prevTaken - units);
        balances[leaveName] = typeObj;

        tx.set(
          balRef,
          { userId: leave.userId, year, balances, updatedAt: new Date().toISOString() },
          { merge: true }
        );

        tx.update(leaveRef, {
          ...adminPayload,
          balanceDeducted: false,
          balanceRefunded: true,
          balanceRefundedAt: new Date().toISOString(),
          balanceRefundedUnits: units,
        });
        return;
      }

      if (nextStatus === "approved") {
        if (wasDeducted) {
          tx.update(leaveRef, adminPayload);
          return;
        }

        typeObj.taken = prevTaken + units;
        balances[leaveName] = typeObj;

        tx.set(
          balRef,
          { userId: leave.userId, year, balances, updatedAt: new Date().toISOString() },
          { merge: true }
        );

        tx.update(leaveRef, {
          ...adminPayload,
          balanceDeducted: true,
          balanceDeductedAt: new Date().toISOString(),
          balanceDeductedUnits: units,
          balanceRefunded: false,
          balanceRefundedAt: null,
          balanceRefundedUnits: null,
        });
        return;
      }

      tx.update(leaveRef, adminPayload);
    });

    notify(`✅ Admin ${decision}`);
    loadAllLeaves();
    loadLeaveBalances(yearForReload); // ✅ refresh correct year
  } catch (err) {
    console.error(err);
    notify("❌ Approve failed: " + err.message);
  }
};


const deleteLeaveRequest = async (id, leaveRow) => {
  try {
    if (!window.confirm("Delete this leave request?")) return;

    const yearForReload = leaveRow?.startDate
      ? new Date(leaveRow.startDate).getFullYear()
      : currentYear;

    await runTransaction(db, async (tx) => {
      const leaveRef = doc(db, "leaves", id);
      const leaveSnap = await tx.get(leaveRef);
      if (!leaveSnap.exists()) return;

      const leave = { id: leaveSnap.id, ...leaveSnap.data() };

      const status = String(leave.status || "").toLowerCase();
      const year = new Date(leave.startDate).getFullYear();
      const leaveName = leave.leaveName;

      const wasDeducted = Boolean(leave.balanceDeducted);

      if (status === "approved" && wasDeducted) {
        const units = Number(leave.balanceDeductedUnits ?? calcLeaveUnits(leave));

        const balRef = doc(db, "leaveBalances", `${leave.userId}_${year}`);
        const balSnap = await tx.get(balRef);

        const balData = balSnap.exists() ? balSnap.data() : { balances: {} };
        const balances = { ...(balData.balances || {}) };
        const typeObj = { ...(balances[leaveName] || {}) };
        const prevTaken = Number(typeObj.taken || 0);

        typeObj.taken = Math.max(0, prevTaken - units);
        balances[leaveName] = typeObj;

        tx.set(
          balRef,
          { userId: leave.userId, year, balances, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }

      tx.delete(leaveRef);
    });

    notify("🗑 Leave request deleted");
    loadAllLeaves();
    loadLeaveBalances(yearForReload); // ✅ refresh correct year
  } catch (err) {
    console.error(err);
    notify("❌ Delete failed: " + err.message);
  }
};


const calcLeaveUnits = (leave) => {
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);

  const days = (end - start) / (1000 * 60 * 60 * 24) + 1; // inclusive
  const dayCount = Math.max(0, days);

  const lt = String(leave.leaveType || "").toLowerCase();
  const multiplier = lt.includes("half") ? 0.5 : 1;

  return dayCount * multiplier;
};

/*   const deleteLeaveRequest = async (id) => {
  try {
    if (!window.confirm("Delete this leave request?")) return;

    await deleteDoc(doc(db, "leaves", id));
    notify("🗑 Leave request deleted");
    loadAllLeaves(); // refresh admin list
  } catch (err) {
    console.error(err);
    notify("❌ Delete failed: " + err.message);
  }
}; */

   const leaderUpdateOvertimeStatus = async (otDocId, status, memberUserId) => {
    if (!leaderMembers.includes(memberUserId)) {
      return notify("🚫 You cannot approve non-member overtime.");
    }
    await updateOvertimeStatus(otDocId, status);
    await loadLeaderOvertime(leaderMembers);
  };

const deleteOvertimeRequest = async (id) => {
  try {
    if (!window.confirm("Delete this overtime request?")) return;

    await deleteDoc(doc(db, "overtimeRequests", id));
    notify("🗑 Overtime request deleted");
    loadAllOvertime(); // refresh admin list
  } catch (err) {
    console.error(err);
    notify("❌ Delete failed: " + err.message);
  }
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

const LEAVE_TYPES = [
  { key: "Annual Leave", label: "Annual", hasCarry: true },
  { key: "Casual Leave", label: "Casual", hasCarry: false },
  { key: "Medical Leave", label: "Medical", hasCarry: false },
  { key: "WithoutPay Leave", label: "WithoutPay", hasCarry: false },
  { key: "Maternity Leave", label: "Maternity", hasCarry: false },
];

// --- Leave Taken helpers (for Leave Balance Management) ---

const isSameYear = (dateStr, year) => {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 4) === String(year);
};

const daysInclusive = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  const s = new Date(startStr);
  const e = new Date(endStr);
  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
};

// return total days taken for a user + leaveName in currentYear
const getLeaveTaken = (uid, leaveName, year = currentYear) => {
  if (!uid) return 0;

  // allLeaves is loaded for admin; fallback safe
  const list = (allLeaves || []).filter((l) => {
    if (l.status !== "approved") return false;
    if (l.userId !== uid) return false;

    // leaveName in your leave requests looks like "Annual Leave", "Casual Leave", etc.
    if ((l.leaveName || "") !== leaveName) return false;

    // include if leave is in this year (simple rule)
    // (if you want cross-year ranges later, we can improve)
    return isSameYear(l.startDate, year) || isSameYear(l.endDate, year);
  });

  return list.reduce((sum, l) => {
    const d = daysInclusive(l.startDate, l.endDate);
    const type = l.leaveType || "Full Day";

    // Simple rule:
    // - Morning Half / Evening Half = 0.5 day (only really valid when start=end)
    // - Full Day = inclusive days
    if ((type === "Morning Half" || type === "Evening Half") && l.startDate === l.endDate) {
      return sum + 0.5;
    }
    return sum + d;
  }, 0);
};

/* All Staff Leave Summary */
const [leaveSummarySearch, setLeaveSummarySearch] = useState("");

const leaveSummaryUids = Object.keys(usersMap || {})
  .filter((uid) => {
    const q = leaveSummarySearch.trim().toLowerCase();
    if (!q) return true;

    const hay = [
      getEid(uid),
      getEmpName(uid),
      getEmpEmail(uid),
    ].join(" ").toLowerCase();

    return hay.includes(q);
  })
  .sort((a, b) => (getEid(a) || "").localeCompare(getEid(b) || ""));




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
  /* const colorStatus = (s) => s === "approved" ? <span className="badge green">Approved</span> : s === "rejected" ? <span className="badge red">Rejected</span> : <span className="badge yellow">Pending</span>; */

  const colorStatus = (s) =>
  s === "approved" ? <span className="badge green">Approved</span>
  : s === "rejected" ? <span className="badge red">Rejected</span>
  : s === "leader_approved" ? <span className="badge blue">Leader Approved</span>
  : <span className="badge yellow">Pending</span>;

  /* ---------------- render ---------------- */
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-box">
          <h2>Staff Attendance Login</h2>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
             />

              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  userSelect: "none",
                  fontSize: "16px"
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </span>
            </div>

           {/*  <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required /> */}
            <button className="btn submit" type="submit">Login</button>
            <button type="button"  className="btn"  style={{ marginTop: 10, background: "#eee", color: "#333" }}  onClick={handlePasswordReset}>
              Forgot Password?
            </button>

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
      <>
      <div className="sidebar-section-title">Leader Dashboard</div>
      <button className="nav-item" onClick={() => {setActiveSidebar("member-att-panel"); setSidebarOpen(false);}}>
        <span className="icon">👥</span> Members Attendance
      </button>
      <button className="nav-item" onClick={() => {setActiveSidebar("member-leave-panel"); setSidebarOpen(false);}}>
        <span className="icon">👥</span> Members Leave Requests
      </button>
      <button className="nav-item" onClick={() => {setActiveSidebar("member-ot-panel"); setSidebarOpen(false);}}>
        <span className="icon">👥</span> Members OT Requests
      </button>
    </>
    )}

    {isAdmin &&  (
      <>
        <hr />
        <div className="sidebar-section-title">Admin Management</div>
       {canAccessPayroll && (
        <button className="nav-item" onClick={() => { setActiveSidebar("admin-employee-form"); setSidebarOpen(false); }}><span className="icon">🧾</span> Employee Information</button>
         )}
        <button  className="nav-item" onClick={() => {setActiveSidebar("admin-employee");setSidebarOpen(false);}}><span className="icon">👥</span> Employee List</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-att-overview"); setSidebarOpen(false);}}>
          <span className="icon">🗓️</span> Attendance Overview
        </button>

        <button className="nav-item" onClick={() => {setActiveSidebar("admin-company-calendar"); setSidebarOpen(false);}}>
          <span className="icon">🎌</span> Company Calendar
        </button>

        <button className="nav-item" onClick={() => {setActiveSidebar("admin-att");setSidebarOpen(false);}}><span className="icon">📊</span> All Attendance</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-att-summary");setSidebarOpen(false);}}><span className="icon">📊</span> Monthly Attendance Summary</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave");setSidebarOpen(false);}}><span className="icon">📄</span>All Leave Requests</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave-balance");setSidebarOpen(false);}}><span className="icon">📊</span> Leave Balance Management</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-leave-summary");setSidebarOpen(false);}}><span className="icon">📝</span>All Staff Leave Summary</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-po");setSidebarOpen(false);}}><span className="icon">💼</span>All Staff P/O Reports</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-ot");setSidebarOpen(false);}}><span className="icon">⏫</span>All Overtime Requests</button>
        <button className="nav-item" onClick={() => {setActiveSidebar("admin-summary");setSidebarOpen(false);}}><span className="icon">📅</span>Monthly Summary</button>
         {/* 🔐 Payroll – ADMIN ONLY */}
        {canAccessPayroll && (
          <>
          <button className="nav-item" onClick={() => {setActiveSidebar("admin-payroll"); setSidebarOpen(false);}}><span className="icon">🏦</span>Payroll Calculator</button>
          <button className="nav-item" onClick={() => { setActiveSidebar("admin-payroll-summary"); setSidebarOpen(false); }}><span className="icon">💰</span> Payroll Summary</button>
          </>
        )}
        
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
            <h2>My Attendance</h2>
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
              <option>WithoutPay Leave</option>
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
                      <option>WithoutPay Leave</option>
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
             {/*  <tbody>
           
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

              </tbody> */}
              <tbody>
              {summaryLeaveTypes.map((leaveName, i) => {
                const base =
                  leaveBalances?.[user.uid]?.balances?.[leaveName]?.base ?? 0;

                // Carry only for Annual Leave
                const carry =
                  leaveName === "Annual Leave"
                    ? (leaveBalances?.[user.uid]?.balances?.[leaveName]?.carry ?? 0)
                    : 0;

                const allowance = Number(base) + Number(carry);

                // ✅ Taken is now manual/admin-controlled (from leaveBalances)
                const taken =
                  Number(leaveBalances?.[user.uid]?.balances?.[leaveName]?.taken ?? 0);

                // ✅ Balance based on admin taken
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
    {isLeader  && activeSidebar === "member-att-panel" && (
   <section className="card">
  <div className="section admin">
    <h2>My Members Attendance</h2>
      
    <div className="filters" style={{ display: "flex", gap: 10, alignItems: "self-start", marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Search by name"
        value={nameFilter}
        onChange={(e) => setNameFilter(e.target.value)}
        style={{ flex: 1 }}
      />

      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
      />
      <button className="btn" onClick={resetFilters}>Reset</button>
    </div>


    <table className="data-table">
      <thead><tr><th>User</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>In Loc</th><th>Out Loc</th><th>Action</th></tr></thead>
      <tbody>
        {filteredMemberAttendance.length === 0 ? <tr><td colSpan="5">No records</td></tr> :
          filteredMemberAttendance.map((at, i) => (
            <tr key={at.id}>
              <td>{displayUser(at.userId)}</td>
              <td>{at.date}</td>
              <td>{toMyanmarTime(at.clockIn)}</td>
              <td>{toMyanmarTime(at.clockOut)}</td>
              <td>{at.locationIn ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${at.locationIn.latitude},${at.locationIn.longitude}`}>📍 View</a> : "-"}</td>
              <td>{at.locationOut ? <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${at.locationOut.latitude},${at}`}>📍 View</a> : "-"}</td>
              <td>
              <button
                className="btn small blue"
                onClick={() => {
                  setEditingLeaderAttendance(at);
                  setLeaderEditIn(at.clockInTime || "");
                  setLeaderEditOut(at.clockOutTime || "");
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

    {isLeader  && activeSidebar === "member-leave-panel" && (
   <section className="card">
  <div className="section admin">
    <h2>My Members Leave Requests</h2>

     <div className="filters" style={{ display: "flex", gap: 10, alignItems: "self-start", marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search by name"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 12 }}>
               <label>Start Date</label>
             <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
               <label>End Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              </div>

              <button className="btn" onClick={resetFilters}>Reset</button>
            </div>
    
    <table className="data-table">
      <thead>
        <tr>
          <th>User</th><th>Start</th><th>End</th><th>Type</th><th>Reason</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        {filteredMemberLeaves.length === 0 ? (
          <tr><td colSpan="7">No leave requests</td></tr>
        ) : (
          filteredMemberLeaves.map((lv) => (
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
     </div>
  </section>
)}

     {isLeader  && activeSidebar === "member-ot-panel" && (
   <section className="card">
  <div className="section admin">
    <h2>My Members Overtime Requests</h2>

    <div className="filters" style={{ display: "flex", gap: 10, alignItems: "self-start", marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Search by name"
        value={nameFilter}
        onChange={(e) => setNameFilter(e.target.value)}
        style={{ flex: 1 }}
      />

      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
      />
      <button className="btn" onClick={resetFilters}>Reset</button>
    </div>

    <table className="data-table">
      <thead>
        <tr>
          <th>User</th><th>Date</th><th>Time</th><th>Total</th><th>Reason</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        {filteredMemberOT.length === 0 ? (
          <tr><td colSpan="7">No overtime requests</td></tr>
        ) : (
          filteredMemberOT.map((ot) => (
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
     </div>
  </section>
)}
 
           
      {/* Admin Employee Management */}
      {canAccessPayroll && isAdmin && activeSidebar === "admin-employee-form" && (
    <section className="card">
    <h2>Employee Information</h2>

    {/* Search + actions */}
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Search by code, name, email, department..."
        value={empSearch}
        onChange={(e) => setEmpSearch(e.target.value)}
        style={{ flex: 1 }}
      />
      <button className="btn" onClick={() => setEmpSearch("")}>Clear</button>
      <button className="btn blue" onClick={openCreateEmployeeModal}>+ New Employee</button>

    </div>

    {/* Employee list (click row to edit) */}
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Dept</th>
            <th>Rank</th>
            <th>Pitch</th>
            <th>Designation</th>
            <th>Email</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.length === 0 ? (
            <tr><td colSpan="8">No employees found</td></tr>
          ) : (
            filteredEmployees.map((e) => (
              <tr
                key={e.id}
                onClick={() => openEmployeeForEdit(e)}
                style={{
                  cursor: "pointer",
                  background: selectedEmpId === e.id ? "#eef6ff" : "",
                }}
              >
                <td>{e.employeeCode || e.eid || "-"}</td>
                <td>{e.employeeName || e.name || "-"}</td>
                <td>{e.department || "-"}</td>
                <td>{e.rank || "-"}</td>
                <td>{e.pitch || "-"}</td>
                <td>{e.designation || "-"}</td>
                <td>{e.email || "-"}</td>
                <td>
                 <button className="btn small" onClick={() => openEditEmployeeModal(e)}>
                  ✏ Edit
                </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

      {/* Form */}
    {showEmpModal && (
  <div className="modal-backdrop" onClick={() => setShowEmpModal(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>
          {selectedEmpId ? "Edit Employee" : "Create New Employee"}
        </h2>
        <button className="btn" onClick={() => setShowEmpModal(false)}>✖</button>
      </div>

      {/* ---- YOUR FORM START ---- */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input
          placeholder="Employee Code"
          value={employeeForm.employeeCode}
          onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })}
        />
        <input
          placeholder="Employee Name"
          value={employeeForm.employeeName}
          onChange={(e) => setEmployeeForm({ ...employeeForm, employeeName: e.target.value })}
        />

        <input
          placeholder="Myanmar Name"
          value={employeeForm.myanmarName}
          onChange={(e) => setEmployeeForm({ ...employeeForm, myanmarName: e.target.value })}
        />
        <select
          value={employeeForm.gender}
          onChange={(e) => setEmployeeForm({ ...employeeForm, gender: e.target.value })}
        >
          <option value="">Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <input
          placeholder="Department"
          value={employeeForm.department}
          onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
        />
        <input
          placeholder="Designation"
          value={employeeForm.designation}
          onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
        />

       <input
          placeholder="Rank"
          value={employeeForm.rank}
          onChange={(e) => setEmployeeForm({ ...employeeForm, rank: e.target.value })}
        />
        <input
          placeholder="Pitch"
          value={employeeForm.pitch}
          onChange={(e) => setEmployeeForm({ ...employeeForm, pitch: e.target.value })}
        />

        {/* For edit mode, show Firestore email (profile) */}
        <input
          placeholder="Email"
          value={employeeForm.email}
          onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
        />

        <div>
          <label style={{ fontSize: 12 }}>DOE</label>
          <input
            type="date"
            value={employeeForm.doe}
            onChange={(e) => setEmployeeForm({ ...employeeForm, doe: e.target.value })}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>DOB</label>
          <input
            type="date"
            value={employeeForm.dob}
            onChange={(e) => setEmployeeForm({ ...employeeForm, dob: e.target.value })}
          />
        </div>

        <input
          placeholder="Employment Type"
          value={employeeForm.employmentType}
          onChange={(e) => setEmployeeForm({ ...employeeForm, employmentType: e.target.value })}
        />

        <input
          placeholder="Probation Period"
          value={employeeForm.probationPeriod}
          onChange={(e) => setEmployeeForm({ ...employeeForm, probationPeriod: e.target.value })}
        />

        <input
          placeholder="Age"
          value={employeeForm.age}
          onChange={(e) => setEmployeeForm({ ...employeeForm, age: e.target.value })}
        />

        <input
          placeholder="NRC"
          value={employeeForm.nrc}
          onChange={(e) => setEmployeeForm({ ...employeeForm, nrc: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={employeeForm.phone}
          onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
        />

        <input
          placeholder="Address"
          value={employeeForm.address}
          onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
        />
        <input
          placeholder="Contact Address"
          value={employeeForm.contactAddress}
          onChange={(e) => setEmployeeForm({ ...employeeForm, contactAddress: e.target.value })}
        />

        <select
          value={employeeForm.maritalStatus}
          onChange={(e) => setEmployeeForm({ ...employeeForm, maritalStatus: e.target.value })}
        >
          <option value="">Marital Status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
        </select>

         <div style={{ position: "relative" }}>
      <label style={{ marginBottom: "10px" }}>Type leader name... </label>
      <input
      placeholder="Type leader name..."
      value={leaderQueryInput}
      autoComplete="off"
      onChange={(e) => {
        setLeaderQueryInput(e.target.value);
        setShowLeaderDropdown(true);
      }}
      onFocus={() => setShowLeaderDropdown(true)}
    />

    {employeeForm.leaderId && (
  <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
    Current leader: <b>{employeeById[employeeForm.leaderId]?.name || "Unknown"}</b>
  </div>
)}

  {/* show dropdown based on INPUT, not leaderQuery */}
   {showLeaderDropdown && leaderQueryInput.trim() && (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 8,
        maxHeight: 200,
        overflowY: "auto",
        zIndex: 9999,
        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
        marginTop: 4,
      }}
    >
      {leaders
        .filter((l) => {
          const q = leaderQueryInput.trim().toLowerCase();
          return (l.name || "").toLowerCase().includes(q);
        })
        .slice(0, 20)
        .map((l) => (
          <div
            key={l.id}
            style={{
              padding: "8px 10px",
              cursor: "pointer",
              borderBottom: "1px solid #f1f1f1",
            }}
            onClick={() => {
              setEmployeeForm({ ...employeeForm, leaderId: l.id });
              setLeaderQueryInput(l.name || "");
              // ✅ close dropdown
              setShowLeaderDropdown(false);
            }}
          >
            <div style={{ fontWeight: 500 }}>{l.name}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{l.email}</div>
          </div>
        ))}
    </div>
  )}
</div>
        
        
        {/* ✅ Only show LOGIN EMAIL + TEMP PASSWORD when creating */}
        {!selectedEmpId && (
          <>
           <label style={{ marginBottom: "10px" }}>Login Email </label>
            <input
              type="email"
              placeholder="Login Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              autoComplete="off"
              name="new-login-email"
            />

            <label style={{ marginBottom: "10px" }}>Temporary Password </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={{ flex: 1 }}
                type={showTempPw ? "text" : "password"}
                placeholder="Temporary Password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                autoComplete="new-password"
                name="new-temp-password"
              />
              <button type="button" className="btn small" onClick={() => setShowTempPw(v => !v)}>
                {showTempPw ? "Hide" : "Show"}
              </button>
            </div>
          </>
        )}
      </div>

     

     <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <button
          className="btn blue"
          onClick={async () => {
            if (selectedEmpId) await updateEmployee();
            else await createEmployee();

            // close modal after save
            setShowEmpModal(false);
          }}
        >
          💾 Save
        </button>

        <button
          className="btn red"
          onClick={() => {
            startCreateEmployee();
            setShowEmpModal(false);
          }}
        >
          Cancel
        </button>
      </div>
      {/* ---- YOUR FORM END ---- */}
    </div>
  </div>
)}

  
  </section>
)}


  {isAdmin && activeSidebar === "admin-employee" && (
  <section className="card">
    <h2>Employee Management</h2>

    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Search by ID, name, email, department..."
        value={employeeSearch}
        onChange={(e) => setEmployeeSearch(e.target.value)}
        style={{ flex: 1 }}
      />
      <button className="btn small" onClick={() => setEmployeeSearch("")}>
        Clear
      </button>
    </div>


      <table className="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Team</th>
          <th>Position</th>
          <th>JLPT</th>
          {/* <th>Join Date</th> */}
          <th>Locations</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
       {filteredEmployeeslocation.map((emp) => (

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
              {/* <td>{emp.joinDate}</td> */}
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

        {isAdmin && activeSidebar === "admin-company-calendar" && (
        <section className="card">
        <h2>Company Calendar (Holidays)</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>Month:</label>
        <input type="month" value={holidayMonth} onChange={(e) => setHolidayMonth(e.target.value)} />

        <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
        <input
          type="text"
          placeholder="Holiday name"
          value={holidayName}
          onChange={(e) => setHolidayName(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <button className="btn blue" onClick={adminAddOrUpdateHoliday}>💾 Save Holiday</button>
        </div>

        <div style={{ marginTop: 14 }}>
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Name</th><th>Action</th></tr>
          </thead>
          <tbody>
            {companyHolidays.length === 0 ? (
              <tr><td colSpan="3">No holidays in this month.</td></tr>
            ) : (
              companyHolidays.map((h) => (
                <tr key={h.id}>
                  <td style={{ color: "red", fontWeight: 700 }}>{h.date}</td>
                  <td style={{ color: "red", fontWeight: 700 }}>{h.name}</td>
                  <td>
                    <button className="btn small red" onClick={() => adminDeleteHoliday(h.id)}>🗑 Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        </section>
        )}


        {isAdmin && activeSidebar === "admin-att-overview" && (
        <section className="card">
        <h2>Attendance Overview (Calendar)</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontWeight: 600 }}>Month:</label>
        <input type="month" value={overviewMonth} onChange={(e) => setOverviewMonth(e.target.value)} />

        <label style={{ fontWeight: 600 }}>Staff:</label>
        <select value={overviewUserId} onChange={(e) => setOverviewUserId(e.target.value)} style={{ minWidth: 260 }}>
        <option value="">-- Select staff --</option>
        {Object.keys(usersMap || {})
          .sort((a, b) => (usersMap[a]?.eid || "").localeCompare(usersMap[b]?.eid || ""))
          .map((uid) => (
            <option key={uid} value={uid}>
              {(usersMap[uid]?.eid || "-")} - {(usersMap[uid]?.name || usersMap[uid]?.email || uid)}
            </option>
          ))}
        </select>
        </div>

        {!overviewUserId ? (
        <div>Please select a staff.</div>
        ) : (
        <div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
          gap: 8
        }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} style={{ fontWeight: 800, opacity: 0.7 }}>{d}</div>
          ))}

            {buildCalendarCells(overviewMonth).map((dateStr, idx) => {
              if (!dateStr) return <div key={idx} style={{ minHeight: 92 }} />;

              const weekday = new Date(dateStr + "T00:00:00").getDay(); // ✅ stable
              const isWeekend = weekday === 0 || weekday === 6;
              const isHoliday = !!holidayMap[dateStr];
              const isRedDay = isWeekend || isHoliday;

              const att = findAttendanceByUserAndDate(overviewUserId, dateStr);
              const leaveAbbr = getLeaveAbbreviationForDate(overviewUserId, dateStr) || "";

              return (
                <div
                  key={dateStr}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 10,
                    minHeight: 92,
                    background: isHoliday ? "#fecaca" : isWeekend ? "#fef2f2" : "white"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900, color: isRedDay ? "#b91c1c" : "inherit" }}>
                      {dateStr}
                    </div>

                    {leaveAbbr ? (
                      <div style={{ fontWeight: 900, color: "#d97706" }}>{leaveAbbr}</div>
                    ) : null}
                  </div>

                  {isHoliday && (
                    <div style={{ marginTop: 6, color: "#b91c1c", fontWeight: 700, fontSize: 12 }}>
                      🎌 {holidayMap[dateStr]?.name}
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <div><b>IN:</b> {att?.clockInTime || "—"}</div>
                    <div><b>OUT:</b> {att?.clockOutTime || "—"}</div>
                  </div>
                </div>
              );
            })}
                    </div>
                  </div>
                )}
          </section>
        )}

        {/* ADMIN: All Attendance */}
        {isAdmin && activeSidebar==="admin-att" && (
          <section className="card">
            <h2>All Staff Attendance</h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input
              style={{ flex: 1,width: 350 }}
              placeholder="Search by employee ID, name, email, date..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
             
            />
            <input
              type="month"
              value={attendanceMonth}
              onChange={(e) => setAttendanceMonth(e.target.value)}
              style={{ width: 150 }}
            />
            <button className="btn" onClick={() => setAttendanceSearch("")}>Clear</button>
          </div>

            <button
            className="btn blue"
            onClick={() => openCreateAttendance ()}
            >
            ➕ Add Attendance
            </button>
            </div>

            <table className="data-table">
              <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Leave</th>
                <th>Date</th>
                <th>In</th>
                <th>Out</th>
                <th>In Loc</th>
                <th>Out Loc</th>
                <th>Action</th>
              </tr>
            </thead>

              <tbody>
                {allAttendance.length===0 ? <tr><td colSpan="7">No attendance</td></tr> :
                  filteredAttendance.map((a) => (
                    <tr key={a.id}>
                      {/* <td>{usersMap[a.userId] || a.userId}</td> */}
                       <td style={{ fontWeight: 700 }}>{getEid(a.userId) || "-"}</td>
                       <td>{usersMap[a.userId]?.name || usersMap[a.userId]?.email || a.userId}</td>
                        <td style={{ fontWeight: 700, color: "#d97706" }}>
                        {getLeaveAbbreviationForDate(a.userId, a.date) || "—"}
                      </td>
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
                     <button  className="btn red" onClick={adminDeleteAttendance} >  🗑 Delete </button>
                    <button className="btn red" onClick={() => setEditingAttendance(null)}>
                      ✖ Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add attend modal box */}
            {creatingAttendance && (
              <div className="modal-overlay">
                <div className="modal">
                  <h3>➕ Add Attendance</h3>
                  
                  <div className="form" style={{ gap: 12 }}>
                    {/* Staff select */}
                    <div>
                       <label style={{ fontWeight: 600 }}>Select employee</label>
                      <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                      <option value="">Select employee</option>
                      {Object.keys(usersMap).map((uid) => (
                        <option key={uid} value={uid}>
                          {displayUser(uid)} ({usersMap[uid]?.eid || ""})
                        </option>
                      ))}
                    </select>
                    </div>
                    
                    {/* Date */}
                    <div>
                       <label style={{ fontWeight: 600 }}>For Single Day Insert</label>
                      <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)}/>
                      </div>
                       <div>
                      <label style={{ fontWeight: 600 }}>For Whole Month Insert</label>
                      <input type="month" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} />
                      <label style={{ display: "inline" }}>
                      <input type="checkbox" checked={bulkWeekdaysOnly} onChange={(e) => setBulkWeekdaysOnly(e.target.checked)} style={{ width: 18,height:18,verticalAlign:"middle" }}/>
                        Weekdays only (Mon–Fri)
                      </label>
                    </div>
                      
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label>Clock In</label>
                        <input type="time" value={createIn} onChange={(e) => setCreateIn(e.target.value)} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label>Clock Out</label>
                        <input type="time" value={createOut} onChange={(e) => setCreateOut(e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button className="btn blue" onClick={adminCreateOrUpdateAttendance}>📅 Add Single Day</button>
                      <button className="btn blue" onClick={adminBulkCreateMonthAttendance}>📅 Add Whole Month</button>
                      <button  className="btn red" onClick={adminDeleteMonthAttendance}>  🗑 Delete Whole Month</button>
                    </div>
                    <div style={{ width: 100, margin: "0 auto"}}>
                      <button className="btn red" onClick={() => setCreatingAttendance(false)}>✖ Cancel</button>
                    </div>
                  </div>
            
                  </div>
                </div>
              )}

          </section>
        )}

         {isAdmin && activeSidebar==="admin-att-summary" && (
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Monthly Attendance Summary ({attendanceMonth})</h2>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <label style={{ fontWeight: 600 }}>Month:</label>
                <input
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  style={{ width: 160 }}
                />
              </div>


              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Present Days</th>
                    <th>Missing Clock In</th>
                    <th>Missing Clock Out</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaryByUser.map((r) => (
                    <tr key={r.uid}>
                      <td style={{ fontWeight: 700 }}>{r.eid || "-"}</td>
                      <td>{r.name}</td>
                      <td>{r.presentDays}</td>
                      <td style={{ color: r.missingClockIn > 0 ? "red" : "inherit" }}>
                        {r.missingClockIn}
                      </td>
                      <td style={{ color: r.missingClockOut > 0 ? "red" : "inherit" }}>
                        {r.missingClockOut}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            <div className="filters" style={{ display: "flex", gap: 10, alignItems: "self-start", marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search by name"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 12 }}>
               <label>Start Date</label>
             <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
               <label>End Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              </div>
               <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={showApprovedLeave}
                  onChange={(e) => setShowApprovedLeave(e.target.checked)}
                />
                Approved
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={showRejectedLeave}
                  onChange={(e) => setShowRejectedLeave(e.target.checked)}
                />
                Rejected
              </label>
            </div>

              <button className="btn" onClick={resetFilters}>Reset</button>
            </div>
            
            <table className="data-table">
              <thead>
              <tr>
                <th>User</th><th>Start</th><th>End</th><th>LeaveType</th><th>LeaveName</th>
                <th>Reason</th>
                <th>Leader</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
              <tbody>
                {filteredAllMemberLeaves.length===0 ? <tr><td colSpan="10">No leave requests</td></tr> :
                  filteredAllMemberLeaves.map((lv) => (
                    <tr key={lv.id}>
                     {/*  <td>{usersMap[lv.userId] || lv.userId}</td> */}
                     <td>{displayUser(lv.userId)}</td>

                      <td>{lv.startDate}</td>
                      <td>{lv.endDate}</td>
                      <td>{lv.leaveType}</td>
                      <td>{lv.leaveName}</td>
                      <td>{lv.reason}</td>
                       <td>{lv.leaderActionBy ? displayUser(lv.leaderActionBy) : "-"}</td>
                      <td>{lv.adminActionBy ? displayUser(lv.adminActionBy) : "-"}</td>
                      <td>{colorStatus(lv.status)}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "start", gap: "2px" }}>
                          {/* <button className="btn small" onClick={() => updateLeaveStatus(lv.id, "approved")}>✅</button>
                          <button className="btn small red" onClick={() => updateLeaveStatus(lv.id, "rejected")}>❌</button> */}
                          <button className="btn small" onClick={() => adminUpdateLeaveStatus(lv.id, "approved", lv)}>✅</button>
                          <button className="btn small red" onClick={() => adminUpdateLeaveStatus(lv.id, "rejected", lv)}>❌</button>

                            <button
                            className="btn small blue"
                             onClick={() => {
                              
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
                          <button
                            className="btn small red"
                            onClick={() => deleteLeaveRequest(lv.id)}
                          >
                            🗑️
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
                      <option>WithoutPay Leave</option>
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

        {/* Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            value={leaveSearch}
            onChange={(e) => setLeaveSearch(e.target.value)}
            placeholder="Search by Employee ID, name, email..."
            style={{ flex: 1 }}
          />
          <button className="btn small" onClick={() => setLeaveSearch("")}>Clear</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Employee ID</th>
                <th style={{ width: 260 }}>Name</th>
                <th>Leave Balance</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredUserIdsForLeave.map((uid) => {
                // keep your setValue logic (same as your current code)
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
                    <td style={{ fontWeight: 700 }}>
                      {usersMap[uid]?.eid || "-"}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700 }}>{displayUser(uid)}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {usersMap[uid]?.email || ""}
                      </div>
                    </td>

                    {/* Leave list (your sketch) */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {LEAVE_TYPES.map((t) => {
                          const base = getBal(uid, t.key, "base");
                          const carry = t.hasCarry ? getBal(uid, t.key, "carry") : 0;
                          const allowance = Number(base) + Number(carry);

                          // manual taken stored in leaveBalances
                          const manualTaken = getBal(uid, t.key, "taken");

                          // if manual taken is empty/null, fallback to computed taken from leave requests
                          const computedTaken = getLeaveTaken(uid, t.key);
                          const taken = (manualTaken !== "" && manualTaken !== null && manualTaken !== undefined)
                            ? Number(manualTaken)
                            : Number(computedTaken);

                          const balance = allowance - taken;


                          return (
                            <div
                              key={t.key}
                              style={{
                                border: "1px solid #e9eef5",
                                borderRadius: 10,
                                padding: 12,
                                background: "#fff",
                              }}
                            >
                              <div style={{ width: 670, display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 100, fontWeight: 700 }}>{t.label}</div>

                                {/* Header row inside */}
                                <div style={{ display: "grid", gridTemplateColumns: t.hasCarry ? "120px 120px 120px 120px" : "120px 120px 120px", gap: 10, alignItems: "center" }}>
                                  <div style={{ fontSize: 12, color: "#666" }}>Allowance</div>
                                  {t.hasCarry && <div style={{ fontSize: 12, color: "#666" }}>Carry</div>}
                                  <div style={{ fontSize: 12, color: "#666" }}>Taken</div>
                                  <div style={{ fontSize: 12, color: "#666" }}>Balance</div>

                                  {/* Inputs row */}
                                  <input
                                    type="number"
                                    value={base}
                                    onChange={(e) => setValue(t.key, "base", e.target.value)}
                                   
                                    placeholder="Base"
                                  />

                                  {t.hasCarry && (
                                    <input
                                      type="number"
                                      value={carry}
                                      onChange={(e) => setValue(t.key, "carry", e.target.value)}
                                     
                                      placeholder="Carry"
                                    />
                                  )}

                                  {/* Taken: usually computed (read-only). If you want manual, change to input + store. */}
                                 <input
                                  type="number"
                                  value={taken}
                                  onChange={(e) => setValue(t.key, "taken", e.target.value)}
                                  placeholder="Taken"
                                />


                                  <input
                                    type="number"
                                    value={balance}
                                    readOnly
                                    style={{
                                      background: "#f7f8fa",
                                      color: balance < 0 ? "red" : "#111",
                                      fontWeight: 700,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>

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

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Search by employee ID, name, email..."
              value={leaveSummarySearch}
              onChange={(e) => setLeaveSummarySearch(e.target.value)}
            />
            <button className="btn" onClick={() => setLeaveSummarySearch("")}>Clear</button>
          </div>


            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Leave Type</th>
                  <th>Allowance</th>
                  <th>Taken</th>
                  <th>Balance</th>
                </tr>
              </thead>
             {/*  <tbody>
                {Object.keys(usersMap).map((uid)  => {
                  
                  const leaveTypes = {
                    "Casual Leave": 6,
                    "Annual Leave": 10,
                    "Medical Leave": 90,
                    "WithoutPay Leave": 10,
                    "Maternity Leave": 98,
                  };

                  
                  const selectedType = leaveSelections[uid] || "Casual Leave";

                 
                  const staffLeaves = allLeaves.filter(
                    (lv) => lv.userId === uid && lv.status === "approved"
                  );
                 
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
              </tbody> */}
              <tbody>
                {leaveSummaryUids.map((uid) => {
                  const leaveTypes = {
                    "Casual Leave": 6,
                    "Annual Leave": 10,
                    "Medical Leave": 90,
                    "WithoutPay Leave": 10,
                    "Maternity Leave": 98,
                  };

                  const selectedType = leaveSelections[uid] || "Casual Leave";

                  // ✅ Allowance from leaveBalances (carry only for Annual Leave)
                  const base = leaveBalances?.[uid]?.balances?.[selectedType]?.base ?? 0;
                  const carry =
                    selectedType === "Annual Leave"
                      ? (leaveBalances?.[uid]?.balances?.[selectedType]?.carry ?? 0)
                      : 0;

                  const allowance = Number(base) + Number(carry);

                  // ✅ Taken from leaveBalances (manual admin edit)
                  const taken = Number(
                    leaveBalances?.[uid]?.balances?.[selectedType]?.taken ?? 0
                  );

                  const balance = Math.max(0, allowance - taken);

                  return (
                    <tr key={uid}>
                      <td style={{ fontWeight: 700 }}>{getEid(uid) || "-"}</td>
                      <td>{displayUser(uid)}</td>

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

             <div className="filters" style={{ display: "flex", gap: 10, alignItems: "self-start", marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search by name"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  style={{ flex: 1 }}
                />

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={showApprovedOT}
                      onChange={(e) => setShowApprovedOT(e.target.checked)}
                    />
                    Approved
                  </label>

                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={showRejectedOT}
                      onChange={(e) => setShowRejectedOT(e.target.checked)}
                    />
                    Rejected
                  </label>
                 </div>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                <button className="btn" onClick={resetFilters}>Reset</button>
              </div>

            <table className="data-table">
              <thead><tr><th>User</th><th>Date</th><th>Time</th><th>Total</th><th>Reason</th><th>Approver</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filteredAllMemberOT.length===0 ? <tr><td colSpan="8">No OT requests</td></tr> :
                  filteredAllMemberOT.map((ot) => (
                    <tr key={ot.id}>
                      {/* <td>{usersMap[ot.userId] || ot.userId}</td> */}
                      <td>{displayUser(ot.userId)}</td>

                      <td>{ot.date}</td>
                      <td>{ot.startTime} - {ot.endTime}</td>
                      <td>{ot.totalTime}</td>
                      <td>{ot.reason}</td>
                      <td>{ot.actionBy ? displayUser(ot.actionBy) : "-"}</td>
                      <td>{colorStatus(ot.status)}</td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                        <button className="btn small" onClick={()=>updateOvertimeStatus(ot.id,"approved")}>✅</button>
                        <button className="btn small red" onClick={()=>updateOvertimeStatus(ot.id,"rejected")}>❌</button>
                        <button
                          className="btn small red"
                          onClick={() => deleteOvertimeRequest(ot.id)}
                        >
                          🗑️
                        </button>
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
        {canAccessPayroll && isAdmin && activeSidebar === "admin-payroll" && (
          <section className="card">
            <h2>Payroll Calculator</h2>
            <PayrollCalculator usersMap={usersMap} />
          </section>
        )} 


       {canAccessPayroll && isAdmin && activeSidebar === "admin-payroll-summary" && (
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
          <th>Pay Month</th>
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
              <td>For {p.month}</td>
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

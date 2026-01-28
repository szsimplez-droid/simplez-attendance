/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";

const notify = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.cssText = `
    position: fixed;
    top: 18px;
    right: 18px;
    background: #2ecc71;
    color: #fff;
    padding: 10px 14px;
    border-radius: 6px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    z-index: 9999;
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
};

export default function PayrollCalculator({ usersMap }) {
  const [selectedUserId, setSelectedUserId] = useState("");

  function minutesToHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}


  // AUTO FILL DATA FROM FIRESTORE
  const loadPayrollAutoData = async (uid) => {
  if (!uid) return;

  // --- LOAD ATTENDANCE ---
  const attQ = query(collection(db, "attendance"), where("userId", "==", uid));
  const attSnap = await getDocs(attQ);

  let attendanceDays = 0;
  let holidayDays = 0;
  let holidayHours = 0;

  attSnap.forEach((doc) => {
    const a = doc.data();
    if (a.clockIn) attendanceDays++;

    const date = new Date(a.date);
    const day = date.getDay(); // 0 = Sun, 6 = Sat

    if (day === 0 || day === 6) {
      holidayDays++;

      if (a.clockIn && a.clockOut) {
        const diff = (new Date(a.clockOut) - new Date(a.clockIn)) / 3600000;
        holidayHours += diff > 0 ? diff : 0;
      }
    }
  });

  // --- LOAD LEAVES ---
  const leaveQ = query(collection(db, "leaves"), where("userId", "==", uid));
  const leaveSnap = await getDocs(leaveQ);

  let annual = 0,
    casual = 0,
    sick = 0,
    comp = 0;

  leaveSnap.forEach((doc) => {
    const l = doc.data();
    if (l.status !== "approved") return;

    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    const days = (end - start) / 86400000 + 1;

    if (l.leaveName === "Annual Leave") annual += days;
    if (l.leaveName === "Casual Leave") casual += days;
    if (l.leaveName === "Sick Leave") sick += days;
    if (l.leaveName === "Withoutpay Leave") comp += days;
  });

  // --- LOAD OVERTIME ---
  const otQ = query(collection(db, "overtimeRequests"), where("userId", "==", uid));
  const otSnap = await getDocs(otQ);

  let otHours = 0;

  otSnap.forEach((doc) => {
    const o = doc.data();
    if (o.status !== "approved") return;

    const [sh, sm] = o.startTime.split(":").map(Number);
    const [eh, em] = o.endTime.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);

    if (diff > 0) otHours += diff / 60;
  });

  // --- LOAD P/O REPORT (Late hours) ---
// -------------------- LATE / EARLY / OUTING --------------------
let totalLateMinutes = 0;
let totalEarlyMinutes = 0;
let totalOutMinutes = 0;

// Official times
const workStart = 8 * 60;   // 08:00
const workEnd = 17 * 60;    // 17:00

// --- Check attendance for LATE & EARLY ---
attSnap.forEach((doc) => {
  const a = doc.data();
  if (!a.clockIn || !a.clockOut) return;

  const ci = new Date(a.clockIn);
  const co = new Date(a.clockOut);

  const ciMin = ci.getHours() * 60 + ci.getMinutes();
  const coMin = co.getHours() * 60 + co.getMinutes();

  // LATE
  if (ciMin > workStart) totalLateMinutes += ciMin - workStart;

  // EARLY LEAVE
  if (coMin < workEnd) totalEarlyMinutes += workEnd - coMin;
});

// --- OUTING FROM P/O REPORT ---
const poQ = query(collection(db, "poReports"), where("userId", "==", uid));
const poSnap = await getDocs(poQ);

poSnap.forEach((doc) => {
  const p = doc.data();
  const [fh, fm] = p.fromTime.split(":").map(Number);
  const [th, tm] = p.toTime.split(":").map(Number);

  const start = fh * 60 + fm;
  const end = th * 60 + tm;

  if (end > start) totalOutMinutes += end - start;
});

// TOTAL LATE/EARLY/OUT
const totalLateHoursDecimal =
  (totalLateMinutes + totalEarlyMinutes + totalOutMinutes) / 60;

// Convert to hr/min formatted string
const totalLateHM = minutesToHM(
  totalLateMinutes + totalEarlyMinutes + totalOutMinutes
);

// ---------------- UPDATE FORM ----------------
setData((prev) => ({
  ...prev,
  lateHours: totalLateHoursDecimal,  // keeps numeric for calculation
  lateHM: totalLateHM,               // add readable format
}));


  // --- UPDATE FORM ---
  setData((prev) => ({
    ...prev,
    annualLeave: annual,
    casualLeave: casual,
    sickLeave: sick,
    compLeave: comp,
    holidayWorkDays: holidayDays,
    holidayWorkHours: holidayHours,
    overtimeHours: otHours,
    lateHours: totalLateHoursDecimal, // for numeric use in payroll
    lateHM: totalLateHM,              // formatted hr/min for UI display
    workedDays: attendanceDays,
  }));
};


  const [data, setData] = useState({
    name: "",
    userId:"",
    languageLevel: "",
    staffId: "",
    type: "正社員",
    staffposition: "",
    staffteam: "",
    paymonth:"",
    workType: "フルタイム",
    joinDate: "",
    standardDays: 21,
    workedDays: 20.5,
    annualLeave: 0,
    casualLeave: 0,
    absentDays: 0,
    sickLeave: 0,
    compLeave: 0,
    holidayWorkDays: 0,
    holidayWorkHours: 0,
    overtimeHours: 0,
    lateHours: 0,
    basicSalary: 668000,
    permanentEmp: 0,
    pitchAdjust: 0,
    pitchTransfer: 20000,
    jobAllowance: 30000,
    directorAllowance: 0,
    languageAllowance: 100000,
    ssb: 0,
    incomeTax: 0,
    bonus: 0,
    centralRate: 2100,
    cbRate: 3950,
  });

  /* const handleChange = (e) => {
    const { name, value } = e.target;
    setData((p) => ({ ...p, [name]: parseFloat(value) || value }));
  }; */

  const handleChange = (e) => {
  const { name, value } = e.target;
  // If value is blank, keep blank
  if (value === "") {
    setData((prev) => ({ ...prev, [name]: "" }));
  } else {
    const num = parseFloat(value);
    setData((prev) => ({
      ...prev,
      [name]: isNaN(num) ? value : num,
    }));
  }
};

  const actualHours = data.standardDays * 8;
  const holidayDays =
    data.annualLeave +
    data.casualLeave +
    data.absentDays +
    data.sickLeave +
    data.compLeave;

  const basicLatest =
    data.basicSalary + data.permanentEmp + data.pitchAdjust + data.pitchTransfer;
  const basicTotal =
    basicLatest + data.jobAllowance + data.directorAllowance + data.languageAllowance;

  const overtimeRate = Math.ceil(((basicTotal * 12) / (52 * 48)) * 2 / 100) * 100;
  const holidayRate = Math.ceil(((basicTotal / 30) * 2 / 8) / 100) * 100;
  const deductionRate = Math.floor(basicTotal / actualHours);

  const fixedOvertime = overtimeRate * 10;
  const totalPay = basicTotal + fixedOvertime;

  const absenceDeduction = deductionRate * data.absentDays * 8;
  const lateDeduction = deductionRate * data.lateHours;
  const fixedOvertimeDeduction = holidayDays >= 10 ? fixedOvertime : 0;

  const overtimeAllowance =
    data.overtimeHours <= 10
      ? 0
      : Math.round((data.overtimeHours - 10) * overtimeRate);
  const holidayAllowance =
    data.holidayWorkDays * holidayRate * 8 +
    data.holidayWorkHours * holidayRate;
  const wfhAllowance = data.workedDays * 1600;

  const afterDeduction =
    totalPay -
    (absenceDeduction +
      lateDeduction +
      fixedOvertimeDeduction +
      data.ssb +
      data.incomeTax) +
    (overtimeAllowance + holidayAllowance + wfhAllowance + data.bonus);

  const salaryTransfer = Math.round(afterDeduction / 100) * 100;
  const usdConversion = Math.round(salaryTransfer / data.centralRate);


  const preferentialTotal = usdConversion * data.cbRate;

  return (
    <div className="payroll-form">
      <h1>Payroll Calculator</h1>

      <section className="form-section">
        <h2>👤 Employee</h2>
        {/* --- Select Staff Dropdown --- */}

           {/*  <select
        value={selectedUserId}
        onChange={(e) => {
            setSelectedUserId(e.target.value);
            loadPayrollAutoData(e.target.value);
        }}
    >
        <option value="">-- Select Employee --</option>

        {Object.entries(usersMap).map(([uid, name]) => (
            <option key={uid} value={uid}>
                {name}
            </option>
        ))}
  </select> */}

      {/* <select
      value={selectedUserId}
      onChange={(e) => {
        setSelectedUserId(e.target.value);
       
        setData(prev => ({
          ...prev,
          userId: e.target.value   // THIS IS UID
        }));
      }}
    >
      <option value="">Select Staff</option>
      {Object.entries(usersMap).map(([uid, name]) => (
        <option key={uid} value={uid}>{name}</option>
      ))}
    </select> */}

    <select
  value={selectedUserId}
  onChange={(e) => {
    const uid = e.target.value;
    setSelectedUserId(uid);

    setData(prev => ({ ...prev, userId: uid }));
    loadPayrollAutoData(uid); // ✅ put back
  }}
>
  <option value="">Select Staff</option>
  {Object.entries(usersMap).map(([uid, u]) => (
    <option key={uid} value={uid}>
      {typeof u === "string" ? u : (u.name || u.email || uid)}
    </option>
  ))}
</select>


        <div className="form-grid">


          <label>名前 <br></br>Name<input name="name" value={data.name} onChange={handleChange} /></label>
          <label>語力 <br></br>JLPT Level<input name="languageLevel" value={data.languageLevel} onChange={handleChange} /></label>
          <label>社員番号 <br></br>Employee No<input name="staffId" value={data.staffId} onChange={handleChange} /></label>
          <label>役職 <br></br>Position<input name="staffposition" value={data.staffposition} onChange={handleChange} /></label>
          <label>チーム <br></br>Team<input name="staffteam" value={data.staffteam} onChange={handleChange} /></label>
          <label>For the Month of<input name="paymonth" value={data.paymonth} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>📅 Days</h2>
        <div className="form-grid">
          <label>所定日数 <br></br>Working Days<input type="number" name="standardDays" value={data.standardDays} onChange={handleChange} /></label>
          <label>出勤日数 <br></br>Attendance Days <input type="number" name="workedDays" value={data.workedDays} onChange={handleChange} /></label>
          <label>実働時間 <br></br>Working Hour<input value={actualHours} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>🏖 Leave</h2>
        <div className="form-grid">
          <label>有給 <br></br>Annual Leave<input type="number" name="annualLeave" value={data.annualLeave} onChange={handleChange} /></label>
          <label>臨時休暇 <br></br>Casual Leave<input type="number" name="casualLeave" value={data.casualLeave} onChange={handleChange} /></label>
          <label>欠勤 <br></br>Abesent Days<input type="number" name="absentDays" value={data.absentDays} onChange={handleChange} /></label>
          <label>病気休暇 <br></br>Medical Leave<input type="number" name="sickLeave" value={data.sickLeave} onChange={handleChange} /></label>
          <label>代休 <br></br>Compensatory holiday<input type="number" name="compLeave" value={data.compLeave} onChange={handleChange} /></label>
          <label>休日出勤日数 <br></br>Holiday work days<input type="number" name="holidayWorkDays" value={data.holidayWorkDays} onChange={handleChange} /></label>
          <label>休暇日数 <br></br>Total Holiday days<input value={holidayDays} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>⏰ Work Hours</h2>
        <div className="form-grid">
          <label>休日出勤時間 <br></br>Holiday Work time<input type="number" name="holidayWorkHours" value={data.holidayWorkHours} onChange={handleChange} /></label>
          <label>残業時間 <br></br>Overtime Hours<input type="number" name="overtimeHours" value={data.overtimeHours} onChange={handleChange} /></label>
          <label>遅刻・早退・外出 (時間) <br></br>Late/Early Departure/Outing<input value={data.lateHM || "0h 0m"} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>💰 Rates</h2>
        <div className="form-grid">
          <label>残業手当@1時間 <input value={overtimeRate} disabled /></label>
          <label>休日手当@1時間 <input value={holidayRate} disabled /></label>
          <label>減給額@1時間 <input value={deductionRate} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>💵 Salary</h2>
        <div className="form-grid">
          <label>基本給 <br></br>Basic salary<input type="number" name="basicSalary" value={data.basicSalary} onChange={handleChange} /></label>
          <label>正社員付与 <br></br>Permanent employee<input type="number" name="permanentEmp" value={data.permanentEmp} onChange={handleChange} /></label>
          <label>ピッチ間調整 <input type="number" name="pitchAdjust" value={data.pitchAdjust} onChange={handleChange} /></label>
          <label>ピッチ移行調整 <br></br> Pitch adjust<input type="number" name="pitchTransfer" value={data.pitchTransfer} onChange={handleChange} /></label>
          <label>基本給(最新) <br></br>Basic salary (latest)<input value={basicLatest} disabled /></label>
          <label>役職手当 <br></br> Job title allowance<input type="number" name="jobAllowance" value={data.jobAllowance} onChange={handleChange} /></label>
          <label>取締役手当 <br></br>Director allowance<input type="number" name="directorAllowance" value={data.directorAllowance} onChange={handleChange} /></label>
          <label>語力手当 <br></br>Language Allowance (JLPT) <input type="number" name="languageAllowance" value={data.languageAllowance} onChange={handleChange} /></label>
          <label>基本給+手当 <br></br>Basic salary + Allowance <input value={basicTotal} disabled /></label>
          <label>固定残業 <br></br>Fixed overtime <input value={fixedOvertime} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>📊 Deductions & Allowances</h2>
        <div className="form-grid">
          <label>欠勤控除 <br></br>Absence deduction<input value={absenceDeduction} disabled /></label>
          <label>遅刻控除 <br></br>Late deduction<input value={lateDeduction} disabled /></label>
          <label>固定残業控除 <br></br>Fixed overtime deduction<input value={fixedOvertimeDeduction} disabled /></label>
          <label>社会福祉 <br></br>(SSB) <input type="number" name="ssb" value={data.ssb} onChange={handleChange} /></label>
          <label>所得税 <br></br>(Income Tax) <input type="number" name="incomeTax" value={data.incomeTax} onChange={handleChange} /></label>
          <label>残業手当 <br></br>Overtime allowance <input value={overtimeAllowance} disabled /></label>
          <label>休出手当 <br></br>Holiday work allowance<input value={holidayAllowance} disabled /></label>
          <label>在宅勤務手当 <br></br>Work from home Allowance<input value={wfhAllowance} disabled /></label>
          <label>賞与 <br></br>Bonus<input type="number" name="bonus" value={data.bonus} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>🏦 Totals</h2>
        <div className="form-grid">
          <label>総支給額 <br></br>The Total Amount paid <input value={totalPay} disabled /></label>
          <label>控除後(当月給与) <br></br>After deduction<input value={afterDeduction} disabled /></label>
          <label>給与振込額 <br></br>Salary transfer amount<input value={salaryTransfer} disabled /></label>
          <label>USD/MMK(中央銀行) <br></br>Central Bank rate<input type="number" name="centralRate" value={data.centralRate} onChange={handleChange} /></label>
          <label>USD/MMK<br></br>CB Bank rate <input type="number" name="cbRate" value={data.cbRate} onChange={handleChange} /></label>
          <label>USD換算 <br></br>USD conversion <input value={usdConversion.toFixed(2)} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>🏦 Special Payment amount</h2>
        <div className="form-grid">
          <label>総支給額(優遇レート) <input value={preferentialTotal.toFixed(2)} disabled /></label>
        </div>
      </section>

    {/*   <button
  className="btn submit"
  onClick={async () => {
    if (!data.name) return notify("Please enter employee name before saving");
    try {
      const payload = {
        ...data,
        actualHours,
        holidayDays,
        basicLatest,
        basicTotal,
        overtimeRate,
        holidayRate,
        deductionRate,
        fixedOvertime,
        totalPay,
        absenceDeduction,
        lateDeduction,
        fixedOvertimeDeduction,
        overtimeAllowance,
        holidayAllowance,
        wfhAllowance,
        afterDeduction,
        salaryTransfer,
        usdConversion,
        preferentialTotal,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, "payrollSummary"), payload);
      notify("✅ Payroll saved successfully.");
      window.dispatchEvent(new Event("refreshPayroll"));
    } catch (err) {
      notify("Error saving payroll: " + err.message);
    }
  }}
>
  💾 Save Payroll
</button> */}



  <button
  className="btn submit"
  onClick={async () => {
    if (!selectedUserId) return notify("Please select a staff first!");
    try {
      const payload = {
        ...data,
        userId: selectedUserId,
        actualHours,
        holidayDays,
        basicLatest,
        basicTotal,
        overtimeRate,
        holidayRate,
        deductionRate,
        fixedOvertime,
        totalPay,
        absenceDeduction,
        lateDeduction,
        fixedOvertimeDeduction,
        overtimeAllowance,
        holidayAllowance,
        wfhAllowance,
        afterDeduction,
        salaryTransfer,
        usdConversion,
        preferentialTotal,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, "payrollSummary"), payload);
    /*  notify(`✅ Payroll saved for ${usersMap[selectedUserId] || "staff"}`); */
    const label = usersMap[selectedUserId]?.name || usersMap[selectedUserId]?.email || selectedUserId;
    notify(`✅ Payroll saved for ${label}`);

      window.dispatchEvent(new Event("refreshPayroll"));
    } catch (err) {
      notify("Error saving payroll: " + err.message);
    }
  }}
>
  💾 Save Payroll
</button> 


    </div>
  );
}

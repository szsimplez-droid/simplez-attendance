/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { doc, setDoc, getDoc } from "firebase/firestore";

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

const [ranks, setRanks] = useState([]);   // list
const [pitches, setPitches] = useState([]); // list

const [rank, setRank] = useState("");    // selected
const [pitch, setPitch] = useState("");  // selected


const [month, setMonth] = useState("");

useEffect(() => {
  fetch("/api/ranks")
    .then(r => r.json())
    .then(setRanks);
}, []);


useEffect(() => {
  if (rank) {
    fetch(`/api/pitches?rank=${rank}`)
      .then(r => r.json())
      .then(setPitches);
  } else {
    setPitches([]);
  }
}, [rank]);


useEffect(() => {
  if (rank && pitch) {
    fetch(`/api/salary?rank=${rank}&pitch=${pitch}`)
      .then(res => res.json())
      .then(data => {
        setData(prev => ({
          ...prev,
          basicSalary: data.Salary
        }));
      });
  }
}, [rank, pitch]);



const formatMoney = (n) => {
  const num = Number(n);
  return isNaN(num) ? "" : num.toLocaleString("en-US");
};


const parseMoney = (v) =>
  Number(String(v).replace(/,/g, ""));

const MoneyInput = ({ name, value, onChange, disabled }) => {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatMoney(value)}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        const num = parseMoney(raw);
        if (!isNaN(num)) {
          onChange({
            target: { name, value: num }
          });
        }
      }}
    />
  );
};


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


// ---------------- UPDATE FORM ----------------

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
    month:"",
    workType: "フルタイム",
    joinDate: "",
    standardDays: 0,
    workedDays: 0,
    annualLeave: 0,
    casualLeave: 0,
    absentDays: 0,
    sickLeave: 0,
    compLeave: 0,
    holidayWorkDays: 0,
    holidayWorkHours: 0,
    overtimeHours: 0,
    deductionRate:0,
    lateHours: 0,
    basicSalary: 0,
    permanentEmp: 0,
    pitchAdjust: 0,
    pitchTransfer: 0,
    jobAllowance: 0,
    directorAllowance: 0,
    languageAllowance: 0,
    ssb: 0,
    incomeTax: 0,
    bonus: 0,
    centralRate: 2100,
    cbRate: 3950,
  });

/* const handleChange = (e) => {
  const { name, value } = e.target;
  if (!name) return;

  setData(prev => ({
    ...prev,
    [name]: numberFields.has(name)
      ? (value === "" ? 0 : Number(value))
      : value   // <-- keep text as text
  }));
};
 */

/* const handleChange = (e) => {
  const { name, value } = e.target;
  if (!name) return;

  setData(prev => ({
    ...prev,
    [name]: value
  }));
};
 */

const numberFields = new Set([
  "standardDays", "workedDays",
  "annualLeave", "casualLeave", "absentDays",
  "sickLeave", "compLeave",
  "holidayWorkDays", "holidayWorkHours",
  "overtimeHours", "lateHours",
  "permanentEmp", "pitchTransfer",
  "jobAllowance", "directorAllowance",
  "languageAllowance", "ssb",
  "incomeTax", "bonus",
  "centralRate", "cbRate"
]);

const handleChange = (e) => {
  const { name, value } = e.target;

  setData(prev => ({
    ...prev,
    [name]: numberFields.has(name)
      ? (value === "" ? 0 : Number(value))
      : value
  }));
};


const sanitizeForFirestore = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k) continue;                 // ✅ drop "" keys
    if (v === undefined) continue;    // ✅ drop undefined
    if (Number.isNaN(v)) continue;    // ✅ drop NaN (optional)

    cleaned[k] = sanitizeForFirestore(v);
  }
  return cleaned;
};

  const actualHours = data.standardDays * 8;
   const holidayDays =
  Number(data.annualLeave) +
  Number(data.casualLeave) +
  Number(data.absentDays) +
  Number(data.sickLeave) +
  Number(data.compLeave);

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

const sortedUsers = Object.entries(usersMap)
  .sort(([, a], [, b]) => a.eid.localeCompare(b.eid));


  /* When user changes → load their draft */
/*   useEffect(() => {
    if (!selectedUserId) return;
  
    const loadDraft = async () => {
      const ref = doc(db, "payrollDrafts", selectedUserId);
      const snap = await getDoc(ref);
  
      if (snap.exists()) {
        const d = snap.data();
  
        setData(prev => ({ ...prev, ...d }));
        setRank(d.rank || "");
        setMonth(d.month || "");
  
        // wait for pitch list to load
        if (d.rank) {
          const res = await fetch(`http://localhost:4000/api/pitches?rank=${d.rank}`);
          const list = await res.json();
          setPitches(list);
          setPitch(d.pitch || "");
        }
  
      } else {
    const user = usersMap[selectedUserId] || {};
    resetForm(user); // pass user so we keep user info + rank/pitch
  }
    };
  
    loadDraft();
  }, [selectedUserId]); */
  
  
  /* Save draft automatically while typing */
  useEffect(() => {
    if (!selectedUserId) return;
  
    const saveDraft = async () => {
      await setDoc(
        doc(db, "payrollDrafts", selectedUserId),
        { ...data, rank, pitch, month },
        { merge: true }
      );
    };
  
    saveDraft();
  }, [data, rank, pitch, month, selectedUserId]);

  const resetForm = (user = {}) => {
  setData({
    name: user.name || "",
    userId: selectedUserId || "",
    languageLevel: user.languageLevel || "",
    staffId: user.eid || "",
    staffposition: user.position || "",
    staffteam: user.team || "",
    month: "",
    standardDays: 0,
    workedDays: 0,
    annualLeave: 0,
    casualLeave: 0,
    absentDays: 0,
    sickLeave: 0,
    compLeave: 0,
    holidayWorkDays: 0,
    holidayWorkHours: 0,
    overtimeHours: 0,
    lateHours: 0,
    basicSalary: 0,
    permanentEmp: 0,
    pitchAdjust: 0,
    pitchTransfer: 0,
    jobAllowance: 0,
    directorAllowance: 0,
    languageAllowance: 0,
    ssb: 0,
    incomeTax: 0,
    bonus: 0,
    centralRate: 2100,
    cbRate: 3950,
  });

  const userRank = user.rank || "";
  const userPitch = user.pitch || "";

  setRank(userRank);
  setPitch(""); // set after pitches loaded
  setMonth("");

  // load pitch list then set pitch
  if (userRank) {
    fetch(`api/pitches?rank=${userRank}`)
      .then((r) => r.json())
      .then((list) => {
        setPitches(list);
        setPitch(list.includes(userPitch) ? userPitch : "");
      });
  } else {
    setPitches([]);
  }
};

const handlePickUser = async (uid) => {
  const u = usersMap[uid] || {};

  const userRank = u.rank || "";
  const userPitch = u.pitch ? String(u.pitch) : "";

  setRank(userRank);

  if (userRank) {
    const r = await fetch(`api/pitches?rank=${userRank}`);
    const list = await r.json();
    setPitches(list);

    // only set pitch after pitches are loaded
    setPitch(list.includes(userPitch) ? userPitch : "");
  } else {
    setPitches([]);
    setPitch("");
  }
};



  return (
    <div className="payroll-form">
      <h1>Payroll Calculator</h1>

      <section className="form-section">
        <h2>👤 Employee</h2>
            
        <select
          value={selectedUserId}
          onChange={(e) => {
            const uid = e.target.value;
            const user = usersMap[uid];

            setSelectedUserId(uid);
             handlePickUser(uid);

            setData(prev => ({
              ...prev,
              userId: uid,
              name: user.name || "",
              staffId: user.eid || "",
              staffteam: user.team || "",
              staffposition: user.position || "",
              languageLevel: user.languageLevel || ""
            }));

            loadPayrollAutoData(uid);
          }}
        >
          <option value="">Select Staff</option>
          {sortedUsers.map(([uid, u]) => (
            <option key={uid} value={uid}>
              {u.eid} {u.name} {u.jpName || ""}
            </option>
          ))}
        </select>



        <div className="form-grid">
          <label>名前 <br></br>Name<input name="name" value={data.name} onChange={handleChange} /></label>
          <label>語力 <br></br>JLPT Level<input name="languageLevel" value={data.languageLevel} onChange={handleChange} /></label>
          <label>社員番号 <br></br>Employee No<input name="staffId" value={data.staffId} onChange={handleChange} /></label>
          <label>役職 <br></br>Position<input name="staffposition" value={data.staffposition} onChange={handleChange} /></label>
          <label>チーム <br></br>Team<input name="staffteam" value={data.staffteam} onChange={handleChange} /></label>
         {/*  <label>For the Month of<input name="paymonth" value={data.paymonth} onChange={handleChange} /></label> */}
          <select value={month} onChange={(e) =>{setMonth(e.target.value);setData(prev =>({ ...prev, month: e.target.value }));}}>
          <option value="">Select Month</option>
          <option value="January">January</option>
          <option value="February">February</option>
          <option value="March">March</option>
          <option value="April">April</option>
          <option value="May">May</option>
          <option value="June">June</option>
          <option value="July">July</option>
          <option value="August">August</option>
          <option value="September">September</option>
          <option value="October">October</option>
          <option value="November">November</option>
          <option value="December">December</option>
        </select>
        
        <select value={rank} onChange={e => {setRank(e.target.value);  setPitch("");}}>
        <option value="">Select Rank</option>
        {ranks.map(r => (
        <option key={r} value={r}>{r}</option>
        ))}
        </select>

        <select value={pitch} onChange={e => setPitch(e.target.value)}>
        <option value="">Select Pitch</option>
        {pitches.map(p => (
        <option key={p} value={p}>{p}</option>
        ))}
        </select>

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
          <label>遅刻・早退・外出 (時間) <br></br>Late/Early Departure/Outing<input type="number" name="lateHours" value={data.lateHours} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>💰 Rates</h2>
        <div className="form-grid">
          <label>残業手当@1時間 <MoneyInput value={overtimeRate} disabled /></label>
          <label>休日手当@1時間 <MoneyInput value={holidayRate} disabled /></label>
          <label>減給額@1時間 <MoneyInput value={deductionRate} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>💵 Salary</h2>
        <div className="form-grid">
          <label>基本給 <br></br>Basic salary<MoneyInput name="basicSalary" value={data.basicSalary} disabled/></label>
          <label>正社員付与 <br></br>Permanent employee<MoneyInput name="permanentEmp" value={data.permanentEmp} onChange={handleChange} /></label>
         {/*  <label>ピッチ間調整 <input type="number" name="pitchAdjust" value={data.pitchAdjust} onChange={handleChange} /></label> */}
          <label>ピッチ移行調整 <br></br> Pitch adjust<MoneyInput name="pitchTransfer" value={data.pitchTransfer} onChange={handleChange} /></label>
          <label>基本給(最新) <br></br>Basic salary (latest)<MoneyInput value={basicLatest} disabled /></label>
          <label>役職手当 <br></br> Job title allowance<MoneyInput name="jobAllowance" value={data.jobAllowance} onChange={handleChange} /></label>
          <label>取締役手当 <br></br>Director allowance<MoneyInput name="directorAllowance" value={data.directorAllowance} onChange={handleChange} /></label>
          <label>語力手当 <br></br>Language Allowance (JLPT) <MoneyInput name="languageAllowance" value={data.languageAllowance} onChange={handleChange} /></label>
          <label>基本給+手当 <br></br>Basic salary + Allowance <MoneyInput value={basicTotal} disabled /></label>
          <label>固定残業 <br></br>Fixed overtime <MoneyInput value={fixedOvertime} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>📊 Deductions & Allowances</h2>
        <div className="form-grid">
          <label>欠勤控除 <br></br>Absence deduction<MoneyInput value={absenceDeduction} disabled /></label>
          <label>遅刻控除 <br></br>Late deduction<MoneyInput value={lateDeduction} disabled /></label>
          <label>固定残業控除 <br></br>Fixed overtime deduction<MoneyInput value={fixedOvertimeDeduction} disabled /></label>
          <label>社会福祉 <br></br>(SSB) <MoneyInput name="ssb" value={data.ssb} onChange={handleChange} /></label>
          <label>所得税 <br></br>(Income Tax) <MoneyInput name="incomeTax" value={data.incomeTax} onChange={handleChange} /></label>
          <label>残業手当 <br></br>Overtime allowance <MoneyInput value={overtimeAllowance} disabled /></label>
          <label>休出手当 <br></br>Holiday work allowance<MoneyInput value={holidayAllowance} disabled /></label>
          <label>在宅勤務手当 <br></br>Work from home Allowance<MoneyInput value={wfhAllowance} disabled /></label>
          <label>賞与 <br></br>Bonus<MoneyInput name="bonus" value={data.bonus} onChange={handleChange} /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>🏦 Totals</h2>
        <div className="form-grid">
          <label>総支給額 <br></br>The Total Amount paid <MoneyInput value={totalPay} disabled /></label>
          <label>控除後(当月給与) <br></br>After deduction<MoneyInput value={afterDeduction} disabled /></label>
          <label>給与振込額 <br></br>Salary transfer amount<MoneyInput value={salaryTransfer} disabled /></label>
          <label>USD/MMK(中央銀行) <br></br>Central Bank rate<MoneyInput type="number" name="centralRate" value={data.centralRate} onChange={handleChange} /></label>
          <label>USD/MMK<br></br>CB Bank rate <MoneyInput name="cbRate" value={data.cbRate} onChange={handleChange} /></label>
          <label>USD換算 <br></br>USD conversion <MoneyInput value={usdConversion.toFixed(2)} disabled /></label>
        </div>
      </section>

      <section className="form-section">
        <h2>🏦 Special Payment amount</h2>
        <div className="form-grid">
          <label>総支給額(優遇レート) <MoneyInput value={preferentialTotal.toFixed(2)} disabled /></label>
        </div>
      </section>

    <button
  className="btn submit"
  onClick={async () => {
    if (!selectedUserId) return notify("Please select a staff first!");
    try {
      const payload = sanitizeForFirestore({
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
      });
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

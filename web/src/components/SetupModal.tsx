import { useState } from "react";

export interface SetupValues {
  filingDate?: string;
  interviewDate?: string;
  dateOfBirth?: string;
  lprSince?: string;
  explanationLanguage?: "en" | "es" | "hi";
  displayName?: string;
}

export function SetupModal({
  onSave,
  onClose,
}: {
  onSave: (v: SetupValues) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<SetupValues>({ explanationLanguage: "en" });
  const set = (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value || undefined }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Set up your coach</h2>
        <p className="sub">
          Your N-400 filing date decides which civics test you'll take: filed before Oct 20, 2025 → the 2008 test
          (10 questions, 6 to pass) · on or after → the 2025 test (20 questions, 12 to pass). Everything stays on
          your machine.
        </p>
        <div className="fieldrow">
          <div className="field">
            <label>N-400 filing date</label>
            <input type="date" onChange={set("filingDate")} />
          </div>
          <div className="field">
            <label>Interview date (optional)</label>
            <input type="date" onChange={set("interviewDate")} />
          </div>
        </div>
        <div className="fieldrow">
          <div className="field">
            <label>Date of birth (optional)</label>
            <input type="date" onChange={set("dateOfBirth")} />
            <div className="note">Only used to detect the 65/20 easier test.</div>
          </div>
          <div className="field">
            <label>Green card since (optional)</label>
            <input type="date" onChange={set("lprSince")} />
          </div>
        </div>
        <div className="fieldrow">
          <div className="field">
            <label>Explanations language</label>
            <select onChange={set("explanationLanguage")} defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <div className="field">
            <label>Your name (optional)</label>
            <input type="text" placeholder="Maria" onChange={set("displayName")} />
          </div>
        </div>
        <div className="actions">
          <button className="btn-secondary" onClick={onClose}>
            Later
          </button>
          <button className="btn-primary" onClick={() => onSave(v)}>
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

import { LoadingSkeleton } from "./LoadingSkeleton.js";
import { useEffect, useState } from "react";
import { downloadSavedResume, getSavedResume, removeSavedResume, type SavedResume } from "../services/resumeStorage.js";
export function SavedResumePanel({ userId }: { userId: string }) {
  const [record, setRecord] = useState<SavedResume | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    void getSavedResume(userId).then(r => { if (active) setRecord(r); }).catch(e => { if (active) setMessage(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [userId]);
  const remove = async () => {
    setBusy(true); setMessage("");
    try { await removeSavedResume(userId); setRecord(null); setMessage("Your stored resume has been removed. Extracted profile details remain in your account."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Resume could not be removed."); }
    finally { setBusy(false); }
  };
  return <section aria-label="Saved resume"><h2>Your resume</h2>{busy ? <LoadingSkeleton label="Checking resume storage" rows={2} /> : record ? <><p>{record.file_name} · saved privately</p><button type="button" className="auth-secondary" onClick={() => void downloadSavedResume(userId).catch(e => setMessage(e.message))}>Download resume</button> <button type="button" className="auth-secondary" onClick={() => { if (window.confirm("Remove your saved PDF? Your profile details will remain.")) void remove(); }}>Remove stored resume</button></> : <p>No saved PDF.</p>}{message ? <p role="status">{message}</p> : null}</section>;
}

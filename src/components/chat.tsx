"use client";
import { useEffect, useRef, useState } from "react";
import type { MessageDTO } from "@/lib/contracts";
import { contactError } from "@/lib/privacy";
import { api, errorText } from "@/lib/client";
import { PhotoPicker, type Photo } from "./fields";
export function Chat({ conversationId, initial = [] }: { conversationId: string; initial?: MessageDTO[] }) {
  const [history, setHistory] = useState(initial), [text, setText] = useState(""), [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState(""), [connectionError, setConnectionError] = useState(""), [busy, setBusy] = useState(false), [uploadBusy, setUploadBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null), retry = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const items = await api<MessageDTO[]>(`/api/conversations/${conversationId}/messages`); if (active) { setHistory(items); setConnectionError(""); } }
      catch (error) { if (active) setConnectionError(errorText(error)); }
      finally { if (active) timer = setTimeout(refresh, 3000); }
    }
    void refresh(); return () => { active = false; clearTimeout(timer); };
  }, [conversationId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [history]);
  const blocked = contactError(text);
  return <section className="card"><div style={{ padding: 20 }}><h3>Masked design room</h3><p className="notice">Use aliases only. Phone numbers, emails and handles are blocked. Admin reviews text and images before sharing; names and addresses must not be included.</p><span className="meta">Messages refresh every 3 seconds. Pending messages are visible only to you and Admin.</span></div><div className="chat-history" role="log" aria-label="Masked conversation" aria-live="polite">{history.length === 0 && <p className="muted">Ask about fabrics, design and finishing.</p>}{history.map(m => <div key={m.id} className={`message ${m.mine ? "mine" : ""}`}><strong>{m.alias}</strong>{m.content && <p>{m.content}</p>}{m.imageUrl && <img src={m.imageUrl} alt="Reviewed design attachment" />}<span className="badge">{m.moderationStatus}</span><small> {new Date(m.createdAt).toLocaleString()}</small></div>)}<div ref={end} /></div>
    <form style={{ padding: 20 }} onSubmit={async e => {
      e.preventDefault(); setError("");
      if (blocked) { setError(blocked); return; }
      setBusy(true);
      try {
        const payload = JSON.stringify({ content: text, uploadId: photos[0]?.id });
        if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
        const message = await api<MessageDTO>(`/api/conversations/${conversationId}/messages`, "POST", { content: text, uploadId: photos[0]?.id, clientKey: retry.current.key });
        setHistory(old => [...old.filter(m => m.id !== message.id), message]); setText(""); setPhotos([]); retry.current = null;
      } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
    }}><label className="field">Your message<textarea value={text} maxLength={4000} onChange={e => setText(e.target.value)} disabled={busy} /></label>{blocked && <p className="notice error" role="alert">{blocked}</p>}<PhotoPicker value={photos} onChange={setPhotos} onBusy={setUploadBusy} limit={1} label="Design attachment" /><button className="btn rust" disabled={busy || uploadBusy || !!blocked || (!text.trim() && !photos.length)}>{busy ? "Submitting..." : "Submit for review"}</button>{error && <p className="notice error" role="alert">{error}</p>}{connectionError && <p className="notice error" role="alert">Connection interrupted: {connectionError}</p>}</form>
  </section>;
}

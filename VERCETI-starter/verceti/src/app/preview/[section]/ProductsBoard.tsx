"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  user_id: string;
  title: string;
  quantity: number;
  notes: string | null;
  image_url: string;
  created_at: string;
  updated_at: string;
};

type ProductView = ProductRow & { nickname: string };

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(187,138,255,.22)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,.035)",
};

export default function ProductsBoard({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ProductView[]>([]);
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("community_products")
      .select("id,user_id,title,quantity,notes,image_url,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (loadError) {
      setError("Не вдалося завантажити список продукції.");
      return;
    }
    const rows = (data ?? []) as ProductRow[];
    const ids = Array.from(new Set(rows.map((row) => row.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,nickname").in("id", ids)
      : { data: [] as { id: string; nickname: string }[] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
    setItems(rows.map((row) => ({ ...row, nickname: names.get(row.user_id) ?? "Учасник" })));
  }, [supabase]);

  useEffect(() => {
    void loadProducts();
    const channel = supabase
      .channel("community-products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_products" }, () => {
        void loadProducts();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, loadProducts]);

  function resetForm() {
    setTitle("");
    setQuantity("");
    setNotes("");
    setFile(null);
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function startEdit(item: ProductView) {
    setEditingId(item.id);
    setTitle(item.title);
    setQuantity(String(item.quantity));
    setNotes(item.notes ?? "");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const amount = Number(quantity.replace(",", "."));
    if (!title.trim() || title.trim().length > 120) {
      setError("Вкажи назву продукції (до 120 символів).");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Вкажи кількість більше нуля.");
      return;
    }
    if (!editingId && !file) {
      setError("Додай скриншот продукції.");
      return;
    }
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setError("Дозволені JPG, PNG або WEBP розміром до 8 МБ.");
      return;
    }

    setBusy(true);
    let imageUrl = editingId ? items.find((item) => item.id === editingId)?.image_url ?? "" : "";
    let uploadedPath: string | null = null;
    if (file) {
      const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      uploadedPath = userId + "/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage.from("community-products").upload(uploadedPath, file, {
        contentType: file.type, upsert: false, cacheControl: "3600"
      });
      if (uploadError) {
        setError("Не вдалося завантажити скриншот. Спробуй ще раз.");
        setBusy(false);
        return;
      }
      imageUrl = supabase.storage.from("community-products").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const payload = {
      title: title.trim(),
      quantity: amount,
      notes: notes.trim() || null,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from("community_products").update(payload).eq("id", editingId).eq("user_id", userId)
      : await supabase.from("community_products").insert({ ...payload, user_id: userId });

    if (result.error) {
      if (uploadedPath) await supabase.storage.from("community-products").remove([uploadedPath]);
      setError("Не вдалося зберегти запис. Перевір з'єднання та спробуй ще раз.");
      setBusy(false);
      return;
    }
    resetForm();
    await loadProducts();
    setSuccess(editingId ? "Запис оновлено." : "Продукцію додано до спільного списку.");
    setBusy(false);
  }

  async function removeItem(item: ProductView) {
    if (!window.confirm("Видалити цей запис продукції?")) return;
    setError("");
    const { error: deleteError } = await supabase.from("community_products").delete().eq("id", item.id).eq("user_id", userId);
    if (deleteError) {
      setError("Не вдалося видалити запис.");
      return;
    }
    const marker = "/storage/v1/object/public/community-products/";
    const index = item.image_url.indexOf(marker);
    if (index >= 0) {
      const path = decodeURIComponent(item.image_url.slice(index + marker.length).split("?")[0]);
      await supabase.storage.from("community-products").remove([path]);
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <div style={{ display: "grid", gap: 20, marginTop: 18 }}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>📦 Додати продукцію</h2>
        <p className="muted">Опублікуй скриншот, назву та кількість — запис одразу стане видимим іншим учасникам.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <strong>Назва продукції</strong>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Наприклад: Пшениця" required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <strong>Кількість</strong>
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" placeholder="Наприклад: 2500" required />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <strong>Коментар (необов'язково)</strong>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} placeholder="Додаткова інформація про продукцію" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <strong>Скриншот {editingId ? "(за бажанням замінити)" : ""}</strong>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <span className="page-note">JPG, PNG або WEBP · до 8 МБ</span>
          </label>
          {error && <p role="alert" style={{ color: "#ff9b9b", margin: 0 }}>{error}</p>}
          {success && <p role="status" style={{ color: "#8fe0ad", margin: 0 }}>{success}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? "Збереження..." : editingId ? "Зберегти зміни" : "Опублікувати"}</button>
            {editingId && <button className="btn secondary" type="button" disabled={busy} onClick={resetForm}>Скасувати</button>}
          </div>
        </form>
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Продукція учасників</h2>
          <span className="page-note">{items.length} записів · оновлюється наживо</span>
        </div>
        {items.length === 0 ? (
          <div style={cardStyle}><p className="muted" style={{ margin: 0 }}>Поки немає опублікованої продукції. Додай перший запис.</p></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
            {items.map((item) => (
              <article key={item.id} style={{ ...cardStyle, overflow: "hidden", padding: 0 }}>
                <a href={item.image_url} target="_blank" rel="noreferrer" aria-label={"Відкрити скриншот: " + item.title}>
                  <img src={item.image_url} alt={"Скриншот: " + item.title} style={{ display: "block", width: "100%", height: 190, objectFit: "cover", background: "rgba(0,0,0,.2)" }} />
                </a>
                <div style={{ padding: 14, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                    <h3 style={{ margin: 0, overflowWrap: "anywhere" }}>{item.title}</h3>
                    <strong style={{ color: "#d8baff", whiteSpace: "nowrap" }}>{Number(item.quantity).toLocaleString("uk-UA")}</strong>
                  </div>
                  <div className="page-note">Автор: {item.nickname}</div>
                  {item.notes && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.notes}</p>}
                  <div className="page-note">{new Date(item.created_at).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })}</div>
                  {item.user_id === userId && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn secondary" type="button" onClick={() => startEdit(item)}>Редагувати</button>
                      <button className="btn secondary" type="button" onClick={() => void removeItem(item)}>Видалити</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

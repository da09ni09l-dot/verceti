"use client";

import { deleteDisciplinaryAction } from "./actions";

export default function DisciplinaryDeleteForm({ id }: { id: string }) {
  return (
    <form
      action={deleteDisciplinaryAction}
      onSubmit={(event) => {
        if (!window.confirm("Точно видалити цей дисциплінарний запис?")) {
          event.preventDefault();
        }
      }}
      style={{ marginTop: 12 }}
    >
      <input type="hidden" name="id" value={id} />

      <button
        className="btn"
        type="submit"
        style={{
          background: "#8f303f",
          borderColor: "#b94b5c"
        }}
      >
        Видалити запис
      </button>
    </form>
  );
}

"use client";

import { CheckSquare, Square } from "lucide-react";

export function BulkEmailControls() {
  function setChecked(checked: boolean) {
    document
      .querySelectorAll<HTMLInputElement>("[data-bulk-email-checkbox='true']")
      .forEach((checkbox) => {
        checkbox.checked = checked;
      });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setChecked(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50"
      >
        <CheckSquare size={14} aria-hidden="true" />
        Chọn tất cả
      </button>
      <button
        type="button"
        onClick={() => setChecked(false)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50"
      >
        <Square size={14} aria-hidden="true" />
        Bỏ chọn
      </button>
    </div>
  );
}

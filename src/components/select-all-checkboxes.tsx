"use client";

import { useState } from "react";

type SelectAllCheckboxesProps = {
  group: string;
  className?: string;
};

export function SelectAllCheckboxes({
  group,
  className = "",
}: SelectAllCheckboxesProps) {
  const [selected, setSelected] = useState(false);

  function toggleAll() {
    const next = !selected;
    document
      .querySelectorAll<HTMLInputElement>(`input[data-select-group="${group}"]`)
      .forEach((checkbox) => {
        checkbox.checked = next;
      });
    setSelected(next);
  }

  return (
    <button type="button" onClick={toggleAll} className={className}>
      {selected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
    </button>
  );
}

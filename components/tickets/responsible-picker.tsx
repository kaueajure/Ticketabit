"use client";

import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { User } from "@/lib/types";

export function ResponsiblePicker({ users, value, onChange, compact = false }: { users: User[]; value: string[]; onChange: (ids: string[]) => void; compact?: boolean }) {
  const options = users.filter((user) => user.active || value.includes(user.id));
  const toggle = (id: string) => {
    if (value.includes(id)) {
      if (value.length === 1) return;
      onChange(value.filter((item) => item !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className={`responsible-picker ${compact ? "compact" : ""}`} role="group" aria-label="Selecionar responsáveis">
      {options.map((user) => {
        const selected = value.includes(user.id);
        return <button key={user.id} type="button" className={selected ? "selected" : ""} onClick={() => toggle(user.id)} aria-pressed={selected} title={user.name}><Avatar name={user.name} photoUrl={user.avatarUrl} size="sm"/><span>{user.name}</span>{selected && <Check size={12}/>}</button>;
      })}
    </div>
  );
}

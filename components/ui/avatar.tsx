import { initials } from "@/lib/utils";

export function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" | "xl" }) {
  return <span className={`avatar avatar-${size}`} aria-label={name}>{initials(name)}{photoUrl && <img src={photoUrl} alt="" />}</span>;
}

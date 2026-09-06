import Link from "next/link";
import { IconBack } from "@/components/icons";

export default function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className="icon-btn">
      <IconBack size={18} />
    </Link>
  );
}

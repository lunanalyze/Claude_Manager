import "./workshop.css";
import { selectionStatus } from "@/lib/ui-standard";
import Workshop from "./Workshop";

export const dynamic = "force-dynamic";

export default function UiStandardPage() {
  const initial = selectionStatus();
  return <Workshop initial={initial} />;
}

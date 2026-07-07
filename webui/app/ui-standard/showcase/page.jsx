import "../workshop.css";
import { resolvedSelections } from "@/lib/ui-standard";
import Showcase from "./Showcase";

export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  const sel = resolvedSelections();
  return <Showcase sel={sel} />;
}

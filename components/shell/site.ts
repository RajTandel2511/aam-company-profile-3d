import { contact } from "@/lib/content";

/**
 * Site-shell constants shared by the nav, the contact section and the footer.
 * Plain module (no "use client") so the server-rendered footer can read it.
 */

/** Page sections in scroll order. `index` matches each section's SectionHeader. */
export const SECTION_LINKS = [
  { id: "systems", label: "Systems", index: "01" },
  { id: "shop", label: "Shop", index: "02" },
  { id: "reach", label: "Reach", index: "03" },
  { id: "work", label: "Work", index: "04" },
  { id: "credentials", label: "Credentials", index: "05" },
  { id: "contact", label: "Contact", index: "06" },
] as const;

/** The one bid call-to-action. */
export const BID_HREF = `mailto:${contact.email}?subject=Bid%20request`;

/** The logo's three streams in order: supply blue, exhaust / outside-air green, return red. */
export const STREAM_FILLS = ["bg-blue", "bg-green", "bg-red"] as const;

/** The three streams side by side as one hard-stop bar. */
export const TRI_BAR = "linear-gradient(90deg, var(--blue) 0 33.34%, var(--green) 0 66.67%, var(--red) 0)";

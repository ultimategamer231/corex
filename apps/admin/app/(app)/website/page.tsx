import { redirect } from "next/navigation";

/** The page's first address; it is now called Analytics. */
export default function WebsitePage() {
  redirect("/analytics");
}

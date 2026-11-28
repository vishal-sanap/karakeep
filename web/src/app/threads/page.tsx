import { redirect } from "next/navigation";

// Threads now live on the Explore page.
export default function ThreadsPage() {
  redirect("/explore#threads");
}

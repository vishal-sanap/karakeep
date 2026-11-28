import { redirect } from "next/navigation";

// Rediscover is now the top of the Explore page.
export default function RediscoverPage() {
  redirect("/explore");
}

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getActiveAutoAttendancePathForUser } from "@/lib/active-auto-attendance";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  if (session.roles.includes("student")) {
    redirect((await getActiveAutoAttendancePathForUser(session.userId)) ?? "/dashboard");
  }

  redirect("/dashboard");
}

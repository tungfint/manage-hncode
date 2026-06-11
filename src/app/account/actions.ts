"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSessionToken,
  getEffectiveAccessForUser,
  getSessionOrRedirect,
  SESSION_COOKIE,
} from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/cookie-options";
import { prisma } from "@/lib/prisma";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined)),
);

export async function updateMyAccountAction(formData: FormData) {
  const session = await getSessionOrRedirect();
  const schema = z.object({
    name: z.string().trim().min(2),
    email: optionalString.pipe(z.string().email().optional()),
    phone: optionalString,
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    redirect("/account?error=invalid");
  }

  const email = parsed.data.email?.toLowerCase();
  const existingEmail = email
    ? await prisma.user.findFirst({
        where: { email, id: { not: session.userId } },
        select: { id: true },
      })
    : null;
  const existingPhone = parsed.data.phone
    ? await prisma.user.findFirst({
        where: { phone: parsed.data.phone, id: { not: session.userId } },
        select: { id: true },
      })
    : null;

  if (existingEmail) {
    redirect("/account?error=email_exists");
  }

  if (existingPhone) {
    redirect("/account?error=phone_exists");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone,
      },
    }),
    prisma.staffProfile.updateMany({
      where: { userId: session.userId },
      data: {
        fullName: parsed.data.name,
        email,
        phone: parsed.data.phone,
      },
    }),
    prisma.student.updateMany({
      where: { userId: session.userId },
      data: {
        fullName: parsed.data.name,
        email,
        phone: parsed.data.phone,
      },
    }),
    prisma.parent.updateMany({
      where: { userId: session.userId },
      data: {
        fullName: parsed.data.name,
        email,
        phone: parsed.data.phone,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "account.update_profile",
        entityType: "user",
        entityId: session.userId,
      },
    }),
  ]);

  const access = await getEffectiveAccessForUser(session.userId);
  const cookieStore = await cookies();

  if (access) {
    cookieStore.set(SESSION_COOKIE, await createSessionToken(access), {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  redirect("/account?updated=1");
}

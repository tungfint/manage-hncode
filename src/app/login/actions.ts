"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  getEffectiveAccessForUser,
  getSessionOrRedirect,
  hashPassword,
  loginSchema,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/cookie-options";
import { prisma } from "@/lib/prisma";

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    loginError(parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ");
  }

  const data = parsed.data;
  const identifier = data.identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: data.identifier.trim() }],
    },
  });

  if (!user) {
    loginError("Email, số điện thoại hoặc mật khẩu không đúng");
  }

  const isValidPassword = await verifyPassword(
    data.password,
    user.passwordHash,
  );

  if (!isValidPassword) {
    loginError("Email, số điện thoại hoặc mật khẩu không đúng");
  }

  const access = await getEffectiveAccessForUser(user.id);

  if (!access) {
    loginError("Tài khoản đang bị khóa hoặc chưa được kích hoạt");
  }

  const token = await createSessionToken(access);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
    },
  });

  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const session = await getSessionOrRedirect({ allowPasswordChange: true });
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    redirect("/change-password?error=short");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=confirm");
  }

  if (newPassword === currentPassword) {
    redirect("/change-password?error=same");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  if (!user) {
    redirect("/login");
  }

  const currentValid = await verifyPassword(currentPassword, user.passwordHash);

  if (!currentValid) {
    redirect("/change-password?error=current");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });

  const access = await getEffectiveAccessForUser(user.id);
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

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "auth.change_password",
      entityType: "user",
      entityId: user.id,
    },
  });

  redirect("/dashboard");
}

import { compare, hash } from "bcryptjs";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PermissionEffect, UserStatus, type PermissionScope } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PermissionCode } from "@/lib/permissions";

export const SESSION_COOKIE = "qltt_session";

export const loginSchema = z.object({
  identifier: z.string().min(3, "Nhap email hoac so dien thoai"),
  password: z.string().min(6, "Mat khau phai co it nhat 6 ky tu"),
});

export type AuthSession = {
  userId: string;
  name: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  scopedPermissions: Array<{
    code: string;
    effect: PermissionEffect;
    scopeType: PermissionScope;
    scopeId: string | null;
  }>;
};

type SessionJwtPayload = JWTPayload & {
  name?: string;
  roles?: string[];
  permissions?: string[];
  mustChangePassword?: boolean;
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSessionToken(session: AuthSession) {
  return new SignJWT({
    name: session.name,
    roles: session.roles,
    permissions: session.permissions,
    mustChangePassword: session.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify<SessionJwtPayload>(token, getSecretKey());

    if (!payload.sub || !payload.name) {
      return null;
    }

    return {
      userId: payload.sub,
      name: payload.name,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      mustChangePassword: Boolean(payload.mustChangePassword),
      scopedPermissions: [],
    };
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  return getEffectiveAccessForUser(session.userId);
}

export async function getEffectiveAccessForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return null;
  }

  const permissionCodes = new Set<string>();
  const deniedPermissionCodes = new Set<string>();
  const scopedPermissions: AuthSession["scopedPermissions"] = [];
  const now = new Date();

  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      permissionCodes.add(rolePermission.permission.code);
    }
  }

  for (const userPermission of user.permissions) {
    if (userPermission.validFrom && userPermission.validFrom > now) {
      continue;
    }

    if (userPermission.validTo && userPermission.validTo < now) {
      continue;
    }

    const code = userPermission.permission.code;

    if (userPermission.scopeType !== "GLOBAL" && userPermission.scopeId) {
      scopedPermissions.push({
        code,
        effect: userPermission.effect,
        scopeType: userPermission.scopeType,
        scopeId: userPermission.scopeId,
      });
      continue;
    }

    if (userPermission.effect === PermissionEffect.DENY) {
      deniedPermissionCodes.add(code);
      permissionCodes.delete(code);
    } else if (!deniedPermissionCodes.has(code)) {
      permissionCodes.add(code);
    }
  }

  return {
    userId: user.id,
    name: user.name,
    roles: user.roles.map((userRole) => userRole.role.code),
    permissions: [...permissionCodes],
    mustChangePassword: user.mustChangePassword,
    scopedPermissions,
  };
}

export async function getSessionOrRedirect(options?: { allowPasswordChange?: boolean }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword && !options?.allowPasswordChange) {
    redirect("/change-password");
  }

  return session;
}

export async function requirePermission(permission: PermissionCode) {
  const session = await getSessionOrRedirect();

  if (!can(session, permission)) {
    redirect("/forbidden");
  }

  return session;
}

export function hasGlobalPermission(
  session: AuthSession | null,
  permission: PermissionCode,
) {
  return Boolean(
    session?.roles.includes("admin") || session?.permissions.includes(permission),
  );
}

export function can(session: AuthSession | null, permission: PermissionCode) {
  if (!session) {
    return false;
  }

  if (hasGlobalPermission(session, permission)) {
    return true;
  }

  const scoped = session.scopedPermissions.filter((item) => item.code === permission);

  if (scoped.some((item) => item.effect === PermissionEffect.DENY)) {
    return false;
  }

  return scoped.some((item) => item.effect === PermissionEffect.ALLOW);
}

export function canInScope(
  session: AuthSession | null,
  permission: PermissionCode,
  scopeType: PermissionScope,
  scopeId: string | null | undefined,
) {
  if (!session) {
    return false;
  }

  if (hasGlobalPermission(session, permission)) {
    return true;
  }

  if (!scopeId) {
    return false;
  }

  const scoped = session.scopedPermissions.filter(
    (item) =>
      item.code === permission &&
      item.scopeType === scopeType &&
      item.scopeId === scopeId,
  );

  if (scoped.some((item) => item.effect === PermissionEffect.DENY)) {
    return false;
  }

  return scoped.some((item) => item.effect === PermissionEffect.ALLOW);
}

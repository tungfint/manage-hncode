import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getEffectiveAccessForUser,
  SESSION_COOKIE,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GOOGLE_STATE_COOKIE } from "../route";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=Google từ chối đăng nhập: ${error}`, request.url),
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/login?error=Phiên đăng nhập Google không hợp lệ.", request.url),
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    new URL("/login/google/callback", request.url).toString();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Chưa cấu hình Google Client ID/Secret.", request.url),
    );
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return NextResponse.redirect(
      new URL("/login?error=Không lấy được thông tin đăng nhập Google.", request.url),
    );
  }

  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: "no-store",
    },
  );
  const profile = (await profileResponse.json()) as GoogleUserInfo;
  const email = profile.email?.toLowerCase();

  if (!profileResponse.ok || !email || !profile.email_verified) {
    return NextResponse.redirect(
      new URL("/login?error=Email Google chưa được xác minh.", request.url),
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.redirect(
      new URL(
        "/login?error=Email Google chưa có trong hệ thống. Vui lòng liên hệ quản trị.",
        request.url,
      ),
    );
  }

  if (profile.sub && user.googleId !== profile.sub) {
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: profile.sub },
    });
  }

  const session = await getEffectiveAccessForUser(user.id);

  if (!session) {
    return NextResponse.redirect(
      new URL("/login?error=Tài khoản chưa được kích hoạt.", request.url),
    );
  }

  const token = await createSessionToken(session);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.redirect(
    new URL(session.mustChangePassword ? "/change-password" : "/dashboard", request.url),
  );
}

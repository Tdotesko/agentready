import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { config } from "./config";
import { findUserById } from "./users";
import type { User } from "./users";

const COOKIE_NAME = "ar_session";
const TOKEN_EXPIRY = "7d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwt.secret, { expiresIn: TOKEN_EXPIRY });
}

export async function setSessionCookie(userId: string) {
  const token = createToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, config.jwt.secret) as { sub: string };
    return findUserById(payload.sub);
  } catch {
    return null;
  }
}

export function hasActiveSub(user: User): boolean {
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

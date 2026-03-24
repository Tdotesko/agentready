import fs from "fs/promises";
import path from "path";
import type { Plan } from "./config";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  stripeCustomerId?: string;
  plan?: Plan;
  subscriptionId?: string;
  subscriptionStatus?: string;
  createdAt: string;
}

export interface StoredScan {
  userId: string;
  url: string;
  score: number;
  grade: string;
  resultJson: string;
  scannedAt: string;
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const SCANS_FILE = path.join(process.cwd(), "data", "scans.json");

async function ensureDir() {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
}

async function readUsers(): Promise<User[]> {
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]) {
  await ensureDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.email === email.toLowerCase()) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function findUserByStripeCustomer(customerId: string): Promise<User | null> {
  const users = await readUsers();
  return users.find((u) => u.stripeCustomerId === customerId) || null;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const users = await readUsers();
  const user: User = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  await writeUsers(users);
  return users[idx];
}

// Scans
async function readScans(): Promise<StoredScan[]> {
  try {
    const data = await fs.readFile(SCANS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveScan(scan: StoredScan) {
  await ensureDir();
  const scans = await readScans();
  scans.push(scan);
  await fs.writeFile(SCANS_FILE, JSON.stringify(scans, null, 2));
}

export async function getUserScans(userId: string): Promise<StoredScan[]> {
  const scans = await readScans();
  return scans.filter((s) => s.userId === userId).sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

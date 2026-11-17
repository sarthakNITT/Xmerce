import { prisma } from "../config/db";

export interface SyncUserData {
  clerkId: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  authProvider?: string;
}

export async function upsertUser(data: SyncUserData) {
  return await prisma.user.upsert({
    where: { clerkId: data.clerkId },
    update: {
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl,
      authProvider: data.authProvider ?? "credentials",
    },
    create: {
      clerkId: data.clerkId,
      email: data.email,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl,
      authProvider: data.authProvider ?? "credentials",
    },
  });
}

export async function deleteUserByClerkId(clerkId: string) {
  return await prisma.user.deleteMany({
    where: { clerkId },
  });
}

export async function getUserByClerkId(clerkId: string) {
  return await prisma.user.findUnique({
    where: { clerkId },
  });
}

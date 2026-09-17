import { encryptSHAH256, randomUUID } from '~/utils/encryption';
import prisma from '../services/prisma.server';

interface CreateUserDetails {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export class UserRepository {
  public static async validate(email: string, password: string) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return null;
    }

    //TODO: use app config secret to further secure salts (per environment)
    const encryptedPassword = encryptSHAH256(password, user.salt);
    if (user.password && user.password === encryptedPassword) {
      return UserRepository.findUserByEmail(email);
    }
    return null;
  }

  public static async findUserByEmail(email: string) {
    const user = await prisma.user.findFirst({ where: { email } });
    return user;
  }

  public static async createUser({ password, ...details }: CreateUserDetails) {
    const salt = randomUUID().replace(/-/g, '');
    const encryptedPassword = encryptSHAH256(password, salt);
    const user = await prisma.user.create({
      data: { ...details, password: encryptedPassword, salt },
    });
    return user;
  }

  public static async listUsers() {
    return await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  // Used to gate the first-time setup wizard — a fresh install/disk image has zero rows here.
  public static async count() {
    return await prisma.user.count();
  }

  public static async updateUser(id: number, details: { name: string; email: string; role?: string }) {
    return await prisma.user.update({ where: { id }, data: details });
  }

  public static async deleteUser(id: number) {
    return await prisma.user.delete({ where: { id } });
  }

  // Returns null if currentPassword doesn't match, so the caller can distinguish
  // "wrong current password" from other failures.
  public static async changePassword(id: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return null;
    }
    const encryptedCurrent = encryptSHAH256(currentPassword, user.salt);
    if (user.password !== encryptedCurrent) {
      return null;
    }
    const salt = randomUUID().replace(/-/g, '');
    const password = encryptSHAH256(newPassword, salt);
    return await prisma.user.update({ where: { id }, data: { password, salt } });
  }
}

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

  public static async updateUserRole(id: number, role: string) {
    return await prisma.user.update({ where: { id }, data: { role } });
  }

  public static async deleteUser(id: number) {
    return await prisma.user.delete({ where: { id } });
  }
}

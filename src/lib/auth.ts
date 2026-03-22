import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'guns-up-dev-secret-change-in-prod';
const TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(operatorId: string, role: string): string {
  return jwt.sign({ operatorId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): { operatorId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { operatorId: string; role: string };
  } catch {
    return null;
  }
}

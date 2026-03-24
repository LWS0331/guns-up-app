import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Set it in your Railway/deployment config.');
  }
  return secret;
}
const TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(operatorId: string, role: string): string {
  return jwt.sign({ operatorId, role }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): { operatorId: string; role: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { operatorId: string; role: string };
  } catch {
    return null;
  }
}

import { NextRequest } from 'next/server';
import { verifyToken } from './auth';

export function getAuthOperator(request: NextRequest): { operatorId: string; role: string } | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

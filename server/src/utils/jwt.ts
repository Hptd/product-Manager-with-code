import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// JWT 配置
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
const ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '24h') as SignOptions['expiresIn'];
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '7d') as SignOptions['expiresIn'];

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

// 生成 Access Token
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

// 生成 Refresh Token
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

// 验证 Access Token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// 验证 Refresh Token
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// 生成随机临时密码 (12位,包含大小写+数字+特殊字符)
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 排除易混淆字符
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specials = '@#$%&*';
  
  // 确保每种类型至少一个
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specials[Math.floor(Math.random() * specials.length)];
  
  // 剩余8位随机
  const allChars = upper + lower + numbers + specials;
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// 从 Bearer Token 中提取 JWT
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

import { Request, Response, NextFunction } from 'express';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../db/prisma.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        status: string;
        forcePasswordChange: boolean;
      };
    }
  }
}

// 认证中间件 - 验证 JWT Token
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '未提供认证令牌' 
      });
    }

    const payload = verifyAccessToken(token);
    
    if (!payload) {
      return res.status(401).json({ 
        success: false, 
        error: '认证令牌无效或已过期' 
      });
    }

    // 查询用户是否存在且状态正常
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({ 
        success: false, 
        error: '账户已被禁用' 
      });
    }

    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockTime = user.lockedUntil.toLocaleString('zh-CN');
      return res.status(403).json({ 
        success: false, 
        error: `账户已锁定，请于 ${unlockTime} 后重试` 
      });
    }

    // 将用户信息附加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      forcePasswordChange: user.forcePasswordChange
    };

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({ 
      success: false, 
      error: '认证服务错误' 
    });
  }
}

// 管理员权限中间件
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: '未认证' 
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      success: false, 
      error: '需要管理员权限' 
    });
  }

  next();
}

// WebSocket 认证验证 (用于 WebSocket 握手)
export function verifyWebSocketToken(url: string): { userId: string; username: string; role: string } | null {
  try {
    const urlObj = new URL(url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    
    if (!token) {
      return null;
    }

    const payload = verifyAccessToken(token);
    
    if (!payload) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role
    };
  } catch (error) {
    return null;
  }
}

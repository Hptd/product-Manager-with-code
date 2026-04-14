import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from '../db/prisma.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, generateTempPassword } from '../utils/jwt.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

dotenv.config();

const router = Router();

// 密码强度要求
const PASSWORD_MIN_LENGTH = 8;

// 验证密码强度
function isPasswordStrong(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`密码至少 ${PASSWORD_MIN_LENGTH} 个字符`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }
  
  return { valid: errors.length === 0, errors };
}

// 获取登录失败配置
function getLoginConfig() {
  const maxRetries = parseInt(process.env.LOGIN_MAX_RETRIES || '5', 10);
  const lockoutDuration = parseInt(process.env.LOGIN_LOCKOUT_DURATION || '15', 10);
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  
  console.log('登录配置:', { maxRetries, lockoutDuration, bcryptRounds, env: process.env.BCRYPT_ROUNDS });
  
  return {
    maxRetries: isNaN(maxRetries) ? 5 : maxRetries,
    lockoutDuration: isNaN(lockoutDuration) ? 15 : lockoutDuration,
    bcryptRounds: isNaN(bcryptRounds) ? 10 : bcryptRounds
  };
}

// ============ 注册 ============
router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('📝 注册请求:', { body: req.body });
    
    // 检查是否允许注册
    if (process.env.ALLOW_REGISTRATION === 'false') {
      return res.status(403).json({ 
        success: false, 
        error: '当前系统已关闭注册功能' 
      });
    }

    const { username, email, password } = req.body;
    console.log('📝 解析参数:', { username, email, passwordLength: password?.length });

    // 基础校验
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名、邮箱和密码不能为空' 
      });
    }

    // 用户名格式校验
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名必须是3-20个字符，仅允许字母、数字和下划线' 
      });
    }

    // 邮箱格式校验
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: '邮箱格式不正确' 
      });
    }

    // 密码强度校验
    const passwordCheck = isPasswordStrong(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ 
        success: false, 
        error: '密码不符合要求',
        details: passwordCheck.errors 
      });
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ 
          success: false, 
          error: '用户名已被占用' 
        });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ 
          success: false, 
          error: '该邮箱已注册' 
        });
      }
    }

    // 加密密码
    const config = getLoginConfig();
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    // 生成 Token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // 存储 Refresh Token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7); // 7天

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiry
      }
    });

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      success: false, 
      error: `注册失败: ${errorMessage}` 
    });
  }
});

// ============ 登录 ============
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名和密码不能为空' 
      });
    }

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      // 统一错误信息，防止枚举
      return res.status(401).json({ 
        success: false, 
        error: '用户名或密码错误' 
      });
    }

    // 检查账户状态
    if (user.status === 'DISABLED') {
      return res.status(403).json({ 
        success: false, 
        error: '账户已被禁用，请联系管理员' 
      });
    }

    if (user.status === 'LOCKED' && user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockTime = user.lockedUntil.toLocaleString('zh-CN');
      return res.status(403).json({ 
        success: false, 
        error: `账户已锁定，请于 ${unlockTime} 后重试` 
      });
    }

    // 验证密码
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordValid) {
      // 增加失败次数
      const config = getLoginConfig();
      const newFailedLogins = user.failedLogins + 1;
      
      let updateData: any = { failedLogins: newFailedLogins };
      
      if (newFailedLogins >= config.maxRetries) {
        // 锁定账户
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + config.lockoutDuration);
        updateData.status = 'LOCKED';
        updateData.lockedUntil = lockoutUntil;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });

      return res.status(401).json({ 
        success: false, 
        error: '用户名或密码错误' 
      });
    }

    // 登录成功，重置失败次数
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        status: user.status === 'LOCKED' ? 'ACTIVE' : user.status,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });

    // 生成 Token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // 存储 Refresh Token
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiry
      }
    });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          forcePasswordChange: user.forcePasswordChange,
          lastLoginAt: user.lastLoginAt
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '登录失败，请稍后重试' 
    });
  }
});

// ============ 登出 ============
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // 从数据库删除 Refresh Token
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '登出失败' 
    });
  }
});

// ============ 刷新 Token ============
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        error: '未提供刷新令牌' 
      });
    }

    // 验证 Token
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return res.status(401).json({ 
        success: false, 
        error: '刷新令牌无效或已过期' 
      });
    }

    // 检查数据库中是否存在该 Token
    const existingToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!existingToken) {
      return res.status(401).json({ 
        success: false, 
        error: '刷新令牌已被撤销' 
      });
    }

    // 检查 Token 是否过期
    if (existingToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: existingToken.id } });
      return res.status(401).json({ 
        success: false, 
        error: '刷新令牌已过期' 
      });
    }

    // 生成新的 Access Token
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      username: payload.username,
      role: payload.role
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    console.error('刷新 Token 失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '刷新令牌失败' 
    });
  }
});

// ============ 获取当前用户信息 ============
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        forcePasswordChange: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

// ============ 修改密码 (用户自助) ============
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未认证' });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '旧密码和新密码不能为空' 
      });
    }

    // 获取用户
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 验证旧密码
    const passwordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    
    if (!passwordValid) {
      return res.status(400).json({ 
        success: false, 
        error: '旧密码不正确' 
      });
    }

    // 检查新密码强度
    const passwordCheck = isPasswordStrong(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ 
        success: false, 
        error: '新密码不符合要求',
        details: passwordCheck.errors 
      });
    }

    // 更新密码
    const config = getLoginConfig();
    const newPasswordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: newPasswordHash,
        forcePasswordChange: false // 清除强制改密码标记
      }
    });

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ success: false, error: '修改密码失败' });
  }
});

// ============ 重置密码 (管理员操作) ============
router.post('/reset-password/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminId = req.user!.id;

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }

    // 生成临时密码
    const tempPassword = generateTempPassword();

    // 加密临时密码
    const config = getLoginConfig();
    const tempPasswordHash = await bcrypt.hash(tempPassword, config.bcryptRounds);

    // 更新用户密码
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: tempPasswordHash,
        forcePasswordChange: true,
        passwordResetBy: adminId,
        passwordResetAt: new Date(),
        failedLogins: 0,
        status: 'ACTIVE',
        lockedUntil: null
      }
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        action: 'password_reset',
        actorId: adminId,
        targetId: userId,
        details: JSON.stringify({ username: targetUser.username })
      }
    });

    // 删除该用户的所有 Refresh Token (强制重新登录)
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });

    res.json({
      success: true,
      message: '密码重置成功',
      data: {
        tempPassword, // 仅返回一次，不存储
        username: targetUser.username
      }
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ success: false, error: '重置密码失败' });
  }
});

export default router;

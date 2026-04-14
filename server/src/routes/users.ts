import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 所有路由都需要认证 + 管理员权限
router.use(authenticate);
router.use(requireAdmin);

// ============ 获取用户列表 ============
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 构建搜索条件
    const where = search ? {
      OR: [
        { username: { contains: search as string } },
        { email: { contains: search as string } }
      ]
    } : {};

    // 查询用户列表
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          forcePasswordChange: true,
          _count: {
            select: { projects: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users: users.map((u: any) => ({
          ...u,
          projectCount: u._count.projects
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// ============ 获取用户详情 ============
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        failedLogins: true,
        lockedUntil: true,
        forcePasswordChange: true,
        passwordResetAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { projects: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({
      success: true,
      data: {
        ...user,
        projectCount: user._count.projects
      }
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ success: false, error: '获取用户详情失败' });
  }
});

// ============ 修改用户信息 ============
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, status } = req.body;

    // 校验输入
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的角色值' 
      });
    }

    if (status && !['ACTIVE', 'LOCKED', 'DISABLED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的状态值' 
      });
    }

    // 防止管理员禁用自己
    if (id === req.user!.id && status === 'DISABLED') {
      return res.status(400).json({ 
        success: false, 
        error: '不能禁用自己' 
      });
    }

    const updateData: any = {};
    if (role) updateData.role = role;
    if (status) {
      updateData.status = status;
      if (status === 'ACTIVE') {
        updateData.failedLogins = 0;
        updateData.lockedUntil = null;
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true
      }
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        actorId: req.user!.id,
        targetId: id,
        details: JSON.stringify({ role, status })
      }
    });

    res.json({
      success: true,
      message: '用户信息已更新',
      data: user
    });
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.status(500).json({ success: false, error: '更新用户信息失败' });
  }
});

// ============ 删除用户 ============
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 防止删除自己
    if (id === req.user!.id) {
      return res.status(400).json({ 
        success: false, 
        error: '不能删除自己的账户' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 删除用户 (cascade 会自动删除关联的项目和 token)
    await prisma.user.delete({
      where: { id }
    });

    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        action: 'user_deleted',
        actorId: req.user!.id,
        targetId: id,
        details: JSON.stringify({ 
          username: user.username, 
          projectCount: user._count.projects 
        })
      }
    });

    res.json({
      success: true,
      message: '用户已删除'
    });
  } catch (error: any) {
    console.error('删除用户失败:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.status(500).json({ success: false, error: '删除用户失败' });
  }
});

// ============ 获取审计日志 (可选功能) ============
router.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({ success: false, error: '获取审计日志失败' });
  }
});

export default router;

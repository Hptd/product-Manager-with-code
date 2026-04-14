// 首次启动时自动创建管理员账号
import { prisma } from '../db/prisma.js';
import bcrypt from 'bcryptjs';

export async function initializeAdminUser() {
  try {
    // 检查是否已有管理员
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (adminExists) {
      console.log('✅ 管理员账号已存在:', adminExists.username);
      return;
    }

    // 从环境变量读取管理员配置
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');

    // 检查是否有普通用户（首次初始化）
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      // 创建第一个管理员账号
      const passwordHash = await bcrypt.hash(adminPassword, bcryptRounds);
      
      await prisma.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          passwordHash,
          role: 'ADMIN'
        }
      });

      console.log('✅ 管理员账号已创建:');
      console.log(`   用户名: ${adminUsername}`);
      console.log(`   密码: ${adminPassword}`);
      console.log('   ⚠️  请立即修改默认密码!');
    }
  } catch (error) {
    console.error('创建管理员账号失败:', error);
  }
}

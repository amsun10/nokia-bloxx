// js/tower.js - 大楼层叠结构、质心偏移动力学与阻尼摆动模拟

import { Block, BLOCK_WIDTH, BLOCK_HEIGHT } from './block.js';

export class Tower {
  constructor(baseX, groundY) {
    this.baseX = baseX;
    this.groundY = groundY;
    this.blocks = [];
    
    // 大楼弹性摆动物理参数 (反向阻尼摆)
    this.swayAngle = 0;          // 当前倾角
    this.swayVelocity = 0;       // 摆动角速度
    this.swayStiffness = 14.0;   // 结构刚度 (回弹系数)
    this.swayDamping = 2.2;      // 阻尼系数 (能量衰减)

    this.population = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isCollapsing = false;

    this.reset();
  }

  reset() {
    this.blocks = [];
    this.swayAngle = 0;
    this.swayVelocity = 0;
    this.population = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isCollapsing = false;

    // 放置最底部的基座大堂
    const foundation = new Block('foundation', 0);
    foundation.x = this.baseX;
    foundation.y = this.groundY - BLOCK_HEIGHT / 2;
    foundation.status = 'landed';
    foundation.offsetFromLower = 0;
    this.blocks.push(foundation);
  }

  getTopBlock() {
    return this.blocks[this.blocks.length - 1];
  }

  getFloorCount() {
    return this.blocks.length - 1; // 扣除地基
  }

  // 计算大楼当前顶部的全局绝对物理位置
  getTopSurfacePosition() {
    const topBlock = this.getTopBlock();
    const count = this.blocks.length;
    // 越高的大楼，顶部受当前摆角倾斜位移越大
    const swayOffsetX = Math.sin(this.swayAngle) * (count * (BLOCK_HEIGHT * 0.7));
    return {
      x: topBlock.x + swayOffsetX,
      y: topBlock.y - BLOCK_HEIGHT / 2,
      rawTopBlock: topBlock
    };
  }

  // 触发大楼倒塌灾难特效
  triggerCollapse(particles = null) {
    this.isCollapsing = true;
    // 依据当前大楼摆动倾斜方向，决定主倒塌方向
    const dir = this.swayAngle > 0.02 ? 1 : (this.swayAngle < -0.02 ? -1 : (Math.random() > 0.5 ? 1 : -1));

    const count = this.blocks.length;
    for (let i = 0; i < count; i++) {
      const b = this.blocks[i];
      b.isCollapsing = true;
      // 从顶层到底层连锁崩塌 (顶层最先失衡滑落)
      const reverseIdx = count - 1 - i;
      b.collapseDelay = reverseIdx * 0.06;
      // 横向爆发冲量与高空离心力
      const heightRatio = (i + 1) / count;
      b.collapseVx = dir * (60 + Math.random() * 90 * heightRatio) + (Math.random() - 0.5) * 40;
      b.collapseVy = -(30 + Math.random() * 80 * heightRatio); // 初始轻微向上掀起
      b.collapseVRot = dir * (1.8 + Math.random() * 3.2 * heightRatio);
      b.collapseGravity = 1100 + Math.random() * 200;
      b.hasHitGround = false;
    }

    if (particles) {
      particles.shake(14, 2.2);
    }
  }

  // 物理更新（阻尼振动方程 / 倒塌独立刚体模拟）
  update(dt, wind = 0, particles = null) {
    if (this.isCollapsing) {
      const count = this.blocks.length;
      for (let i = 0; i < count; i++) {
        const b = this.blocks[i];
        if (!b.isCollapsing) continue;

        if (b.collapseDelay > 0) {
          b.collapseDelay -= dt;
          // 倾覆延迟期间整楼加剧倾斜颤抖
          b.rotation += this.swayAngle * dt * 3.0;
          continue;
        }

        // 重力下坠与飞散
        b.collapseVy += b.collapseGravity * dt;
        b.x += b.collapseVx * dt;
        b.y += b.collapseVy * dt;
        b.rotation += b.collapseVRot * dt;

        // 触及地面碰撞与碎裂
        const groundContactY = this.groundY - BLOCK_HEIGHT / 2;
        if (b.y >= groundContactY) {
          b.y = groundContactY;
          b.collapseVy = -b.collapseVy * 0.2; // 触地轻微弹跳
          b.collapseVx *= 0.6;
          b.collapseVRot *= 0.45;

          if (!b.hasHitGround) {
            b.hasHitGround = true;
            if (particles) {
              particles.spawnDust(b.x, b.y, 16);
              particles.spawnRubble(b.x, b.y, 14);
              particles.spawnSmoke(b.x, b.y, 6);
            }
          }
        }

        // 下落途中随机冒出断裂碎屑烟雾
        if (Math.random() < 0.22 && particles) {
          particles.spawnSmoke(b.x, b.y, 1);
        }
      }
      return;
    }

    // 正常状态：质心恢复力加速度 = -k * angle - c * v + 外力(风力微扰)
    const count = this.blocks.length;
    const effectiveStiffness = Math.max(3.5, this.swayStiffness - count * 0.12);
    const acceleration = -effectiveStiffness * this.swayAngle - this.swayDamping * this.swayVelocity + (wind * 0.08);

    this.swayVelocity += acceleration * dt;
    this.swayAngle += this.swayVelocity * dt;

    // 限制最大摆动角度防止过度穿模失真
    this.swayAngle = Math.max(-0.25, Math.min(0.25, this.swayAngle));
  }

  // 判定掉落方块的着陆对齐情况
  checkLanding(fallingBlock) {
    if (fallingBlock.status !== 'falling') return null;

    const topPos = this.getTopSurfacePosition();
    const prevBottomY = (fallingBlock.prevY ?? fallingBlock.y) + BLOCK_HEIGHT / 2;
    const currentBottomY = fallingBlock.y + BLOCK_HEIGHT / 2;

    // 连续碰撞检测 (Continuous Collision Detection):
    // 1. 上一帧在目标表面之上 (或刚好触碰)，且当前帧到达或越过了目标表面
    const crossedSurface = prevBottomY <= topPos.y + 4 && currentBottomY >= topPos.y;
    // 2. 容错近距范围 (防止初始帧异常)
    const inSurfaceRange = currentBottomY >= topPos.y && fallingBlock.y < topPos.y + BLOCK_HEIGHT * 0.8;

    if (crossedSurface || inSurfaceRange) {
      const deltaX = fallingBlock.x - topPos.x;
      const absDelta = Math.abs(deltaX);

      // 1. 完美判定 (Perfect!) - 偏差小于等于 6 像素
      if (absDelta <= 6) {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // 完美对齐极大吸收晃动能量，稳定大楼
        this.swayVelocity *= 0.12;
        this.swayAngle *= 0.15;

        const popBonus = 100 + (this.combo - 1) * 50;
        this.population += popBonus;

        this.attachBlock(fallingBlock, topPos.x, topPos.y - BLOCK_HEIGHT / 2, 0);
        fallingBlock.addResidents(3);

        return {
          type: 'perfect',
          combo: this.combo,
          popGained: popBonus,
          deltaX: deltaX
        };
      }

      // 2. 普通着陆 (Good / OK) - 偏差在允许重叠宽度内
      const maxAllowedOffset = BLOCK_WIDTH * 0.44;
      if (absDelta <= maxAllowedOffset) {
        this.combo = 0;

        // 偏差造成偏心力矩冲量，激发大楼摇晃
        const impulseDirection = deltaX > 0 ? 1 : -1;
        const impulseIntensity = (absDelta / maxAllowedOffset) * 0.55;
        this.swayVelocity += impulseDirection * impulseIntensity;

        // 依据对齐精准度折算入住人口 (40 ~ 90人)
        const accuracy = 1.0 - (absDelta / maxAllowedOffset);
        const popGained = Math.round(40 + accuracy * 50);
        this.population += popGained;

        this.attachBlock(fallingBlock, fallingBlock.x, topPos.y - BLOCK_HEIGHT / 2, deltaX);
        fallingBlock.addResidents(accuracy > 0.5 ? 2 : 1);

        return {
          type: absDelta <= 16 ? 'good' : 'ok',
          combo: 0,
          popGained: popGained,
          deltaX: deltaX
        };
      }

      // 3. 严重错位滑落 (Miss)
      fallingBlock.status = 'tumbling';
      fallingBlock.vRotation = deltaX > 0 ? 5.5 : -5.5;
      fallingBlock.vx = (deltaX > 0 ? 1 : -1) * (140 + Math.random() * 60);

      this.combo = 0;
      return {
        type: 'miss',
        deltaX: deltaX
      };
    }

    return null; // 仍在下落途中
  }

  // 固化新方块到大楼上
  attachBlock(block, finalX, finalY, offset) {
    block.status = 'landed';
    block.x = finalX;
    block.y = finalY;
    block.offsetFromLower = offset;
    block.rotation = 0;
    this.blocks.push(block);
  }

  draw(ctx, cameraY) {
    const count = this.blocks.length;

    // 倒塌特效状态下的独立刚体自由翻滚渲染
    if (this.isCollapsing) {
      for (let i = 0; i < count; i++) {
        const block = this.blocks[i];
        const renderX = block.x;
        const renderY = block.y - cameraY;
        if (renderY > -100 && renderY < ctx.canvas.height + 100) {
          block.draw(ctx, renderX, renderY, 0);
        }
      }
      return;
    }

    // 从底部到顶部依次绘制所有楼层
    for (let i = 0; i < count; i++) {
      const block = this.blocks[i];
      // 高度比例 ratio 从 0 (地基) 到 1 (顶层)
      const heightRatio = i / Math.max(1, count - 1);
      // 随着楼层越高，随大楼弹性角度产生渐进侧弯 (曲率分布)
      const currentFloorAngle = this.swayAngle * (heightRatio * 0.9);
      const swayOffset = Math.sin(this.swayAngle) * (i * BLOCK_HEIGHT * 0.65);

      const renderX = block.x + swayOffset;
      const renderY = block.y - cameraY;

      // 仅在可视视野范围内的楼层进行细致渲染优化
      if (renderY > -100 && renderY < ctx.canvas.height + 100) {
        block.draw(ctx, renderX, renderY, currentFloorAngle);
      }
    }
  }
}

// js/crane.js - 起重机摇摆物理、吊钩与新方块生成

import { Block } from './block.js';

export class Crane {
  constructor(canvasWidth, anchorY = 22) {
    this.canvasWidth = canvasWidth;
    this.anchorX = canvasWidth / 2;
    this.anchorY = anchorY;

    this.ropeLength = 165; // 紧凑适中的摆动索长，紧密呼应下方建筑
    this.angle = 0;
    this.angularVelocity = 0;
    this.maxAngle = 0.48; // 摆动最大角度 (~27度)
    this.swingSpeed = 2.4; // 摆动角频率
    this.time = 0;
    this.hookRecoil = 0; // 脱钩后吊钩微弱弹升动效

    this.currentBlock = null;
    this.isDropping = false;
    this.reloadCooldown = 0; // 下一个方块装填计时
  }

  reset(floorNumber = 1) {
    this.time = 0;
    this.angle = 0;
    this.hookRecoil = 0;
    this.isDropping = false;
    this.reloadCooldown = 0;
    this.spawnBlock(floorNumber);
  }

  spawnBlock(floorNumber) {
    this.currentBlock = new Block('normal', floorNumber);
    this.isDropping = false;
  }

  update(dt, difficultyMultiplier = 1.0, wind = 0) {
    this.time += dt * (this.swingSpeed * (0.9 + 0.1 * difficultyMultiplier));
    
    // 动态摆角 = 正弦主振动 + 风力偏置 + 偶发微小次谐波扰动
    const baseSwing = Math.sin(this.time) * (this.maxAngle * Math.min(1.3, 0.85 + 0.15 * difficultyMultiplier));
    const windOffset = wind * 0.12;
    const microJitter = Math.sin(this.time * 2.7) * 0.04;
    
    this.angle = baseSwing + windOffset + microJitter;
    // 近似角速度用于释放时的惯性传递
    this.angularVelocity = Math.cos(this.time) * this.maxAngle * this.swingSpeed;

    // 吊钩脱载回缩微动平滑恢复
    if (Math.abs(this.hookRecoil) > 0.05) {
      this.hookRecoil *= Math.exp(-12.0 * dt);
    } else {
      this.hookRecoil = 0;
    }

    // 更新装填冷却
    if (this.reloadCooldown > 0) {
      this.reloadCooldown -= dt;
    }

    // 更新悬挂方块位置 (沿摆角方向刚体延伸，确保吊钩与方块无缝嵌套)
    if (this.currentBlock && this.currentBlock.status === 'hanging') {
      const blockPos = this.getBlockCenterPosition();
      this.currentBlock.x = blockPos.x;
      this.currentBlock.y = blockPos.y;
      this.currentBlock.rotation = this.angle;
    }
  }

  getHookPosition() {
    const currentLength = this.ropeLength + this.hookRecoil;
    return {
      x: this.anchorX + Math.sin(this.angle) * currentLength,
      y: this.anchorY + Math.cos(this.angle) * currentLength
    };
  }

  // 计算方块中心在吊钩下方的真实物理空间坐标
  getBlockCenterPosition() {
    const hookPos = this.getHookPosition();
    const offsetDistance = 38; // 吊钩下沿到方块中心的几何轴向间距
    return {
      x: hookPos.x + Math.sin(this.angle) * offsetDistance,
      y: hookPos.y + Math.cos(this.angle) * offsetDistance
    };
  }

  // 释放方块 (cameraX, cameraY 转换为世界物理全局坐标)
  releaseBlock(cameraX = 0, cameraY = 0) {
    if (!this.currentBlock || this.currentBlock.status !== 'hanging' || this.reloadCooldown > 0) {
      return null;
    }

    const blockPos = this.getBlockCenterPosition();
    const effectiveRadius = this.ropeLength + 38;
    const vx = this.angularVelocity * effectiveRadius * Math.cos(this.angle);
    
    const released = this.currentBlock;
    // 叠加镜头水平与垂直偏移，精准转换到世界物理空间
    released.release(blockPos.x + cameraX, blockPos.y + cameraY, vx, this.angle, this.angularVelocity);
    
    // 起重机吊钩脱载卸力微弹动画 (-6px 向上自然微缩后复位)
    this.hookRecoil = -6;

    this.currentBlock = null;
    this.isDropping = true;
    this.reloadCooldown = 0.35; // 0.35秒装填冷却

    return released;
  }

  draw(ctx) {
    ctx.save();

    // 1. 顶部起重机导轨桁架 (工业黄色 + 警示条纹)
    this.drawGantry(ctx);

    const hookPos = this.getHookPosition();

    // 2. 钢缆 (双线编织效果)
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.anchorX, this.anchorY);
    ctx.lineTo(hookPos.x, hookPos.y);
    ctx.stroke();

    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.anchorX, this.anchorY);
    ctx.lineTo(hookPos.x, hookPos.y);
    ctx.stroke();

    // 3. 机械滑轮组与重型吊钩
    this.drawHook(ctx, hookPos.x, hookPos.y);

    // 4. 如果有悬挂方块，绘制悬挂方块
    if (this.currentBlock && this.currentBlock.status === 'hanging') {
      this.currentBlock.draw(ctx, this.currentBlock.x, this.currentBlock.y);
    }

    ctx.restore();
  }

  drawGantry(ctx) {
    const barY = this.anchorY - 14;
    const barH = 14;

    // 金属大梁
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(0, barY, this.canvasWidth, barH);

    // 斜向警示斑马黑线
    ctx.fillStyle = '#2c3e50';
    for (let x = -20; x < this.canvasWidth + 20; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, barY + barH);
      ctx.lineTo(x + 10, barY);
      ctx.lineTo(x + 18, barY);
      ctx.lineTo(x + 8, barY + barH);
      ctx.fill();
    }

    // 下沿轨道金属边
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(0, barY + barH - 2, this.canvasWidth, 3);

    // 轨道中央悬吊小车 (Trolley)
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.anchorX - 18, barY + barH - 4, 36, 10);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(this.anchorX - 14, barY + barH + 2, 28, 4);

    // 吊索引出滚轮
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.arc(this.anchorX, barY + barH + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHook(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);

    // 滑轮保护罩
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(-10, -14, 20, 14);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, -7, 4, 0, Math.PI * 2);
    ctx.fill();

    // 金属锻造挂钩
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 8);
    ctx.arc(4, 12, 6, Math.PI, 0.2, true);
    ctx.stroke();

    ctx.restore();
  }
}

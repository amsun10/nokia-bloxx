// js/block.js - 楼层方块实体、下落物理与复古像素绘制

export const BLOCK_WIDTH = 114;
export const BLOCK_HEIGHT = 56;

export class Block {
  constructor(type = 'normal', floorNumber = 1) {
    this.type = type; // 'foundation', 'normal', 'roof'
    this.floorNumber = floorNumber;
    this.width = BLOCK_WIDTH;
    this.height = BLOCK_HEIGHT;
    
    this.x = 0;
    this.y = 0;
    this.prevY = 0; // 上一帧 Y 坐标，用于连续碰撞穿透检测
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.vRotation = 0;

    this.status = 'hanging'; // 'hanging', 'falling', 'landed', 'tumbling'
    this.offsetFromLower = 0; // 与下层的水平偏差
    this.residents = []; // 入驻居民小人 [{x, y, frame}]
    this.hasCelebrated = false;
    this.colorVariant = (floorNumber % 4); // 4种经典建筑配色主题
    this.windowStates = [
      Math.random() > 0.3,
      Math.random() > 0.3,
      Math.random() > 0.3
    ];
  }

  // 释放下落
  release(initialX, initialY, initialVx) {
    this.x = initialX;
    this.y = initialY;
    this.prevY = initialY;
    this.vx = initialVx * 0.7; // 继承摆动线速度的一部分
    this.vy = 0.5;
    this.status = 'falling';
  }

  update(dt, wind = 0) {
    if (this.status === 'falling') {
      this.prevY = this.y;
      const gravity = 1200; // px/s^2
      this.vy += gravity * dt;
      this.x += (this.vx + wind * 20) * dt;
      this.y += this.vy * dt;
      // 微弱空气阻力水平旋转
      this.rotation = Math.sin(this.vy * 0.05) * 0.04;
    } else if (this.status === 'tumbling') {
      this.prevY = this.y;
      // 错位坠毁滚落
      const gravity = 1400;
      this.vy += gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.vRotation * dt;
    }
  }

  addResidents(count) {
    for (let i = 0; i < count; i++) {
      this.residents.push({
        windowIdx: i % 3,
        cheerTimer: 0,
        color: ['#ff4757', '#2ed573', '#1e90ff', '#ffa502'][Math.floor(Math.random() * 4)]
      });
    }
  }

  draw(ctx, screenX, screenY, towerAngle = 0) {
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(this.rotation + towerAngle);

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (this.type === 'foundation') {
      this.drawFoundation(ctx, -halfW, -halfH);
    } else {
      this.drawNormalFloor(ctx, -halfW, -halfH);
    }

    // 绘制挂钩扣环（如果在悬挂中）
    if (this.status === 'hanging') {
      this.drawRoofHarness(ctx, -halfW, -halfH);
    }

    ctx.restore();
  }

  // 绘制普通公寓楼层（高精度复古像素风）
  drawNormalFloor(ctx, x, y) {
    const w = this.width;
    const h = this.height;

    // 配色定义 (外墙主色、阴影色、高光色)
    const palettes = [
      { main: '#d35400', shadow: '#a04000', light: '#e67e22', trim: '#ecf0f1' }, // 经典暖橙红砖
      { main: '#2980b9', shadow: '#1f618d', light: '#3498db', trim: '#f1c40f' }, // 现代深海蓝
      { main: '#27ae60', shadow: '#1e8449', light: '#2ecc71', trim: '#ffffff' }, // 清新墨绿
      { main: '#8e44ad', shadow: '#6c3483', light: '#9b59b6', trim: '#f39c12' }  // 奢华深紫
    ];
    const theme = palettes[this.colorVariant];

    // 1. 墙面背景与投影
    ctx.fillStyle = theme.shadow;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = theme.main;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // 2. 砖块横向纹理
    ctx.strokeStyle = theme.shadow;
    ctx.lineWidth = 1;
    for (let row = 1; row < 4; row++) {
      const lineY = y + row * (h / 4);
      ctx.beginPath();
      ctx.moveTo(x + 2, lineY);
      ctx.lineTo(x + w - 2, lineY);
      ctx.stroke();
    }

    // 3. 上下楼板装饰线（Cornice）
    ctx.fillStyle = theme.trim;
    ctx.fillRect(x - 2, y, w + 4, 4); // 顶部横梁
    ctx.fillStyle = theme.shadow;
    ctx.fillRect(x - 2, y + 3, w + 4, 1);

    // 底部横梁
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(x - 1, y + h - 4, w + 2, 4);

    // 4. 窗户 (3扇经典拱窗/方窗)
    const winWidth = 20;
    const winHeight = 26;
    const winSpacing = (w - winWidth * 3) / 4;

    for (let i = 0; i < 3; i++) {
      const winX = x + winSpacing * (i + 1) + winWidth * i;
      const winY = y + 12;

      // 窗框外围阴影与边缘
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(winX - 1, winY - 1, winWidth + 2, winHeight + 2);

      // 窗内灯光（黄光开启 vs 蓝暗色关闭）
      const isLit = this.windowStates[i];
      ctx.fillStyle = isLit ? '#f1c40f' : '#34495e';
      ctx.fillRect(winX, winY, winWidth, winHeight);

      // 窗格十字分割
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(winX + winWidth / 2 - 1, winY, 2, winHeight);
      ctx.fillRect(winX, winY + winHeight / 2 - 1, winWidth, 2);

      // 窗帘/反光高光
      ctx.fillStyle = isLit ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(winX, winY);
      ctx.lineTo(winX + winWidth / 2, winY);
      ctx.lineTo(winX, winY + winHeight / 2);
      ctx.fill();

      // 检查是否有小人居民在窗前欢呼
      const resident = this.residents.find(r => r.windowIdx === i);
      if (resident) {
        // 小人头部和挥舞的手臂
        ctx.fillStyle = resident.color;
        ctx.beginPath();
        ctx.arc(winX + winWidth / 2, winY + winHeight - 6, 4, 0, Math.PI * 2);
        ctx.fill();
        // 挥动的手臂
        ctx.strokeStyle = '#f5cd79';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const armOffset = Math.sin(Date.now() * 0.015 + i) * 3;
        ctx.moveTo(winX + winWidth / 2 - 4, winY + winHeight - 4);
        ctx.lineTo(winX + 2, winY + winHeight - 10 + armOffset);
        ctx.moveTo(winX + winWidth / 2 + 4, winY + winHeight - 4);
        ctx.lineTo(winX + winWidth - 2, winY + winHeight - 10 - armOffset);
        ctx.stroke();
      }

      // 窗台小花盆装饰
      if (i === 1) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(winX + 2, winY + winHeight, winWidth - 4, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(winX + 4, winY + winHeight - 2, 4, 2);
        ctx.fillRect(winX + 11, winY + winHeight - 3, 5, 3);
      }
    }

    // 左右立柱高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + 2, y + 4, 2, h - 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x + w - 4, y + 4, 2, h - 8);
  }

  // 绘制大楼地基与入口大堂
  drawFoundation(ctx, x, y) {
    const w = this.width;
    const h = this.height;

    // 石砖大理石地基
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(x + 3, y + 2, w - 6, h - 4);

    // 顶部门楣
    ctx.fillStyle = '#34495e';
    ctx.fillRect(x - 2, y, w + 4, 5);

    // 双开大玻璃门
    const doorW = 32;
    const doorH = 34;
    const doorX = x + (w - doorW) / 2;
    const doorY = y + h - doorH - 2;

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // 旋转门/中缝
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(doorX + doorW / 2 - 1, doorY, 2, doorH);

    // 门厅两旁绿植盆栽
    ctx.fillStyle = '#d35400';
    ctx.fillRect(doorX - 16, doorY + 16, 10, 16);
    ctx.fillRect(doorX + doorW + 6, doorY + 16, 10, 16);
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(doorX - 11, doorY + 12, 8, 0, Math.PI * 2);
    ctx.arc(doorX + doorW + 11, doorY + 12, 8, 0, Math.PI * 2);
    ctx.fill();

    // 门上方招牌
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(doorX - 6, doorY - 8, doorW + 12, 7);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOTEL BLOXX', doorX + doorW / 2, doorY - 2);
  }

  // 绘制悬吊时的钢缆固定扣与顶部吊环
  drawRoofHarness(ctx, x, y) {
    const w = this.width;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;

    // 两侧固定扣
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(x + 10, y - 5, 8, 6);
    ctx.fillRect(x + w - 18, y - 5, 8, 6);

    // 斜拉钢索汇聚到中心吊环
    ctx.strokeStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 5);
    ctx.lineTo(0, y - 22);
    ctx.lineTo(x + w - 14, y - 5);
    ctx.stroke();

    // 顶部挂钩圆环
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, y - 22, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

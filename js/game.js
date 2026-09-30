// js/game.js - 核心游戏主逻辑、高度视差背景、风力系统与镜头平滑跟踪

import { Crane } from './crane.js';
import { Tower } from './tower.js';
import { ParticleSystem } from './particle.js';
import { audio } from './audio.js';
import { storage } from './storage.js';

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 580;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 适配真实屏幕像素比与高清晰度
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    // 游戏核心状态
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER'
    this.lives = 3;
    this.maxLives = 3;

    // 镜头相机
    this.cameraY = 0;
    this.targetCameraY = 0;

    // 实体系统
    const groundY = CANVAS_HEIGHT - 60;
    this.tower = new Tower(CANVAS_WIDTH / 2, groundY);
    this.crane = new Crane(CANVAS_WIDTH, 45);
    this.particles = new ParticleSystem();
    this.activeFallingBlock = null;

    // 动态风力系统
    this.wind = 0;
    this.targetWind = 0;
    this.windChangeTimer = 0;

    // 视差背景元素（漂浮云彩、星星）
    this.clouds = [];
    this.initClouds();
    this.stars = [];
    this.initStars();

    // 帧率时间
    this.lastTime = performance.now();
    this.newHighScore = false;
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      this.clouds.push({
        x: Math.random() * CANVAS_WIDTH,
        y: -i * 180 + 100, // 分布在不同高度层
        speed: 12 + Math.random() * 20,
        w: 50 + Math.random() * 50,
        h: 22 + Math.random() * 15,
        alpha: 0.5 + Math.random() * 0.4
      });
    }
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: -i * 60 - 1500, // 高空层 (30层以上)
        size: 1 + Math.random() * 2,
        twinkleSpeed: 2 + Math.random() * 3
      });
    }
  }

  startNewGame() {
    audio.init();
    audio.playClick();
    if (storage.getSetting('bgm')) {
      audio.startBgm();
    }

    this.state = 'PLAYING';
    this.lives = this.maxLives;
    this.newHighScore = false;
    this.activeFallingBlock = null;

    this.tower.reset();
    this.crane.reset(1);
    this.particles.reset();

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.wind = 0;
    this.targetWind = 0;
    this.windChangeTimer = 2.0;

    this.emptyHookTimer = 0;
    if (this.nextFloorTimer) {
      clearTimeout(this.nextFloorTimer);
      this.nextFloorTimer = null;
    }
  }

  // 玩家按下下落按钮 (空格 / 5 / 触屏)
  triggerDrop() {
    if (this.state === 'MENU') {
      this.startNewGame();
      return;
    }

    if (this.state === 'GAMEOVER') {
      this.startNewGame();
      return;
    }

    if (this.state === 'PLAYING') {
      if (this.activeFallingBlock || !this.crane.currentBlock) {
        return; // 已有正在下落的方块或未就绪
      }
      // 将当前镜头偏移传入，精确转换到物理世界坐标系
      const released = this.crane.releaseBlock(this.cameraY);
      if (released) {
        this.activeFallingBlock = released;
        audio.playDrop();
      }
    }
  }

  update(dt) {
    // 1. 更新风力扰动
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      // 随着楼层升高，风力更大
      const floorFactor = Math.min(2.5, 0.5 + this.tower.getFloorCount() * 0.08);
      this.targetWind = (Math.random() - 0.5) * 2 * floorFactor;
      this.windChangeTimer = 3.5 + Math.random() * 3;
    }
    this.wind += (this.targetWind - this.wind) * (dt * 1.5);

    // 2. 更新背景云层
    for (const c of this.clouds) {
      c.x += (c.speed + this.wind * 15) * dt;
      if (c.x > CANVAS_WIDTH + 80) c.x = -80;
      if (c.x < -80) c.x = CANVAS_WIDTH + 80;
    }

    // 3. 更新粒子系统
    this.particles.update(dt);

    // 倒塌过场状态分支
    if (this.state === 'COLLAPSING') {
      this.collapseDuration -= dt;
      this.tower.update(dt, this.wind, this.particles);

      // 镜头平滑下移跟踪坠落大楼到地面
      const groundScreenY = (CANVAS_HEIGHT - 60) - (CANVAS_HEIGHT * 0.7);
      this.cameraY += (groundScreenY - this.cameraY) * Math.min(1.0, dt * 2.5);

      if (this.collapseDuration <= 0) {
        this.handleGameOver();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    // 4. 更新大楼物理与起重机
    this.tower.update(dt, this.wind);
    const difficulty = 1.0 + Math.min(2.0, this.tower.getFloorCount() * 0.05);
    this.crane.update(dt, difficulty, this.wind);

    // 5. 更新下落中的方块与碰撞检测
    if (this.activeFallingBlock) {
      this.activeFallingBlock.update(dt, this.wind);

      // 仅处于下落状态时检测着陆碰撞 (翻滚中不重复判定)
      if (this.activeFallingBlock.status === 'falling') {
        const result = this.tower.checkLanding(this.activeFallingBlock);
        if (result) {
          const topPos = this.tower.getTopSurfacePosition();

          if (result.type === 'perfect') {
            audio.playLand(1.0);
            audio.playPerfect(result.combo);
            this.particles.spawnCelebration(topPos.x, topPos.y, result.combo);
            this.particles.spawnDust(topPos.x, topPos.y, 14);
            this.particles.shake(4, 0.18);

            const comboTxt = result.combo > 1 ? `PERFECT x${result.combo}!` : 'PERFECT!';
            this.particles.addFloatingText(comboTxt, topPos.x, topPos.y - 10, '#f1c40f', `+${result.popGained} POP`);
            this.activeFallingBlock = null;

            // 准备下一层
            this.prepareNextFloor(300);
          } else if (result.type === 'good' || result.type === 'ok') {
            audio.playLand(0.8);
            audio.playWobble();
            this.particles.spawnDust(topPos.x, topPos.y, 8);
            this.particles.shake(result.type === 'good' ? 5 : 8, 0.22);

            const ratingTxt = result.type === 'good' ? 'GOOD' : 'OK';
            const ratingColor = result.type === 'good' ? '#2ecc71' : '#e67e22';
            this.particles.addFloatingText(ratingTxt, topPos.x, topPos.y - 10, ratingColor, `+${result.popGained} POP`);
            this.activeFallingBlock = null;

            this.prepareNextFloor(300);
          } else if (result.type === 'miss') {
            // 严重错位脱靶
            audio.playMiss();
            this.particles.shake(12, 0.35);
            this.particles.addFloatingText('MISS!', topPos.x, topPos.y - 10, '#e74c3c', '-1 LIFE');

            this.lives--;
            if (this.lives <= 0) {
              // 触发大楼轰然倒塌特效，不再直接弹窗结束
              this.startCollapse();
            } else {
              // 错位脱靶后，保证吊钩装填下一层方块
              this.prepareNextFloor(500);
            }
          }
        }
      }

      // 方块跌出屏幕外检测与清理
      if (this.activeFallingBlock && this.activeFallingBlock.y - this.cameraY > CANVAS_HEIGHT + 150) {
        this.activeFallingBlock = null;
        if (this.state === 'PLAYING' && !this.crane.currentBlock) {
          this.prepareNextFloor(200);
        }
      }
    }

    // 6. 安全看门狗 (Safety Watchdog):
    // 若游戏中既无挂载方块也无下落方块且冷却完毕，0.4秒内自动补填，彻底解决吊钩空转问题
    if (!this.crane.currentBlock && !this.activeFallingBlock && this.crane.reloadCooldown <= 0) {
      this.emptyHookTimer = (this.emptyHookTimer || 0) + dt;
      if (this.emptyHookTimer > 0.4) {
        this.prepareNextFloor(0);
        this.emptyHookTimer = 0;
      }
    } else {
      this.emptyHookTimer = 0;
    }

    // 7. 镜头平滑跟踪大楼顶部
    const topBlock = this.tower.getTopBlock();
    // 保持大楼顶部大约在屏幕中央偏下位置 (约 62% 高度处)
    this.targetCameraY = topBlock.y - (CANVAS_HEIGHT * 0.62);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1.0, dt * 4.5);
  }

  // 启动大楼轰鸣倒塌过场特效
  startCollapse() {
    this.state = 'COLLAPSING';
    this.collapseDuration = 2.8; // 2.8秒物理崩塌与尘暴过场
    this.activeFallingBlock = null;

    audio.stopBgm();
    audio.playCollapse();
    this.tower.triggerCollapse(this.particles);
  }

  prepareNextFloor(delay = 300) {
    if (this.nextFloorTimer) {
      clearTimeout(this.nextFloorTimer);
    }
    this.nextFloorTimer = setTimeout(() => {
      if (this.state === 'PLAYING' && !this.crane.currentBlock) {
        this.crane.spawnBlock(this.tower.getFloorCount() + 1);
      }
      this.nextFloorTimer = null;
    }, delay);
  }

  handleGameOver() {
    this.state = 'GAMEOVER';
    audio.playGameOver();

    const floors = this.tower.getFloorCount();
    const pop = this.tower.population;
    const maxCombo = this.tower.maxCombo;
    this.newHighScore = storage.updateRecord(pop, floors, maxCombo);
  }

  // 渲染总流程
  draw() {
    const ctx = this.ctx;
    const shake = this.particles.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. 动态渐变天空与背景层
    this.drawSkyBackground(ctx);

    // 2. 远景地平线与城市天际线 (根据镜头高度移动视差)
    this.drawParallaxCity(ctx);

    // 3. 绘制大楼本体
    this.tower.draw(ctx, this.cameraY);

    // 4. 绘制正在掉落的方块
    if (this.activeFallingBlock) {
      this.activeFallingBlock.draw(
        ctx,
        this.activeFallingBlock.x,
        this.activeFallingBlock.y - this.cameraY
      );
    }

    // 5. 绘制吊车起重机 (起重机固定在顶部，不随普通镜头完全卷走)
    this.crane.draw(ctx);

    // 6. 绘制粒子与浮动反馈
    this.particles.draw(ctx, this.cameraY);

    // 7. 绘制游戏 HUD 顶栏与状态界面
    this.drawHUD(ctx);

    ctx.restore();
  }

  // 绘制动态多段渐变天空
  drawSkyBackground(ctx) {
    const heightProgress = Math.max(0, -this.cameraY / 1500); // 0=地面, 1=高空, 2=太空
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);

    if (heightProgress < 0.6) {
      // 地面日间天蓝色
      grad.addColorStop(0, '#3498db');
      grad.addColorStop(0.6, '#5dade2');
      grad.addColorStop(1, '#aed6f1');
    } else if (heightProgress < 1.4) {
      // 傍晚霞光与晚霞紫橙
      const p = (heightProgress - 0.6) / 0.8;
      grad.addColorStop(0, '#2c3e50');
      grad.addColorStop(0.5, '#8e44ad');
      grad.addColorStop(1, '#e67e22');
    } else {
      // 深空暗夜与繁星
      grad.addColorStop(0, '#0a0d1a');
      grad.addColorStop(0.5, '#151932');
      grad.addColorStop(1, '#2c3e50');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 绘制高空繁星
    if (heightProgress > 0.8) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const starY = s.y - this.cameraY * 0.2;
        if (starY >= 0 && starY <= CANVAS_HEIGHT) {
          ctx.beginPath();
          ctx.arc(s.x, starY, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 弯月
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH - 45, 75, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#151932';
      ctx.beginPath();
      ctx.arc(CANVAS_WIDTH - 52, 72, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制漂浮白云 (视差滚动)
    for (const c of this.clouds) {
      const renderY = c.y - this.cameraY * 0.45;
      if (renderY > -60 && renderY < CANVAS_HEIGHT + 60) {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`;
        ctx.beginPath();
        ctx.roundRect(c.x, renderY, c.w, c.h, 12);
        ctx.fill();
        // 云朵小突起
        ctx.beginPath();
        ctx.arc(c.x + c.w * 0.35, renderY - 4, c.h * 0.55, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.65, renderY - 2, c.h * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 绘制地面与远景天际线
  drawParallaxCity(ctx) {
    const groundScreenY = (CANVAS_HEIGHT - 60) - this.cameraY;

    // 仅当地面在视口附近时绘制
    if (groundScreenY > -200) {
      // 1. 远景灰蓝楼宇剪影 (慢速视差)
      const distantY = groundScreenY - 140;
      ctx.fillStyle = '#7fb3d5';
      const buildingWidths = [35, 45, 28, 55, 32, 40, 50, 36, 44, 40];
      let curX = 0;
      for (let i = 0; i < buildingWidths.length; i++) {
        const bw = buildingWidths[i];
        const bh = 80 + (i % 4) * 35;
        ctx.fillRect(curX, groundScreenY - bh, bw - 2, bh);
        curX += bw;
      }

      // 2. 近景绿地草坪（无缝紧贴大楼地基底部 groundScreenY）
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(0, groundScreenY, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, groundScreenY, CANVAS_WIDTH, 4);

      // 大楼正门前大理石迎宾铺地与台阶
      const hotelW = 126;
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect((CANVAS_WIDTH - hotelW) / 2, groundScreenY, hotelW, 16);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect((CANVAS_WIDTH - hotelW) / 2, groundScreenY + 4, hotelW, 1);
      ctx.fillRect((CANVAS_WIDTH - hotelW) / 2, groundScreenY + 9, hotelW, 1);

      // 地面沥青公路
      ctx.fillStyle = '#34495e';
      ctx.fillRect(0, groundScreenY + 18, CANVAS_WIDTH, 42);
      // 马路路沿石 (Curbs)
      ctx.fillStyle = '#bdc3c7';
      ctx.fillRect(0, groundScreenY + 16, CANVAS_WIDTH, 2);

      // 公路白色交通标线
      ctx.fillStyle = '#ecf0f1';
      for (let x = 10; x < CANVAS_WIDTH; x += 30) {
        ctx.fillRect(x, groundScreenY + 36, 16, 3);
      }

      // 地面小行道树（自然植根于草坪之上）
      for (let tx of [26, 68, CANVAS_WIDTH - 68, CANVAS_WIDTH - 26]) {
        // 树干
        ctx.fillStyle = '#795548';
        ctx.fillRect(tx - 3, groundScreenY - 18, 6, 20);
        // 树冠
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(tx, groundScreenY - 22, 14, 0, Math.PI * 2);
        ctx.fill();
        // 树冠高光层次
        ctx.fillStyle = '#43a047';
        ctx.beginPath();
        ctx.arc(tx - 3, groundScreenY - 25, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 绘制抬头 HUD 信息栏与各界面
  drawHUD(ctx) {
    if (this.state === 'PLAYING') {
      // 1. 顶部半透明像素黑底状态栏
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 30);

      // 生命值爱心 ❤️❤️❤️
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      let hearts = '';
      for (let i = 0; i < this.maxLives; i++) {
        hearts += i < this.lives ? '❤️ ' : '🖤 ';
      }
      ctx.fillText(hearts, 8, 20);

      // 当前楼层数
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`FL: ${this.tower.getFloorCount()}`, CANVAS_WIDTH / 2 - 25, 20);

      // 人口计数
      ctx.fillStyle = '#f1c40f';
      ctx.textAlign = 'right';
      ctx.fillText(`POP: ${this.tower.population.toLocaleString()}`, CANVAS_WIDTH - 8, 20);

      // 2. 右侧风向风速计 (Wind indicator)
      this.drawWindIndicator(ctx);

      // 3. 连击倍率标牌
      if (this.tower.combo > 1) {
        ctx.fillStyle = 'rgba(230, 126, 34, 0.85)';
        ctx.roundRect(8, 38, 86, 22, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`COMBO x${this.tower.combo}`, 14, 53);
      }
    } else if (this.state === 'COLLAPSING') {
      // 倒塌红色警报呼吸浮层
      const pulse = (Math.sin(Date.now() * 0.015) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + pulse * 0.16})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, 32);

      ctx.fillStyle = '#ef4444';
      ctx.font = '900 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ 大楼失衡崩解倒塌中...! ⚠️', CANVAS_WIDTH / 2, 21);
    } else if (this.state === 'MENU') {
      this.drawMenuScreen(ctx);
    } else if (this.state === 'GAMEOVER') {
      this.drawGameOverScreen(ctx);
    }
  }

  drawWindIndicator(ctx) {
    const wx = CANVAS_WIDTH - 42;
    const wy = 46;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.roundRect(wx - 26, wy - 10, 60, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#bdc3c7';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('WIND', wx - 22, wy + 4);

    // 箭头指示
    const arrowLen = Math.min(14, Math.abs(this.wind) * 12);
    if (arrowLen > 1) {
      const dir = this.wind > 0 ? 1 : -1;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + 16, wy + 1);
      ctx.lineTo(wx + 16 + dir * arrowLen, wy + 1);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(wx + 15, wy, 2, 2);
    }
  }

  drawMenuScreen(ctx) {
    // 菜单遮罩
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 标题徽章外框
    const boxX = 30;
    const boxY = 80;
    const boxW = CANVAS_WIDTH - 60;
    const boxH = 410;

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 像素经典标题
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TOWER BLOXX', CANVAS_WIDTH / 2, boxY + 48);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('★ 经典摩天大楼 ★', CANVAS_WIDTH / 2, boxY + 76);

    // 经典怀旧图示 (小楼房方块)
    const iconX = CANVAS_WIDTH / 2;
    const iconY = boxY + 125;
    ctx.fillStyle = '#d35400';
    ctx.fillRect(iconX - 25, iconY - 20, 50, 24);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(iconX - 16, iconY - 14, 8, 10);
    ctx.fillRect(iconX + 8, iconY - 14, 8, 10);

    // 历史最高记录展示
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px monospace';
    ctx.fillText('🏆 最高纪录 (HIGH SCORE)', CANVAS_WIDTH / 2, boxY + 180);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`人口: ${storage.data.highScore.toLocaleString()} 人`, CANVAS_WIDTH / 2, boxY + 205);
    ctx.fillText(`最高层数: ${storage.data.maxFloors} 层`, CANVAS_WIDTH / 2, boxY + 228);
    ctx.fillText(`最高连击: x${storage.data.maxCombo}`, CANVAS_WIDTH / 2, boxY + 251);

    // 操作指南说明
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('🕹️ 操作方式:', CANVAS_WIDTH / 2, boxY + 295);
    ctx.fillText('键盘: 空格键 / 数字键 5', CANVAS_WIDTH / 2, boxY + 316);
    ctx.fillText('触屏/鼠标: 点击下方 5 键或屏幕', CANVAS_WIDTH / 2, boxY + 336);

    // 闪烁开始按钮
    const pulse = (Math.sin(Date.now() * 0.006) + 1) * 0.5;
    ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.6})`;
    ctx.fillRect(boxX + 25, boxY + 355, boxW - 50, 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('【 按 5 或点击开始 】', CANVAS_WIDTH / 2, boxY + 378);
  }

  drawGameOverScreen(ctx) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const boxX = 35;
    const boxY = 90;
    const boxW = CANVAS_WIDTH - 70;
    const boxH = 390;

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 游戏结束标题
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, boxY + 45);

    if (this.newHighScore) {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px monospace';
      ctx.fillText('🎉 新记录突破! NEW HIGH! 🎉', CANVAS_WIDTH / 2, boxY + 75);
    }

    // 统计清单
    const statY = boxY + 115;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';

    ctx.fillText('• 达成楼层:', boxX + 30, statY);
    ctx.fillText('• 入住总人口:', boxX + 30, statY + 32);
    ctx.fillText('• 最大连击:', boxX + 30, statY + 64);
    ctx.fillText('• 历史最高人口:', boxX + 30, statY + 96);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${this.tower.getFloorCount()} 层`, boxX + boxW - 30, statY);
    ctx.fillText(`${this.tower.population.toLocaleString()} 人`, boxX + boxW - 30, statY + 32);
    ctx.fillText(`x${this.tower.maxCombo}`, boxX + boxW - 30, statY + 64);

    ctx.fillStyle = '#facc15';
    ctx.fillText(`${storage.data.highScore.toLocaleString()} 人`, boxX + boxW - 30, statY + 96);

    // 评级勋章
    const floors = this.tower.getFloorCount();
    let rank = '初级建筑工 🥉';
    if (floors >= 40) rank = '天际建筑大师 👑';
    else if (floors >= 25) rank = '摩天专家 🥇';
    else if (floors >= 12) rank = '合格工头 🥈';

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`称号: ${rank}`, CANVAS_WIDTH / 2, statY + 145);

    // 再来一局按钮
    const pulse = (Math.sin(Date.now() * 0.007) + 1) * 0.5;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + pulse * 0.55})`;
    ctx.fillRect(boxX + 25, boxY + 320, boxW - 50, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('【 按 5 或点击再来一局 】', CANVAS_WIDTH / 2, boxY + 346);
  }
}

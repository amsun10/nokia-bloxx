// js/particle.js - 粒子系统、连击火花、落点烟尘与浮动分数反馈

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }

  reset() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }

  // 触发屏幕震动 (像素级震屏反馈)
  shake(intensity = 6, duration = 0.25) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  // 落地砖尘碎屑 (Dust puff)
  spawnDust(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI / count) * i + Math.PI; // 向上向外扩散
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - 20,
        size: 2 + Math.random() * 3,
        color: ['#bdc3c7', '#ecf0f1', '#95a5a6'][Math.floor(Math.random() * 3)],
        alpha: 1.0,
        decay: 2.2 + Math.random() * 1.5
      });
    }
  }

  // 完美对齐庆祝礼花 (Confetti & Starburst)
  spawnCelebration(x, y, combo = 1) {
    const count = 18 + Math.min(25, combo * 5);
    const colors = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 150;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        size: 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 1.4 + Math.random() * 0.8,
        gravity: 250,
        isConfetti: true,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 12
      });
    }
  }

  // 添加浮动提示文本 (PERFECT! / GOOD / +150 Pop)
  addFloatingText(text, x, y, color = '#f1c40f', subText = '') {
    this.floatingTexts.push({
      text: text,
      subText: subText,
      x: x,
      y: y,
      vy: -65,
      alpha: 1.0,
      scale: 1.4,
      color: color,
      life: 1.1
    });
  }

  update(dt) {
    // 更新震屏
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      if (p.isConfetti) {
        p.rotation += p.rotSpeed * dt;
      }
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 更新浮动文字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.scale > 1.0) {
        t.scale -= dt * 2.0;
        if (t.scale < 1.0) t.scale = 1.0;
      }
      t.alpha = Math.max(0, t.life / 1.1);
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  getShakeOffset() {
    if (this.shakeDuration <= 0 || this.shakeIntensity <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeIntensity,
      y: (Math.random() - 0.5) * 2 * this.shakeIntensity
    };
  }

  draw(ctx, cameraY) {
    ctx.save();

    // 绘制粒子
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      const screenY = p.y - cameraY;
      if (p.isConfetti) {
        ctx.save();
        ctx.translate(p.x, screenY);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 绘制浮动评级文字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.save();
      const screenY = t.y - cameraY;
      ctx.translate(t.x, screenY);
      ctx.scale(t.scale, t.scale);

      // 文本黑色硬描边 (经典像素游戏描边)
      ctx.font = '900 18px "Courier New", monospace, sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(t.text, 0, 0);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);

      // 副标题 (+POP 人口)
      if (t.subText) {
        ctx.font = 'bold 12px "Courier New", monospace, sans-serif';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(t.subText, 0, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.subText, 0, 18);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}

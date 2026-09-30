// js/main.js - 游戏总控制器、按键输入映射与诺基亚键盘交互绑定

import { Game } from './game.js';
import { audio } from './audio.js';
import { storage } from './storage.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);

  // UI 控制元素
  const toggleFrameBtn = document.getElementById('toggleFrameBtn');
  const toggleSoundBtn = document.getElementById('toggleSoundBtn');
  const toggleBgmBtn = document.getElementById('toggleBgmBtn');
  const deviceContainer = document.getElementById('deviceContainer');

  // 初始化设置状态
  let isPhoneFrame = storage.getSetting('phoneFrame') ?? true;
  let isMuted = storage.getSetting('muted') ?? false;
  let isBgmOn = storage.getSetting('bgm') ?? true;

  function applySettings() {
    if (isPhoneFrame) {
      deviceContainer.classList.remove('pure-screen-mode');
      toggleFrameBtn.innerHTML = '📱 诺基亚机身: 开';
      toggleFrameBtn.classList.add('active');
    } else {
      deviceContainer.classList.add('pure-screen-mode');
      toggleFrameBtn.innerHTML = '🖥️ 全屏模式';
      toggleFrameBtn.classList.remove('active');
    }

    if (isMuted) {
      toggleSoundBtn.innerHTML = '🔇 音效: 关';
      toggleSoundBtn.classList.remove('active');
    } else {
      toggleSoundBtn.innerHTML = '🔊 音效: 开';
      toggleSoundBtn.classList.add('active');
    }

    if (isBgmOn) {
      toggleBgmBtn.innerHTML = '🎵 音乐: 开';
      toggleBgmBtn.classList.add('active');
    } else {
      toggleBgmBtn.innerHTML = '🎵 音乐: 关';
      toggleBgmBtn.classList.remove('active');
    }
  }
  applySettings();

  // 绑定顶部工具栏
  toggleFrameBtn.addEventListener('click', () => {
    isPhoneFrame = !isPhoneFrame;
    storage.setSetting('phoneFrame', isPhoneFrame);
    applySettings();
  });

  toggleSoundBtn.addEventListener('click', () => {
    audio.init();
    isMuted = audio.toggleMute();
    storage.setSetting('muted', isMuted);
    applySettings();
  });

  toggleBgmBtn.addEventListener('click', () => {
    audio.init();
    isBgmOn = audio.toggleBgm();
    storage.setSetting('bgm', isBgmOn);
    applySettings();
  });

  // 统一的按键触发（带触觉/听觉和按键高亮反馈）
  function triggerAction(keyElement = null) {
    audio.init();
    if (keyElement) {
      keyElement.classList.add('pressed');
      setTimeout(() => keyElement.classList.remove('pressed'), 120);
    }
    game.triggerDrop();
  }

  // 1. 物理键盘输入监听
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Digit5' || e.code === 'Numpad5' || e.code === 'Enter' || e.code === 'ArrowDown') {
      e.preventDefault();
      const key5 = document.querySelector('.key[data-key="5"]');
      triggerAction(key5);
    } else if (e.code === 'KeyM') {
      toggleSoundBtn.click();
    } else if (e.code === 'KeyB') {
      toggleBgmBtn.click();
    } else if (e.code === 'KeyF') {
      toggleFrameBtn.click();
    } else {
      // 触碰其它按键产生咔哒声
      audio.playClick();
    }
  });

  // 2. Canvas 区域点击 / 触控
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    triggerAction();
  });

  // 3. 诺基亚物理按键交互绑定
  const keypad = document.getElementById('nokiaKeypad');
  if (keypad) {
    keypad.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.key, .dpad-btn, .soft-key');
      if (!btn) return;
      e.preventDefault();

      btn.classList.add('pressed');
      const action = btn.getAttribute('data-action') || btn.getAttribute('data-key');

      if (action === '5' || action === 'drop' || action === 'center' || action === 'left-soft') {
        triggerAction(btn);
      } else if (action === 'right-soft') {
        // 右功能键切换声音
        toggleSoundBtn.click();
      } else {
        // 普通按键声音
        audio.init();
        audio.playClick();
      }
    });

    keypad.addEventListener('pointerup', (e) => {
      const btn = e.target.closest('.key, .dpad-btn, .soft-key');
      if (btn) btn.classList.remove('pressed');
    });

    keypad.addEventListener('pointerleave', (e) => {
      const pressed = keypad.querySelectorAll('.pressed');
      pressed.forEach(b => b.classList.remove('pressed'));
    });
  }

  // 核心 Game Loop
  let lastFrameTime = performance.now();
  function gameLoop(now) {
    let dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    // 防止切后台恢复时大 dt 导致物理穿透穿模
    if (dt > 0.1) dt = 0.1;

    game.update(dt);
    game.draw();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});

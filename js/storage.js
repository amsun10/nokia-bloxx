// js/storage.js - 本地数据与最高分持久化存储

const STORAGE_KEY = 'nokia_tower_bloxx_data';

const defaultData = {
  highScore: 0,
  maxFloors: 0,
  maxCombo: 0,
  totalGames: 0,
  settings: {
    muted: false,
    bgm: true,
    phoneFrame: true
  }
};

class StorageManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...defaultData, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('LocalStorage load failed', e);
    }
    return { ...defaultData };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  updateRecord(population, floors, combo) {
    let isNewHigh = false;
    if (population > this.data.highScore) {
      this.data.highScore = population;
      isNewHigh = true;
    }
    if (floors > this.data.maxFloors) {
      this.data.maxFloors = floors;
    }
    if (combo > this.data.maxCombo) {
      this.data.maxCombo = combo;
    }
    this.data.totalGames++;
    this.save();
    return isNewHigh;
  }

  getSetting(key) {
    return this.data.settings[key];
  }

  setSetting(key, val) {
    this.data.settings[key] = val;
    this.save();
  }
}

export const storage = new StorageManager();

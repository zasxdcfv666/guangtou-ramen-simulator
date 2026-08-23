const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      offscreen: true
    }
  });

  win.webContents.on('did-finish-load', async () => {
    console.log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));
    
    // 截图1：主菜单
    const menuImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'screenshot_menu.png'), menuImg.toPNG());
    console.log('Menu screenshot saved');
    
    // 开始游戏
    await win.webContents.executeJavaScript('Game.startNewGame(); "started"');
    await new Promise(r => setTimeout(r, 4000));
    
    // 截图2：游戏内
    const gameImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'screenshot_game.png'), gameImg.toPNG());
    console.log('Game screenshot saved');
    
    // 检查状态
    const state = await win.webContents.executeJavaScript(`
      (function() {
        const timeEl = document.getElementById('time-display');
        const moneyEl = document.getElementById('money-display');
        return { time: timeEl.textContent, money: moneyEl.textContent };
      })()
    `);
    console.log('Game state:', JSON.stringify(state));
    
    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

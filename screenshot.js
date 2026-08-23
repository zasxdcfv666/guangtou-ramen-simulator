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
    
    // 等待初始化
    await new Promise(r => setTimeout(r, 1500));
    
    // 开始游戏
    await win.webContents.executeJavaScript('Game.startNewGame(); "started"');
    console.log('Game started');
    
    // 等待游戏渲染几帧，让顾客生成
    await new Promise(r => setTimeout(r, 4000));
    
    // 截图
    const image = await win.webContents.capturePage();
    const outputPath = path.join(__dirname, 'game_screenshot.png');
    fs.writeFileSync(outputPath, image.toPNG());
    console.log('Screenshot saved to:', outputPath);
    console.log('Image size:', image.getSize().width, 'x', image.getSize().height);
    
    // 再检查一下Canvas状态
    const state = await win.webContents.executeJavaScript(`
      (function() {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const timeEl = document.getElementById('time-display');
        const moneyEl = document.getElementById('money-display');
        const customers = document.getElementById('customers-display');
        return {
          time: timeEl ? timeEl.textContent : 'N/A',
          money: moneyEl ? moneyEl.textContent : 'N/A',
          customers: customers ? customers.textContent : 'N/A',
          canvasW: canvas.width,
          canvasH: canvas.height
        };
      })()
    `);
    console.log('Game state:', JSON.stringify(state));
    
    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

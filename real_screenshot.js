const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    title: '朝阳路光头拉面模拟器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.webContents.on('did-finish-load', async () => {
    console.log('Page loaded, window visible');
    
    // 开始游戏
    await new Promise(r => setTimeout(r, 1500));
    await win.webContents.executeJavaScript('Game.startNewGame(); "started"');
    console.log('Game started');
    
    // 等待8秒，让更多顾客生成，游戏画面更丰富
    await new Promise(r => setTimeout(r, 8000));
    
    // 截图
    const image = await win.webContents.capturePage();
    const outputPath = path.join(__dirname, 'real_game_screenshot.png');
    fs.writeFileSync(outputPath, image.toPNG());
    console.log('Screenshot saved:', outputPath);
    console.log('Image size:', image.getSize().width, 'x', image.getSize().height);
    
    // 检查游戏状态
    const state = await win.webContents.executeJavaScript(`
      (function() {
        const timeEl = document.getElementById('time-display');
        const moneyEl = document.getElementById('money-display');
        const custEl = document.getElementById('customers-display');
        const repEl = document.getElementById('reputation-display');
        return {
          time: timeEl.textContent,
          money: moneyEl.textContent,
          customers: custEl.textContent,
          reputation: repEl.textContent
        };
      })()
    `);
    console.log('Game state:', JSON.stringify(state));
    
    // 再等2秒后退出
    setTimeout(() => app.quit(), 2000);
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());

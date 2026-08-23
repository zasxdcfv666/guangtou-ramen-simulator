const { app, BrowserWindow } = require('electron');
const path = require('path');

let win;
let errors = [];
let logs = [];
let renderSuccess = false;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 捕获控制台日志
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelNames = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
    logs.push(`[${levelNames[level] || level}] ${message} (line ${line})`);
    if (level === 2) errors.push(`Console ERROR: ${message} (line ${line})`);
  });

  // 捕获页面错误
  win.webContents.on('render-process-gone', (event, details) => {
    errors.push(`Render process gone: ${details.reason}`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    errors.push(`Failed to load: ${errorCode} ${errorDescription}`);
  });

  // 页面加载完成后，注入代码检查Canvas是否正常渲染
  win.webContents.on('did-finish-load', async () => {
    console.log('Page loaded successfully');
    
    // 等待一下让游戏初始化
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查页面状态
    try {
      const result = await win.webContents.executeJavaScript(`
        (function() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          
          // 读取Canvas中心像素，判断是否有渲染内容
          const pixel = ctx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
          
          // 检查HUD是否显示
          const hud = document.getElementById('hud');
          const hudDisplay = hud ? hud.style.display : 'not found';
          
          // 检查菜单是否显示
          const menu = document.getElementById('menu');
          const menuDisplay = menu ? menu.style.display : 'not found';
          
          // 检查时间显示
          const timeEl = document.getElementById('time-display');
          const timeText = timeEl ? timeEl.textContent : 'not found';
          
          return {
            canvasWidth: w,
            canvasHeight: h,
            centerPixel: Array.from(pixel),
            hudDisplay: hudDisplay,
            menuDisplay: menuDisplay,
            timeText: timeText,
            bodyBg: getComputedStyle(document.body).backgroundColor
          };
        })()
      `);
      
      console.log('=== Page State ===');
      console.log(JSON.stringify(result, null, 2));
      
      // 判断Canvas是否有渲染（中心像素不是纯背景色）
      const p = result.centerPixel;
      const isNotBackground = !(p[0] === 26 && p[1] === 15 && p[2] === 10);
      console.log(`Canvas rendered: ${isNotBackground || result.canvasWidth > 0}`);
      console.log(`Center pixel: rgba(${p[0]},${p[1]},${p[2]},${p[3]})`);
      
      if (result.canvasWidth === 0 || result.canvasHeight === 0) {
        errors.push('Canvas size is 0!');
      }
      
    } catch(e) {
      errors.push(`Execute JS error: ${e.message}`);
    }
    
    // 再等一下，模拟点击开始游戏
    try {
      await win.webContents.executeJavaScript(`
        Game.startNewGame();
        'started'
      `);
      console.log('Game started via API');
      
      await new Promise(r => setTimeout(r, 2000));
      
      const result2 = await win.webContents.executeJavaScript(`
        (function() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          const pixel = ctx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
          const timeEl = document.getElementById('time-display');
          return {
            canvasWidth: w,
            canvasHeight: h,
            centerPixel: Array.from(pixel),
            timeText: timeEl ? timeEl.textContent : 'not found',
            hudDisplay: document.getElementById('hud').style.display
          };
        })()
      `);
      
      console.log('=== After Start Game ===');
      console.log(JSON.stringify(result2, null, 2));
      
      const p2 = result2.centerPixel;
      console.log(`Center pixel after start: rgba(${p2[0]},${p2[1]},${p2[2]},${p2[3]})`);
      
      // 检查是否有渲染内容（不是纯黑/纯背景）
      const hasContent = p2[0] > 30 || p2[1] > 20 || p2[2] > 15;
      console.log(`Canvas has rendered content: ${hasContent}`);
      if (!hasContent) errors.push('Canvas appears blank after game start!');
      
    } catch(e) {
      errors.push(`Game start test error: ${e.message}`);
    }
    
    // 输出所有日志
    console.log('\n=== Console Logs ===');
    logs.forEach(l => console.log(l));
    
    console.log('\n=== Errors ===');
    if (errors.length === 0) {
      console.log('NO ERRORS - Everything looks good!');
    } else {
      errors.forEach(e => console.log(e));
    }
    
    // 退出
    setTimeout(() => app.quit(), 500);
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());

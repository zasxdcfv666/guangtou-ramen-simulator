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
    
    // 开始游戏
    await win.webContents.executeJavaScript('Game.startNewGame(); "started"');
    console.log('Game started');
    
    // 快进时间，让外卖订单生成（模拟20分钟后）
    await win.webContents.executeJavaScript(`
      // 直接生成几个外卖订单用于测试
      for(let i = 0; i < 3; i++) {
        setTimeout(() => {
          const event = new Event('test');
        }, i * 100);
      }
      'ready'
    `);
    
    // 手动触发外卖订单生成
    await win.webContents.executeJavaScript(`
      Game.generateDeliveryOrder();
      Game.generateDeliveryOrder();
      Game.generateDeliveryOrder();
      'generated 3 orders'
    `).then(r => console.log('Order gen:', r)).catch(e => console.log('Gen error:', e.message));
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 打开外卖面板
    await win.webContents.executeJavaScript(`
      Game.toggleDelivery();
      'panel toggled'
    `).then(r => console.log('Panel:', r)).catch(e => console.log('Panel error:', e.message));
    
    await new Promise(r => setTimeout(r, 1500));
    
    // 截图
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'screenshot_delivery.png'), img.toPNG());
    console.log('Delivery screenshot saved');
    
    // 检查外卖订单状态
    const state = await win.webContents.executeJavaScript(`
      (function() {
        const panel = document.getElementById('delivery-panel');
        const list = document.getElementById('delivery-list');
        const pending = document.getElementById('delivery-pending-count');
        return {
          panelDisplay: panel ? panel.style.display : 'not found',
          listHTML: list ? list.innerHTML.substring(0, 200) : 'not found',
          pendingCount: pending ? pending.textContent : 'not found'
        };
      })()
    `);
    console.log('Delivery state:', JSON.stringify(state, null, 2));
    
    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

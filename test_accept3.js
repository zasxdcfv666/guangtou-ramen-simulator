const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function log(msg) {
  console.log('[TEST] ' + msg);
}

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

  win.webContents.on('console-message', (event, level, message) => {
    if(level >= 2 && !message.includes('Security Warning')) log('CONSOLE: ' + message);
  });

  win.webContents.on('did-finish-load', async () => {
    log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));

    try {
      // 1. 开始游戏
      await win.webContents.executeJavaScript(`Game.startNewGame(); 'started'`);
      log('1. 游戏已开始');
      await new Promise(r => setTimeout(r, 500));

      // 2. 生成外卖订单（现在直接就是pending状态）
      await win.webContents.executeJavaScript(`Game.generateDeliveryOrder(); 'generated'`);
      log('2. 订单已生成（直接待接单）');
      await new Promise(r => setTimeout(r, 500));

      // 3. 打开外卖面板
      await win.webContents.executeJavaScript(`Game.toggleDelivery(); 'opened'`);
      log('3. 外卖面板已打开');
      await new Promise(r => setTimeout(r, 500));

      // 4. 检查面板里的按钮
      const panelInfo = await win.webContents.executeJavaScript(`
        (function(){
          var list = document.getElementById('delivery-list');
          var buttons = list.querySelectorAll('button');
          var btnTexts = Array.from(buttons).map(function(b){return b.textContent.trim()});
          var hasAccept = btnTexts.some(function(t){return t.indexOf('接单')>=0});
          var hasReject = btnTexts.some(function(t){return t.indexOf('拒单')>=0});
          return JSON.stringify({btnCount: buttons.length, btnTexts: btnTexts, hasAccept: hasAccept, hasReject: hasReject});
        })()
      `);
      log('4. 面板按钮: ' + panelInfo);

      // 5. 模拟点击接单按钮
      const clickResult = await win.webContents.executeJavaScript(`
        (function(){
          var list = document.getElementById('delivery-list');
          var acceptBtn = Array.from(list.querySelectorAll('button')).find(function(b){return b.textContent.indexOf('接单')>=0});
          if(acceptBtn){
            acceptBtn.click();
            return JSON.stringify({clicked: true, btnText: acceptBtn.textContent.trim()});
          } else {
            return JSON.stringify({clicked: false, reason: 'no accept button'});
          }
        })()
      `);
      log('5. 点击接单按钮: ' + clickResult);

      // 6. 等待一下，检查面板状态变化
      await new Promise(r => setTimeout(r, 500));
      const afterClick = await win.webContents.executeJavaScript(`
        (function(){
          var list = document.getElementById('delivery-list');
          var html = list.innerHTML;
          var hasCooking = html.indexOf('制作中') >= 0 || html.indexOf('进行中') >= 0;
          var hasPending = html.indexOf('待接单') >= 0;
          return JSON.stringify({hasCooking: hasCooking, hasPending: hasPending});
        })()
      `);
      log('6. 点击后状态: ' + afterClick);

      // 7. 测试拒单按钮
      await win.webContents.executeJavaScript(`Game.generateDeliveryOrder(); 'gen2'`);
      await new Promise(r => setTimeout(r, 300));
      await win.webContents.executeJavaScript(`Game.toggleDelivery(); Game.toggleDelivery(); 'refresh'`);
      await new Promise(r => setTimeout(r, 300));

      const rejectResult = await win.webContents.executeJavaScript(`
        (function(){
          var list = document.getElementById('delivery-list');
          var rejectBtn = Array.from(list.querySelectorAll('button')).find(function(b){return b.textContent.indexOf('拒单')>=0});
          if(rejectBtn){
            rejectBtn.click();
            return JSON.stringify({clicked: true});
          } else {
            return JSON.stringify({clicked: false});
          }
        })()
      `);
      log('7. 点击拒单按钮: ' + rejectResult);

      // 截图
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'test_accept_final.png'), img.toPNG());
      log('截图保存成功');

      log('=== 测试完成 ===');

    } catch(e) {
      log('测试异常: ' + e.message);
    }

    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

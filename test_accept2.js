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
      await new Promise(r => setTimeout(r, 1000));

      // 2. 生成外卖订单
      await win.webContents.executeJavaScript(`Game.generateDeliveryOrder(); 'generated'`);
      log('2. 订单已生成');

      // 3. 等待游戏循环运行，让订单从unpaid变成pending（等3秒现实时间）
      log('3. 等待订单变成待接单状态...');
      await new Promise(r => setTimeout(r, 3000));

      // 4. 打开外卖面板
      await win.webContents.executeJavaScript(`Game.toggleDelivery(); 'opened'`);
      log('4. 外卖面板已打开');
      await new Promise(r => setTimeout(r, 500));

      // 5. 检查面板里的按钮
      const panelInfo = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const html = list.innerHTML;
        const buttons = list.querySelectorAll('button');
        const btnTexts = Array.from(buttons).map(b => b.textContent.trim());
        const hasAccept = btnTexts.some(t => t.includes('接单'));
        const hasReject = btnTexts.some(t => t.includes('拒单'));
        JSON.stringify({btnCount: buttons.length, btnTexts: btnTexts, hasAccept: hasAccept, hasReject: hasReject, htmlLen: html.length})
      `);
      log('5. 面板信息: ' + panelInfo);

      // 6. 模拟点击接单按钮
      const clickResult = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const acceptBtn = Array.from(list.querySelectorAll('button')).find(b => b.textContent.includes('接单'));
        if(acceptBtn){
          acceptBtn.click();
          JSON.stringify({clicked: true, btnText: acceptBtn.textContent.trim()})
        } else {
          JSON.stringify({clicked: false, reason: 'no accept button found'})
        }
      `);
      log('6. 点击接单按钮: ' + clickResult);

      // 7. 等待一下，然后检查面板状态变化
      await new Promise(r => setTimeout(r, 500));
      const afterClick = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const html = list.innerHTML;
        const hasCooking = html.includes('制作中') || html.includes('进行中');
        const hasPending = html.includes('待接单');
        JSON.stringify({hasCooking: hasCooking, hasPending: hasPending, htmlSnippet: html.substring(0, 200)})
      `);
      log('7. 点击后面板状态: ' + afterClick);

      // 8. 测试直接调用Game.acceptDelivery
      const directTest = await win.webContents.executeJavaScript(`
        Game.generateDeliveryOrder();
        'generated2'
      `);
      await new Promise(r => setTimeout(r, 3000));
      await win.webContents.executeJavaScript(`Game.toggleDelivery(); 'opened2'`);
      await new Promise(r => setTimeout(r, 300));

      const directCallResult = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const acceptBtn = Array.from(list.querySelectorAll('button')).find(b => b.textContent.includes('接单'));
        if(acceptBtn){
          const onclickAttr = acceptBtn.getAttribute('onclick');
          JSON.stringify({found: true, onclick: onclickAttr})
        } else {
          JSON.stringify({found: false})
        }
      `);
      log('8. 按钮onclick属性: ' + directCallResult);

      // 截图
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'test_accept2.png'), img.toPNG());
      log('截图保存成功');

      log('=== 测试完成 ===');

    } catch(e) {
      log('测试异常: ' + e.message);
    }

    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

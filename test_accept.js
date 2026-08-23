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
    if(level >= 2) log('CONSOLE: ' + message);
  });

  win.webContents.on('did-finish-load', async () => {
    log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));

    try {
      // 1. 开始游戏
      await win.webContents.executeJavaScript(`Game.startNewGame(); 'started'`);
      log('1. 游戏已开始');
      await new Promise(r => setTimeout(r, 500));

      // 2. 生成一个外卖订单
      const orderResult = await win.webContents.executeJavaScript(`
        Game.generateDeliveryOrder();
        const order = state.deliveryOrders[0];
        JSON.stringify({id: order.id, status: order.status, customer: order.customerName})
      `);
      log('2. 生成订单: ' + orderResult);

      // 3. 手动把订单状态改成pending（跳过unpaid阶段）
      await win.webContents.executeJavaScript(`
        state.deliveryOrders[0].status = 'pending';
        state.deliveryOrders[0].unpaidTimer = 0;
        'set to pending'
      `);
      log('3. 订单状态设为pending');

      // 4. 打开外卖面板
      await win.webContents.executeJavaScript(`Game.toggleDelivery(); 'opened'`);
      log('4. 外卖面板已打开');
      await new Promise(r => setTimeout(r, 500));

      // 5. 检查面板里是否有接单按钮
      const panelHTML = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const buttons = list.querySelectorAll('button');
        const btnInfos = [];
        buttons.forEach(b => btnInfos.push({text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: b.disabled}));
        JSON.stringify(btnInfos)
      `);
      log('5. 面板按钮: ' + panelHTML);

      // 6. 直接调用Game.acceptDelivery测试
      const directCallResult = await win.webContents.executeJavaScript(`
        const orderId = state.deliveryOrders[0].id;
        const beforeStatus = state.deliveryOrders[0].status;
        Game.acceptDelivery(orderId);
        const afterStatus = state.deliveryOrders[0].status;
        JSON.stringify({before: beforeStatus, after: afterStatus})
      `);
      log('6. 直接调用acceptDelivery: ' + directCallResult);

      // 7. 模拟真实点击按钮
      await win.webContents.executeJavaScript(`
        // 重新生成一个订单
        Game.generateDeliveryOrder();
        state.deliveryOrders[0].status = 'pending';
        Game.toggleDelivery();
        'regen'
      `);
      await new Promise(r => setTimeout(r, 300));

      const clickResult = await win.webContents.executeJavaScript(`
        const list = document.getElementById('delivery-list');
        const acceptBtn = Array.from(list.querySelectorAll('button')).find(b => b.textContent.includes('接单'));
        if(acceptBtn){
          acceptBtn.click();
          const order = state.deliveryOrders.find(o => o.status === 'cooking');
          JSON.stringify({clicked: true, hasCooking: !!order, status: order ? order.status : 'none'})
        } else {
          JSON.stringify({clicked: false, reason: 'button not found'})
        }
      `);
      log('7. 模拟点击接单按钮: ' + clickResult);

      // 截图
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'test_accept.png'), img.toPNG());
      log('截图保存成功');

      log('=== 测试完成 ===');

    } catch(e) {
      log('测试异常: ' + e.message + ' ' + e.stack);
    }

    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

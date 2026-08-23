const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let results = [];

function log(msg) {
  console.log('[TEST] ' + msg);
  results.push(msg);
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
    if(level >= 2) log('CONSOLE ERROR: ' + message);
  });

  win.webContents.on('did-finish-load', async () => {
    log('Page loaded');
    await new Promise(r => setTimeout(r, 2000));

    try {
      // 测试1: 开始游戏
      const startResult = await win.webContents.executeJavaScript(`
        Game.startNewGame();
        const hud = document.getElementById('hud');
        const actionBar = document.getElementById('action-bar');
        JSON.stringify({hudDisplay: hud.style.display, actionBarDisplay: actionBar.style.display, scene: 'started'})
      `);
      log('1. 开始游戏: ' + startResult);

      await new Promise(r => setTimeout(r, 500));

      // 测试2: 暂停按钮
      const pauseResult = await win.webContents.executeJavaScript(`
        Game.togglePause();
        const btn = document.getElementById('pause-btn');
        JSON.stringify({btnText: btn.textContent, scene: 'paused'})
      `);
      log('2. 暂停按钮: ' + pauseResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试3: 继续游戏
      const resumeResult = await win.webContents.executeJavaScript(`
        Game.togglePause();
        const btn = document.getElementById('pause-btn');
        JSON.stringify({btnText: btn.textContent})
      `);
      log('3. 继续按钮: ' + resumeResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试4: 外卖面板(E键功能)
      const deliveryResult = await win.webContents.executeJavaScript(`
        Game.toggleDelivery();
        const panel = document.getElementById('delivery-panel');
        JSON.stringify({panelDisplay: panel.style.display})
      `);
      log('4. 外卖面板: ' + deliveryResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试5: 关闭外卖面板
      const deliveryCloseResult = await win.webContents.executeJavaScript(`
        Game.toggleDelivery();
        const panel = document.getElementById('delivery-panel');
        JSON.stringify({panelDisplay: panel.style.display})
      `);
      log('5. 关闭外卖面板: ' + deliveryCloseResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试6: 升级商店
      const upgradeResult = await win.webContents.executeJavaScript(`
        Game.showUpgrades();
        const modal = document.getElementById('modal-container');
        JSON.stringify({hasModal: modal.innerHTML.length > 0, contentPreview: modal.innerHTML.substring(0, 100)})
      `);
      log('6. 升级商店: ' + upgradeResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试7: 关闭模态框
      const closeModalResult = await win.webContents.executeJavaScript(`
        Game.closeModal();
        const modal = document.getElementById('modal-container');
        JSON.stringify({modalEmpty: modal.innerHTML === ''})
      `);
      log('7. 关闭模态框: ' + closeModalResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试8: 成就面板
      const achievementResult = await win.webContents.executeJavaScript(`
        Game.showAchievements();
        const modal = document.getElementById('modal-container');
        JSON.stringify({hasModal: modal.innerHTML.length > 0})
      `);
      log('8. 成就面板: ' + achievementResult);

      await new Promise(r => setTimeout(r, 300));

      // 测试9: 返回主菜单
      const backResult = await win.webContents.executeJavaScript(`
        Game.closeModal();
        Game.backToMenu();
        const menu = document.getElementById('menu');
        JSON.stringify({menuDisplay: menu.style.display})
      `);
      log('9. 返回主菜单: ' + backResult);

      // 截图
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'test_buttons.png'), img.toPNG());
      log('截图保存成功');

      log('=== 所有按钮测试完成 ===');

    } catch(e) {
      log('测试异常: ' + e.message);
    }

    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});

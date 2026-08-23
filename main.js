const { app, BrowserWindow, Menu, shell, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ==================== 更新配置 ====================
const UPDATE_URL = 'https://raw.githubusercontent.com/zasxdcfv666/guangtou-ramen-simulator/main/version.json';
const CURRENT_VERSION = '1.0.0';

// 注册自定义协议为特权协议（必须在app.ready之前）
protocol.registerSchemesAsPrivileged([
  { scheme: 'music', privileges: { secure: true, supportFetchAPI: true, stream: true } }
]);

// 读取帧率配置
let vsyncEnabled = false;
try {
  const configPath = path.join(__dirname, 'fps-config.json');
  if(fs.existsSync(configPath)){
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    vsyncEnabled = config.vsyncEnabled === true;
  }
} catch(e) {}

// 关闭垂直同步和帧率限制（默认解锁帧率）
if(!vsyncEnabled){
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}

let mainWindow;

// IPC：读写垂直同步配置
ipcMain.handle('set-vsync', (event, enabled) => {
  try {
    const configPath = path.join(__dirname, 'fps-config.json');
    fs.writeFileSync(configPath, JSON.stringify({vsyncEnabled: enabled}));
    return true;
  } catch(e) {
    return false;
  }
});

ipcMain.handle('get-vsync', () => {
  try {
    const configPath = path.join(__dirname, 'fps-config.json');
    if(fs.existsSync(configPath)){
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).vsyncEnabled === true;
    }
  } catch(e) {}
  return false;
});

// 获取Music文件夹路径（用用户数据目录，确保有权限创建和写入）
function getMusicDir(){
  return path.join(app.getPath('userData'), 'Music');
}

// IPC：读取Music文件夹中的音乐列表
ipcMain.handle('get-music-list', () => {
  try {
    const musicDir = getMusicDir();
    if(!fs.existsSync(musicDir)){
      fs.mkdirSync(musicDir, {recursive: true});
      return [];
    }
    const files = fs.readdirSync(musicDir);
    const audioExts = ['.mp3','.wav','.ogg','.m4a','.flac','.aac','.wma'];
    const musicList = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return audioExts.includes(ext);
    }).map(f => ({
      name: path.basename(f, path.extname(f)),
      filename: f,
      url: 'music://local/' + encodeURIComponent(f)
    }));
    return musicList;
  } catch(e) {
    return { error: e.message };
  }
});

// IPC：打开Music文件夹
ipcMain.handle('open-music-folder', () => {
  try {
    const musicDir = getMusicDir();
    if(!fs.existsSync(musicDir)){
      fs.mkdirSync(musicDir, {recursive: true});
    }
    // 用Electron的shell.openPath打开文件夹
    shell.openPath(musicDir);
    return true;
  } catch(e) {
    return false;
  }
});

// IPC：获取Music文件夹路径
ipcMain.handle('get-music-dir', () => {
  return getMusicDir();
});

// IPC：调整窗口大小
ipcMain.handle('set-window-size', (event, width, height) => {
  try {
    if(mainWindow){
      mainWindow.setSize(width, height);
      return true;
    }
  } catch(e) {}
  return false;
});

// IPC：检查更新
ipcMain.handle('check-update', () => {
  return new Promise((resolve) => {
    if(!UPDATE_URL){
      resolve({ hasUpdate: false, message: '未配置更新地址', currentVersion: CURRENT_VERSION });
      return;
    }
    const req = https.get(UPDATE_URL, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          const hasUpdate = compareVersions(info.version, CURRENT_VERSION) > 0;
          resolve({
            hasUpdate,
            currentVersion: CURRENT_VERSION,
            latestVersion: info.version || CURRENT_VERSION,
            downloadUrl: info.downloadUrl || '',
            releaseNotes: info.releaseNotes || '',
            message: hasUpdate ? `发现新版本 v${info.version}` : '已是最新版本'
          });
        } catch(e) {
          resolve({ hasUpdate: false, message: '更新信息解析失败', currentVersion: CURRENT_VERSION });
        }
      });
    });
    req.on('error', () => resolve({ hasUpdate: false, message: '无法连接更新服务器', currentVersion: CURRENT_VERSION }));
    req.on('timeout', () => { req.destroy(); resolve({ hasUpdate: false, message: '检查更新超时', currentVersion: CURRENT_VERSION }); });
  });
});

// IPC：打开外部链接（用于下载更新）
ipcMain.handle('open-external', (event, url) => {
  if(url && url.startsWith('https://')){
    shell.openExternal(url);
    return true;
  }
  return false;
});

// 版本号比较：返回1表示v1>v2，-1表示v1<v2，0表示相等
function compareVersions(v1, v2){
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for(let i = 0; i < Math.max(parts1.length, parts2.length); i++){
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if(a > b) return 1;
    if(a < b) return -1;
  }
  return 0;
}

// IPC：获取真实CPU信息（用完整路径的PowerShell读取注册表，打包后也能找到）
ipcMain.handle('get-real-cpu-info', () => {
  try {
    if(process.platform === 'win32'){
      // 用SystemRoot环境变量拼接PowerShell完整路径，打包后PATH可能不包含PowerShell
      const psPath = process.env.SystemRoot 
        ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : 'powershell.exe';
      const regPath = process.env.SystemRoot
        ? path.join(process.env.SystemRoot, 'System32', 'reg.exe')
        : 'reg.exe';
      
      // 方案1：用PowerShell读取注册表，输出纯文本
      try {
        const nameCmd = `"${psPath}" -NoProfile -Command "(Get-ItemProperty 'HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0').ProcessorNameString"`;
        const nameResult = execSync(nameCmd, {encoding: 'utf8', timeout: 10000, windowsHide: true});
        const cpuName = nameResult.trim();
        
        if(cpuName && cpuName.length > 0 && !cpuName.includes('Exception') && !cpuName.includes('Error')){
          // 读取频率
          let cpuSpeed = 0;
          try {
            const speedCmd = `"${psPath}" -NoProfile -Command "(Get-ItemProperty 'HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0').'~MHz'"`;
            const speedResult = execSync(speedCmd, {encoding: 'utf8', timeout: 5000, windowsHide: true});
            cpuSpeed = parseInt(speedResult.trim()) || 0;
          } catch(e) {}
          
          const logicalCores = parseInt(process.env.NUMBER_OF_PROCESSORS) || os.cpus().length;
          
          return {
            model: cpuName,
            cores: logicalCores,
            logical: logicalCores,
            speed: cpuSpeed || (os.cpus()[0]?.speed || 0)
          };
        }
      } catch(e) {}
      
      // 方案2：用reg.exe读取注册表
      try {
        const regCmd = `"${regPath}" query "HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0" /v ProcessorNameString`;
        const regResult = execSync(regCmd, {encoding: 'utf8', timeout: 5000, windowsHide: true});
        const lines = regResult.trim().split('\n');
        let cpuName = '';
        for(const line of lines){
          if(line.includes('ProcessorNameString')){
            const parts = line.split(/\s+/);
            const regSzIndex = parts.findIndex(p => p === 'REG_SZ');
            if(regSzIndex !== -1 && regSzIndex + 1 < parts.length){
              cpuName = parts.slice(regSzIndex + 1).join(' ').trim();
            }
            break;
          }
        }
        
        if(cpuName){
          const logicalCores = parseInt(process.env.NUMBER_OF_PROCESSORS) || os.cpus().length;
          return {
            model: cpuName,
            cores: logicalCores,
            logical: logicalCores,
            speed: os.cpus()[0]?.speed || 0
          };
        }
      } catch(e) {}
    }
    // 降级：用os.cpus()
    const cpus = os.cpus();
    return {
      model: cpus[0]?.model || 'Unknown CPU',
      cores: cpus.length,
      logical: cpus.length,
      speed: cpus[0]?.speed || 0
    };
  } catch(e) {
    return {model: 'Unknown CPU', cores: 1, logical: 1, speed: 0};
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '朝阳路光头拉面模拟器',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#1a0f0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // 外部链接用浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 自定义菜单
function createMenu() {
  const template = [
    {
      label: '游戏',
      submenu: [
        { label: '重新开始', click: () => { mainWindow.webContents.reload(); } },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '全屏', role: 'togglefullscreen' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于', click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于',
            message: '朝阳路光头拉面模拟器 v1.0.0',
            detail: '福州仓山区菖蒲路5号\n深夜食堂经营模拟游戏\n\n光头老板，二十年老店\n每晚18:00-21:00，不见不散'
          });
        }}
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // 注册music://协议处理器，用于播放本地音乐文件
  protocol.handle('music', (request) => {
    try {
      // music://local/文件名 -> 解码后拼接Music目录
      const urlPath = decodeURIComponent(request.url.replace('music://local/', ''));
      const musicDir = getMusicDir();
      const filePath = path.join(musicDir, urlPath);
      // 安全检查：确保文件在Music目录内
      if(!filePath.startsWith(musicDir)){
        return new Response('Forbidden', { status: 403 });
      }
      return net.fetch('file:///' + filePath.replace(/\\/g, '/'));
    } catch(e) {
      return new Response('Not Found', { status: 404 });
    }
  });
  
  // 启动时创建Music文件夹，确保一定存在
  try {
    const musicDir = getMusicDir();
    if(!fs.existsSync(musicDir)){
      fs.mkdirSync(musicDir, {recursive: true});
    }
    // 首次运行时释放打包的Summer.mp3到Music文件夹（不覆盖已有文件）
    const bundledMusic = path.join(__dirname, 'Summer.mp3');
    const targetMusic = path.join(musicDir, 'Summer.mp3');
    if(fs.existsSync(bundledMusic) && !fs.existsSync(targetMusic)){
      fs.copyFileSync(bundledMusic, targetMusic);
    }
  } catch(e) {}
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

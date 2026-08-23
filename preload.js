const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// 直接在preload中获取真实CPU信息（不通过IPC，更可靠）
function getRealCPUInfo(){
  try {
    if(process.platform === 'win32'){
      // 用SystemRoot拼接PowerShell完整路径
      const psPath = process.env.SystemRoot 
        ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : 'powershell.exe';
      
      // 方案1：PowerShell读取注册表
      try {
        const nameCmd = `"${psPath}" -NoProfile -Command "(Get-ItemProperty 'HKLM:\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0').ProcessorNameString"`;
        const nameResult = execSync(nameCmd, {encoding: 'utf8', timeout: 10000, windowsHide: true});
        const cpuName = nameResult.trim();
        
        if(cpuName && cpuName.length > 0 && !cpuName.includes('Exception') && !cpuName.includes('Error')){
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
      
      // 方案2：reg.exe读取注册表
      try {
        const regPath = process.env.SystemRoot
          ? path.join(process.env.SystemRoot, 'System32', 'reg.exe')
          : 'reg.exe';
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
    
    // 降级：os.cpus()
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
}

// 在preload加载时就获取CPU信息（同步执行，确保渲染进程拿到时已经是正确的）
const realCPU = getRealCPUInfo();

// 系统信息
const systemInfo = {
  electron: process.versions.electron || 'N/A',
  node: process.versions.node || 'N/A',
  chrome: process.versions.chrome || 'N/A',
  arch: process.arch || 'N/A',
  platform: process.platform || 'N/A',
  osRelease: os.release() || 'N/A',
  hostname: os.hostname() || 'N/A',
  // CPU信息（直接用注册表读取的真实信息）
  cpuModel: realCPU.model,
  cpuSpeed: realCPU.speed,
  cpuCores: realCPU.cores,
  logicalCores: realCPU.logical,
  // 内存信息
  totalMem: os.totalmem(),
  freeMem: os.freemem()
};

contextBridge.exposeInMainWorld('electronAPI', {
  setVsync: (enabled) => ipcRenderer.invoke('set-vsync', enabled),
  getVsync: () => ipcRenderer.invoke('get-vsync'),
  getMusicList: () => ipcRenderer.invoke('get-music-list'),
  openMusicFolder: () => ipcRenderer.invoke('open-music-folder'),
  getMusicDir: () => ipcRenderer.invoke('get-music-dir'),
  // 窗口大小调整
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  // 检查更新
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // 获取真实CPU信息（直接返回preload中已获取的结果）
  getRealCPUInfo: () => Promise.resolve(realCPU),
  // 获取系统信息（preload中已取好，包含真实CPU信息）
  getSystemInfo: () => systemInfo,
  // 实时获取内存使用
  getMemoryUsage: () => ({
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem()
  })
});

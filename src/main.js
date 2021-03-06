const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const si = require("systeminformation");
const { setup: setupPushReceiver } = require("electron-push-receiver");
var HID = require("node-hid");
var devices = HID.devices();

var osu = require("node-os-utils");
var cpuInfoOsu = osu.cpu;
var netstat = osu.netstat;

const path = require("path");
const os = require("os");
const Store = require("./store.js");

const store = new Store({
  // We'll call our data file 'user-preferences'
  configName: "user-preferences",
  defaults: {
    // 800x600 is the default size of our window
    deviceId: 0,
    token: "",
    poweroffRemote: true,
    rebootRemote: true,
    notifications: true,
  },
});

var indexWindow = null;
/**
 * Mostrar la ventana de configuracion
 */
function showConfigWindow() {
  const configWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, "views/assets/img/logo.png"),
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "/preload.js"),
    },
    title: "PIC",
  });

  // and load the index.html of the app.
  configWindow.loadFile("src/views/config.html");
  setupPushReceiver(configWindow.webContents);
}

function showIndexWindow() {
  indexWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, "views/assets/img/logo.png"),
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "/preload.js"),
    },
    title: "PIC",
  });

  // and load the index.html of the app.
  indexWindow.loadFile("src/views/index.html");
  setupPushReceiver(indexWindow.webContents);
  getInfo();
}

function getInfo() {
  var ram = formatBytes(os.totalmem());
  var freeRam = formatBytes(os.freemem());

  let proc = exec("wmic product get name");
  let results = "";
  proc.stdout.on("data", (data) => {
    results += `${data}`;
  });
  proc.on("close", async (code) => {
    si.cpu()
      .then((cpuInfo) => {
        cpuInfoOsu.usage().then((cpuPercentage) => {
          si.system().then((system) => {
            si.memLayout().then((memInfo) => {
              si.baseboard().then((baseboard) => {
                si.bios().then((bios) => {
                  si.chassis().then((chassis) => {
                    si.cpuTemperature().then((cpuTemperature) => {
                      si.graphics().then((graphics) => {
                        si.networkInterfaces((networkInterfaces) => {
                          si.audio().then((audio) => {
                            si.diskLayout().then((diskLayout) => {
                              si.networkStats("*").then((networkStats) => {
                                si.osInfo().then((osInfo) => {
                                  si.usb((usb) => {
                                    var data = {
                                      usb: usb,
                                      devices: devices,
                                      osInfo: osInfo,
                                      networkStats: networkStats,
                                      diskLayout: diskLayout,
                                      audio: audio,
                                      apps: results.split("\n"),
                                      graphics: graphics,
                                      cpuTemperature: cpuTemperature,
                                      bios: bios,
                                      chassis: chassis,
                                      system: system,
                                      baseboard: baseboard,
                                      memory: memInfo,
                                      ram: ram,
                                      free: freeRam,
                                      cpu: cpuInfo,
                                      cpuPercentage: cpuPercentage,
                                      networkInterfaces: networkInterfaces,
                                      arch: os.arch(),
                                      systemName: os.type(),
                                      platform: os.platform(),
                                      configOptios: {
                                        reboot: store.get("rebootRemote"),
                                        poweroff: store.get("poweroffRemote"),
                                        notifications:
                                          store.get("notifications"),
                                      },
                                    };

                                    indexWindow.webContents.send("data", data);
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      })
      .catch((error) => console.error(error));
  });
}

function formatBytes(a, b = 2, k = 1024) {
  with (Math) {
    let d = floor(log(a) / log(k));
    return 0 == a
      ? "0 Bytes"
      : parseFloat((a / pow(k, d)).toFixed(max(0, b))) +
          " " +
          ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d];
  }
}

ipcMain.on("saveToken", function (event, data) {
  store.set("deviceId", data.deviceId);
  store.set("token", data.token);
  store.set("poweroffRemote", true);
  store.set("rebootRemote", true);
  store.set("notifications", true);
});

ipcMain.on("newCPUInfo", function (event, arg) {
  cpuInfoOsu.usage().then((cpuPercentage) => {
    var data = cpuPercentage;
    indexWindow.webContents.send("responseNewCPUInfo", data);
  });
});

ipcMain.on("newInfo", function (event, args) {
  getInfo();
});

ipcMain.on("resetConfig", function (evt, args) {
  store.set("deviceId", 0);
  store.set("token", "");
  store.set("poweroffRemote", false);
  store.set("rebootRemote", false);
  store.set("notifications", false);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  let token = store.get("token");
  let deviceId = store.get("deviceId");
  if (token == "" || deviceId == 0) {
    showConfigWindow();
  } else {
    showIndexWindow();
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

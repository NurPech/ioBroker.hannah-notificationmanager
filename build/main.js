"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var mqtt = __toESM(require("mqtt"));
class HannahNotificationmanager extends utils.Adapter {
  mqttClient = null;
  constructor(options = {}) {
    super({
      ...options,
      name: "hannah-notificationmanager"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    const { mqtt_broker, mqtt_port, mqtt_user, mqtt_pass } = this.config;
    this.mqttClient = mqtt.connect(`mqtt://${mqtt_broker}:${mqtt_port}`, {
      username: mqtt_user || void 0,
      password: mqtt_pass || void 0,
      clientId: `iobroker-${this.namespace}`,
      reconnectPeriod: 5e3
    });
    this.mqttClient.on("connect", () => {
      this.log.info(`MQTT verbunden: ${mqtt_broker}:${mqtt_port}`);
      this.setState("info.connection", true, true);
    });
    this.mqttClient.on("error", (err) => {
      this.log.error(`MQTT Fehler: ${err.message}`);
      this.setState("info.connection", false, true);
    });
    this.mqttClient.on("close", () => {
      this.setState("info.connection", false, true);
    });
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback - Callback function
   */
  onUnload(callback) {
    var _a;
    try {
      (_a = this.mqttClient) == null ? void 0 : _a.end();
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
  onMessage(obj) {
    var _a, _b, _c;
    if (!obj || obj.command !== "sendNotification") return;
    this.log.debug(`sendNotification: ${JSON.stringify(obj.message)}`);
    const notification = obj.message;
    const text = this.extractText(notification);
    if (!text) {
      this.log.warn("Notification ohne Text empfangen \u2014 ignoriert.");
      if (obj.callback) {
        this.sendTo(obj.from, obj.command, { sent: false, error: "Kein Text" }, obj.callback);
      }
      return;
    }
    const severity = (_b = (_a = notification == null ? void 0 : notification.category) == null ? void 0 : _a.severity) != null ? _b : "notify";
    const payload = JSON.stringify({ text, severity });
    if ((_c = this.mqttClient) == null ? void 0 : _c.connected) {
      this.mqttClient.publish(this.config.hannah_topic, payload, { qos: 1 }, (err) => {
        if (err) {
          this.log.error(`Publish fehlgeschlagen: ${err.message}`);
          if (obj.callback) {
            this.sendTo(obj.from, obj.command, { sent: false, error: err.message }, obj.callback);
          }
        } else {
          this.log.info(`Notification \u2192 Hannah: [${severity}] "${text}"`);
          if (obj.callback) {
            this.sendTo(obj.from, obj.command, { sent: true }, obj.callback);
          }
        }
      });
    } else {
      this.log.warn("MQTT nicht verbunden \u2014 Notification verworfen.");
      if (obj.callback) {
        this.sendTo(obj.from, obj.command, { sent: false, error: "MQTT nicht verbunden" }, obj.callback);
      }
    }
  }
  extractText(notification) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    try {
      const instances = (_c = (_b = (_a = notification == null ? void 0 : notification.category) == null ? void 0 : _a.instances) != null ? _b : notification == null ? void 0 : notification.instances) != null ? _c : {};
      const parts = [];
      for (const data of Object.values(instances)) {
        for (const msg of (_d = data.messages) != null ? _d : []) {
          if (msg.message) parts.push(msg.message);
        }
      }
      if (parts.length) return parts.join(". ");
      const desc = (_e = notification == null ? void 0 : notification.category) == null ? void 0 : _e.description;
      if (typeof desc === "string") return desc;
      if (desc && typeof desc === "object") return (_g = (_f = desc.de) != null ? _f : desc.en) != null ? _g : null;
      const name = (_h = notification == null ? void 0 : notification.category) == null ? void 0 : _h.name;
      if (typeof name === "string") return name;
      if (name && typeof name === "object") return (_j = (_i = name.de) != null ? _i : name.en) != null ? _j : null;
    } catch (e) {
      this.log.warn(`Text-Extraktion fehlgeschlagen: ${e.message}`);
    }
    return null;
  }
}
if (require.main !== module) {
  module.exports = (options) => new HannahNotificationmanager(options);
} else {
  (() => new HannahNotificationmanager())();
}
//# sourceMappingURL=main.js.map

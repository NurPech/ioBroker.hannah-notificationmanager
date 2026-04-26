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
  onReady() {
    const { mqtt_broker, mqtt_port, mqtt_user, mqtt_pass } = this.config;
    this.mqttClient = mqtt.connect(`mqtt://${mqtt_broker}:${mqtt_port}`, {
      username: mqtt_user || void 0,
      password: mqtt_pass || void 0,
      clientId: `iobroker-${this.namespace}`,
      reconnectPeriod: 5e3
    });
    this.mqttClient.on("connect", () => {
      this.log.info(`MQTT connected: ${mqtt_broker}:${mqtt_port}`);
      void this.setState("info.connection", true, true);
    });
    this.mqttClient.on("error", (err) => {
      this.log.error(`MQTT error: ${err.message}`);
      void this.setState("info.connection", false, true);
    });
    this.mqttClient.on("close", () => {
      void this.setState("info.connection", false, true);
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
  /** @inheritdoc */
  onMessage(obj) {
    var _a, _b, _c, _d, _e;
    if (!obj) {
      return;
    }
    if (obj.command === "sendDirect") {
      const { text: text2, severity: severity2 = "notify" } = (_a = obj.message) != null ? _a : {};
      if (!text2) {
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, { sent: false, error: "no payload" }, obj.callback);
        }
        return;
      }
      const payload2 = JSON.stringify({ type: "direct", text: text2, severity: severity2 });
      if ((_b = this.mqttClient) == null ? void 0 : _b.connected) {
        this.mqttClient.publish(this.config.hannah_topic, payload2, { qos: 1 }, (err) => {
          if (obj.callback) {
            this.sendTo(
              obj.from,
              obj.command,
              err ? { sent: false, error: err.message } : { sent: true },
              obj.callback
            );
          }
        });
      } else {
        this.log.warn("MQTT disconnected \u2014 Direct-Notification dropped.");
        if (obj.callback) {
          this.sendTo(obj.from, obj.command, { sent: false, error: "MQTT not connected" }, obj.callback);
        }
      }
      return;
    }
    if (obj.command !== "sendNotification") {
      return;
    }
    this.log.debug(`sendNotification: ${JSON.stringify(obj.message)}`);
    const notification = obj.message;
    const text = this.extractText(notification);
    if (!text) {
      this.log.warn("Received notification without content \u2014 ignored.");
      if (obj.callback) {
        this.sendTo(obj.from, obj.command, { sent: false, error: "no payload" }, obj.callback);
      }
      return;
    }
    const severity = (_d = (_c = notification == null ? void 0 : notification.category) == null ? void 0 : _c.severity) != null ? _d : "notify";
    const payload = JSON.stringify({ text, severity });
    if ((_e = this.mqttClient) == null ? void 0 : _e.connected) {
      this.mqttClient.publish(this.config.hannah_topic, payload, { qos: 1 }, (err) => {
        if (err) {
          this.log.error(`Failed to publish message: ${err.message}`);
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
      this.log.warn("MQTT not connected \u2014 notification discarded.");
      if (obj.callback) {
        this.sendTo(obj.from, obj.command, { sent: false, error: "MQTT not connected" }, obj.callback);
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
          if (msg.message) {
            parts.push(msg.message);
          }
        }
      }
      if (parts.length) {
        return parts.join(". ");
      }
      const desc = (_e = notification == null ? void 0 : notification.category) == null ? void 0 : _e.description;
      if (typeof desc === "string") {
        return desc;
      }
      if (desc && typeof desc === "object") {
        return (_g = (_f = desc.de) != null ? _f : desc.en) != null ? _g : null;
      }
      const name = (_h = notification == null ? void 0 : notification.category) == null ? void 0 : _h.name;
      if (typeof name === "string") {
        return name;
      }
      if (name && typeof name === "object") {
        return (_j = (_i = name.de) != null ? _i : name.en) != null ? _j : null;
      }
    } catch (e) {
      this.log.warn(`Failed to extract text: ${e.message}`);
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

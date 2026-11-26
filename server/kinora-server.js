#!/usr/bin/env node
import { createRequire as __kinoraRequire } from 'node:module'; const require = __kinoraRequire(import.meta.url); globalThis.KINORA_BUNDLE = true;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
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

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask2, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask2[i & 3];
      }
    }
    function _unmask(buffer, mask2) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask2[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask2, output, offset, length) {
          if (length < 48) _mask(source, mask2, output, offset, length);
          else bufferUtil.mask(source, mask2, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask2) {
          if (buffer.length < 32) _unmask(buffer, mask2);
          else bufferUtil.unmask(buffer, mask2);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask2;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask2 = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask2);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask2[0] = randomPool[randomPoolPointer++];
            mask2[1] = randomPool[randomPoolPointer++];
            mask2[2] = randomPool[randomPoolPointer++];
            mask2[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask2[0] | mask2[1] | mask2[2] | mask2[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask2[0];
        target[offset - 3] = mask2[1];
        target[offset - 2] = mask2[2];
        target[offset - 1] = mask2[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask2, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask2, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask2, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask: mask2,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask2, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask: mask2,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask2, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask: mask2,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http2 = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask2, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask2 = void 0;
        } else if (typeof mask2 === "function") {
          cb = mask2;
          mask2 = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask2 === void 0) mask2 = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask2, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask2, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask2 = void 0;
        } else if (typeof mask2 === "function") {
          cb = mask2;
          mask2 = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask2 === void 0) mask2 = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask2, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http2 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/index.js
import http from "node:http";
import fs2 from "node:fs";
import fsp2 from "node:fs/promises";
import path2 from "node:path";
import { spawn as spawn2, execFile as execFile2 } from "node:child_process";
import os2 from "node:os";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// server/export.js
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
var HERE = path.dirname(fileURLToPath(import.meta.url));
var PY = process.env.PYTHON || "python";
var readJson = async (f, d) => {
  try {
    return JSON.parse(await fsp.readFile(f, "utf8"));
  } catch {
    return d;
  }
};
function killTree(child) {
  if (!child || child.exitCode != null) return;
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {
  });
  else child.kill("SIGTERM");
}
function scaleFilter(o, srcW, srcH) {
  const W = o.ancho || srcW, H = o.alto || srcH;
  if (W === srcW && H === srcH) return null;
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  const w = even(W), h = even(H);
  if (Math.abs(W / H - srcW / srcH) < 0.01) return `scale=${w}:${h}:flags=lanczos`;
  return o.ajuste === "recortar" ? `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}` : `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${o.fondo || "black"}`;
}
function createExporter({ broadcast: broadcast2, project: project2, buildAudio: buildAudio2 }) {
  let job = null;
  const emit = (patch) => {
    job = { ...job, ...patch, actualizado: Date.now() };
    broadcast2({ type: "exportar", job: publicJob() });
  };
  const publicJob = () => job && { id: job.id, estado: job.estado, etapa: job.etapa, etapas: job.etapas, pct: job.pct, etapaPct: job.etapaPct, cuadros: job.cuadros, total: job.total, velocidad: job.velocidad, inicio: job.inicio, restante: job.restante, resultado: job.resultado, error: job.error, opciones: job.opciones, log: job.log.slice(-14) };
  function run2(cmd, args2, { cwd, onLine } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args2, { cwd, windowsHide: true });
      job.child = child;
      let buf = "", tail = "";
      const feed = (chunk) => {
        const s = chunk.toString("utf8");
        tail = (tail + s).slice(-4e3);
        buf += s;
        let i;
        while ((i = buf.search(/[\r\n]/)) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line) {
            onLine?.(line);
            if (!/^(frame|fps|stream_|bitrate|total_size|out_time|dup|drop|speed|progress)=/.test(line)) job.log.push(line);
          }
        }
      };
      child.stdout.on("data", feed);
      child.stderr.on("data", feed);
      child.on("close", (code) => {
        job.child = null;
        if (job.cancelado) reject(new Error("Canceled"));
        else if (code) reject(new Error(tail.trim().split("\n").slice(-4).join("\n") || `${cmd} exited with ${code}`));
        else resolve(tail);
      });
      child.on("error", reject);
    });
  }
  const setStage = (etapa, pct = 0) => {
    const idx = job.etapas.indexOf(etapa);
    const overall = (idx + pct) / job.etapas.length;
    const elapsed = (Date.now() - job.inicio) / 1e3;
    const restante = overall > 0.03 ? Math.max(0, elapsed / overall - elapsed) : null;
    emit({ etapa, etapaPct: pct, pct: overall, restante });
  };
  async function destination(o, ext) {
    const p = project2();
    const base = (o.nombre || p.name || "video").replace(/[<>:"/\\|?*]+/g, "-").trim() || "video";
    const dir = o.destino === "descargas" ? path.join(os.homedir(), "Downloads") : path.join(p.dir, "out", "exports");
    await fsp.mkdir(dir, { recursive: true });
    let file = path.join(dir, ext ? `${base}.${ext}` : base), n = 2;
    while (fs.existsSync(file)) file = path.join(dir, ext ? `${base}-v${n++}.${ext}` : `${base}-v${n++}`);
    return file;
  }
  async function start(o) {
    if (job && job.estado === "exportando") throw new Error("An export is already running.");
    const p = project2();
    if (!fs.existsSync(path.join(p.dir, "render.py"))) throw new Error("This project has no render.py.");
    const tl = await readJson(path.join(p.dir, "timeline.json"), null);
    if (!tl) throw new Error("Could not find timeline.json.");
    const spb = 60 / tl.bpm, total = tl.beats * spb;
    const desde = Math.max(0, +o.desde || 0), hasta = Math.min(total, o.hasta != null ? +o.hasta : total);
    const entero = desde <= 1e-3 && hasta >= total - 1e-3;
    const formato = o.formato || "mp4";
    const cuadro = formato === "cuadro";
    const high = !cuadro && o.fps && o.fps > tl.fps;
    const etapas = cuadro ? ["imagen", "guardado"] : ["imagen", ...o.audio !== false && ["mp4", "webm"].includes(formato) && (!entero || high) ? ["sonido"] : [], "formato", "guardado"];
    job = { id: Date.now().toString(36), estado: "exportando", etapas, etapa: etapas[0], pct: 0, etapaPct: 0, inicio: Date.now(), log: [], opciones: o, cuadros: 0, total: 0, velocidad: null };
    emit({});
    work(o, tl, { spb, total, desde, hasta, entero, formato, cuadro, high }).catch((e) => emit({ estado: job.cancelado ? "cancelado" : "error", error: e.message }));
    return publicJob();
  }
  async function work(o, tl, x) {
    const p = project2();
    const out = path.join(p.dir, "out");
    const name = tl.name || "video";
    if (x.cuadro) {
      const n = Math.round((o.t ?? x.desde) * tl.fps);
      setStage("imagen", 0.1);
      await run2(PY, ["render.py", "--frames", String(n)], { cwd: p.dir });
      const src = path.join(out, "frames", `f${String(n).padStart(5, "0")}.png`);
      setStage("guardado", 0.5);
      const dst2 = await destination({ ...o, nombre: o.nombre || `${name}-${(n / tl.fps).toFixed(2)}s` }, "png");
      const vf2 = scaleFilter(o, tl.width, tl.height);
      if (vf2) await run2("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", vf2, dst2]);
      else await fsp.copyFile(src, dst2);
      return finish(dst2);
    }
    if (o.audio !== false && fs.existsSync(path.join(p.dir, "sound.py"))) {
      job.log.push("Preparing the sound");
      await buildAudio2().catch(() => {
      });
    }
    const t0 = Date.now();
    const highOut = path.join(out, `${name}-${o.fps}fps.mp4`);
    const args2 = x.high ? [path.join(HERE, "render_frames.py"), p.dir, "--fps", String(o.fps), "--from", String(x.desde), "--to", String(x.hasta), "--workers", String(o.workers || 6), "--out", highOut] : ["render.py", "--workers", String(o.workers || 6), ...x.entero ? [] : ["--from", String(x.desde / x.spb), "--to", String(x.hasta / x.spb)]];
    setStage("imagen", 0);
    await run2(PY, args2, {
      cwd: p.dir,
      onLine: (line) => {
        const m = line.match(/(\d+)\/(\d+) frames\s+([\d.]+)s/);
        if (m) {
          const done = +m[1], all = +m[2];
          job.cuadros = done;
          job.total = all;
          job.velocidad = done / Math.max(0.1, (Date.now() - t0) / 1e3);
          setStage("imagen", done / all);
        }
        if (/^final:/.test(line)) setStage("imagen", 1);
      }
    });
    let master = x.high ? highOut : x.entero ? path.join(out, `${name}.mp4`) : path.join(out, `${name}-range.mp4`);
    if (!fs.existsSync(master)) master = path.join(out, `${name}-silent.mp4`);
    const soundFrom = x.high ? x.desde : x.desde;
    const hasSound = fs.existsSync(path.join(out, "sound.wav"));
    if (job.etapas.includes("sonido")) {
      setStage("sonido", 0.2);
      if (hasSound) {
        const muxed = path.join(out, `${name}-range-sound.mp4`);
        const dur = x.hasta - x.desde;
        await run2("ffmpeg", [
          "-y",
          "-loglevel",
          "error",
          "-i",
          master,
          "-ss",
          soundFrom.toFixed(3),
          "-t",
          dur.toFixed(3),
          "-i",
          path.join(out, "sound.wav"),
          "-map",
          "0:v",
          "-map",
          "1:a",
          "-af",
          `loudnorm=I=-14:TP=-2.5:LRA=11,afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, dur - 0.3).toFixed(3)}:d=0.3`,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "256k",
          "-shortest",
          muxed
        ]);
        master = muxed;
      }
      setStage("sonido", 1);
    }
    setStage("formato", 0);
    const durOut = x.hasta - x.desde;
    const vf = [scaleFilter(o, tl.width, tl.height)].filter(Boolean);
    const fps = o.fps && o.fps < tl.fps ? o.fps : null;
    const q = { alta: 0, media: 1, liviana: 2 }[o.calidad || "alta"];
    const progress = ["-progress", "pipe:1", "-nostats"];
    const onLine = (line) => {
      const m = line.match(/^out_time_(?:ms|us)=(\d+)/);
      if (m) setStage("formato", Math.min(0.99, +m[1] / 1e6 / Math.max(0.1, durOut)));
    };
    const withAudio = o.audio !== false;
    let dst;
    if (x.formato === "mp4") {
      dst = await destination(o, "mp4");
      const same = !vf.length && !fps && q === 0 && withAudio;
      if (same) {
        await fsp.copyFile(master, dst);
        setStage("formato", 1);
      } else await run2("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        ...progress,
        "-i",
        master,
        ...vf.length ? ["-vf", vf.join(",")] : [],
        ...fps ? ["-r", String(fps)] : [],
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        String([17, 21, 26][q]),
        "-pix_fmt",
        "yuv420p",
        ...withAudio ? ["-c:a", "aac", "-b:a", ["256k", "192k", "128k"][q]] : ["-an"],
        "-movflags",
        "+faststart",
        dst
      ], { onLine });
    } else if (x.formato === "webm") {
      dst = await destination(o, "webm");
      await run2("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        ...progress,
        "-i",
        master,
        ...vf.length ? ["-vf", vf.join(",")] : [],
        ...fps ? ["-r", String(fps)] : [],
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        String([28, 33, 38][q]),
        "-row-mt",
        "1",
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        ...withAudio ? ["-c:a", "libopus", "-b:a", "128k"] : ["-an"],
        dst
      ], { onLine });
    } else if (x.formato === "gif") {
      dst = await destination(o, "gif");
      const gfps = fps || 20, colors = [256, 160, 96][q];
      const chain = [...vf, `fps=${gfps}`].join(",");
      await run2("ffmpeg", ["-y", "-loglevel", "error", ...progress, "-i", master, "-filter_complex", `[0:v]${chain},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`, "-loop", "0", dst], { onLine });
    } else if (x.formato === "png") {
      dst = await destination(o, null);
      await fsp.mkdir(dst, { recursive: true });
      await run2("ffmpeg", ["-y", "-loglevel", "error", ...progress, "-i", master, ...vf.length || fps ? ["-vf", [...vf, ...fps ? [`fps=${fps}`] : []].join(",")] : [], path.join(dst, "%05d.png")], { onLine });
    } else throw new Error(`Unknown format: ${x.formato}`);
    setStage("formato", 1);
    return finish(dst);
  }
  async function finish(dst) {
    setStage("guardado", 0.5);
    const st = await fsp.stat(dst);
    let tamano = st.size;
    if (st.isDirectory()) {
      tamano = 0;
      for (const f of await fsp.readdir(dst)) tamano += (await fsp.stat(path.join(dst, f))).size;
    }
    const p = project2();
    const rel = dst.startsWith(p.dir) ? path.relative(p.dir, dst).split(path.sep).join("/") : null;
    const resultado = { ruta: dst, rel, nombre: path.basename(dst), tamano, carpeta: st.isDirectory(), formato: job.opciones.formato, segundos: (Date.now() - job.inicio) / 1e3 };
    const histFile = path.join(p.dir, ".estudio", "exportaciones.json");
    const hist = await readJson(histFile, []);
    hist.unshift({ ...resultado, fecha: (/* @__PURE__ */ new Date()).toISOString(), opciones: job.opciones });
    await fsp.writeFile(histFile, JSON.stringify(hist.slice(0, 30), null, 2));
    emit({ estado: "listo", pct: 1, etapa: "guardado", etapaPct: 1, restante: 0, resultado });
    return resultado;
  }
  return {
    start,
    cancel() {
      if (job?.estado === "exportando") {
        job.cancelado = true;
        killTree(job.child);
        emit({ estado: "cancelado" });
      }
    },
    state: publicJob,
    async history() {
      const p = project2();
      return (await readJson(path.join(p.dir, ".estudio", "exportaciones.json"), [])).filter((h) => fs.existsSync(h.ruta));
    },
    async known(ruta) {
      return (await this.history()).some((h) => h.ruta === ruta);
    }
  };
}

// server/index.js
var HERE2 = path2.dirname(fileURLToPath2(import.meta.url));
var ROOT = path2.resolve(HERE2, "..");
var args = process.argv.slice(2);
var flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
var PORT = Number(flag("--port", process.env.ESTUDIO_PORT || 4870));
var PROD = args.includes("--prod") || globalThis.KINORA_BUNDLE === true;
var OPEN = args.includes("--open");
var positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--port"));
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".md": "text/markdown; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};
var SOURCE_EXT = /* @__PURE__ */ new Set([".html", ".js", ".mjs", ".jsx", ".ts", ".tsx", ".py", ".json", ".md", ".css"]);
var IGNORED = /(^|[\\/])(\.estudio|out|node_modules|__pycache__|\.git)([\\/]|$)/;
var project = null;
var live = { t: 0, playing: false, seleccion: null, herramienta: "inspeccionar", vista: null, actualizado: 0 };
var clients = /* @__PURE__ */ new Set();
var pending = /* @__PURE__ */ new Map();
var reqId = 0;
var watcher = null;
var chat = { proc: null, sessionId: null, busy: false };
var exporter = createExporter({ broadcast: (m) => broadcast(m), project: () => project, buildAudio: () => buildAudio() });
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  for (const ws of clients) send(ws, msg);
}
function uiRequest(cmd, payload = {}, timeout = 2e4) {
  const ui = [...clients].find((c) => c.readyState === 1);
  if (!ui) return Promise.reject(new Error("The editor is not open in any browser tab. Call the open tool (no folder needed) to open the tab, then try again."));
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`The editor did not respond to ${cmd}.`));
    }, timeout);
    pending.set(id, { resolve: (v) => {
      clearTimeout(timer);
      resolve(v);
    }, reject: (e) => {
      clearTimeout(timer);
      reject(e);
    } });
    send(ui, { type: "cmd", id, cmd, ...payload });
  });
}
var dataDir = () => path2.join(project.dir, ".estudio");
var notesPath = () => path2.join(dataDir(), "notas.json");
async function readJson2(file, fallback) {
  try {
    return JSON.parse(await fsp2.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson(file, value) {
  await fsp2.mkdir(path2.dirname(file), { recursive: true });
  await fsp2.writeFile(file, JSON.stringify(value, null, 2));
}
async function listFiles(dir, base = dir, out = []) {
  for (const ent of await fsp2.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path2.join(dir, ent.name);
    const rel = path2.relative(base, full).split(path2.sep).join("/");
    if (IGNORED.test(rel)) continue;
    if (ent.isDirectory()) await listFiles(full, base, out);
    else out.push(rel);
  }
  return out;
}
async function openProject(dir) {
  dir = path2.resolve(dir);
  const stat = await fsp2.stat(dir).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error(`Folder not found: ${dir}`);
  const entry = fs2.existsSync(path2.join(dir, "index.html")) ? "index.html" : (await listFiles(dir)).find((f) => f.endsWith(".html"));
  if (!entry) throw new Error("The folder has no HTML page.");
  project = { dir, name: path2.basename(dir) === "video" ? path2.basename(path2.dirname(dir)) : path2.basename(dir), entry };
  await fsp2.mkdir(dataDir(), { recursive: true });
  history = { undo: [], redo: [], known: /* @__PURE__ */ new Map() };
  for (const f of await listFiles(dir)) if (SOURCE_EXT.has(path2.extname(f).toLowerCase())) history.known.set(f, await fsp2.readFile(path2.join(dir, f), "utf8").catch(() => null));
  const rec = (await readJson2(RECENTS, [])).filter((r) => r.dir !== dir);
  rec.unshift({ dir, name: project.name, abierto: (/* @__PURE__ */ new Date()).toISOString() });
  await writeJson(RECENTS, rec.slice(0, 12));
  const saved = await readJson2(path2.join(dataDir(), "chat.json"), {});
  chat.sessionId = saved.sessionId || null;
  if (!chat.busy) {
    const histFile = path2.join(dataDir(), "mensajes.json");
    const hist = await readJson2(histFile, []);
    if (hist.length && hist[hist.length - 1].tipo === "usuario") {
      hist.push({ tipo: "claude", texto: "", herramientas: [], t: Date.now(), error: "Interrupted: the editor restarted while Claude was working. You can ask again." });
      await writeJson(histFile, hist);
    }
  }
  watch();
  buildAudio().catch((e) => console.warn("audio:", e.message));
  broadcast({ type: "proyecto", name: project.name });
  console.log(`project: ${dir}`);
}
var HOME_DIR = path2.join(os2.homedir(), ".estudio");
var RECENTS = path2.join(HOME_DIR, "recientes.json");
var CONFIG = path2.join(HOME_DIR, "config.json");
var history = { undo: [], redo: [], known: /* @__PURE__ */ new Map() };
var restoring = /* @__PURE__ */ new Map();
var pendingTrack = /* @__PURE__ */ new Set();
var chatRun = 0;
var preguntas = /* @__PURE__ */ new Map();
async function track(rel) {
  pendingTrack.delete(rel);
  if (!SOURCE_EXT.has(path2.extname(rel).toLowerCase())) return;
  const now = await fsp2.readFile(path2.join(project.dir, rel), "utf8").catch(() => null);
  const before = history.known.get(rel) ?? null;
  history.known.set(rel, now);
  if (restoring.has(rel)) {
    const expected = restoring.get(rel);
    restoring.delete(rel);
    if (now === expected) return;
  }
  if (now === before) return;
  const autor = chat.busy ? "claude" : "vos";
  const grupo = chat.busy ? `claude-${chatRun}` : `vos-${rel}`;
  const last = history.undo[history.undo.length - 1];
  const merge = last && last.grupo === grupo && (autor === "claude" || Date.now() - last.t < 2500);
  if (merge) {
    const f = last.files.find((x) => x.file === rel);
    if (f) f.after = now;
    else last.files.push({ file: rel, before, after: now });
    last.t = Date.now();
  } else history.undo.push({ files: [{ file: rel, before, after: now }], autor, grupo, t: Date.now() });
  if (history.undo.length > 300) history.undo.shift();
  history.redo = [];
  broadcast({ type: "historial", ...historySummary() });
}
function describeStep(st) {
  if (!st) return null;
  return { file: st.files.length === 1 ? st.files[0].file : `${st.files.length} files`, autor: st.autor, archivos: st.files.map((f) => f.file) };
}
function historySummary() {
  return { deshacer: describeStep(history.undo[history.undo.length - 1]), rehacer: describeStep(history.redo[history.redo.length - 1]), pasos: history.undo.length };
}
async function stepHistory(dir) {
  for (const rel of [...pendingTrack]) await track(rel);
  const from = dir === "deshacer" ? history.undo : history.redo;
  const to = dir === "deshacer" ? history.redo : history.undo;
  const step = from.pop();
  if (!step) return null;
  for (const f of step.files) {
    const content = dir === "deshacer" ? f.before : f.after;
    const full = path2.join(project.dir, f.file);
    restoring.set(f.file, content);
    if (content == null) await fsp2.rm(full, { force: true });
    else await fsp2.writeFile(full, content);
    history.known.set(f.file, content);
  }
  to.push(step);
  broadcast({ type: "historial", ...historySummary() });
  return { ...step, file: describeStep(step).file };
}
function frontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  let key = null;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      out[key] = kv[2].replace(/^["']|["']$/g, "");
    } else if (key && /^\s+/.test(line)) out[key] += " " + line.trim();
  }
  return out;
}
async function skillDirs() {
  const cfg = await readJson2(CONFIG, {});
  const home = os2.homedir();
  const configDir = process.env.CLAUDE_CONFIG_DIR || path2.join(home, ".claude");
  const roots = [
    { dir: path2.join(ROOT, "skills"), origen: "Kinora" },
    ...(cfg.skills || []).map((d) => ({ dir: d, origen: "Added", single: true })),
    { dir: path2.join(configDir, "skills"), origen: "Claude Code" },
    { dir: path2.join(home, ".claude", "skills"), origen: "Claude Code" },
    { dir: path2.join(home, ".agents", "skills"), origen: "Agents" }
  ];
  const seen = /* @__PURE__ */ new Map();
  for (const r of roots) {
    const dirs = r.single ? [r.dir] : (await fsp2.readdir(r.dir, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => path2.join(r.dir, e.name));
    for (const d of dirs) {
      const md = await fsp2.readFile(path2.join(d, "SKILL.md"), "utf8").catch(() => null);
      if (!md) continue;
      const fm = frontmatter(md);
      const name = fm.name || path2.basename(d);
      if (seen.has(name)) continue;
      seen.set(name, { name, description: fm.description || "", dir: d, origen: r.origen, fija: r.origen === "Kinora" });
    }
  }
  return [...seen.values()];
}
async function activeSkills() {
  const all = await skillDirs();
  const conf = await readJson2(path2.join(dataDir(), "config.json"), {});
  const on = conf.skills || all.filter((s) => s.fija || s.name === "opuscut").map((s) => s.name);
  return all.map((s) => ({ ...s, activa: s.fija || on.includes(s.name) }));
}
var VERSION_SEEN = 1;
var runOnce = (cmd, args2, timeout, shell) => new Promise((resolve) => execFile2(cmd, args2, { timeout, windowsHide: true, shell }, (err, stdout, stderr) => resolve({ ok: !err, missing: err?.code === "ENOENT", out: String(stdout || "").trim(), err: String(stderr || "").trim() })));
var run = async (cmd, args2, timeout = 15e3) => {
  const r = await runOnce(cmd, args2, timeout, false);
  return r.missing && process.platform === "win32" ? runOnce(cmd, args2, timeout, true) : r;
};
var setupCache = null;
async function setupStatus(fresh) {
  if (setupCache && !fresh && Date.now() - setupCache.t < 6e4) return setupCache.v;
  const PYBIN = process.env.PYTHON || "python";
  const [ver, auth, py, mods, ff] = await Promise.all([
    run(process.env.CLAUDE_BIN || "claude", ["--version"]),
    run(process.env.CLAUDE_BIN || "claude", ["auth", "status"]),
    run(PYBIN, ["--version"]),
    run(PYBIN, ["-c", 'import importlib.util as u;print(",".join(m for m in ["numpy","scipy","PIL","playwright"] if not u.find_spec(m)))']),
    run("ffmpeg", ["-version"])
  ]);
  let a = {};
  try {
    a = JSON.parse(auth.out);
  } catch {
  }
  const cfg = await readJson2(CONFIG, {});
  const con = await connections();
  const v = {
    visto: cfg.bienvenida === VERSION_SEEN,
    claude: {
      instalado: ver.ok,
      version: ver.ok ? ver.out.split(/\s/)[0] : null,
      conectado: !!a.loggedIn,
      metodo: a.authMethod || null,
      plan: a.subscriptionType || null
    },
    python: { ok: py.ok, version: py.ok ? (py.out || py.err).replace(/^Python\s*/i, "") : null, faltan: mods.ok ? mods.out.split(",").filter(Boolean).map((m) => m === "PIL" ? "Pillow" : m) : null },
    ffmpeg: ff.ok,
    sonidos: cfg.openverse !== false,
    imagenes: con.openrouter ? "openrouter" : con.gateway ? "gateway" : null,
    requisitos: path2.join(ROOT, "skills", "opuscut", "requirements.txt"),
    plataforma: process.platform
  };
  setupCache = { t: Date.now(), v };
  return v;
}
async function connections() {
  const cfg = await readJson2(CONFIG, {});
  return {
    openrouter: cfg.openrouter || process.env.OPENROUTER_API_KEY || null,
    gateway: cfg.gateway || process.env.AI_GATEWAY_API_KEY || null,
    tripo: cfg.tripo || process.env.TRIPO_API_KEY || null,
    modeloImagen: cfg.modeloImagen || "openrouter:openai/gpt-5.4-image-2"
  };
}
var mask = (k) => k ? `${k.slice(0, 6)}\u2026${k.slice(-4)}` : null;
var imageModels = { t: 0, key: "", list: [] };
async function listImageModels() {
  const con = await connections();
  const key = `${!!con.openrouter}:${!!con.gateway}`;
  if (imageModels.key === key && Date.now() - imageModels.t < 36e5) return imageModels.list;
  const list = [];
  if (con.openrouter) {
    try {
      const d = await (await fetch("https://openrouter.ai/api/v1/models")).json();
      for (const m of d.data || []) if ((m.architecture?.output_modalities || []).includes("image") && !m.id.startsWith("openrouter/"))
        list.push({ id: `openrouter:${m.id}`, nombre: m.name.replace(/^[^:]+:\s*/, ""), proveedor: "OpenRouter", autor: m.id.split("/")[0], via: "chat", referencias: (m.architecture?.input_modalities || []).includes("image") });
    } catch {
    }
  }
  if (con.gateway) {
    try {
      const d = await (await fetch("https://ai-gateway.vercel.sh/v1/models")).json();
      for (const m of d.data || []) {
        const only = m.type === "image";
        const multi = m.type === "language" && (m.tags || []).includes("image-generation");
        if (!only && !multi) continue;
        list.push({ id: `gateway:${m.id}`, nombre: m.name, proveedor: "AI Gateway", autor: m.owned_by || m.id.split("/")[0], via: only ? "images" : "chat", referencias: (m.modalities?.input || []).includes("image") || multi });
      }
    } catch {
    }
  }
  imageModels = { t: Date.now(), key, list };
  return list;
}
async function saveGenerated(buf, prompt, nombre, fondo) {
  const base = (nombre || prompt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "imagen";
  const dir = path2.join(project.dir, "assets", "gen");
  await fsp2.mkdir(dir, { recursive: true });
  let file = path2.join(dir, `${base}.png`), n = 2;
  while (fs2.existsSync(file)) file = path2.join(dir, `${base}-${n++}.png`);
  await fsp2.writeFile(file, buf);
  if (fondo === "transparente") await new Promise((resolve, reject) => execFile2(process.env.PYTHON || "python", [path2.join(HERE2, "key_green.py"), file, file], { windowsHide: true }, (e) => e ? reject(e) : resolve()));
  broadcast({ type: "archivos" });
  return path2.relative(project.dir, file).split(path2.sep).join("/");
}
async function generateImage({ prompt, refs = [], ratio = "1:1", fondo = "normal", nombre, modelo }) {
  const con = await connections();
  let id = modelo || con.modeloImagen;
  if (!id.includes(":")) id = `openrouter:${id}`;
  const [prov, model] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  const key = prov === "gateway" ? con.gateway : con.openrouter;
  if (!key) throw new Error(`${prov === "gateway" ? "AI Gateway" : "OpenRouter"} is not connected.`);
  const text = `${prompt}${fondo === "transparente" ? "\n\nIsolated subject on a flat pure chroma green background (#00FF00), no shadow on the background, nothing else in frame." : ""}
Aspect ratio ${ratio}. No text or watermark unless asked.`;
  const images = [];
  for (const ref of refs.slice(0, 4)) {
    const full = safeJoin(project.dir, ref);
    const ext = path2.extname(full).slice(1).toLowerCase().replace("jpg", "jpeg");
    images.push(`data:image/${ext};base64,${(await fsp2.readFile(full)).toString("base64")}`);
  }
  const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const models = await listImageModels();
  const info = models.find((m) => m.id === id);
  let buf, cost = null;
  if (prov === "gateway" && info?.via === "images") {
    const url = images.length ? "https://ai-gateway.vercel.sh/v1/images/edits" : "https://ai-gateway.vercel.sh/v1/images/generations";
    const body = { model, prompt: text, n: 1, response_format: "b64_json", ...images.length ? { images: images.map((u) => ({ image_url: u })) } : {} };
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || `AI Gateway returned ${r.status}`);
    const img = d.data?.[0];
    if (img?.b64_json) buf = Buffer.from(img.b64_json, "base64");
    else if (img?.url) buf = Buffer.from(await (await fetch(img.url)).arrayBuffer());
  } else {
    const content = [{ type: "text", text }, ...images.map((u2) => ({ type: "image_url", image_url: { url: u2 } }))];
    const url = prov === "gateway" ? "https://ai-gateway.vercel.sh/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
    const body = { model, modalities: ["image", "text"], messages: [{ role: "user", content }], ...prov === "openrouter" ? { image_config: { aspect_ratio: ratio } } : {}, stream: false };
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error?.message || `${prov === "gateway" ? "AI Gateway" : "OpenRouter"} returned ${r.status}`);
    const u = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (u) buf = Buffer.from(u.split(",")[1], "base64");
    cost = d.usage?.cost ?? null;
  }
  if (!buf) throw new Error("The model did not return an image.");
  const archivo = await saveGenerated(buf, prompt, nombre, fondo);
  return { archivo, costo: cost, modelo: id };
}
var SOUND_CACHE = path2.join(HOME_DIR, "sonidos-cache");
async function searchSounds({ q, largo = "shortest", tipo = "efecto", pagina = 1 }) {
  const cfg = await readJson2(CONFIG, {});
  if (cfg.openverse === false) throw new Error("Free sounds are turned off.");
  const params = new URLSearchParams({ q, license_type: "commercial", page_size: "20", page: String(pagina) });
  if (largo) params.set("length", largo);
  if (tipo === "musica") params.set("source", "jamendo");
  const key = params.toString();
  const cacheFile = path2.join(SOUND_CACHE, Buffer.from(key).toString("base64url") + ".json");
  const cached = await readJson2(cacheFile, null);
  if (cached && Date.now() - cached.t < 7 * 864e5) return cached.data;
  const r = await fetch(`https://api.openverse.org/v1/audio/?${key}`, { headers: { "user-agent": "Kinora/0.5 (local video editor)" } });
  if (r.status === 429) throw new Error("Openverse asked to wait: the limit without a key is 20 searches per minute.");
  const d = await r.json();
  const data = (d.results || []).map((x) => ({
    id: x.id,
    titulo: x.title,
    autor: x.creator,
    licencia: `${(x.license || "").toUpperCase()} ${x.license_version || ""}`.trim(),
    duracion: x.duration ? x.duration / 1e3 : null,
    url: x.url,
    fuente: x.source,
    pagina: x.foreign_landing_url,
    atribucion: x.attribution,
    cc0: x.license === "cc0" || x.license === "pdm"
  })).filter((x) => x.url);
  await writeJson(cacheFile, { t: Date.now(), data });
  return data;
}
var GENERIC_SOUNDS = [
  ["Whoosh", "whoosh"],
  ["Hits", "punch"],
  ["Impacts", "cinematic impact"],
  ["Interface clicks", "ui click"],
  ["Risers", "riser"],
  ["Bells", "bell chime"],
  ["Ambience", "ambience"],
  ["Transitions", "swoosh transition"]
];
var GENERIC_MUSIC = [
  ["Cinematic", "cinematic"],
  ["Ambient", "ambient"],
  ["Electronic", "electronic"],
  ["Lo-fi", "lofi"],
  ["Epic", "epic"],
  ["Piano", "piano"],
  ["Suspense", "suspense"],
  ["Upbeat", "upbeat"]
];
var STOP = /* @__PURE__ */ new Set(["a", "an", "the", "and", "of", "in", "on", "that", "with", "final", "soft", "low", "high", "big", "small", "then", "silence", "concept", "cues", "up", "pile", "minor", "major"]);
async function videoSoundIdeas() {
  const md = await fsp2.readFile(path2.join(project.dir, "video.md"), "utf8").catch(() => "");
  const sec = (md.match(/##\s*Sound[^\n]*\n([\s\S]*?)(\n##\s|$)/i) || [])[1] || "";
  const phrases = sec.replace(/^[-*]\s*(Concept|Cues)\s*:/gim, "").replace(/\bin [A-G][#b]? (minor|major)\b/gi, "").split(/[,;.\n]| and /i).map((x) => x.replace(/^[-*\s]+/, "").trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const ph of phrases) {
    const words = ph.split(/\s+/).filter((w) => /^[a-z][a-z-]+$/.test(w) && !STOP.has(w)).slice(0, 2);
    if (!words.length) continue;
    const q = words.join(" ");
    if (!out.includes(q)) out.push(q);
    if (out.length >= 6) break;
  }
  return out;
}
async function recommendSounds({ tipo = "efecto", largo } = {}) {
  const music = tipo === "musica";
  const ideas = music ? [] : await videoSoundIdeas();
  const groups = [
    ...ideas.map((q) => ({ titulo: q, q, delVideo: true })),
    ...(music ? GENERIC_MUSIC : GENERIC_SOUNDS).map(([titulo, q]) => ({ titulo, q }))
  ];
  const len = largo || (music ? "medium" : "shortest");
  const out = [];
  for (let i = 0; i < groups.length; i += 4) {
    const chunk = await Promise.all(groups.slice(i, i + 4).map(async (g) => {
      try {
        const list = await searchSounds({ q: g.q, largo: len, tipo });
        return { ...g, items: list.sort((a, b) => b.cc0 - a.cc0).slice(0, 6) };
      } catch (e) {
        return { ...g, items: [], error: e.message };
      }
    }));
    out.push(...chunk);
  }
  return out.filter((g) => g.items.length || g.error);
}
async function downloadSound({ url, titulo, atribucion, cc0 }) {
  const base = (titulo || "sonido").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sonido";
  const dir = path2.join(project.dir, "assets", "sounds");
  await fsp2.mkdir(dir, { recursive: true });
  let file = path2.join(dir, `${base}.wav`), n = 2;
  while (fs2.existsSync(file)) file = path2.join(dir, `${base}-${n++}.wav`);
  const r = await fetch(url, { headers: { "user-agent": "Kinora/0.5 (local video editor)" } });
  if (!r.ok) throw new Error(`Could not download (${r.status}).`);
  const tmp = file + ".src";
  await fsp2.writeFile(tmp, Buffer.from(await r.arrayBuffer()));
  await new Promise((resolve, reject) => execFile2("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-ar", "48000", "-ac", "2", file], { windowsHide: true }, (e) => e ? reject(new Error("ffmpeg could not convert the sound.")) : resolve()));
  await fsp2.rm(tmp, { force: true });
  const rel = path2.relative(project.dir, file).split(path2.sep).join("/");
  if (!cc0 && atribucion) {
    const credits = path2.join(dir, "CREDITS.md");
    const prev = await fsp2.readFile(credits, "utf8").catch(() => "# Sound credits\n");
    await fsp2.writeFile(credits, `${prev}
- ${path2.basename(file)}: ${atribucion}`);
  }
  broadcast({ type: "archivos" });
  return { archivo: rel, atribucion: cc0 ? null : atribucion };
}
function watch() {
  if (watcher) watcher.close();
  const timers = /* @__PURE__ */ new Map();
  watcher = fs2.watch(project.dir, { recursive: true }, (_ev, file) => {
    if (!file) return;
    const rel = file.split(path2.sep).join("/");
    if (IGNORED.test(rel)) return;
    clearTimeout(timers.get(rel));
    pendingTrack.add(rel);
    timers.set(rel, setTimeout(() => {
      timers.delete(rel);
      track(rel);
      broadcast({ type: "archivo", file: rel });
      if (/(^|\/)(sound|synth)\.py$/.test(rel) || rel === "timeline.json") buildAudio().catch((e) => broadcast({ type: "audio", error: e.message }));
    }, 120));
  });
}
var audioRun = null;
function buildAudio() {
  if (!project || !fs2.existsSync(path2.join(project.dir, "sound.py"))) return Promise.resolve(null);
  if (audioRun) {
    audioRun.again = true;
    return audioRun.promise;
  }
  const run2 = { again: false };
  run2.promise = new Promise((resolve, reject) => {
    broadcast({ type: "audio", estado: "generando" });
    execFile2(process.env.PYTHON || "python", [path2.join(HERE2, "audio.py"), project.dir], { cwd: project.dir, maxBuffer: 1 << 24, windowsHide: true }, (err, stdout, stderr) => {
      audioRun = null;
      if (run2.again) {
        buildAudio().then(resolve, reject);
        return;
      }
      if (err) {
        const msg = (stderr || err.message).trim().split("\n").slice(-6).join("\n");
        broadcast({ type: "audio", error: msg });
        reject(new Error(msg));
        return;
      }
      broadcast({ type: "audio", estado: "listo", stamp: Date.now() });
      resolve(stdout);
    });
  });
  audioRun = run2;
  return run2.promise;
}
function readBody(req, limit = 64 << 20) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("Too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
var json = (res, code, value) => {
  res.writeHead(code, { "content-type": MIME[".json"], "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};
function safeJoin(base, rel) {
  const full = path2.resolve(base, decodeURIComponent(rel).replace(/^\/+/, ""));
  if (full !== base && !full.startsWith(base + path2.sep)) throw new Error("Path outside the project");
  return full;
}
async function serveProject(req, res, rel) {
  const full = safeJoin(project.dir, rel || project.entry);
  const st = await fsp2.stat(full).catch(() => null);
  if (!st || !st.isFile()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = path2.extname(full).toLowerCase();
  const headers = { "content-type": MIME[ext] || "application/octet-stream", "cache-control": "no-store" };
  if (ext === ".html") {
    let html = await fsp2.readFile(full, "utf8");
    const tag = '<script src="/__estudio/probe.js"></script>';
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
    res.writeHead(200, headers);
    res.end(html);
    return;
  }
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const [a, b] = range.slice(6).split("-");
    const start = Number(a) || 0, end = b ? Number(b) : st.size - 1;
    res.writeHead(206, { ...headers, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
    fs2.createReadStream(full, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": st.size });
  fs2.createReadStream(full).pipe(res);
}
async function notes() {
  return readJson2(notesPath(), []);
}
async function saveNotes(list) {
  await writeJson(notesPath(), list);
  broadcast({ type: "notas", notas: list });
}
async function api(req, res, url) {
  const route = url.pathname.slice(5);
  const method = req.method;
  const body = method === "GET" ? null : await readBody(req);
  const data = body && req.headers["content-type"]?.includes("json") ? JSON.parse(body.toString("utf8") || "{}") : null;
  if (route === "abrir" && method === "POST") {
    await openProject(data.dir);
    return json(res, 200, { ok: true, dir: project.dir });
  }
  if (route === "bienvenida" && method === "GET") {
    const st = await setupStatus(url.searchParams.has("fresco"));
    if (url.searchParams.get("vista") === "nuevo") return json(res, 200, { ...st, visto: false, claude: { instalado: false, version: null, conectado: false, metodo: null, plan: null }, imagenes: null });
    return json(res, 200, st);
  }
  if (route === "bienvenida" && method === "POST") {
    const cfg = await readJson2(CONFIG, {});
    cfg.bienvenida = VERSION_SEEN;
    await writeJson(CONFIG, cfg);
    setupCache = null;
    return json(res, 200, { ok: true });
  }
  if (route === "instalar" && method === "POST") {
    const PYBIN = process.env.PYTHON || "python";
    const steps = [[PYBIN, ["-m", "pip", "install", "--disable-pip-version-check", "-r", path2.join(ROOT, "skills", "opuscut", "requirements.txt")]], [PYBIN, ["-m", "playwright", "install", "chromium"]]];
    for (const [cmd, a] of steps) {
      const r = await run(cmd, a, 15 * 6e4);
      if (!r.ok) {
        setupCache = null;
        return json(res, 500, { error: (r.err || r.out).split("\n").slice(-4).join("\n") || "The install failed." });
      }
    }
    setupCache = null;
    return json(res, 200, await setupStatus(true));
  }
  if (route === "ejemplo" && method === "POST") {
    const base = data.carpeta ? path2.resolve(data.carpeta) : path2.join(os2.homedir(), "Documents", "Kinora");
    let target = path2.join(base, "Example"), i = 2;
    while (fs2.existsSync(target)) target = path2.join(base, `Example ${i++}`);
    await fsp2.mkdir(base, { recursive: true });
    await fsp2.cp(path2.join(ROOT, "templates", "example"), target, { recursive: true, filter: (src) => !/__pycache__|[\\/]out([\\/]|$)/.test(src) });
    await openProject(target);
    return json(res, 200, { ok: true, dir: target });
  }
  if (route === "recientes") return json(res, 200, (await readJson2(RECENTS, [])).filter((r) => fs2.existsSync(r.dir)));
  if (route === "carpetas") {
    let dir = url.searchParams.get("dir");
    if (!dir) {
      const rec = await readJson2(RECENTS, []);
      dir = rec[0] ? path2.dirname(rec[0].dir) : os2.homedir();
    }
    dir = path2.resolve(dir);
    const ents = await fsp2.readdir(dir, { withFileTypes: true }).catch(() => []);
    const dirs = [];
    for (const e of ents) {
      if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules" || e.name === "__pycache__") continue;
      const full = path2.join(dir, e.name);
      dirs.push({ name: e.name, path: full, video: fs2.existsSync(path2.join(full, "index.html")) });
    }
    dirs.sort((a, b) => b.video - a.video || a.name.localeCompare(b.name));
    const parent = path2.dirname(dir);
    return json(res, 200, { dir, parent: parent !== dir ? parent : null, video: fs2.existsSync(path2.join(dir, "index.html")), dirs });
  }
  if (route === "elegir" && method === "POST") {
    const folder = data.tipo === "carpeta";
    const start = (data.desde || "").replace(/'/g, "''");
    const ps = folder ? `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Choose a folder'; $d.ShowNewFolderButton = $true; if ('${start}') { $d.SelectedPath = '${start}' }; $o = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }; if ($d.ShowDialog($o) -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $d.SelectedPath }` : `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Open a video'; $d.Filter = 'Video page (*.html)|*.html|All files (*.*)|*.*'; if ('${start}') { $d.InitialDirectory = '${start}' }; $o = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }; if ($d.ShowDialog($o) -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $d.FileName }`;
    const out = await new Promise((resolve) => execFile2("powershell", ["-NoProfile", "-STA", "-Command", ps], { windowsHide: false, maxBuffer: 1 << 20 }, (err, stdout) => resolve(err ? "" : stdout.trim())));
    if (!out) return json(res, 200, { cancelado: true });
    return json(res, 200, { ruta: folder ? out : path2.dirname(out), archivo: folder ? null : path2.basename(out) });
  }
  if (route === "localizar" && method === "POST") {
    const { nombre, archivos = [], indice } = data;
    const want = new Map(archivos.map((a) => typeof a === "string" ? [a, null] : [a.n, a.s]));
    const home = os2.homedir();
    const rec = (await readJson2(RECENTS, [])).map((r) => path2.dirname(r.dir));
    const roots = [.../* @__PURE__ */ new Set([...rec, path2.join(home, "Desktop"), path2.join(home, "Documents"), path2.join(home, "Downloads"), path2.join(home, "OneDrive"), home, ...process.platform === "win32" ? "CDEFGH".split("").map((l) => l + ":/").filter((d) => fs2.existsSync(d)) : ["/"]])].filter((d) => fs2.existsSync(d));
    const skip = /^(node_modules|\.git|AppData|\$Recycle\.Bin|Windows|Program Files.*|ProgramData|System Volume Information|__pycache__)$/i;
    const found = [];
    const seen = /* @__PURE__ */ new Set();
    let visited = 0;
    const score = async (dir) => {
      const names = await fsp2.readdir(dir).catch(() => []);
      let hits = 0;
      for (const n of names) {
        if (!want.has(n)) continue;
        const size2 = want.get(n);
        if (size2 == null) {
          hits++;
          continue;
        }
        const st = await fsp2.stat(path2.join(dir, n)).catch(() => null);
        if (st && st.size === size2) hits++;
      }
      let size = true;
      if (indice?.nombre) {
        const st = await fsp2.stat(path2.join(dir, indice.nombre)).catch(() => null);
        size = !!st && (!indice.tam || st.size === indice.tam);
      }
      return size ? hits / Math.max(1, want.size) : 0;
    };
    for (const r of roots) {
      const queue = [[r, 0]];
      while (queue.length && visited < 4e4 && found.length < 3) {
        const [dir, depth] = queue.shift();
        if (seen.has(dir)) continue;
        seen.add(dir);
        visited++;
        if (path2.basename(dir).toLowerCase() === String(nombre).toLowerCase()) {
          const sc = await score(dir);
          if (sc >= 0.98) found.push({ dir, sc });
        }
        if (depth >= 6) continue;
        const ents = await fsp2.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of ents) if (e.isDirectory() && !e.name.startsWith(".") && !skip.test(e.name)) queue.push([path2.join(dir, e.name), depth + 1]);
      }
      if (found.length) break;
    }
    found.sort((a, b) => b.sc - a.sc);
    return json(res, 200, { rutas: found.map((f) => f.dir) });
  }
  if (route === "lugares") {
    const home = os2.homedir();
    const lugares = [
      { nombre: "Home", ruta: home },
      { nombre: "Desktop", ruta: path2.join(home, "Desktop") },
      { nombre: "Documents", ruta: path2.join(home, "Documents") },
      { nombre: "Downloads", ruta: path2.join(home, "Downloads") }
    ].filter((l) => fs2.existsSync(l.ruta));
    const unidades = [];
    if (process.platform === "win32") {
      for (const l of "CDEFGHIJKLMNOPQRSTUVWXYZ") if (fs2.existsSync(l + ":/")) unidades.push({ nombre: `${l}:`, ruta: l + ":/" });
    }
    return json(res, 200, { lugares, unidades });
  }
  if (route === "conexiones" && method === "GET") {
    const c = await connections();
    return json(res, 200, { openrouter: mask(c.openrouter), gateway: mask(c.gateway), tripo: mask(c.tripo), modeloImagen: c.modeloImagen, openverse: (await readJson2(CONFIG, {})).openverse !== false });
  }
  if (route === "conexiones" && method === "POST") {
    const cfg = await readJson2(CONFIG, {});
    for (const k of ["openrouter", "gateway", "tripo", "modeloImagen"]) if (k in data) {
      if (data[k]) cfg[k] = data[k];
      else delete cfg[k];
    }
    if ("openverse" in data) {
      if (data.openverse) delete cfg.openverse;
      else cfg.openverse = false;
    }
    await writeJson(CONFIG, cfg);
    setupCache = null;
    const c = await connections();
    return json(res, 200, { openrouter: mask(c.openrouter), gateway: mask(c.gateway), tripo: mask(c.tripo), modeloImagen: c.modeloImagen, openverse: cfg.openverse !== false });
  }
  if (route === "modelos-imagen") {
    try {
      return json(res, 200, await listImageModels());
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }
  if (route === "nuevo" && method === "POST") {
    const cfg = await readJson2(CONFIG, {});
    const engine = cfg.motor || path2.join(ROOT, "skills", "opuscut", "engine");
    if (!fs2.existsSync(path2.join(engine, "index.html"))) return json(res, 409, { error: "Could not find the OpusCut engine for the template." });
    const name = String(data.nombre || "").trim().replace(/[<>:"/\\|?*]+/g, "-");
    if (!name) return json(res, 400, { error: "The name is missing." });
    const target = path2.join(path2.resolve(data.carpeta), name);
    if (fs2.existsSync(target)) return json(res, 409, { error: "A folder with that name already exists." });
    await fsp2.cp(engine, target, { recursive: true, filter: (src) => !/__pycache__|[\\/]out([\\/]|$)/.test(src) });
    const tl = await readJson2(path2.join(target, "timeline.json"), {});
    tl.name = name.toLowerCase().replace(/\s+/g, "-");
    if (data.ancho) tl.width = +data.ancho;
    if (data.alto) tl.height = +data.alto;
    if (data.segundos) tl.beats = Math.max(4, Math.round(+data.segundos * tl.bpm / 60));
    await writeJson(path2.join(target, "timeline.json"), tl);
    await openProject(target);
    return json(res, 200, { ok: true, dir: target });
  }
  if (route === "skills" && method === "GET") {
    if (!project) return json(res, 200, (await skillDirs()).map((s) => ({ ...s, activa: s.fija })));
    return json(res, 200, await activeSkills());
  }
  if (route === "skills/agregar" && method === "POST") {
    const dir = path2.resolve(data.dir);
    if (!fs2.existsSync(path2.join(dir, "SKILL.md"))) return json(res, 400, { error: "That folder has no SKILL.md." });
    const cfg = await readJson2(CONFIG, {});
    cfg.skills = [.../* @__PURE__ */ new Set([...cfg.skills || [], dir])];
    await writeJson(CONFIG, cfg);
    return json(res, 200, { ok: true });
  }
  if (!project) return json(res, 409, { error: "No project is open." });
  if (route === "etiquetas") {
    const file = path2.join(dataDir(), "config.json");
    const conf = await readJson2(file, {});
    if (method === "POST") {
      conf.etiquetas = conf.etiquetas || { pistas: {}, sonidos: {} };
      const group = data.tipo === "pista" ? "pistas" : "sonidos";
      if (data.nombre && data.nombre.trim()) conf.etiquetas[group][data.clave] = data.nombre.trim();
      else delete conf.etiquetas[group][data.clave];
      await writeJson(file, conf);
      broadcast({ type: "etiquetas", etiquetas: conf.etiquetas });
    }
    return json(res, 200, conf.etiquetas || { pistas: {}, sonidos: {} });
  }
  if (route === "skills" && method === "POST") {
    const conf = await readJson2(path2.join(dataDir(), "config.json"), {});
    conf.skills = data.activas;
    await writeJson(path2.join(dataDir(), "config.json"), conf);
    return json(res, 200, await activeSkills());
  }
  if ((route === "deshacer" || route === "rehacer") && method === "POST") {
    const step = await stepHistory(route);
    return json(res, 200, { ok: !!step, file: step?.file, ...historySummary() });
  }
  if (route === "historial" && url.searchParams.has("todo")) {
    for (const rel of [...pendingTrack]) await track(rel);
    const list = (steps) => steps.map((st) => ({ ...describeStep(st), t: new Date(st.t).toISOString() })).reverse();
    return json(res, 200, { deshacer: list(history.undo), rehacer: list(history.redo) });
  }
  if (route === "historial") return json(res, 200, historySummary());
  if (route === "explorador" && method === "POST") {
    spawn2("explorer", [project.dir], { detached: true, windowsHide: false }).unref();
    return json(res, 200, { ok: true });
  }
  if (route === "proyecto") {
    const files = await listFiles(project.dir);
    const timeline = await readJson2(path2.join(project.dir, "timeline.json"), null);
    const videoMd = await fsp2.readFile(path2.join(project.dir, "video.md"), "utf8").catch(() => null);
    const tastePath = [path2.join(project.dir, ".opuscut", "taste.md"), path2.join(project.dir, "..", ".opuscut", "taste.md")].find((p) => fs2.existsSync(p));
    return json(res, 200, {
      dir: project.dir,
      name: project.name,
      entry: project.entry,
      timeline,
      files,
      fuentes: files.filter((f) => SOURCE_EXT.has(path2.extname(f).toLowerCase())),
      videoMd,
      gusto: tastePath ? await fsp2.readFile(tastePath, "utf8") : null,
      sonido: fs2.existsSync(path2.join(project.dir, "sound.py")),
      chat: { sessionId: chat.sessionId, ocupado: chat.busy }
    });
  }
  if (route === "fuente") {
    const full = safeJoin(project.dir, url.searchParams.get("file"));
    return json(res, 200, { file: url.searchParams.get("file"), text: await fsp2.readFile(full, "utf8") });
  }
  if (route === "literal" && method === "POST") {
    const full = safeJoin(project.dir, data.file);
    const text = await fsp2.readFile(full, "utf8");
    const lines = text.split("\n");
    const line = lines[data.line - 1];
    if (line == null || line.slice(data.col, data.col + data.old.length) !== data.old) return json(res, 409, { error: "The code changed. Select it again." });
    lines[data.line - 1] = line.slice(0, data.col) + data.value + line.slice(data.col + data.old.length);
    await fsp2.writeFile(full, lines.join("\n"));
    return json(res, 200, { ok: true });
  }
  if (route === "notas" && method === "GET") return json(res, 200, await notes());
  if (route === "notas" && method === "POST") {
    const list = await notes();
    const id = "n" + Date.now().toString(36);
    let cuadro = null;
    if (data.imagen) {
      const dir = path2.join(dataDir(), "cuadros");
      await fsp2.mkdir(dir, { recursive: true });
      const ext = /^data:image\/jpe?g/.test(data.imagen) ? "jpg" : /^data:image\/webp/.test(data.imagen) ? "webp" : "png";
      cuadro = `.estudio/cuadros/${id}.${ext}`;
      await fsp2.writeFile(path2.join(project.dir, cuadro), Buffer.from(data.imagen.split(",")[1], "base64"));
    }
    const nota = { id, estado: "abierta", creada: (/* @__PURE__ */ new Date()).toISOString(), autor: data.autor || "Sebasti\xE1n", ...data, imagen: void 0, cuadro };
    list.push(nota);
    await saveNotes(list);
    return json(res, 200, nota);
  }
  if (route.startsWith("notas/") && (method === "PATCH" || method === "DELETE")) {
    const id = route.slice(6);
    let list = await notes();
    if (method === "DELETE") list = list.filter((n) => n.id !== id);
    else list = list.map((n) => n.id === id ? { ...n, ...data, id } : n);
    await saveNotes(list);
    return json(res, 200, list.find((n) => n.id === id) || { ok: true });
  }
  if (route === "estado" && method === "GET") return json(res, 200, { proyecto: project.dir, ...live, conectado: [...clients].some((c) => c.readyState === 1) });
  if (route === "ui" && method === "POST") {
    try {
      return json(res, 200, await uiRequest(data.cmd, data, data.timeout || 3e4));
    } catch (e) {
      return json(res, 503, { error: e.message });
    }
  }
  if (route === "audio" && method === "POST") {
    try {
      await buildAudio();
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }
  if (route === "archivos" && method === "POST") {
    const name = path2.basename(decodeURIComponent(req.headers["x-nombre"] || "archivo"));
    const where = { assets: "assets", capturas: ".estudio/capturas", adjuntos: ".estudio/adjuntos" }[url.searchParams.get("destino")] || ".estudio/referencias";
    const full = safeJoin(project.dir, `${where}/${name}`);
    await fsp2.mkdir(path2.dirname(full), { recursive: true });
    await fsp2.writeFile(full, body);
    broadcast({ type: "archivos" });
    return json(res, 200, { ok: true, file: `${where}/${name}` });
  }
  if (route === "linea") {
    const tl = await readJson2(path2.join(project.dir, "timeline.json"), null);
    const ev = await readJson2(path2.join(dataDir(), "audio", "events.json"), null);
    const conf = await readJson2(path2.join(dataDir(), "config.json"), {});
    const et = conf.etiquetas || { pistas: {}, sonidos: {} };
    const pistas = {};
    for (const e of ev?.eventos || []) (pistas[e.bus] ||= { nombre: et.pistas[e.bus] || e.bus, eventos: [] }).eventos.push({ t: e.t, dur: e.dur, ganancia: e.gain, linea: e.line, nombre: et.sonidos[e.line] });
    if (!tl) {
      const v = live.video || {};
      return json(res, 200, { duracion: live.duracion || ev?.duracion || null, fps: v.fps || null, ancho: v.ancho || null, alto: v.alto || null, modo: v.modo || "libre", bpm: null, compases: null, escenas: [], silencios: ev?.silencios || [], pistas, sinTimeline: true });
    }
    return json(res, 200, { duracion: tl.beats * 60 / tl.bpm, fps: tl.fps, ancho: tl.width, alto: tl.height, modo: "opuscut", bpm: tl.bpm, compases: tl.beats / (tl.beats_per_bar || 4), escenas: (tl.scenes || []).map((s) => ({ id: s.id, desde: s.from * 60 / tl.bpm, hasta: s.to * 60 / tl.bpm })), silencios: ev?.silencios || [], pistas });
  }
  if (route === "textos/editar" && method === "POST") {
    const want = String(data.actual ?? ""), next = String(data.nuevo ?? "");
    const hits = [];
    for (const f of (await listFiles(project.dir)).filter((f2) => /\.(html|js|mjs|jsx|ts|tsx)$/i.test(f2))) {
      const lines2 = (await fsp2.readFile(path2.join(project.dir, f), "utf8")).split("\n");
      lines2.forEach((l, i) => {
        for (const m of l.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) if (m[2] === want && !(m[1] === "`" && m[2].includes("${"))) hits.push({ archivo: f, linea: i + 1, columna: m.index, quote: m[1] });
      });
    }
    const pick = data.linea ? hits.filter((h2) => h2.linea === +data.linea && (!data.archivo || h2.archivo === data.archivo)) : hits;
    if (!pick.length) return json(res, 404, { error: `Could not find the text "${want}" written in the code.`, coincidencias: hits });
    if (pick.length > 1) return json(res, 409, { error: "There are several matches. Say which one with file and line.", coincidencias: pick });
    const h = pick[0], full = path2.join(project.dir, h.archivo);
    const lines = (await fsp2.readFile(full, "utf8")).split("\n");
    const esc = next.replaceAll("\\", "\\\\").replaceAll(h.quote, "\\" + h.quote);
    lines[h.linea - 1] = lines[h.linea - 1].slice(0, h.columna) + h.quote + esc + h.quote + lines[h.linea - 1].slice(h.columna + want.length + 2);
    await fsp2.writeFile(full, lines.join("\n"));
    return json(res, 200, { ok: true, ...h });
  }
  if (route === "ruta" && method === "POST") {
    const ruta = path2.resolve(String(data.ruta || "").trim().replace(/^["']|["']$/g, "").replace(/^~(?=[\\/]|$)/, os2.homedir()));
    const st = await fsp2.stat(ruta).catch(() => null);
    return json(res, 200, st ? { existe: true, ruta, tipo: st.isDirectory() ? "carpeta" : "archivo", nombre: path2.basename(ruta), tamano: st.size } : { existe: false, ruta });
  }
  if (route === "adjunto/ruta" && method === "POST") {
    const ruta = path2.resolve(String(data.ruta || "").trim().replace(/^["']|["']$/g, ""));
    const st = await fsp2.stat(ruta).catch(() => null);
    if (!st || !st.isFile()) return json(res, 404, { error: `Could not find ${ruta}` });
    const dir = path2.join(dataDir(), "adjuntos");
    await fsp2.mkdir(dir, { recursive: true });
    const ext = path2.extname(ruta), stem = path2.basename(ruta, ext);
    let dst = path2.join(dir, stem + ext), n = 2;
    while (fs2.existsSync(dst)) dst = path2.join(dir, `${stem}-${n++}${ext}`);
    await fsp2.copyFile(ruta, dst);
    return json(res, 200, { file: path2.relative(project.dir, dst).split(path2.sep).join("/"), origen: ruta });
  }
  if (route === "importar" && method === "POST") {
    const where = { assets: "assets", referencias: ".estudio/referencias", adjuntos: ".estudio/adjuntos" }[data.destino] || "assets";
    const src = String(data.ruta || "").trim().replace(/^["']|["']$/g, "");
    let buf, name;
    if (/^https?:\/\//i.test(src)) {
      const r = await fetch(src, { headers: { "user-agent": "Kinora/0.5 (local video editor)" } });
      if (!r.ok) return json(res, 502, { error: `Could not download (${r.status}).` });
      buf = Buffer.from(await r.arrayBuffer());
      name = decodeURIComponent(new URL(src).pathname.split("/").pop() || "archivo");
    } else {
      const full = path2.resolve(src.replace(/^~(?=[\\/]|$)/, os2.homedir()));
      const st = await fsp2.stat(full).catch(() => null);
      if (!st || !st.isFile()) return json(res, 404, { error: `Could not find ${full}` });
      buf = await fsp2.readFile(full);
      name = path2.basename(full);
    }
    name = path2.basename(data.nombre || name).replace(/[<>:"/\\|?*]+/g, "-") || "archivo";
    const sub = data.carpeta ? String(data.carpeta).replace(/^[\\/]+|\.\./g, "") : "";
    const dir = safeJoin(project.dir, path2.posix.join(where, sub));
    await fsp2.mkdir(dir, { recursive: true });
    const ext = path2.extname(name), stem = path2.basename(name, ext);
    let dst = path2.join(dir, name), n = 2;
    while (fs2.existsSync(dst)) dst = path2.join(dir, `${stem}-${n++}${ext}`);
    await fsp2.writeFile(dst, buf);
    broadcast({ type: "archivos" });
    return json(res, 200, { file: path2.relative(project.dir, dst).split(path2.sep).join("/"), tamano: buf.length });
  }
  if (route === "adjunto/video" && method === "POST") {
    const full = safeJoin(project.dir, data.file);
    const probe = await new Promise((r) => execFile2("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", full], { windowsHide: true }, (e, out) => r(e ? null : JSON.parse(out))));
    if (!probe) return json(res, 400, { error: "Could not read the video." });
    const dur = +probe.format?.duration || 0, st = probe.streams?.[0] || {};
    const base = full.replace(/\.[^.]+$/, "");
    const dir = `${base}-cuadros`;
    await fsp2.mkdir(dir, { recursive: true });
    const n = dur > 30 ? 12 : dur > 8 ? 10 : 8;
    const cuadros = [];
    for (let i = 0; i < n; i++) {
      const t = dur * (i + 0.5) / n;
      const out = path2.join(dir, `${String(i + 1).padStart(2, "0")}-${t.toFixed(2)}s.jpg`);
      await new Promise((r) => execFile2("ffmpeg", ["-y", "-loglevel", "error", "-ss", t.toFixed(3), "-i", full, "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "3", out], { windowsHide: true }, () => r()));
      if (fs2.existsSync(out)) cuadros.push({ t: +t.toFixed(2), path: path2.relative(project.dir, out).split(path2.sep).join("/") });
    }
    const hoja = path2.join(dir, "hoja.jpg");
    const cols = n > 8 ? 4 : 4, rows = Math.ceil(n / cols);
    await new Promise((r) => execFile2("ffmpeg", ["-y", "-loglevel", "error", "-i", full, "-vf", `fps=${(n / Math.max(0.1, dur)).toFixed(4)},scale=480:-2,tile=${cols}x${rows}:padding=6:color=black`, "-frames:v", "1", "-q:v", "3", hoja], { windowsHide: true }, () => r()));
    return json(res, 200, { duracion: dur, ancho: st.width, alto: st.height, cuadros, hoja: fs2.existsSync(hoja) ? path2.relative(project.dir, hoja).split(path2.sep).join("/") : null });
  }
  if (route === "referencias") {
    const dir = path2.join(dataDir(), "referencias");
    const list = await fsp2.readdir(dir).catch(() => []);
    return json(res, 200, list.map((f) => `.estudio/referencias/${f}`));
  }
  if (route === "sonidos/buscar") {
    try {
      return json(res, 200, await searchSounds({ q: url.searchParams.get("q") || "", largo: url.searchParams.get("largo") ?? "shortest", tipo: url.searchParams.get("tipo") || "efecto", pagina: +(url.searchParams.get("pagina") || 1) }));
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }
  if (route === "sonidos/proxy") {
    const target = new URL(url.searchParams.get("url"));
    if (!/(^|\.)(freesound\.org|wikimedia\.org|jamendo\.com|incompetech\.com|openverse\.org)$/.test(target.hostname)) return json(res, 403, { error: "Source not allowed" });
    const r = await fetch(target, { headers: { "user-agent": "Kinora/0.5 (local video editor)", ...req.headers.range ? { range: req.headers.range } : {} } });
    const headers = { "content-type": r.headers.get("content-type") || "audio/mpeg", "cache-control": "max-age=86400", "accept-ranges": "bytes" };
    for (const h of ["content-length", "content-range"]) if (r.headers.get(h)) headers[h] = r.headers.get(h);
    res.writeHead(r.status, headers);
    const reader = r.body.getReader();
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
    return;
  }
  if (route === "sonidos/recomendados") {
    try {
      return json(res, 200, await recommendSounds({ tipo: url.searchParams.get("tipo") || "efecto", largo: url.searchParams.get("largo") || null }));
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }
  if (route === "sonidos/bajar" && method === "POST") {
    try {
      return json(res, 200, await downloadSound(data));
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }
  if (route === "generar" && method === "POST") {
    try {
      return json(res, 200, await generateImage(data));
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }
  if (route === "exportar" && method === "POST") {
    try {
      return json(res, 200, await exporter.start(data || {}));
    } catch (e) {
      return json(res, 409, { error: e.message });
    }
  }
  if (route === "exportar/cancelar" && method === "POST") {
    exporter.cancel();
    return json(res, 200, { ok: true });
  }
  if (route === "exportar/estado") return json(res, 200, exporter.state());
  if (route === "exportar/historial") return json(res, 200, await exporter.history());
  if (route === "exportar/abrir" && method === "POST") {
    if (!await exporter.known(data.ruta)) return json(res, 403, { error: "Unknown path" });
    if (data.carpeta) spawn2("explorer", ["/select,", data.ruta], { detached: true }).unref();
    else spawn2("cmd", ["/c", "start", "", data.ruta], { detached: true, windowsHide: true }).unref();
    return json(res, 200, { ok: true });
  }
  if (route === "exportar/archivo") {
    const ruta = url.searchParams.get("ruta");
    if (!await exporter.known(ruta)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const st = await fsp2.stat(ruta);
    const ext = path2.extname(ruta).toLowerCase();
    const headers = { "content-type": MIME[ext] || "application/octet-stream", "accept-ranges": "bytes" };
    const range = req.headers.range;
    if (range) {
      const [x, y] = range.slice(6).split("-");
      const start = +x || 0, end = y ? +y : st.size - 1;
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
      fs2.createReadStream(ruta, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "content-length": st.size });
    fs2.createReadStream(ruta).pipe(res);
    return;
  }
  if (route === "chat" && method === "POST") {
    startChat(data.texto, data.modelo, data.adjuntos || [], data.contexto || null);
    return json(res, 200, { ok: true });
  }
  if (route === "chat/vivo") return json(res, 200, chat.busy ? chat.live : null);
  if (route === "pregunta" && method === "POST") {
    const id = "q" + Date.now().toString(36);
    const q = { id, pregunta: data.pregunta, opciones: data.opciones || [], multiple: !!data.multiple, t: Date.now() };
    if (chat.live) {
      chat.live.pregunta = q;
      chat.live.estado = { tipo: "esperando" };
    }
    broadcast({ type: "chat", evento: { tipo: "pregunta", ...q } });
    const answer = await new Promise((resolve) => {
      preguntas.set(id, resolve);
      setTimeout(() => {
        if (preguntas.has(id)) {
          preguntas.delete(id);
          resolve(null);
        }
      }, 30 * 6e4);
    });
    if (chat.live) {
      chat.live.pregunta = null;
      chat.live.estado = { tipo: "pensando" };
    }
    broadcast({ type: "chat", evento: { tipo: "respondida", id, respuesta: answer } });
    await appendHistory({ tipo: "pregunta", ...q, respuesta: answer, t: Date.now() });
    return json(res, 200, answer == null ? { sinRespuesta: true } : { respuesta: answer });
  }
  if (route === "pregunta/responder" && method === "POST") {
    const resolve = preguntas.get(data.id);
    if (!resolve) return json(res, 404, { error: "That question is no longer open." });
    preguntas.delete(data.id);
    resolve(data.respuesta);
    return json(res, 200, { ok: true });
  }
  if (route === "chat/parar" && method === "POST") {
    if (chat.proc) {
      chat.stopped = true;
      if (process.platform === "win32") execFile2("taskkill", ["/pid", String(chat.proc.pid), "/T", "/F"], { windowsHide: true }, () => {
      });
      else chat.proc.kill("SIGTERM");
    }
    return json(res, 200, { ok: true });
  }
  if (route === "chat/nuevo" && method === "POST") {
    chat.sessionId = null;
    await writeJson(path2.join(dataDir(), "chat.json"), {});
    await writeJson(path2.join(dataDir(), "mensajes.json"), []);
    broadcast({ type: "chat", evento: { tipo: "nuevo" } });
    return json(res, 200, { ok: true });
  }
  if (route === "chat/historial") return json(res, 200, await readJson2(path2.join(dataDir(), "mensajes.json"), []));
  return json(res, 404, { error: "not found" });
}
var MODELOS = { opus: "claude-opus-5-5", fable: "claude-fable-5-1", sonnet: "claude-sonnet-5-5" };
async function appendHistory(entry) {
  const file = path2.join(dataDir(), "mensajes.json");
  const list = await readJson2(file, []);
  list.push(entry);
  await writeJson(file, list);
}
async function startChat(texto, modelo = "opus", adjuntos = [], ctxData = null) {
  if (chat.busy) {
    broadcast({ type: "chat", evento: { tipo: "error", texto: "Claude is still working." } });
    return;
  }
  chat.busy = true;
  chatRun++;
  const user = { tipo: "usuario", texto, adjuntos, contexto: ctxData, t: Date.now() };
  chat.live = { inicio: Date.now(), modelo, texto: "", herramientas: [], estado: { tipo: "pensando" }, tokens: 0, pregunta: null };
  await appendHistory(user);
  broadcast({ type: "chat", evento: user });
  const mcpConfig = path2.join(dataDir(), "mcp.json");
  await writeJson(mcpConfig, { mcpServers: { kinora: { command: process.execPath, args: [path2.join(HERE2, globalThis.KINORA_BUNDLE ? "kinora-mcp.js" : "mcp.js")], env: { ESTUDIO_URL: `http://127.0.0.1:${PORT}` } } } });
  const skill = await fsp2.readFile(path2.join(ROOT, "skills", "kinora", "SKILL.md"), "utf8").catch(() => "");
  const skills = (await activeSkills()).filter((x) => x.activa && !x.fija);
  const contexto = [
    skill.replace(/^---[\s\S]*?---\s*/, ""),
    skills.length ? `
## Active skills in this project
${skills.map((x) => `- ${x.name}: ${x.description} Read ${path2.join(x.dir, "SKILL.md")} before using it.`).join("\n")}` : "",
    `
## Current session
Project: ${project.dir}
The editor is open. What you see with the kinora tools is what the user sees right now. Reply in the language the user writes in, briefly.`
  ].join("\n");
  const argv = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    MODELOS[modelo] || modelo,
    "--mcp-config",
    mcpConfig,
    "--strict-mcp-config",
    "--append-system-prompt",
    contexto,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "mcp__kinora",
    "Read",
    "Edit",
    "Write",
    "Glob",
    "Grep",
    "Bash(python:*)",
    "Bash(ffmpeg:*)",
    "Bash(ffprobe:*)",
    "Bash(node:*)",
    "Bash(ls:*)"
  ];
  for (const x of skills) argv.push("--add-dir", x.dir);
  const extra = /* @__PURE__ */ new Set();
  for (const m of texto.matchAll(/(?:[A-Za-z]:[\\/]|\\\\)[^\s"'<>|*?]+/g)) {
    const p = m[0].replace(/[.,;:)\]]+$/, "");
    const st = await fsp2.stat(p).catch(() => null);
    if (st) extra.add(st.isDirectory() ? p : path2.dirname(p));
  }
  for (const a of adjuntos) if (a && typeof a === "object" && a.tipo === "carpeta" && a.ruta) extra.add(a.ruta);
  for (const d of extra) if (!d.startsWith(project.dir)) argv.push("--add-dir", d);
  if (chat.sessionId) argv.push("--resume", chat.sessionId);
  let prompt = texto + (ctxData ? `

[Editor context: ${JSON.stringify(ctxData)}]` : "");
  if (adjuntos.length) {
    const lines = adjuntos.map((a) => {
      if (typeof a === "string") return `- ${a}: look at it with Read.`;
      if (a.tipo === "imagen") return `- Image ${a.path}: look at it with Read.`;
      if (a.tipo === "video") return `- Video ${a.path}, ${a.info?.duracion ? a.info.duracion.toFixed(1) + " s" : ""}${a.info?.ancho ? `, ${a.info.ancho}\xD7${a.info.alto}` : ""}. You cannot play it: use Read on the contact sheet ${a.info?.hoja || ""} and the frames in order (${(a.info?.cuadros || []).map((c) => `${c.path} at ${c.t} s`).join(", ")}). If you need more detail, extract frames with ffmpeg.`;
      if (a.tipo === "audio") return `- Audio ${a.path}: you can measure it with ffprobe or ffmpeg.`;
      if (a.tipo === "carpeta") return `- Folder ${a.ruta}: you have read access. Explore it with Glob, Grep and Read if needed.`;
      return `- File ${a.path}: read it with Read.`;
    });
    prompt += `

The user attached (paths relative to the project):
${lines.join("\n")}`;
  }
  const proc = spawn2(process.env.CLAUDE_BIN || "claude", argv, { cwd: project.dir, windowsHide: true, env: { ...process.env, ESTUDIO_URL: `http://127.0.0.1:${PORT}`, MCP_TOOL_TIMEOUT: "1900000" } });
  chat.proc = proc;
  proc.stdin.end(prompt);
  let buf = "", texto_ = "", herramientas = [], msgId = "m0";
  const tokensBy = /* @__PURE__ */ new Map();
  const setState = (st) => {
    if (!chat.live) return;
    if (st) chat.live.estado = st;
    chat.live.tokens = [...tokensBy.values()].reduce((a, b) => a + b, 0);
    broadcast({ type: "chat", evento: { tipo: "estado", estado: chat.live.estado, tokens: chat.live.tokens } });
  };
  broadcast({ type: "chat", evento: { tipo: "inicio", modelo } });
  proc.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "system" && ev.subtype === "init" && ev.session_id) chat.sessionId = ev.session_id;
      if (ev.type === "stream_event") {
        const e = ev.event || {};
        if (e.type === "content_block_start") {
          const b = e.content_block || {};
          if (b.type === "thinking" || b.type === "redacted_thinking") setState({ tipo: "pensando" });
          else if (b.type === "text") setState({ tipo: "escribiendo" });
          else if (b.type === "tool_use") setState({ tipo: "herramienta", nombre: b.name });
        }
        if (e.type === "message_start" && e.message?.id) msgId = e.message.id;
        if (e.type === "message_delta" && e.usage?.output_tokens != null) {
          tokensBy.set(msgId, e.usage.output_tokens);
          setState(null);
        }
      }
      if (ev.type === "user" && (ev.message?.content || []).some((c) => c.type === "tool_result")) setState({ tipo: "pensando" });
      if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.type === "text_delta") {
        if (chat.live) chat.live.texto += ev.event.delta.text;
        broadcast({ type: "chat", evento: { tipo: "delta", texto: ev.event.delta.text } });
      }
      if (ev.type === "assistant") {
        for (const block of ev.message?.content || []) {
          if (block.type === "text") {
            texto_ += (texto_ ? "\n\n" : "") + block.text;
            if (chat.live) chat.live.texto = texto_ + "\n\n";
            broadcast({ type: "chat", evento: { tipo: "texto", texto: block.text } });
          }
          if (block.type === "tool_use") {
            const h = { nombre: block.name, entrada: block.input };
            setState({ tipo: "herramienta", nombre: block.name, entrada: block.input });
            herramientas.push(h);
            if (chat.live) chat.live.herramientas = herramientas.slice();
            broadcast({ type: "chat", evento: { tipo: "herramienta", ...h } });
          }
        }
      }
      if (ev.type === "result") {
        broadcast({ type: "chat", evento: { tipo: "costo", usd: ev.total_cost_usd, ms: ev.duration_ms, turnos: ev.num_turns } });
        finish(ev.is_error ? 1 : 0, ev.is_error ? String(ev.result || "") : "");
        setTimeout(() => {
          if (proc.exitCode === null) {
            if (process.platform === "win32") execFile2("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true }, () => {
            });
            else proc.kill();
          }
        }, 3e3);
      }
    }
  });
  let err = "";
  proc.stderr.on("data", (c) => {
    err += c.toString("utf8");
  });
  let finished = false;
  const finish = async (code, why = "") => {
    if (finished) return;
    finished = true;
    const stopped = chat.stopped;
    chat.stopped = false;
    chat.busy = false;
    chat.proc = null;
    chat.live = null;
    for (const [id, resolve] of preguntas) {
      preguntas.delete(id);
      resolve(null);
    }
    await writeJson(path2.join(dataDir(), "chat.json"), { sessionId: chat.sessionId });
    const fin = { tipo: "claude", texto: texto_, herramientas, t: Date.now(), detenido: stopped || void 0, error: !stopped && code ? why || err.trim().split("\n").slice(-3).join("\n") || `exited with ${code}` : null };
    await appendHistory(fin);
    broadcast({ type: "chat", evento: { ...fin, tipo: "fin" } });
  };
  proc.on("close", (code) => finish(code));
}
async function main() {
  const target = positional[0] || process.env.ESTUDIO_PROYECTO;
  if (target) await openProject(target).catch((e) => console.warn(e.message));
  let vite = null;
  if (!PROD || !fs2.existsSync(path2.join(ROOT, "ui", "dist", "index.html"))) {
    const { createServer } = await import("vite");
    vite = await createServer({ root: path2.join(ROOT, "ui"), configFile: path2.join(ROOT, "ui", "vite.config.js"), server: { middlewareMode: true, hmr: { port: PORT + 1 } }, appType: "spa" });
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname === "/__estudio/probe.js") {
        res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
        res.end(await fsp2.readFile(path2.join(HERE2, "probe.js")));
        return;
      }
      if (url.pathname === "/llms.txt" || url.pathname === "/AGENTS.md") {
        res.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
        res.end(await fsp2.readFile(path2.join(ROOT, url.pathname === "/llms.txt" ? "llms.txt" : "AGENTS.md")).catch(() => ""));
        return;
      }
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (url.pathname.startsWith("/proyecto/")) {
        if (!project) {
          res.writeHead(404);
          res.end();
          return;
        }
        return await serveProject(req, res, url.pathname.slice("/proyecto/".length));
      }
      if (vite) return vite.middlewares(req, res);
      const file = safeJoin(path2.join(ROOT, "ui", "dist"), url.pathname === "/" ? "index.html" : url.pathname);
      const ok = fs2.existsSync(file) && fs2.statSync(file).isFile();
      const f = ok ? file : path2.join(ROOT, "ui", "dist", "index.html");
      res.writeHead(200, { "content-type": MIME[path2.extname(f)] || "application/octet-stream" });
      fs2.createReadStream(f).pipe(res);
    } catch (e) {
      console.error(e);
      json(res, 500, { error: e.message });
    }
  });
  const wss = new import_websocket_server.default({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type === "estado") live = { ...live, ...msg.estado, actualizado: Date.now() };
      if (msg.type === "respuesta" && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.data);
      }
    });
  });
  server.listen(PORT, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`Kinora at ${url}`);
    if (OPEN) spawn2("cmd", ["/c", "start", "", url], { detached: true, windowsHide: true }).unref();
  });
}
main();

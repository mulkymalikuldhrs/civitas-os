// CIVITAS OS — audio guard untuk klien Minecraft web (v1.5)
// Headless/browser tanpa codec: decodeAudioData gagal (EncodingError) dan
// unhandledrejection mematikan klien. Guard ini membuat dekode suara yang gagal
// mengembalikan AudioBuffer ASLI berisi sunyi (ctx.createBuffer) sehingga kode
// pemakai (THREE.Audio / AudioBufferSourceNode) tetap valid. Tanpa suara > tanpa dunia.
(function () {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !AC.prototype || !AC.prototype.decodeAudioData) return;
    var orig = AC.prototype.decodeAudioData;
    AC.prototype.decodeAudioData = function (buf, ok, err) {
      var ctx = this;
      var silent = function () {
        try {
          var ab = ctx.createBuffer(1, 1, 22050);
          return ab;
        } catch (_) {
          return { duration: 0, length: 0, sampleRate: 22050, numberOfChannels: 1, getChannelData: function () { return new Float32Array(0); } };
        }
      };
      var res;
      try {
        res = orig.call(ctx, buf, function (b) { if (ok) ok(b); }, function (e) { if (err) err(e); });
      } catch (e) {
        var d0 = silent();
        if (ok) try { ok(d0); } catch (_) {}
        return Promise.resolve(d0);
      }
      if (res && typeof res.then === "function") {
        return res.then(null, function () {
          var d1 = silent();
          try { if (ok) ok(d1); } catch (_) {}
          return d1;
        });
      }
      return res;
    };
  } catch (_) { /* jaga-jaga */ }
})();

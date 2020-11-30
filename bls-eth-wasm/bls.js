import wasmCode from './bls_c.wasm';

(generator => {
  if (typeof exports === 'object') {
    const crypto = require('crypto')
    crypto.getRandomValues = crypto.randomFillSync
    generator(exports, crypto, true)
  } else {
    const crypto = window.crypto || window.msCrypto
    const exports = {}
    window.bls = generator(exports, crypto, false)
  }
})((exports, crypto, isNodeJs) => {
  /* eslint-disable */
  exports.BLS12_381 = 5

  const setup = (exports) => {
    const mod = exports.mod
    const MCLBN_FP_UNIT_SIZE = 6
    const MCLBN_FR_UNIT_SIZE = 4
    const BLS_COMPILER_TIME_VAR_ADJ = 200
    const MCLBN_COMPILED_TIME_VAR = (MCLBN_FR_UNIT_SIZE * 10 + MCLBN_FP_UNIT_SIZE) + BLS_COMPILER_TIME_VAR_ADJ
    const BLS_ID_SIZE = MCLBN_FR_UNIT_SIZE * 8
    const BLS_SECRETKEY_SIZE = MCLBN_FP_UNIT_SIZE * 8
    const BLS_PUBLICKEY_SIZE = BLS_SECRETKEY_SIZE * 3
    const BLS_SIGNATURE_SIZE = BLS_SECRETKEY_SIZE * 3 * 2
    const MSG_SIZE = 32
    exports.MSG_SIZE = MSG_SIZE

    const _malloc = size => {
      return mod._blsMalloc(size)
    }
    const _free = pos => {
      mod._blsFree(pos)
    }
    const ptrToAsciiStr = (pos, n) => {
      let s = ''
      for (let i = 0; i < n; i++) {
        s += String.fromCharCode(mod.HEAP8[pos + i])
      }
      return s
    }
    const asciiStrToPtr = (pos, s) => {
      for (let i = 0; i < s.length; i++) {
        mod.HEAP8[pos + i] = s.charCodeAt(i)
      }
    }
    exports.toHex = (a, start, n) => {
      let s = ''
      for (let i = 0; i < n; i++) {
        s += ('0' + a[start + i].toString(16)).slice(-2)
      }
      return s
    }
    // Uint8Array to hex string
    exports.toHexStr = a => {
      return exports.toHex(a, 0, a.length)
    }
    // hex string to Uint8Array
    exports.fromHexStr = s => {
      if (s.length & 1) throw new Error('fromHexStr:length must be even ' + s.length)
      const n = s.length / 2
      const a = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        a[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
      }
      return a
    }
///////////////////////////
    const copyToUint32Array = (a, pos) => {
      a.set(mod.HEAP32.subarray(pos / 4, pos / 4 + a.length))
//    for (let i = 0; i < a.length; i++) {
//      a[i] = mod.HEAP32[pos / 4 + i]
//    }
    }
    const copyFromUint32Array = (pos, a) => {
      for (let i = 0; i < a.length; i++) {
        mod.HEAP32[pos / 4 + i] = a[i]
      }
    }
//////////////////////////////////
    const _wrapGetStr = (func, returnAsStr = true) => {
      return (x, ioMode = 0) => {
        const maxBufSize = 3096
        const pos = _malloc(maxBufSize)
        const n = func(pos, maxBufSize, x, ioMode)
        if (n <= 0) {
          throw new Error('err gen_str:' + x)
        }
        let s = null
        if (returnAsStr) {
          s = ptrToAsciiStr(pos, n)
        } else {
          s = new Uint8Array(mod.HEAP8.subarray(pos, pos + n))
        }
        _free(pos)
        return s
      }
    }
    const _wrapSerialize = func => {
      return _wrapGetStr(func, false)
    }
    const _wrapDeserialize = func => {
      return (x, buf) => {
        const pos = _malloc(buf.length)
        mod.HEAP8.set(buf, pos)
        const r = func(x, pos, buf.length)
        _free(pos)
        if (r === 0) throw new Error('err _wrapDeserialize', buf)
      }
    }
    /*
      argNum : n
      func(x0, ..., x_(n-1), buf, ioMode)
      => func(x0, ..., x_(n-1), pos, buf.length, ioMode)
    */
    const _wrapInput = (func, argNum, returnValue = false) => {
      return function () {
        const args = [...arguments]
        const buf = args[argNum]
        const typeStr = Object.prototype.toString.apply(buf)
        if (['[object String]', '[object Uint8Array]', '[object Array]'].indexOf(typeStr) < 0) {
          throw new Error(`err bad type:"${typeStr}". Use String or Uint8Array.`)
        }
        const ioMode = args[argNum + 1] // may undefined
        const pos = _malloc(buf.length)
        if (typeStr === '[object String]') {
          asciiStrToPtr(pos, buf)
        } else {
          mod.HEAP8.set(buf, pos)
        }
        const r = func(...args.slice(0, argNum), pos, buf.length, ioMode)
        _free(pos)
        if (returnValue) return r
        if (r) throw new Error('err _wrapInput ' + buf)
      }
    }
    const callSetter = (func, a, p1, p2) => {
      const pos = _malloc(a.length * 4)
      func(pos, p1, p2) // p1, p2 may be undefined
      copyToUint32Array(a, pos)
      _free(pos)
    }
    const callGetter = (func, a, p1, p2) => {
      const pos = _malloc(a.length * 4)
      mod.HEAP32.set(a, pos / 4)
      const s = func(pos, p1, p2)
      _free(pos)
      return s
    }
    const callShare = (func, a, size, vec, id) => {
      const pos = a._allocAndCopy()
      const idPos = id._allocAndCopy()
      const vecPos = _malloc(size * vec.length)
      for (let i = 0; i < vec.length; i++) {
        copyFromUint32Array(vecPos + size * i, vec[i].a_)
      }
      func(pos, vecPos, vec.length, idPos)
      _free(vecPos)
      _free(idPos)
      a._saveAndFree(pos)
    }
    const callRecover = (func, a, size, vec, idVec) => {
      const n = vec.length
      if (n !== idVec.length) throw ('recover:bad length')
      const secPos = a._alloc()
      const vecPos = _malloc(size * n)
      const idVecPos = _malloc(BLS_ID_SIZE * n)
      for (let i = 0; i < n; i++) {
        copyFromUint32Array(vecPos + size * i, vec[i].a_)
        copyFromUint32Array(idVecPos + BLS_ID_SIZE * i, idVec[i].a_)
      }
      func(secPos, vecPos, idVecPos, n)
      _free(idVecPos)
      _free(vecPos)
      a._saveAndFree(secPos)
    }

    // change curveType
    exports.blsInit = () => {
      const r = mod._blsInit(exports.BLS12_381, MCLBN_COMPILED_TIME_VAR)
      if (r) throw ('blsInit err ' + r)

      //https://github.com/herumi/bls/blob/master/include/bls/bls.h#L106
      const r2 = mod._blsSetETHmode(3);
      if (r2) throw ('blsSetEthMode err ' + r2)
    }
    exports.getCurveOrder = _wrapGetStr(mod._blsGetCurveOrder)
    exports.getFieldOrder = _wrapGetStr(mod._blsGetFieldOrder)

    exports.shouldVerifyBlsSignatureOrder = _wrapInput(mod._blsSignatureVerifyOrder, 0);
    exports.shouldVerifyBlsPublicKeyOrder = _wrapInput(mod._blsPublicKeyVerifyOrder, 0);

    mod.blsSecretKeySerialize = _wrapSerialize(mod._blsSecretKeySerialize)
    mod.blsPublicKeySerialize = _wrapSerialize(mod._blsPublicKeySerialize)
    mod.blsSignatureSerialize = _wrapSerialize(mod._blsSignatureSerialize)

    mod.blsSecretKeyDeserialize = _wrapDeserialize(mod._blsSecretKeyDeserialize)
    mod.blsPublicKeyDeserialize = _wrapDeserialize(mod._blsPublicKeyDeserialize)
    mod.blsSignatureDeserialize = _wrapDeserialize(mod._blsSignatureDeserialize)

    mod.blsPublicKeySerializeUncompressed = _wrapSerialize(mod._blsPublicKeySerializeUncompressed)
    mod.blsSignatureSerializeUncompressed = _wrapSerialize(mod._blsSignatureSerializeUncompressed)
    mod.blsPublicKeyDeserializeUncompressed = _wrapDeserialize(mod._blsPublicKeyDeserializeUncompressed)
    mod.blsSignatureDeserializeUncompressed = _wrapDeserialize(mod._blsSignatureDeserializeUncompressed)

    mod.blsSecretKeySetLittleEndian = _wrapInput(mod._blsSecretKeySetLittleEndian, 1)
    mod.blsHashToSecretKey = _wrapInput(mod._blsHashToSecretKey, 1)
    mod.blsSign = _wrapInput(mod._blsSign, 2)
    mod.blsVerify = _wrapInput(mod._blsVerify, 2, true)

    class Common {
      constructor (size) {
        this.a_ = new Uint32Array(size / 4)
      }
      deserializeHexStr (s) {
        this.deserialize(exports.fromHexStr(s))
      }
      serializeToHexStr () {
        return exports.toHexStr(this.serialize())
      }
      dump (msg = '') {
        console.log(msg + this.serializeToHexStr())
      }
      clear () {
        this.a_.fill(0)
      }

      clone() {
        const copy = new this.constructor();
        copy.a_ = this.a_.slice(0);
        return copy;
      }
      // alloc new array
      _alloc () {
        return _malloc(this.a_.length * 4)
      }
      // alloc and copy a_ to mod.HEAP32[pos / 4]
      _allocAndCopy () {
        const pos = this._alloc()
        mod.HEAP32.set(this.a_, pos / 4)
        return pos
      }
      // save pos to a_
      _save (pos) {
        this.a_.set(mod.HEAP32.subarray(pos / 4, pos / 4 + this.a_.length))
      }
      // save and free
      _saveAndFree(pos) {
        this._save(pos)
        _free(pos)
      }
      // set parameter (p1, p2 may be undefined)
      _setter (func, p1, p2) {
        const pos = this._alloc()
        const r = func(pos, p1, p2)
        this._saveAndFree(pos)
        if (r) throw new Error('_setter err')
      }
      // getter (p1, p2 may be undefined)
      _getter (func, p1, p2) {
        const pos = this._allocAndCopy()
        const s = func(pos, p1, p2)
        _free(pos)
        return s
      }
      _isEqual (func, rhs) {
        const xPos = this._allocAndCopy()
        const yPos = rhs._allocAndCopy()
        const r = func(xPos, yPos)
        _free(yPos)
        _free(xPos)
        return r === 1
      }
      // func(y, this) and return y
      _op1 (func) {
        const y = new this.constructor()
        const xPos = this._allocAndCopy()
        const yPos = y._alloc()
        func(yPos, xPos)
        y._saveAndFree(yPos)
        _free(xPos)
        return y
      }
      // func(z, this, y) and return z
      _op2 (func, y, Cstr = null) {
        const z = Cstr ? new Cstr() : new this.constructor()
        const xPos = this._allocAndCopy()
        const yPos = y._allocAndCopy()
        const zPos = z._alloc()
        func(zPos, xPos, yPos)
        z._saveAndFree(zPos)
        _free(yPos)
        _free(xPos)
        return z
      }
      // func(self, y)
      _update (func, y) {
        const xPos = this._allocAndCopy()
        const yPos = y._allocAndCopy()
        func(xPos, yPos)
        this._saveAndFree(xPos)
        _free(yPos)
        _free(xPos)
      }
    }

    exports.SecretKey = class extends Common {
      constructor () {
        super(BLS_SECRETKEY_SIZE)
      }
      setInt (x) {
        this._setter(mod._blsIdSetInt, x) // same as Id
      }
      isEqual (rhs) {
        return this._isEqual(mod._blsSecretKeyIsEqual, rhs)
      }
      deserialize (s) {
        this._setter(mod.blsSecretKeyDeserialize, s)
      }
      serialize () {
        return this._getter(mod.blsSecretKeySerialize)
      }
      add (rhs) {
        this._update(mod._blsSecretKeyAdd, rhs)
      }
      share (msk, id) {
        callShare(mod._blsSecretKeyShare, this, BLS_SECRETKEY_SIZE, msk, id)
      }
      recover (secVec, idVec) {
        callRecover(mod._blsSecretKeyRecover, this, BLS_SECRETKEY_SIZE, secVec, idVec)
      }
      setHashOf (s) {
        this._setter(mod.blsHashToSecretKey, s)
      }
      setLittleEndian (s) {
        this._setter(mod.blsSecretKeySetLittleEndian, s)
      }
      setByCSPRNG () {
        const a = new Uint8Array(BLS_SECRETKEY_SIZE)
        crypto.getRandomValues(a)
        this.setLittleEndian(a)
      }
      getPublicKey () {
        const pub = new exports.PublicKey()
        const secPos = this._allocAndCopy()
        const pubPos = pub._alloc()
        mod._blsGetPublicKey(pubPos, secPos)
        pub._saveAndFree(pubPos)
        _free(secPos)
        return pub
      }
      /*
        input
        m : message (string or Uint8Array)
        return
        BlsSignature
      */
      sign (m) {
        const sig = new exports.Signature()
        const secPos = this._allocAndCopy()
        const sigPos = sig._alloc()
        mod.blsSign(sigPos, secPos, m)
        sig._saveAndFree(sigPos)
        _free(secPos)
        return sig
      }
      /*
        input
        m : message (40 bytes Uint8Array)
        return
        BlsSignature
      */
      signHashWithDomain (m) {
        if (m.length !== MSG_SIZE) throw new Error(`bad size message:${m.length}`)
        const sig = new exports.Signature()
        const secPos = this._allocAndCopy()
        const sigPos = sig._alloc()
        const mPos = _malloc(MSG_SIZE)
        mod.HEAP8.set(m, mPos)
        mod._blsSignHashWithDomain(sigPos, secPos, mPos)
        _free(mPos)
        sig._saveAndFree(sigPos)
        _free(secPos)
        return sig
      }
    }
    exports.deserializeHexStrToSecretKey = s => {
      const r = new exports.SecretKey()
      r.deserializeHexStr(s)
      return r
    }

    exports.PublicKey = class extends Common {
      constructor () {
        super(BLS_PUBLICKEY_SIZE)
      }
      isEqual (rhs) {
        return this._isEqual(mod._blsPublicKeyIsEqual, rhs)
      }
      deserialize (s) {
        this._setter(mod.blsPublicKeyDeserialize, s)
      }
      deserializeUncompressed (s) {
        this._setter(mod.blsPublicKeyDeserializeUncompressed, s)
      }
      serialize () {
        return this._getter(mod.blsPublicKeySerialize)
      }
      serializeUncompressed () {
        return this._getter(mod.blsPublicKeySerializeUncompressed)
      }
      deserializeUncompressedHexStr (s) {
        this.deserializeUncompressed(exports.fromHexStr(s))
      }
      serializeUncompressedToHexStr () {
        return exports.toHexStr(this.serializeUncompressed())
      }
      isValidOrder () {
        return this._getter(mod._blsPublicKeyIsValidOrder)
      }
      add (rhs) {
        this._update(mod._blsPublicKeyAdd, rhs)
      }
      share (msk, id) {
        callShare(mod._blsPublicKeyShare, this, BLS_PUBLICKEY_SIZE, msk, id)
      }
      recover (secVec, idVec) {
        callRecover(mod._blsPublicKeyRecover, this, BLS_PUBLICKEY_SIZE, secVec, idVec)
      }
      verify (sig, m) {
        const pubPos = this._allocAndCopy()
        const sigPos = sig._allocAndCopy()
        const r = mod.blsVerify(sigPos, pubPos, m)
        _free(sigPos)
        _free(pubPos)
        return r !== 0
      }
      verifyHashWithDomain (sig, m) {
        if (m.length !== MSG_SIZE) return false
        const pubPos = this._allocAndCopy()
        const sigPos = sig._allocAndCopy()
        const mPos = _malloc(MSG_SIZE)
        mod.HEAP8.set(m, mPos)
        const r = mod._blsVerifyHashWithDomain(sigPos, pubPos, mPos)
        _free(mPos)
        _free(sigPos)
        _free(pubPos)
        return r !== 0
      }
    }
    exports.deserializeHexStrToPublicKey = s => {
      const r = new exports.PublicKey()
      r.deserializeHexStr(s)
      return r
    }
    exports.deserializeUncompressedHexStrToPublicKey = s => {
      const r = new exports.PublicKey()
      r.deserializeUncompressedHexStr(s)
      return r
    }

    exports.Signature = class extends Common {
      constructor () {
        super(BLS_SIGNATURE_SIZE)
      }
      isEqual (rhs) {
        return this._isEqual(mod._blsSignatureIsEqual, rhs)
      }
      deserialize (s) {
        this._setter(mod.blsSignatureDeserialize, s)
      }
      deserializeUncompressed (s) {
        this._setter(mod.blsSignatureDeserializeUncompressed, s)
      }
      serialize () {
        return this._getter(mod.blsSignatureSerialize)
      }
      serializeUncompressed () {
        return this._getter(mod.blsSignatureSerializeUncompressed)
      }
      deserializeUncompressedHexStr (s) {
        this.deserializeUncompressed(exports.fromHexStr(s))
      }
      serializeUncompressedToHexStr () {
        return exports.toHexStr(this.serializeUncompressed())
      }
      isValidOrder () {
        return this._getter(mod._blsSignatureIsValidOrder)
      }
      add (rhs) {
        this._update(mod._blsSignatureAdd, rhs)
      }
      recover (secVec, idVec) {
        callRecover(mod._blsSignatureRecover, this, BLS_SIGNATURE_SIZE, secVec, idVec)
      }
      // this = aggSig
      aggregate (sigVec) {
        const n = sigVec.length
        const aggSigPos = this._allocAndCopy()
        const sigVecPos = _malloc(BLS_SIGNATURE_SIZE * n)
        for (let i = 0; i < n; i++) {
          mod.HEAP32.set(sigVec[i].a_, (sigVecPos + BLS_SIGNATURE_SIZE * i) / 4)
        }
        const r = mod._blsAggregateSignature(aggSigPos, sigVecPos, n)
        _free(sigVecPos)
        this._saveAndFree(aggSigPos)
        return r === 1
      }

      // this = aggSig
      fastAggregateVerify (pubVec, msg) {
        const n = pubVec.length
        const msgSize = msg.length
        const aggSigPos = this._allocAndCopy()
        const pubVecPos = _malloc(BLS_PUBLICKEY_SIZE * n)
        const msgPos = _malloc(msgSize)
        for (let i = 0; i < n; i++) {
          mod.HEAP32.set(pubVec[i].a_, (pubVecPos + BLS_PUBLICKEY_SIZE * i) / 4)
        }
        mod.HEAP8.set(msg, msgPos)
        const r = mod._blsFastAggregateVerify(aggSigPos, pubVecPos, n, msgPos, msgSize)
        _free(msgPos)
        _free(pubVecPos)
        _free(aggSigPos)
        return r === 1
      }

      // this = aggSig
      // msgVec = (32 * pubVec.length)-size Uint8Array
      aggregateVerifyNoCheck (pubVec, msgVec) {
        const n = pubVec.length
        if (n === 0 || msgVec.length !== MSG_SIZE * n) {
          return false
        }
        const aggSigPos = this._allocAndCopy()
        const pubVecPos = _malloc(BLS_PUBLICKEY_SIZE * n)
        const msgPos = _malloc(msgVec.length)
        for (let i = 0; i < n; i++) {
          mod.HEAP32.set(pubVec[i].a_, (pubVecPos + BLS_PUBLICKEY_SIZE * i) / 4)
        }
        mod.HEAP8.set(msgVec, msgPos)
        const r = mod._blsAggregateVerifyNoCheck(aggSigPos, pubVecPos, msgPos, MSG_SIZE, n)
        _free(msgPos)
        _free(pubVecPos)
        _free(aggSigPos)
        return r === 1
      }
    }
    exports.deserializeHexStrToSignature = s => {
      const r = new exports.Signature()
      r.deserializeHexStr(s)
      return r
    }
    // make setter check the correctness of the order if doVerify
    exports.verifySignatureOrder = (doVerify) => {
      mod._blsSignatureVerifyOrder(doVerify)
    }
    // make setter check the correctness of the order if doVerify
    exports.verifyPublicKeyOrder = (doVerify) => {
      mod._blsPublicKeyVerifyOrder(doVerify)
    }
    exports.areAllMsgDifferent = (msgs, msgSize = MSG_SIZE) => {
      const n = msgs.length / msgSize
      if (msgs.length !== n * msgSize) return false
      const h = {}
      for (let i = 0; i < n; i++) {
        const m = msgs.subarray(i * msgSize, (i + 1) * msgSize)
        if (m in h) return false
        h[m] = true
      }
      return true
    }
    exports.blsInit()
  } // setup()
  const _cryptoGetRandomValues = function(p, n) {
    const a = new Uint8Array(n)
    crypto.getRandomValues(a)
    for (let i = 0; i < n; i++) {
      exports.mod.HEAP8[p + i] = a[i]
    }
  }
  exports.init = () => {
    exports.curveType = exports.BLS12_381
    return new Promise(resolve => {
      const wasmBinary = Buffer.from(wasmCode, "binary");
      try {
        const js = require('./bls_c.js');

        const Module = {
          cryptoGetRandomValues: _cryptoGetRandomValues,
          wasmBinary: wasmBinary,
        };
        js(Module).then(_mod => {
          exports.mod = _mod;
          setup(exports, exports.curveType);
          resolve();
        });
      } catch (e) {
        exports.mod = Module()
        exports.mod.cryptoGetRandomValues = _cryptoGetRandomValues
        exports.mod.wasmBinary = wasmBinary;
        exports.mod.onRuntimeInitialized = () => {
          setup(exports, exports.curveType)
          resolve()
        }
      }
    })
  }

  return exports
})

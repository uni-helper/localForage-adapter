import serializer from "localforage/src/utils/serializer";
import executeCallback from "localforage/src/utils/executeCallback";
import normalizeKey from 'localforage/src/utils/normalizeKey';

/**
 * @description 在此库中定义uni是什么（uni-app的全局对象）
 */
declare const uni: any;

function getKeyPrefix(options, defaultConfig) {
  var keyPrefix = options.name + '/';

  if (options.storeName !== defaultConfig.storeName) {
    keyPrefix += options.storeName + '/';
  }
  return keyPrefix;
}

/**
 * @description 是否支持使用uniStorage方式进行存储
 * @return {Boolean} true 支持 false 不支持
 */
function support(): boolean {
  try {
    return (
      typeof uni !== 'undefined' &&
      'setStorage' in uni &&
      // in IE8 typeof localStorage.setItem === 'object'
      !!uni.setStorage
    );
  } catch (e) {
    return false;
  }
}

/**
 * @description 初始化storage
 * @param options
 */
function initStorage(options) {
  var self = this;
  var dbInfo: any = {}
  if (options) {
    for (let i in options) {
      dbInfo[i] = options[i]
    }
  }

  dbInfo.keyPrefix = getKeyPrefix(options, self._defaultConfig);

  if (!support()) {
    return Promise.reject('当前环境不支持uniStorage');
  }

  self._dbInfo = dbInfo;
  dbInfo.serializer = serializer;

  return Promise.resolve();
}

/**
 * @description 清空当前库的所有数据
 * @param callback 
 */
function clear(callback) {
  var self = this;
  var promise = self.ready().then(function () {
    var keyPrefix = self._dbInfo.keyPrefix;
    try {
      const res = uni.clearStorageSync();
      const keys = res.keys

      for (var i = keys.length - 1; i >= 0; i--) {
        if (keys[i].indexOf(keyPrefix) === 0) {
          uni.removeStorageSync(keys[i]);
        }
      }
    } catch (e) {
      console.log(e)
    }
  });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取当前库的所有数据
 * @param key 
 * @param callback 
 * @returns 
 */
function getItem(key, callback) {
  var self = this;

  key = normalizeKey(key);

  var promise = self.ready().then(function () {
    var dbInfo = self._dbInfo;
    try {
      var result = uni.getStorageSync(dbInfo.keyPrefix + key);

      if (result) {
        result = dbInfo.serializer.deserialize(result);
      }

      return result;
    } catch (e) {
      return undefined
    }
  });

  executeCallback(promise, callback);
  return promise;
}

function iterate(iterator, callback) {
  var self = this;

  var promise = self.ready().then(function () {
    var keyPrefix = self._dbInfo.keyPrefix;
    var keyPrefixLength = keyPrefix.length;
    var length = uni.getStorageInfoSync().keys.length;
    var keys = uni.getStorageInfoSync().keys;
    var iterationNumber = 1;

    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (key.indexOf(keyPrefix) !== 0) {
        continue;
      }
      var value = uni.getStorageSync(key);

      if (value) {
        value = self._dbInfo.serializer.deserialize(value);
      }

      value = iterator(value, key.substring(keyPrefixLength), iterationNumber++);

      if (value !== void 0) {
        return value;
      }
    }
  });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 最终的驱动器成品
 */
export const uniStorageDriver = {
  //我们的名字
  _driver: 'uniStorageDriver',
  // 是否支持
  _support: support,
  _initStorage: initStorage,
  clear: clear,
  getItem: getItem,
}

export default uniStorageDriver;
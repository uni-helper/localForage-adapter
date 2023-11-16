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

/**
 * @description 迭代当前库的所有数据
 * @param iterator 
 * @param callback 
 * @returns 
 */
function iterate(iterator, callback) {
  var self = this;

  var promise = self.ready().then(function () {
    var keyPrefix = self._dbInfo.keyPrefix;
    var keyPrefixLength = keyPrefix.length;
    var keys = uni.getStorageInfoSync().keys;
    var length = keys.length;

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
 * @description 获取当前库的所有key
 * @param n 
 * @param callback 
 * @returns 
 */
function key(n, callback) {
  var self = this;
  var promise = self.ready().then(function () {
    var dbInfo = self._dbInfo;
    var result;
    try {
      result = uni.getStorageInfoSync().keys[n];
    } catch (e) {
      result = null;
    }

    if (result) {
      result = result.substring(dbInfo.keyPrefix.length);
    }

    return result;
  });
  executeCallback(promise, callback);
  return promise;

}

/**
 * @description 获取当前库的所有key（数组）
 * @param callback 
 * @returns 
 */
function keys(callback) {
  var self = this;
  var promise = self.ready().then(function () {
    var dbInfo = self._dbInfo;
    var keyPrefix = dbInfo.keyPrefix;
    var keys = uni.getStorageInfoSync().keys;
    var length = keys.length;
    var result: any[] = [];

    for (var i = 0; i < length; i++) {
      var itemKey = keys[i];
      if (itemKey.indexOf(keyPrefix) === 0) {
        result.push(itemKey.substring(keyPrefix.length));
      }
    }

    return result;
  });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取当前库的所有key的数量
 * @param callback 
 * @returns 
 */
function length(callback) {
  var self = this;
  var promise = self.keys().then(function (keys) {
    return keys.length;
  });

  executeCallback(promise, callback);
  return promise;
}

function removeItem(key, callback) {
  var self = this;

  key = normalizeKey(key);
  var promise = self.ready().then(function () {
    var dbInfo = self._dbInfo;
    try {
      uni.removeStorageSync(dbInfo.keyPrefix + key);
    } catch (e) {
      console.log(e)
    }
  });

  executeCallback(promise, callback);
  return promise;

}

/**
 * @description 存储一个key-value
 * @param key 
 * @param value 
 * @param callback 
 * @returns 
 */
function setItem(key, value, callback) {
  var self = this;

  key = normalizeKey(key);
  var promise = self.ready().then(function () {
    if (value === undefined) {
      value = null
    }

    var originalValue = value;

    return new Promise(function (resolve, reject) {
      var dbInfo = self._dbInfo;
      dbInfo.serializer.serialize(value, function (value, error) {
        if (error) {
          reject(error)
        } else {
          try {
            uni.setStorageSync(dbInfo.keyPrefix + key, value);
            resolve(originalValue)
          } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              reject(e)
            }
            reject(e)
          }
        }
      })
    })
  });

  executeCallback(promise, callback);
  return promise;
}

function dropInstance(options, callback) {
  callback = executeCallback(callback);

  var currentConfig = this.config();
  options = typeof options !== 'function' && options || {};
  if (!options.name) {
    options.name = options.name || currentConfig.name;
    options.storeName = options.storeName || currentConfig.storeName;
  }

  var self = this;
  var promise;
  if (!options.name) {
    promise = Promise.reject('没有指定库的名称');
  } else {
    promise = new Promise(function (resolve) {
      if (!options.storeName) {
        resolve(`${options.name}/`);
      } else {
        resolve(getKeyPrefix(options, self._defaultConfig));
      }
    }).then(function (keyPrefix) {
      try {
        for (var i = uni.getStorageInfoSync().keys.length - 1; i >= 0; i--) {
          var key = uni.getStorageInfoSync().keys[i];
          if (key.indexOf(keyPrefix) === 0) {
            uni.removeStorageSync(key);
          }
        }
      } catch (e) {

      }
    })
  }

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
  iterate: iterate,
  key: key,
  keys: keys,
  length: length,
  removeItem: removeItem,
  setItem: setItem,
  dropInstance: dropInstance,
}

export default uniStorageDriver;
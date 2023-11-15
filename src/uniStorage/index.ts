import serializer from "localforage/src/utils/serializer";
import executeCallback from "localforage/src/utils/executeCallback";

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
 * @description 最终的驱动器成品
 */
export const uniStorageDriver = {
  //我们的名字
  _driver: 'uniStorageDriver',
  // 是否支持
  _support: support,
  _initStorage: initStorage,
}

export default uniStorageDriver;
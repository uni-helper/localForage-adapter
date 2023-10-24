import * as sqlite from './sqlite';
import * as uniStorage from './uniStorage';

//本项目在于用sqlite重新实现localForage的API
//sqlite-runtime.ts是plus.sqlite的封装，用于在plus环境下使用sqlite
//core.ts是本项目的核心代码，用于实现localForage的API


export const INDEXEDDB = 'SQLite';
export const WEBSQL = 'SQLite';
export const LOCALSTORAGE = 'uniStorage';
export const SQLITE = 'SQLite';
export const UNISTORAGE = 'uniStorage';
let CUSTOMDRIVER = 'customDriver';

//配置
const coreConfig = {
  name: 'localforage',//数据库的名称。可能会在在数据库的提示中会出现。一般使用你的应用程序的名字。在 uniStorage 中，它作为存储在 uniStorage 中的所有 key 的前缀。
  driver: [SQLITE, UNISTORAGE] as String[] | String,//要使用的首选驱动。
  size: 4980736,//用作兼容，实际上sqlite不需要这个参数
  storeName: 'keyvaluepairs',//仅含字母和数字和下划线。任何非字母和数字字符都将转换为下划线。
  description: '',//数据库的描述，一般是提供给开发者的。
  version: '1.0'//数据库的版本号。实际上sqlite不需要这个参数
}


//你需要确保接受一个 callback 参数，并且将同样的几个参数传递给回调函数，类似默认驱动那样。同时你还需要 resolve 或 reject Promise。通过 默认驱动 可了解如何实现自定义的驱动。
//自定义实现可包含一个 _support 属性，该属性为布尔值（true / false） ，或者返回一个 Promise,该 Promise 的结果为布尔值。如果省略 _support，则默认值是 true 。你用它来标识当前的浏览器支持你自定义的驱动。
const customDriver: any = {
}
export function defineDriver(defineConfig: {
  _driver: 'customDriverUniqueName',
  _initStorage: (options: any) => void,
  support?: true,
  clear: (callback: (err?: any) => void) => void,
  getItem: (key: string, callback: (err: any, value: any) => void) => void,
  key: (n: number, callback: (err: any, key: string) => void) => void,
  keys: (callback: (err: any, keys: string[]) => void) => void,
  length: (callback: (err: any, numberOfKeys: number) => void) => void,
  removeItem: (key: string, callback: (err?: any) => void) => void,
  setItem: (key: string, value: any, callback: (err?: any, value?: any) => void) => void
}) {
  // 根据配置，来实现自定义驱动
  CUSTOMDRIVER = defineConfig._driver;

  // 清空数据库
  const clear = defineConfig.clear;

  // 从数据库中获取某个 key 的值
  const getItem = defineConfig.getItem;

  // 根据索引获取数据库中 key 的函数
  const key = defineConfig.key;

  // 获取数据库中所有 key 的函数
  const keys = defineConfig.keys;

  // 获取数据库中 key 的数量的函数
  const length = defineConfig.length;

  // 从数据库中删除某个 key 的值的函数
  const removeItem = defineConfig.removeItem;

  // 将某个 key 的值存储到数据库中的函数
  const setItem = defineConfig.setItem;

  // 设置自定义驱动的支持属性
  const _support = defineConfig.support !== undefined ? defineConfig.support : true;

  // 设置自定义驱动的初始化函数
  const _initStorage = defineConfig._initStorage;

  // 更新核心配置的驱动
  setDriver(customDriver);

  // 初始化自定义驱动的存储
  _initStorage(coreConfig);

  //向customDriver注册方法
  customDriver.clear = clear;
  customDriver.getItem = getItem;
  customDriver.key = key;
  customDriver.keys = keys;
  customDriver.length = length;
  customDriver.removeItem = removeItem;
  customDriver.setItem = setItem;
}


//设置配置
export function config(options: {
  name?: string,
  driver?: string | string[],
  size?: number,
  storeName?: string,
  description?: string
  version?: string
}) {
  Object.assign(coreConfig, options);
}

//设置驱动器
export function setDriver(driver: string | string[]) {
  coreConfig.driver = driver;
}

//获取第一个驱动器
export function driver(): String {
  if (typeof coreConfig.driver === 'string') {
    return coreConfig.driver;
  } else {
    return coreConfig.driver[0];
  }
}

//ready方法，用于确定数据库是否已经准备好
export async function ready(): Promise<any> {
  return true;
}

//getItem，从数据库中获取某个key的值
export async function getItem(key: string, successCallback: (err, value) => void): Promise<any> {
  let result = {
    status: false,
    data: null as any
  }
  if (driver() === SQLITE) {
    result.data = await sqlite.getItem(key, coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === UNISTORAGE) {
    result.data = await uniStorage.getItem(key, coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === CUSTOMDRIVER) {
    result.data = await customDriver.getItem(key);
    if (result.data !== null) {
      result.status = true;
    }
  }
  successCallback(result.status, result.data);
  if (result.status === true) {
    return result.data;
  } else {
    throw new Error(undefined);
  }
}

//setItem，往数据库中存储某个key的值
export async function setItem(key: string, value: any, successCallback: (e) => void): Promise<any> {
  let result = false;
  if (driver() === SQLITE) {
    result = await sqlite.setItem(key, value, coreConfig.name, coreConfig.storeName);
  } else if (driver() === UNISTORAGE) {
    result = await uniStorage.setItem(key, value, coreConfig.name, coreConfig.storeName);
  } else if (driver() === CUSTOMDRIVER) {
    result = await customDriver.setItem(key, value);
  }
  successCallback(value);
  if (result === true) {
    return value;
  } else {
    throw new Error(undefined);
  }
}

//removeItem，从数据库中删除某个key的值
export async function removeItem(key: string, successCallback: () => void): Promise<any> {
  let result = false;
  if (driver() === SQLITE) {
    result = await sqlite.removeItem(key, coreConfig.name, coreConfig.storeName);
  } else if (driver() === UNISTORAGE) {
    result = await uniStorage.removeItem(key, coreConfig.name, coreConfig.storeName);
  } else if (driver() === CUSTOMDRIVER) {
    result = await customDriver.removeItem(key);
  }
  successCallback();
  if (result === true) {
    return;
  } else {
    throw new Error();
  }
}

//clear，清空数据库
export async function clear(successCallback: () => void): Promise<any> {
  let result = false;
  if (driver() === SQLITE) {
    result = await sqlite.clear(coreConfig.name, coreConfig.storeName);
  } else if (driver() === UNISTORAGE) {
    result = await uniStorage.clear(coreConfig.name, coreConfig.storeName);
  } else if (driver() === CUSTOMDRIVER) {
    result = await customDriver.clear();
  }
  successCallback();
  if (result === true) {
    return;
  } else {
    throw new Error();
  }
}

//length，获取数据库中的key的数量
export async function length(successCallback: (numberOfKeys) => void): Promise<any> {
  let result = {
    status: false,
    data: 0
  }
  if (driver() === SQLITE) {
    result.data = await sqlite.length(coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === UNISTORAGE) {
    result.data = await uniStorage.length(coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === CUSTOMDRIVER) {
    result.data = await customDriver.length();
    if (result.data !== null) {
      result.status = true;
    }
  }
  successCallback(result.data);
  if (result.status === true) {
    return result.data;
  } else {
    throw new Error();
  }
}

//key，获取数据库根据 key 的索引获取其名
export async function key(n: number, successCallback: (key) => void): Promise<any> {
  let result = {
    status: false,
    data: '' as string | null
  }
  if (driver() === SQLITE) {
    result.data = await sqlite.key(n, coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === UNISTORAGE) {
    result.data = await uniStorage.key(n, coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === CUSTOMDRIVER) {
    result.data = await customDriver.key(n);
    if (result.data !== null) {
      result.status = true;
    }
  }
  successCallback(result);
  if (result.status) {
    return result;
  } else {
    throw new Error();
  }
}

//keys，获取数据库中的所有key
export async function keys(successCallback: (keys: string[]) => void): Promise<string[]> {
  let result = {
    data: [] as string[],
    status: false
  };
  if (driver() === SQLITE) {
    result.data = await sqlite.keys(coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === UNISTORAGE) {
    result.data = await uniStorage.keys(coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === CUSTOMDRIVER) {
    result.data = await customDriver.keys();
    if (result.data !== null) {
      result.status = true;
    }
  }
  successCallback(result.data);
  if (result.status === true) {
    return result.data;
  } else {
    throw new Error();
  }
}

//iterate，迭代数据仓库中的所有 value/key 键值对。
export async function iterate(iteratorCallback: (value: any, key: string, iterationNumber: number) => void, successCallback: () => void): Promise<any> {
  let result = {
    data: [] as string[],
    status: false
  };
  if (driver() === SQLITE) {
    result.data = await sqlite.iterate(iteratorCallback, coreConfig.name, coreConfig.storeName);
    if (result.data !== null) {
      result.status = true;
    }
  } else if (driver() === UNISTORAGE) {
    result.status = true;
  } else if (driver() === CUSTOMDRIVER) {
    result.data = await customDriver.iterate(iteratorCallback);
    if (result.data !== null) {
      result.status = true;
    }
  }
  successCallback();
  if (result.status === true) {
    return result.data;
  } else {
    throw new Error();
  }
}


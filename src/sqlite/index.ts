import executeCallback from "localforage/src/utils/executeCallback";
import normalizeKey from 'localforage/src/utils/normalizeKey';

declare const plus: any;
let name, storeName;
//使用plus的sqlite重新实现一遍localForage

/**
 * @name: 一层封装
 * 
 **/

// #ifdef APP-PLUS

//打开数据库
function openDatabase(_name): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.openDatabase({
      name: _name,
      path: '_doc/localForage/' + _name + '.db',
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('1：Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}



//数据库是否打开
const isOpenDatabase = (_name) => {
  try {
    const isOpen = plus.sqlite.isOpenDatabase({
      name: _name,
      path: '_doc/localForage/' + _name + '.db',
    });
    //console.log('Database ' + _name + ' is open:', isOpen);
    return isOpen;
  } catch (error) {
    console.error('Error checking if database ' + _name + ' is open:', error);
    return false;
  }
}

//关闭数据库
function closeDatabase(_name) {
  return new Promise((resolve, reject) => {
    plus.sqlite.closeDatabase({
      name: _name,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('2：Failed to close database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行事务
//operation ，类型为string，并且只有三个可选值：begin、commit、rollback
type operation = 'begin' | 'commit' | 'rollback';
function transaction(operation: operation, _name: any) {
  return new Promise((resolve, reject) => {
    plus.sqlite.transaction({
      name: _name,
      operation: operation,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('3：Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行sql语句
function executeSql(sql: string, _name: any): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.executeSql({
      name: _name,
      sql: sql,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('4：Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行查询的sql语句
function selectSql(sql: string, _name: any): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.selectSql({
      name: _name,
      sql: sql,
      success(e) {
        resolve(e);
      },
      fail(e) {
        reject(new Error('5：Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

// #endif

/**
 * @name: 二层封装
 * 
 **/

//往某数据库中执行sql语句的综合方法，包括打开数据库、执行sql语句、关闭数据库（其中关闭数据库要判断是否还有其他操作在执行）
interface Counter {
  [key: string]: number;
}

const counter: Counter = {};
async function execute(sql: string, _name: any, returnResults = false) {
  if (!counter[_name]) {
    counter[_name] = 0;
  } else {
    counter[_name]++;
  }
  let result = false;
  let queryResults;

  if (!isOpenDatabase(_name)) {
    const openResult = await openDatabase(_name);
    if (!openResult) {
      throw new Error("Failed to execute statement");
    }
  }

  // 开始事务
  try {
    await transaction('begin', _name);
    const executionResult = await executeSql(sql, _name);

    if (executionResult) {
      await transaction('commit', _name);
      result = true;

      if (returnResults) {
        queryResults = executionResult; // 如果需要返回结果，把结果保存到 queryResults
      }
    } else {
      throw new Error("Failed in transaction SQL operation");
    }

  } catch (error) {
    await transaction('rollback', _name);
    throw error;
  }

  counter[_name]--;

  if (counter[_name] === 0) {
    await closeDatabase(_name);
  }

  return returnResults ? queryResults : result; // 根据参数返回相应的值
}

//往某数据库中执行查询的sql语句的综合方法，包括打开数据库、执行sql语句、关闭数据库（其中关闭数据库要判断是否还有其他操作在执行）
async function select(sql: string, _name: any) {
  if (!counter[_name]) {
    counter[_name] = 0;
  } else {
    counter[_name]++;
  }
  let result: any = null;
  if (!isOpenDatabase(_name)) {
    // 打开数据库
    const openResult = await openDatabase(_name);
    if (!openResult) {
      throw new Error("Failed to select, because database don't open");
    }
  }

  // 执行查询操作
  result = await selectSql(sql, _name);

  counter[_name]--;
  if (counter[_name] === 0) {
    // 如果没有其它正在执行的操作，关闭数据库
    await closeDatabase(_name);
  }

  if (result !== null) {
    // 返回查询结果
    return result;
  } else {
    throw new Error("Failed to execute select operation");
  }
}

// 检查数据库中的表是否存在，如果不存在则创建，如果存在则不做任何操作
// 创建成功或者表已存在返回true，创建失败返回false
export async function checkStore(_name, _storeName) {
  // 查询在 sqlite_master 表中是否存在名为 storeName 的表
  const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${_storeName}';`;
  try {
    const result = await select(sql, _name);
    if (result.length > 0) {
      //console.log(`Table ${_storeName} has created.`)
      return true; // 表已存在
    } else {
      // 表不存在，试图创建它
      const sql = `CREATE TABLE ${_storeName} (key PRIMARY KEY, value);`;
      const createAction = await execute(sql, _name);
      //console.log(`Table ${_storeName} now created.`)
      return createAction !== undefined && createAction !== false; // 如果 createAction 非 undefined 且非 false，意味着创建成功
    }
  } catch (err) {
    //console.log(_name)
    //console.log(_storeName)
    console.error('An error occurred when checking or creating the table:', err);
    return false; // 发生错误，返回false
  }
}

/**
 * @name: 最终封装
 * 
 **/

/**
 * @description 是否支持使用sqlite方式进行存储
 * @return {Boolean} true 支持 false 不支持
 */
// function support(): boolean {
//   try {
//     return plus.sqlite !== undefined
//   } catch (e) {
//     return false;
//   }
// }


/**
 * @description 初始化数据库
 * @param options 
 * @returns 
 */
export async function _initStorage(options) {
  name = options.name;
  storeName = options.storeName;
  //console.log(options)
  //console.log(name)
  //console.log(storeName)

  const isDatabaseOpen = isOpenDatabase(name);
  if (isDatabaseOpen) {
    executeCallback(Promise.resolve(true));
    return Promise.resolve(true);
  } else {
    const promise = openDatabase(name)
      .then(() => {
        executeCallback(Promise.resolve(true));
        return true;
      })
      .catch(error => {
        executeCallback(Promise.reject(error));
        return Promise.reject(error);
      });

    return promise;
  }
}

/**
 * @description 删除数据库
 * @param {Function} callback 
 * @returns {Promise} 
 */
export function dropInstance(callback, name) {
  const sql = `DROP DATABASE IF EXISTS ${name};`;
  const promise = execute(sql, name);

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 设置指定数据
 * @param key 
 * @param value
 * @param callback 
 * @returns 
 */
export async function setItem(key, value, callback) {
  const _name = name
  const _storeName = storeName
  try {
    key = normalizeKey(key);
    await checkStore(_name, _storeName);

    if (value === undefined) {
      value = null;
    }

    const sql = `INSERT OR REPLACE INTO ${_storeName} (key, value) VALUES('${key}', '${value}');`;
    const result = await execute(sql, _name);

    executeCallback(result ? true : Promise.reject('Set item failed'), callback);

    return result ? true : Promise.reject('Set item failed');
  } catch (error) {
    console.error("1：An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 获取指定数据
 * @param key 
 * @param callback 
 * @returns 
 */
export async function getItem(key, callback) {
  const _name = name
  const _storeName = storeName
  try {
    key = normalizeKey(key);
    await checkStore(_name, _storeName);

    const sql = `SELECT value FROM ${_storeName} WHERE key='${key}';`;
    const result = await select(sql, _name);

    executeCallback(result.length > 0 ? result[0].value : null, callback);

    return result.length > 0 ? result[0].value : null;
  } catch (error) {
    console.error("2：An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 删除指定数据
 * @param key 
 * @param callback 
 * @returns 
 */
export async function removeItem(key, callback) {
  const _name = name
  const _storeName = storeName
  try {
    key = normalizeKey(key);
    await checkStore(_name, _storeName);

    const sql = `DELETE FROM ${_storeName} WHERE key ='${key}';`;
    const result = await execute(sql, _name);

    executeCallback(result ? true : false, callback);
    return result ? true : false;
  } catch (error) {
    console.error("3：An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}


/**
 * @description 清空某个表的全部数据

 * @param callback 
 * @returns 
 */
export async function clear(callback) {
  const _name = name
  const _storeName = storeName
  try {
    await checkStore(_name, _storeName);

    const sql = `DELETE FROM ${_storeName};`;
    const result = await execute(sql, _name);

    executeCallback(result ? true : false, callback);
    return result ? true : false;
  } catch (error) {
    console.error("4：An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 获取指定库的指定key
 * @param index
 * @param callback 
 * @returns 
 */
export async function key(index, callback) {
  const _name = name
  const _storeName = storeName
  try {
    await checkStore(_name, _storeName);

    const sql = `SELECT key FROM ${_storeName} LIMIT ${index}, 1;`;
    const result = await select(sql, _name);

    const key = result.length > 0 ? result.map(item => item.key) : [];
    executeCallback(key, callback);

    return key;
  } catch (error) {
    console.error("An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 获取指定库的全部keys
 * @param callback 
 * @returns 
 */
export async function keys(callback) {
  const _name = name
  const _storeName = storeName
  try {
    await checkStore(_name, _storeName);
    const sql = `SELECT key FROM ${_storeName};`;
    const result = await select(sql, _name);

    const keys = result.length > 0 ? result.map(item => item.key) : [];
    executeCallback(keys, callback);

    return keys; // Return the keys array outside the callback
  } catch (error) {
    console.error("An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 获取当前库的所有key的数量
 * @param callback
 * @returns
 */
export async function length(callback) {
  const _name = name
  const _storeName = storeName
  try {
    await checkStore(_name, _storeName);

    const sql = `SELECT COUNT(key) AS count FROM ${_storeName};`;
    const result = await select(sql, _name);

    executeCallback(result.length > 0 ? result[0].count : 0, callback);
    return result.length > 0 ? result[0].count : 0;
  } catch (error) {
    console.error("7：An error occurred:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 迭代指定库的所有数据
 * @param name 
 * @param storeName
 * @param callback 
 * @returns 
 */
export async function iterate(callback) {
  const _name = name
  const _storeName = storeName
  try {
    await checkStore(_name, _storeName);
    const sql = `SELECT key, value FROM ${_storeName};`;
    const result = await select(sql, _name);

    let iterationNumber = 1;
    let returnValue;

    for (let item of result) {
      returnValue = callback(item.key, item.value, iterationNumber++);
      if (returnValue !== undefined) {
        executeCallback(returnValue, callback);
        return returnValue;
      }
    }

    executeCallback(result.length > 0 ? result : [], callback);
    return result.length > 0 ? result : [];
  } catch (error) {
    console.error("Error during iteration:", error);
    executeCallback(null, callback);
    throw error;
  }
}

/**
 * @description 最终的驱动器成品
 */
export const sqliteDriver = {
  //我们的名字
  _driver: 'sqliteDriver',
  // 是否支持
  // _support: support,
  _initStorage: _initStorage,
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

export default sqliteDriver;
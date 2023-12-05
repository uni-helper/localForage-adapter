import executeCallback from "localforage/src/utils/executeCallback";
import normalizeKey from 'localforage/src/utils/normalizeKey';

declare const plus: any;

//使用plus的sqlite重新实现一遍localForage

/**
 * @name: 一层封装
 * 
 **/

// #ifdef APP-PLUS

//打开数据库
async function openDatabase(name: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.openDatabase({
      name: name,
      path: '_doc/localForage/' + name + '.db',
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}



//数据库是否打开
const isOpenDatabase = (name: string) => {
  return plus.sqlite.isOpenDatabase({
    name: name,
    path: '_doc/localForage/' + name + '.db'
  })
}

//关闭数据库
async function closeDatabase(name: string) {
  return new Promise((resolve, reject) => {
    plus.sqlite.closeDatabase({
      name: name,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行事务
//operation ，类型为string，并且只有三个可选值：begin、commit、rollback
type operation = 'begin' | 'commit' | 'rollback';
async function transaction(name: string, operation: operation) {
  return new Promise((resolve, reject) => {
    plus.sqlite.transaction({
      name: name,
      operation: operation,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行sql语句
async function executeSql(name: string, sql: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.executeSql({
      name: name,
      sql: sql,
      success(e) {
        resolve(true);
      },
      fail(e) {
        reject(new Error('Failed to open database: ' + JSON.stringify(e)));
      }
    });
  });
}

//执行查询的sql语句
async function selectSql(name: string, sql: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.selectSql({
      name: name,
      sql: sql,
      success(e) {
        resolve(e);
      },
      fail(e) {
        reject(new Error('Failed to open database: ' + JSON.stringify(e)));
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
let counter: counter;
interface counter {
  //每一个属性为string类型的属性都是一个数据库的名称，属性的值为一个数字，表示该数据库有多少个操作在执行，默认为0
  [key: string]: number;
}
async function execute(name: string, sql: string, returnResults = false) {
  counter[name]++;
  let result = false;
  let queryResults;

  if (!isOpenDatabase(name)) {
    const openResult = await openDatabase(name);
    if (!openResult) {
      throw new Error("Failed to open database");
    }
  }

  // 开始事务
  try {
    await transaction(name, 'begin');
    const executionResult = await executeSql(name, sql);
    
    if (executionResult) {
      await transaction(name, 'commit');
      result = true;

      if (returnResults) {
        queryResults = executionResult; // 如果需要返回结果，把结果保存到 queryResults
      }
    } else {
      throw new Error("Failed to execute SQL operation");
    }

  } catch (error) {
    await transaction(name, 'rollback');
    throw error;
  }

  counter[name]--;

  if (counter[name] === 0) {
    await closeDatabase(name);
  }

  return returnResults ? queryResults : result; // 根据参数返回相应的值
}

//往某数据库中执行查询的sql语句的综合方法，包括打开数据库、执行sql语句、关闭数据库（其中关闭数据库要判断是否还有其他操作在执行）
async function select(name: string, sql: string) {
  counter[name]++;
  let result: any = null;
  if (!isOpenDatabase(name)) {
    // 打开数据库
    const openResult = await openDatabase(name);
    if (!openResult) {
      throw new Error("Failed to open database");
    }
  }

  // 执行查询操作
  result = await selectSql(name, sql);

  counter[name]--;
  if (counter[name] === 0) {
    // 如果没有其它正在执行的操作，关闭数据库
    await closeDatabase(name);
  }

  if (result !== null) {
    // 返回查询结果
    return result;
  } else {
    throw new Error("Failed to execute select operation");
  }
}

//检查数据库中的表是否存在，如果不存在则创建，如果存在则不做任何操作
//创建成功或者表已存在返回true，创建失败返回false
export async function checkStore(name: string, storeName: string) {
  const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${storeName}';`;
  const result = await select(name, sql);
  if (result.length > 0) {
    return true; // 表已存在
  } else {
    const createSql = `CREATE TABLE ${storeName} (id INT PRIMARY KEY, name TEXT);`;
    try {
      const createAction = await execute(name, createSql);
      if (createAction) {
        return true; // 创建表成功
      } else {
        throw new Error('Table creation failed'); // 创建表失败
      }
    } catch (err) {
      console.log(err);
      return false; // 返回false，表示创建失败
    }
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
function support(): boolean {
  try {
    return plus.sqlite !== undefined
  } catch (e) {
    return false;
  }
}


/**
 * @description 初始化数据库
 * @param options 
 * @param callback 
 * @returns 
 */
export function initStorage(options, callback) {
  const promise = openDatabase(options.name)
    .then(() => {
      return true;
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 删除数据库
 * @param {string} name 
 * @param {Function} callback 
 * @returns {Promise} 
 */
export function dropInstance(name, callback) {
  const sql = `DROP DATABASE IF EXISTS ${name};`;
  const promise = execute(name, sql);

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 设置指定数据
 * @param key 
 * @param value
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function setItem(key, value, name, storeName, callback) {
  key = normalizeKey(key);
  let promise = checkStore(name, storeName)
    .then(() => {
      if (value === undefined) {
        value = null;
      }

      const sql = `INSERT OR REPLACE INTO ${storeName} (id, name) VALUES ('${key}', '${value}');`;
      return execute(name, sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return Promise.reject('Set item failed');
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定数据
 * @param key 
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function getItem(key, name, storeName, callback) {
  key = normalizeKey(key);
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `SELECT name FROM ${storeName} WHERE id='${key}';`;
      return select(name, sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].name;
      } else {
        return null;
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 删除指定数据
 * @param key 
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function removeItem(key, name, storeName, callback) {
  key = normalizeKey(key);
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `DELETE FROM ${storeName} WHERE id='${key}';`;
      return execute(name, sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return false;
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 清空某个表的全部数据
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function clear(name, storeName, callback) {
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `DELETE FROM ${storeName};`;
      return execute(name, sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return false;
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定库的指定key
 * @param index
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function key(index, name, storeName, callback) {
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `SELECT id FROM ${storeName} LIMIT ${index}, 1;`;
      return execute(name, sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].id;
      } else {
        return null;
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定库的全部keys
 * @param name
 * @param storeName
 * @param callback 
 * @returns 
 */
export function keys(name, storeName, callback) {
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `SELECT id FROM ${storeName};`;
      return execute(name, sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result.map(item => item.id);
      } else {
        return [];
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取当前库的所有key的数量
 * @param name
 * @param storeName
 * @param callback
 * @returns
 */
export function length(name, storeName, callback) {
  let promise = checkStore(name, storeName)
    .then(() => {
      const sql = `SELECT COUNT(id) AS count FROM ${storeName};`;
      return select(name, sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].count;
      } else {
        return 0;
      }
    })
    .catch(error => {
      executeCallback(Promise.reject(error), callback);
      return Promise.reject(error);
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 迭代指定库的所有数据
 * @param name 
 * @param storeName
 * @param callback 
 * @returns 
 */
export async function iterate(name, storeName, callback) {
  var self = this;
  
  var promise = self.ready().then(async function() {
    await checkStore(name, storeName);
    const sql = `SELECT id, name FROM ${storeName};`;
    const result = await select(name, sql);

    var iterationNumber = 1;

    if (result.length > 0) {
      let value;
      for(let item of result) {
        value = callback(item.name, item.id, iterationNumber++);

        if(value !== void 0) {
          return value;
        }
      }
      return result;
    } else {
      return [];
    }
  });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 最终的驱动器成品
 */
export const sqliteDriver = {
  //我们的名字
  _driver: 'sqliteDriver',
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

export default sqliteDriver;
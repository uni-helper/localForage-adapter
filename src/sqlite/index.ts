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
async function openDatabase(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.openDatabase({
      name: name,
      path: '_doc/localForage/' + name + '.db',
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
const isOpenDatabase = () => {
  try {
    const isOpen = plus.sqlite.isOpenDatabase({
      name: name,
      path: '_doc/localForage/' + name + '.db',
    });
    console.log('Database ' + name + ' is open:', isOpen);
    return isOpen;
  } catch (error) {
    console.error('Error checking if database ' + name + ' is open:', error);
    return false;
  }
}

//关闭数据库
async function closeDatabase() {
  return new Promise((resolve, reject) => {
    plus.sqlite.closeDatabase({
      name: name,
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
async function transaction(operation: operation) {
  return new Promise((resolve, reject) => {
    plus.sqlite.transaction({
      name: name,
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
async function executeSql(sql: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.executeSql({
      name: name,
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
async function selectSql(sql: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    plus.sqlite.selectSql({
      name: name,
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
let counter: counter;
interface counter {
  //每一个属性为string类型的属性都是一个数据库的名称，属性的值为一个数字，表示该数据库有多少个操作在执行，默认为0
  [key: string]: number;
}
async function execute(sql: string, returnResults = false) {
  let counter = {};
  counter[name]++;
  let result = false;
  let queryResults;

  if (!isOpenDatabase()) {
    const openResult = await openDatabase();
    if (!openResult) {
      throw new Error("Failed to execute statement");
    }
  }

  // 开始事务
  try {
    await transaction('begin');
    const executionResult = await executeSql(sql);
    
    if (executionResult) {
      await transaction('commit');
      result = true;

      if (returnResults) {
        queryResults = executionResult; // 如果需要返回结果，把结果保存到 queryResults
      }
    } else {
      throw new Error("Failed in transaction SQL operation");
    }

  } catch (error) {
    await transaction('rollback');
    throw error;
  }

  counter[name]--;

  if (counter[name] === 0) {
    await closeDatabase();
  }

  return returnResults ? queryResults : result; // 根据参数返回相应的值
}

//往某数据库中执行查询的sql语句的综合方法，包括打开数据库、执行sql语句、关闭数据库（其中关闭数据库要判断是否还有其他操作在执行）
async function select(sql: string) {
  let counter = {};
  counter[name]++;
  let result: any = null;
  if (!isOpenDatabase()) {
    // 打开数据库
    const openResult = await openDatabase();
    if (!openResult) {
      throw new Error("Failed to select, because database don't open");
    }
  }

  // 执行查询操作
  result = await selectSql(sql);

  counter[name]--;
  if (counter[name] === 0) {
    // 如果没有其它正在执行的操作，关闭数据库
    await closeDatabase();
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
export async function checkStore() {
  console.log(name)
  console.log(storeName)
  // 查询在 sqlite_master 表中是否存在名为 storeName 的表
  const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${storeName}';`;
  try {
    const result = await select(sql);
    if (result.length > 0) {
      console.log(`Table ${storeName} has created.`)
      return true; // 表已存在
    } else {
      // 表不存在，试图创建它
      const sql = `CREATE TABLE ${storeName} (key PRIMARY KEY, value);`;
      const createAction = await execute(sql);
      console.log(`Table ${storeName} now created.`)
      return createAction !== undefined && createAction !== false; // 如果 createAction 非 undefined 且非 false，意味着创建成功
    }
  } catch (err) {
    console.log(name)
    console.log(storeName)
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
export function _initStorage(options) {
  name = options.name;
  storeName = options.storeName;
  console.log(options)
  console.log(name)
  console.log(storeName)
  
  const isDatabaseOpen = isOpenDatabase();
  if (isDatabaseOpen) {
    executeCallback(Promise.resolve(true));
    return Promise.resolve(true);
  } else {
    const promise = openDatabase()
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
export function dropInstance(callback) {
  const sql = `DROP DATABASE IF EXISTS ${name};`;
  const promise = execute(sql);

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
export function setItem(key, value, callback) {
  key = normalizeKey(key);
  let promise = checkStore()
    .then(() => {
      if (value === undefined) {
        value = null;
      }
      const sql = `INSERT OR REPLACE INTO ${storeName} (key, value) VALUES ('${key}', '${value}');`;
      return execute(sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return Promise.reject('Set item failed');
      }
    })
    .catch(error => {
      console.error("1：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定数据
 * @param key 
 * @param callback 
 * @returns 
 */
export function getItem(key, callback) {
  key = normalizeKey(key);
  let promise = checkStore()
    .then(() => {
      const sql = `SELECT key FROM ${storeName} WHERE key ='${key}';`;
      return select(sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].name;
      } else {
        return null;
      }
    })
    .catch(error => {
      console.error("2：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 删除指定数据
 * @param key 

 * @param callback 
 * @returns 
 */
export function removeItem(key, callback) {
  key = normalizeKey(key);
  let promise = checkStore()
    .then(() => {
      const sql = `DELETE FROM ${storeName} WHERE key ='${key}';`;
      return execute(sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return false;
      }
    })
    .catch(error => {
      console.error("3：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 清空某个表的全部数据

 * @param callback 
 * @returns 
 */
export function clear(callback) {
  let promise = checkStore()
    .then(() => {
      const sql = `DELETE FROM ${storeName};`;
      return execute(sql);
    })
    .then(result => {
      if (result) {
        return true;
      } else {
        return false;
      }
    })
    .catch(error => {
      console.error("4：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定库的指定key
 * @param index
 * @param callback 
 * @returns 
 */
export function key(index, callback) {
  let promise = checkStore()
    .then(() => {
      const sql = `SELECT key FROM ${storeName} LIMIT ${index}, 1;`;
      return execute(sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].id;
      } else {
        return null;
      }
    })
    .catch(error => {
      console.error("5：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取指定库的全部keys
 * @param callback 
 * @returns 
 */
export function keys(callback) {
  let promise = checkStore()
    .then(() => {
      const sql = `SELECT key FROM ${storeName};`;
      return execute(sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result.map(item => item.key);
      } else {
        return [];
      }
    })
    .catch(error => {
      console.error("6：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
    });

  executeCallback(promise, callback);
  return promise;
}

/**
 * @description 获取当前库的所有key的数量
 * @param callback
 * @returns
 */
export function length(callback) {
  let promise = checkStore()
    .then(() => {
      const sql = `SELECT COUNT(key) AS count FROM ${storeName};`;
      return select(sql);
    })
    .then(result => {
      if (result.length > 0) {
        return result[0].count;
      } else {
        return 0;
      }
    })
    .catch(error => {
      console.error("7：An error occurred:", error); // 处理异常并输出错误信息
      executeCallback(null, callback); // 返回默认值或执行其他操作
      return null; // 返回一个默认值
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
export async function iterate(callback) {
  var self = this;
  
  var promise = self.ready().then(async function() {
    await checkStore();
    const sql = `SELECT key, value FROM ${storeName};`;
    const result = await select(sql);

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
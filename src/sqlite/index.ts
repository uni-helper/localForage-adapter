import executeCallback from "localforage/src/utils/executeCallback";
import normalizeKey from 'localforage/src/utils/normalizeKey';

declare const plus: any;
let dbQueue: (() => void)[] = []; // 创建队列，用于存储还未执行的数据库操作
let isTaskRunning = false; // 是否正在初始化数据库
let name, storeName;

//使用plus的sqlite重新实现一遍localForage

/**
 * @name: 一层封装
 * 
 **/

// #ifdef APP-PLUS

// 定义 DbTask 接口
interface DbTask {
  task: () => Promise<any>;
  callback: (err: any | null, result?: any) => void;
}

// 声明 dbTaskQueue 为 DbTask 类型的数组
const dbTaskQueue: DbTask[] = [];

function createInitTask(options) {
  return async function() {
    const { name, storeName } = options;
    // 首先检查是否已打开数据库的特定实例
    if (!isOpenDatabase(name)) {
      await openDatabase(name);
    }
    
    // 检查特定 store 是否已存在并准备就绪
    // 由于 checkStore 函数已经被修改为使用队列，我们直接传递 callback 给 checkStore
    await checkStore(name, storeName, function(err) {
      if (err) {
        // 错误处理
        console.error('An error occurred when checking or creating the store:', err);
      } else {
        // 如果 store 的检查或创建成功，您可以在这里继续处理或者调用其他队列任务
        console.log(`Store ${storeName} is ready.`);
      }
    });
  };
}

// 处理队列中的任务
function processQueue() {
  if (isTaskRunning || dbTaskQueue.length === 0) {
    return; // 如果任务正在运行或队列为空，直接返回
  }

  isTaskRunning = true; // 设置标记，表示任务正在执行
  const nextTask = dbTaskQueue.shift();

  // 使用 if 语句进行运行时检查
  if (!nextTask) {
    isTaskRunning = false; // 如果没有任务，重置标记
    return;
  }

  nextTask.task().then(result => {
    isTaskRunning = false;
    nextTask.callback(null, result);
    processQueue();
  }).catch(err => {
    isTaskRunning = false;
    nextTask.callback(err);
    processQueue(); 
  });
}

// 将任务和其回调函数添加到队列
function enqueueDbTask(taskFunction, callback) {
  dbTaskQueue.push({ task: taskFunction, callback }); // 添加任务到队列
  processQueue(); // 尝试处理队列中的任务
}

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

export function executeSql(sql, params, callback) {
  const task = async () => {
    return new Promise((resolve, reject) => {
      plus.sqlite.executeSql({
        name: name,
        sql: sql,
        args: params || [],
        success(e) {
          resolve(e);
        },
        fail(e) {
          reject(new Error('4：Failed to open database: ' + JSON.stringify(e)));
        }
      });
    });
  };

  enqueueDbTask(task, callback);
}

//执行查询的sql语句
export function selectSql(sql, params, callback) {
  const task = async () => {
    return new Promise((resolve, reject) => {
      plus.sqlite.selectSql({
        name: name,
        sql: sql,
        args: params || [],
        success(e) {
          resolve(e);
        },
        fail(e) {
          reject(new Error('5：Failed to open database: ' + JSON.stringify(e)));
        }
      });
    });
  };

  enqueueDbTask(task, callback);
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
async function execute(sql: string, _name: any, returnResults = false, callback: (err: any, result?: any) => void) {
  if (!counter[_name]) {
    counter[_name] = 0;
  } 
  counter[_name]++;

  let result: any = false;
  let queryResults: any;

  if (!isOpenDatabase(_name)) {
    try {
      await openDatabase(_name);
    } catch (error) {
      executeCallback(error, callback);
      throw error;
    }
  }

  // 开始事务
  try {
    await transaction('begin', _name);

    const executeTask = () => new Promise((resolve, reject) => {
      executeSql(sql, [], (error, sqlResult) => {
        if (error) {
          reject(error);
        } else {
          resolve(sqlResult);
        }
      });
    });

    const executionResult = await executeTask();

    if (executionResult) {
      await transaction('commit', _name);
      result = true;

      if (returnResults) {
        queryResults = executionResult; // If results should be returned, save them to queryResults.
      }
    } else {
      throw new Error("Failed in transaction SQL operation");
    }

  } catch (error) {
    await transaction('rollback', _name);
    executeCallback(error, callback);
    throw error;
  } finally {
    counter[_name]--;
    if (counter[_name] === 0) {
      await closeDatabase(_name);
    }
  }

  const finalResult = returnResults ? queryResults : result;
  executeCallback(null, finalResult, callback); // Execute the callback with the result.
  return finalResult;
}

//往某数据库中执行查询的sql语句的综合方法，包括打开数据库、执行sql语句、关闭数据库（其中关闭数据库要判断是否还有其他操作在执行）
async function select(sql: string, _name: any, callback: (err: any, result?: any) => void) {
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
      const error = new Error("Failed to select, because database don't open");
      executeCallback(error, callback);
      throw error;
    }
  }

  // 执行查询操作
  const selectTask = () => new Promise((resolve, reject) => {
    selectSql(sql, [], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });

  enqueueDbTask(selectTask, (err, res) => {
    // Update the counter
    counter[_name]--;
    // If this was the last operation, close the database
    if (counter[_name] === 0) {
      closeDatabase(_name);
    }
    // Handle the callback with result or error based on the task outcome
    if (err) {
      console.error("Failed to execute select operation:", err);
      executeCallback(null, callback);
      throw err;
    } else {
      result = res;
      executeCallback(result, callback);
    }
  });

  // We return the result directly, since errors are handled by throwing
  return result;
}
// 检查数据库中的表是否存在，如果不存在则创建，如果存在则不做任何操作
export async function checkStore(_name, _storeName, callback) {
  const task = async () => {
    // Check if the table exists by querying the SQLite master table
    const sqlCheckTableExists = `SELECT name FROM sqlite_master WHERE type='table' AND name='${_storeName}';`;
    const result = await new Promise((resolve, reject) => {
      selectSql(sqlCheckTableExists, [], (error, results) => { // Pass an empty array for params
        if (error) reject(error);
        if (results && results.length > 0) {
          resolve(true); // The table exists
        } else {
          // If the table does not exist, create it
          const sqlCreateTable = `CREATE TABLE IF NOT EXISTS ${_storeName} (key PRIMARY KEY, value);`;
          executeSql(sqlCreateTable, [], (createError, createResults) => {
            if (createError) reject(createError);
            resolve(true); // The table has been created successfully
          });
        }
      });
    });
    return result;
  };

  // Add the given task to the queue, including the success and error callbacks
  enqueueDbTask(task, (err, result) => {
    if (err) {
      console.error('An error occurred when checking or creating the table:', err);
    }
    if (callback) {
      callback(err, result);
    }
  });
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
export function _initStorage(options, callback) {
  // 创建用给定参数初始化的任务函数
  const initTaskWithParams = createInitTask(options);
  // 将初始化任务和回调加入队列
  enqueueDbTask(initTaskWithParams, callback);
}

/**
 * @description 删除数据库
 * @param {Function} callback 
 * @returns {Promise} 
 */
export function dropInstance(callback, name) {
  const sql = `DROP DATABASE IF EXISTS ${name};`;
  const promise = new Promise((resolve, reject) => {
    execute(sql, name, false, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });

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
export function setItem(key: any, value: any, callback: (err: any, result?: any) => void) {
  key = normalizeKey(key);
  
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `INSERT OR REPLACE INTO ${storeName} (key, value) VALUES (?, ?);`;

      await new Promise<void>((resolve, reject) => {
        executeSql(sql, [key, value], (executeErr, executeResult) => {
          if (executeErr) {
            reject(executeErr);
          } else {
            resolve();
          }
        });
      });

      return true; 
    } catch (error) {
      throw error; 
    }
  };
  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 获取指定数据
 * @param key
 * @param callback
 * @returns
 */
export async function getItem(key: string, callback: (err: any, result?: any) => void) {
  key = normalizeKey(key);

  const task = async () => {
      try {
          await new Promise<void>((resolve, reject) => {
              checkStore(name, storeName, (checkErr) => {
                  if (checkErr) {
                      reject(checkErr);
                  } else {
                      resolve();
                  }
              });
          });

          const sql = `SELECT value FROM ${storeName} WHERE key=?;`;

          const result = await new Promise<any>((resolve, reject) => {
              selectSql(sql, [key], (selectErr, results) => {
                  if (selectErr) {
                      reject(selectErr);
                  } else {
                      resolve(results);
                  }
              });
          });

          return result.length > 0 ? result[0].value : null;
      } catch (error) {
          throw error;
      }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 删除指定数据
 * @param key 要删除的数据的键
 * @param callback 结果回调函数
 * @returns 
 */
export async function removeItem(key: string, callback: (err: any, result?: any) => void) {
  key = normalizeKey(key);

  const task = async () => {
      try {
          await new Promise<void>((resolve, reject) => {
              checkStore(name, storeName, (checkErr) => {
                  if (checkErr) {
                      reject(checkErr);
                  } else {
                      resolve();
                  }
              });
          });

          const sql = `DELETE FROM ${storeName} WHERE key=?;`;

          await new Promise<void>((resolve, reject) => {
              executeSql(sql, [key], (executeErr, executeResult) => {
                  if (executeErr) {
                      reject(executeErr);
                  } else {
                      resolve();
                  }
              });
          });

          return true;
      } catch (error) {
          throw error;
      }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}


/**
 * @description 清空某个表的全部数据
 * @param callback 结果回调函数
 * @returns 
 */
export async function clear(callback: (err: any, result?: any) => void) {
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `DELETE FROM ${storeName};`;

      await new Promise<void>((resolve, reject) => {
        executeSql(sql, [], (executeErr, executeResult) => {
          if (executeErr) {
            reject(executeErr);
          } else {
            resolve();
          }
        });
      });

      return true;
    } catch (error) {
      throw error;
    }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 获取指定库的指定键
 * @param index 键的索引位置
 * @param callback 结果回调函数
 * @returns 
 */
export async function key(index: number, name: string, storeName: string, callback: (err: any, result?: any) => void) {
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `SELECT key FROM ${storeName} ORDER BY ROWID ASC LIMIT 1 OFFSET ?;`;

      const result = await new Promise<any>((resolve, reject) => {
        selectSql(sql, [index], (selectErr, results) => {
          if (selectErr) {
            reject(selectErr);
          } else {
            resolve(results);
          }
        });
      });

      return result.length > 0 ? result[0].key : null;
    } catch (error) {
      throw error;
    }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 获取指定库的全部键
 * @param callback 结果回调函数
 * @returns 
 */
export async function keys(name: string, storeName: string, callback: (err: any, result?: any) => void) {
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `SELECT key FROM ${storeName};`;

      const result = await new Promise<any[]>((resolve, reject) => {
        selectSql(sql, [], (selectErr, results) => {
          if (selectErr) {
            reject(selectErr);
          } else {
            resolve(results);
          }
        });
      });

      return result.map(row => row.key);
    } catch (error) {
      throw error;
    }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 获取当前库的所有key的数量
 * @param name 数据库名称
 * @param storeName 表名称
 * @param callback 结果回调函数
 * @returns
 */
export async function length(name: string, storeName: string, callback: (err: any, result?: any) => void) {
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `SELECT COUNT(key) as count FROM ${storeName};`;

      const result = await new Promise<number>((resolve, reject) => {
        selectSql(sql, [], (selectErr, results) => {
          if (selectErr) {
            reject(selectErr);
          } else {
            resolve(results.length > 0 && results[0].count ? results[0].count : 0);
          }
        });
      });

      return result;
    } catch (error) {
      throw error; 
    }
  };

  enqueueDbTask(task, (err, result) => {
    if (callback) {
      callback(err, result);
    }
  });
}

/**
 * @description 迭代指定库的所有数据
 * @param name 数据库的名称
 * @param storeName 存储名称
 * @param callback 进行迭代时的回调函数
 * @returns 
 */
export async function iterate(name: string, storeName: string, callback: (err: any, key: any, value: any, index: number) => void) {
  const task = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        checkStore(name, storeName, (checkErr) => {
          if (checkErr) {
            reject(checkErr);
          } else {
            resolve();
          }
        });
      });

      const sql = `SELECT key, value FROM ${storeName};`;

      const results = await new Promise<any[]>((resolve, reject) => {
        selectSql(sql, [], (selectErr, rows) => {
          if (selectErr) {
            reject(selectErr);
          } else {
            resolve(rows);
          }
        });
      });

      let index = 0;
      for (const row of results) {
        callback(null, row.key, row.value, index++);
      }
    } catch (error) {
      callback(error, null, null, 0);
      throw error; 
    }
  };

  enqueueDbTask(task, (err) => {
    if (err && callback) {
      callback(err, null, null, 0);
    }
  });
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
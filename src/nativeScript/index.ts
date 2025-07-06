import executeCallback from 'localforage/src/utils/executeCallback';
import normalizeKey from 'localforage/src/utils/normalizeKey';
import { openOrCreate, deleteDatabase } from '@nativescript-community/sqlite';

const dbConnections = {};

function getDB(options) {
    const { name } = options;
    if (!dbConnections[name]) {
        dbConnections[name] = openOrCreate(`:memory:${name}.db`);
    }
    return dbConnections[name];
}

async function checkStore(db, storeName) {
    try {
        const result = await db.get('SELECT name FROM sqlite_master WHERE type=? AND name=?', ['table', storeName]);
        if (result) {
            return true;
        }
        await db.execute('CREATE TABLE IF NOT EXISTS ' + storeName + ' (key PRIMARY KEY, value)');
        return true;
    } catch (error) {
        console.error('checkStore error', error);
        return false;
    }
}

export function _initStorage(options) {
    const db = getDB(options);
    const promise = checkStore(db, options.storeName);
    executeCallback(promise);
    return promise;
}

export function clear(callback) {
    const db = getDB(this._config);
    const promise = db.execute('DELETE FROM ' + this._config.storeName).then(() => undefined);
    executeCallback(promise, callback);
    return promise;
}

export function getItem(key, callback) {
    key = normalizeKey(key);
    const db = getDB(this._config);
    const promise = db.get('SELECT value FROM ' + this._config.storeName + ' WHERE key = ?', [key]).then(result => {
        if (result) {
            return result.value;
        }
        return null;
    });
    executeCallback(promise, callback);
    return promise;
}

export function iterate(iterator, callback) {
    const db = getDB(this._config);
    const promise = db.all('SELECT key, value FROM ' + this._config.storeName).then(results => {
        let i = 0;
        for (const row of results) {
            const result = iterator(row.value, row.key, i++);
            if (result !== undefined) {
                return result;
            }
        }
    });
    executeCallback(promise, callback);
    return promise;
}

export function key(n, callback) {
    const db = getDB(this._config);
    const promise = db.get('SELECT key FROM ' + this._config.storeName + ' LIMIT 1 OFFSET ?', [n]).then(result => {
        if (result) {
            return result.key;
        }
        return null;
    });
    executeCallback(promise, callback);
    return promise;
}

export function keys(callback) {
    const db = getDB(this._config);
    const promise = db.all('SELECT key FROM ' + this._config.storeName).then(results => results.map(row => row.key));
    executeCallback(promise, callback);
    return promise;
}

export function length(callback) {
    const db = getDB(this._config);
    const promise = db.get('SELECT COUNT(key) as count FROM ' + this._config.storeName).then(result => result.count);
    executeCallback(promise, callback);
    return promise;
}

export function removeItem(key, callback) {
    key = normalizeKey(key);
    const db = getDB(this._config);
    const promise = db.execute('DELETE FROM ' + this._config.storeName + ' WHERE key = ?', [key]).then(() => undefined);
    executeCallback(promise, callback);
    return promise;
}

export function setItem(key, value, callback) {
    key = normalizeKey(key);
    const db = getDB(this._config);
    const promise = db.execute('INSERT OR REPLACE INTO ' + this._config.storeName + ' (key, value) VALUES (?, ?)', [key, value]).then(() => value);
    executeCallback(promise, callback);
    return promise;
}

export function dropInstance(options, callback) {
    const db = dbConnections[options.name];
    const promise = new Promise<void>((resolve, reject) => {
        if (db) {
            db.close();
            delete dbConnections[options.name];
            deleteDatabase(options.name + '.db');
            resolve();
        } else {
            resolve();
        }
    });

    executeCallback(promise, callback);
    return promise;
}

export const nativeScriptSqliteDriver = {
    _driver: 'nativeScriptSqliteDriver',
    _initStorage: _initStorage,
    _support: () => typeof openOrCreate === 'function',
    clear: clear,
    getItem: getItem,
    iterate: iterate,
    key: key,
    keys: keys,
    length: length,
    removeItem: removeItem,
    setItem: setItem,
    dropInstance: dropInstance
};

export default nativeScriptSqliteDriver;
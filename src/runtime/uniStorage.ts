declare const uni: any;

//使用uni的storage重新实现一遍localForage
//setItem
export async function setItem(key: string, value: any, dbName: string, storeName: string): Promise<boolean> {
  return await uni.setStorage({
    key: 'localForage_' + dbName + '_' + storeName + '_' + key,
    data: value,
  }).then(() => {
    return true;
  }).catch(() => {
    return false;
  })
}

//getItem
export async function getItem(key: string, dbName: string, storeName: string): Promise<any> {
  return await uni.getStorage({
    key: 'localForage_' + dbName + '_' + storeName + '_' + key,
  }).then((res: any) => {
    return res.data;
  }).catch(() => {
    return null;
  })
}

//removeItem
export async function removeItem(key: string, dbName: string, storeName: string): Promise<boolean> {
  return await uni.removeStorage({
    key: 'localForage_' + dbName + '_' + storeName + '_' + key,
  }).then(() => {
    return true;
  }).catch(() => {
    return false;
  })
}

//keys
export async function keys(dbName: string, storeName: string): Promise<string[]> {
  return await uni.getStorageInfo({
  }).then((res: any) => {
    //生成一个新的数组，提取所有startWith('localForage_' + dbName + '_' + storeName + '_')的key
    let keys: string[] = [];
    for (let i = 0; i < res.keys.length; i++) {
      if (res.keys[i].startsWith('localForage_' + dbName + '_' + storeName + '_')) {
        keys.push(res.keys[i]);
      }
    }
    return keys;
  }).catch(() => {
    return [];
  })
}

//key:根据 key 的索引获取其名称
export async function key(n: number, dbName: string, storeName: string): Promise<string | null> {
  const ks = await keys(dbName, storeName);
  if (ks.length > n) {
    return ks[n];
  } else {
    return null;
  }
}

//LENGTH
export async function length(dbName: string, storeName: string): Promise<number> {
  const ks = await keys(dbName, storeName);
  return ks.length;
}

//clear
export async function clear(dbName: string, storeName: string): Promise<boolean> {
  const ks = await keys(dbName, storeName);
  for (let i = 0; i < ks.length; i++) {
    await removeItem(ks[i], dbName, storeName);
  }
  return true;
}
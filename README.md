# @uni-helper/localforage-adapter

[![NPM version](https://img.shields.io/npm/v/@uni-helper/localforage-adapter?color=a1b858&label=)](https://www.npmjs.com/package/@uni-helper/localforage-adapter)

此项目所有主要功能和目标均已完成，但是由于未经过严格测试，所以暂时不建议在生产环境中使用。

## 安装

```bash
# pnpm
pnpm install @uni-helper/localforage-adapter
# npm
npm install @uni-helper/localforage-adapter --save
# yarn
yarn add @uni-helper/localforage-adapter
```

## 使用

```js
import { uniStorageDriver, sqliteDriver } from "@uni-helper/localforage-adapter"
import localforage from "localforage"

localforage.defineDriver(uniStorageDriver);
// 可以使用 #ifdef 等UniAPP特有条件编译注释符
localforage.setDriver([
  uniStorageDriver._driver // 或者"uniStorageDriver"
  sqliteDriver._driver // 或者"sqliteDriver"
]);
```

## License

[MIT](./LICENSE) License &copy; 2023-PRESENT [Uni-Helper](https://github.com/uni-helper)

# @uni-helper/localforage-adapter

[![NPM version](https://img.shields.io/npm/v/@uni-helper/localforage-adapter?color=a1b858&label=)](https://www.npmjs.com/package/@uni-helper/localforage-adapter)

## 注意

此项目正在开发中，目前可用的驱动器仅 `uniStorage`，使用方法如下所示：

```js
import { uniStorageDriver } from "@uni-helper/localforage-adapter"
import localforage from "localforage"

localforage.defineDriver(uniStorageDriver);
// 可以使用 #ifdef 等UniAPP特有条件编译注释符
localforage.setDriver([
  uniStorageDriver._driver // 或者"uniStorageDriver"
]);
```

## License

[MIT](./LICENSE) License &copy; 2023-PRESENT [Uni-Helper](https://github.com/uni-helper)

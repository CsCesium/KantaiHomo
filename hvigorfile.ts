import { appTasks } from '@ohos/hvigor-ohos-plugin';

export default {
  system: appTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [],       /* Custom plugin to extend the functionality of Hvigor. */
  buildOption: {
    define: {
      __DEV__: process.env.BUILD_MODE !== 'release'
    }
  }
}
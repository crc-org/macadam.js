# macadam.js
An NPM library to work with macadam from Node projects

## Installation

The library is published on GitHub NPM registry. 

You need to indicate in `.npmrc` where is located the package, and you need to authenticate with a GitHub token (classic) having `read:packages` scope:

.npmrc
```
@crc-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<TOKEN>
```

Then you can install the package for your project:

```
npm i @crc-org/macadam.js@latest
```

## Usage

```typescript
import * as macadamjs from '@crc-org/macadam.js';

const macadam = new macadamjs.Macadam('my-ext');
await macadam.init();
await macadam.createVm({
  name: 'my-vm',
  imagePath: '/path/to/image.raw',
  username: 'core',
});
const vms = await macadam.listVms({});
console.log('==> vms', vms);

const startResult = await macadam.startVm({
    name: 'my-vm',
});
console.log('==> start', startResult);

const stopResult = await macadam.stopVm({
    name: 'my-vm',
});
console.log('==> stop', stopResult);

const rmResult = await macadam.removeVm({
    name: 'my-vm',
});
console.log('==> rm result', rmResult);

const vms0 = await macadam.listVms({});
console.log('==> vms after rm', vms0);
```

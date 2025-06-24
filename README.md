# macadam.js
An NPM library to work with macadam from Node projects

## Installation

To install the package for your project:

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

const executeResult = await macadam.executeCommand({
    name: 'my-vm',
    command: 'ls',
    args: [ 'ls' ],
});
console.log('==> execute', executeResult);

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

## Details

The `type` passed to the constructor is used to differentiate images between callers. When a caller uses the `my-ext` type,
the images it creates with `startVm({ name: 'vm1' })` will have a real name `my-ext-vm1`. This real name is only visible when executing `macadam list`, 
but will be transparent when calling `listVms({})`: this call will display the name `vm1`, and will display only the machines whose real name is prefixed by `my-ext`.

/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import { existsSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { dirname, resolve } from 'node:path';

import * as extensionApi from '@podman-desktop/api';

import { MACADAM_MACOS_PATH, MACADAM_VERSION, PACKAGE_NAME } from './consts';

type Resolver = (request: string, options?: NodeJS.RequireResolveOptions) => string;

export interface AreBinariesAvailableOptions {
  // if true, also check if the version of the binary matches the version installed by the library, only on macOS
  checkVersion?: boolean;
}

export interface InitOptions {
  // if true, upgrade the binaries to the current version, only on macOS
  upgradeBinaries?: boolean;
}

export interface CommonOptions {
  // env vars
  containerProvider?: 'wsl' | 'hyperv' | 'applehv'; // CONTAINERS_MACHINE_PROVIDER

  // other run options
  runOptions?: extensionApi.RunOptions;
}

export interface CreateVmOptions extends CommonOptions {
  // positional args
  imagePath: string;
  // flags
  name: string; // --name
  sshIdentityPath?: string; // --ssh-identity-path
  username?: string; // -- username
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListVmsOptions extends CommonOptions {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RemoveVmOptions extends CommonOptions {
  // positional args
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StartVmOptions extends CommonOptions {
  // positional args
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StopVmOptions extends CommonOptions {
  // positional args
  name: string;
}

export interface ExecuteCommandOptions extends CommonOptions {
  // positional args
  name: string;
  command: string;
  args: string[];
}

export interface VmDetails {
  Name: string;
  Image: string;
  CPUs: number;
  Memory: string;
  DiskSize: string;
  Running: boolean;
  Starting: boolean;
  Port: number;
  RemoteUsername: string;
  IdentityPath: string;
  VMType: string;
}

export class Macadam {
  #initialized: boolean = false;
  // path of the `macadam` cli
  #macadamPath: string = '';
  // #utilitiesPath is undefined if no utilities are needed on the local platform (currently Windows)
  #utilitiesPath?: string;

  // prefix added to machine names to differentiate machines between users
  #vmNamePrefix: string;

  constructor(private type: string) {
    this.#vmNamePrefix = `${type}-`;
  }

  /**
   * Checks whether binaries are available or if they will be made available by init().
   *
   * @returns true if init() can be called without having to install the binaries
   * - macOS: checks if binary exists (init() will install it if missing)
   * - Windows: always true (binary is expected to be bundled with library, init() won't install it)
   * - Linux: always true (binary is a prerequisite, init() won't install it)
   */
  async areBinariesAvailable(options?: AreBinariesAvailableOptions): Promise<boolean> {
    if (!extensionApi.env.isMac) {
      return true;
    }
    const macadamPath = resolve(MACADAM_MACOS_PATH, 'macadam');
    if (!existsSync(macadamPath)) {
      return false;
    }
    if (options?.checkVersion) {
      return await this.isVersionUpToDate(macadamPath);
    }
    return true;
  }

  async init(options?: InitOptions): Promise<void> {
    return this._init(require.resolve, options);
  }

  protected async _init(resolver?: Resolver, options?: InitOptions): Promise<void> {
    resolver ??= require.resolve;
    this.#macadamPath = extensionApi.env.isMac
      ? await this.findInstallMacadam(resolver, options)
      : await this.findMacadamPath(resolver);
    if (extensionApi.env.isMac) {
      this.#utilitiesPath = MACADAM_MACOS_PATH;
    }
    this.#initialized = true;
  }

  async findMacadamPath(resolver: Resolver): Promise<string> {
    let bin = '';
    if (extensionApi.env.isWindows) {
      bin = 'macadam-windows-amd64.exe';
    } else if (extensionApi.env.isMac) {
      bin = 'macadam-installer-macos-universal.pkg';
    } else if (extensionApi.env.isLinux) {
      // hardcoded for the moment, the binary must be installed manually on this directory
      // and gvproxy must be installed as /usr/local/libexec/podman/gvproxy
      return '/usr/local/bin/macadam';
    }
    if (!bin) {
      throw new Error(`binary not found for platform ${platform()} and architecture ${arch()}`);
    }
    const packagePath = dirname(resolver(`${PACKAGE_NAME}/package.json`));
    return resolve(packagePath, 'binaries', bin);
  }

  async findInstallMacadam(resolver: Resolver, options?: InitOptions): Promise<string> {
    const macadamPath = resolve(MACADAM_MACOS_PATH, 'macadam');
    if (!existsSync(macadamPath) || (options?.upgradeBinaries && !(await this.isVersionUpToDate(macadamPath)))) {
      const installer = await this.findMacadamPath(resolver);
      await extensionApi.process.exec('installer', ['-pkg', installer, '-target', '/'], { isAdmin: true });
    }
    return macadamPath;
  }

  protected getMacadamPath(): string {
    return this.#macadamPath;
  }

  protected getUtilitiesPath(): string | undefined {
    return this.#utilitiesPath;
  }

  protected async isVersionUpToDate(macadamPath: string): Promise<boolean> {
    try {
      const result = await extensionApi.process.exec(macadamPath, ['--version']);
      return result.stdout.trim().endsWith(MACADAM_VERSION);
    } catch (error) {
      // If we can't determine the version, treat it as not up to date
      return false;
    }
  }

  //
  // Below, init should have been called
  //

  // createVm executes `macadam init` and returns stdout
  // If stderr is not empty, throws an error
  async createVm(options: CreateVmOptions): Promise<extensionApi.RunResult> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    const parameters: string[] = ['init', options.imagePath, '--name', this.realMachineName(options.name)];
    if (options.sshIdentityPath) {
      parameters.push('--ssh-identity-path');
      parameters.push(options.sshIdentityPath);
    }
    if (options.username) {
      parameters.push('--username');
      parameters.push(options.username);
    }

    return await extensionApi.process.exec(
      this.#macadamPath,
      parameters,
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  // listVms executes `macadam list --format json` and returns the list of VMs
  // If stderr is not empty, throws an error
  async listVms(options: ListVmsOptions): Promise<VmDetails[]> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    const cmdResult = await extensionApi.process.exec(
      this.#macadamPath,
      ['list', '--format', 'json'],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
    if (!cmdResult.stdout) {
      return [];
    }
    const list = JSON.parse(cmdResult.stdout);
    const result: VmDetails[] = [];
    if (Array.isArray(list)) {
      const vms = list;
      for (const vm of vms) {
        if (this.isVmDetails(vm)) {
          result.push(vm);
        }
      }
    }
    return result
      .filter(vm => this.isMachineOwned(vm.Name))
      .map(vm => ({
        ...vm,
        Name: this.visibleMachineName(vm.Name),
      }));
  }

  async removeVm(options: RemoveVmOptions): Promise<extensionApi.RunResult> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath,
      ['rm', '-f', this.realMachineName(options.name)],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  async startVm(options: StartVmOptions): Promise<extensionApi.RunResult> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath,
      ['start', this.realMachineName(options.name)],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  async stopVm(options: StopVmOptions): Promise<extensionApi.RunResult> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath,
      ['stop', this.realMachineName(options.name)],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  async executeCommand(options: ExecuteCommandOptions): Promise<extensionApi.RunResult> {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath,
      ['ssh', this.realMachineName(options.name), options.command, ...options.args],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  protected isVmDetails(vm: unknown): vm is VmDetails {
    return (
      !!vm &&
      typeof vm === 'object' &&
      'Name' in vm &&
      'Image' in vm &&
      'Running' in vm &&
      'Starting' in vm &&
      'CPUs' in vm &&
      'Memory' in vm &&
      'DiskSize' in vm &&
      'Port' in vm &&
      'RemoteUsername' in vm &&
      'IdentityPath' in vm &&
      'VMType' in vm
    );
  }

  protected getFinalOptions(runOptions?: extensionApi.RunOptions, containerProvider?: string): extensionApi.RunOptions {
    const finalOptions: extensionApi.RunOptions = {
      ...(runOptions ?? {}),
    };

    if (containerProvider) {
      finalOptions.env = {
        ...(finalOptions.env ?? {}),
        CONTAINERS_MACHINE_PROVIDER: containerProvider,
      };
    }
    if (this.#utilitiesPath) {
      finalOptions.env = {
        ...(finalOptions.env ?? {}),
        CONTAINERS_HELPER_BINARY_DIR: this.#utilitiesPath,
      };
    }
    return finalOptions;
  }

  protected isMachineOwned(realName: string): boolean {
    return realName.startsWith(this.#vmNamePrefix);
  }

  protected realMachineName(visibleName: string): string {
    return `${this.#vmNamePrefix}${visibleName}`;
  }

  protected visibleMachineName(realName: string): string {
    if (!this.isMachineOwned(realName)) {
      throw new Error('visibleMachineName called on a non owned machine. Please filter machines with isMachineOwned');
    }
    return realName.slice(this.#vmNamePrefix.length);
  }
}

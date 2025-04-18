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
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { PACKAGE_NAME } from './consts';
import * as extensionApi from '@podman-desktop/api';

type Resolver = (request: string, options?: NodeJS.RequireResolveOptions) => string;

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
  sshIdentityPath?: string; // --ssh-identity-path
  username?: string; // -- username
}

export interface ListVmsOptions extends CommonOptions {}

export interface RemoveVmOptions extends CommonOptions {}

export interface StartVmOptions extends CommonOptions {}

export interface StopVmOptions extends CommonOptions {}

export interface VmDetails {
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
  
  constructor(private type: string) {}

  async init(): Promise<void> {
    return this._init(require.resolve);
  }

  protected async _init(resolver?: Resolver): Promise<void> {
    if (!resolver) {
      resolver = require.resolve;
    }
    this.#macadamPath = await this.findMacadamPath(resolver);
    if (extensionApi.env.isMac) {
      this.#utilitiesPath = await this.findUtilitiesPath();
    }
    this.#initialized = true;
  }

  async findMacadamPath(resolver: Resolver): Promise<string> {
    let bin = '';
    if (extensionApi.env.isWindows) {
      bin = 'macadam-windows-amd64.exe';
    } else if (extensionApi.env.isMac) {
      if (os.arch() === 'arm64') {
        bin = 'macadam-darwin-arm64';
      } else if (os.arch() == 'x64') {
        bin = 'macadam-darwin-amd64';
      }
    }
    if (!bin) {
      throw new Error(`binary not found for platform ${os.platform()} and architecture ${os.arch()}`);
    }
    const packagePath = path.dirname(resolver(`${PACKAGE_NAME}/package.json`));
  
    const filepath = path.resolve(packagePath, 'binaries', bin);
    await fs.promises.chmod(filepath, '755');
    return filepath;
  }

  async findUtilitiesPath(): Promise<string> {
    const utilities = ['vfkit', 'gvproxy'];
    let result: string = '';
    for (const utility of utilities) {
      const utilityPath = await this.findExecutableInPath(utility);
      const utiliyDir = path.dirname(utilityPath);
      if (result && utiliyDir !== result) {
        throw new Error(`utilities must be in the same directory: ${utilities.join(', ')}`);
      }
      result = utiliyDir;
    }
    return result;
  }

  async findExecutableInPath(executable: string): Promise<string> {
    if (extensionApi.env.isMac) {
      // grab full path for Linux and mac
      const { stdout: fullPath } = await extensionApi.process.exec('which', [executable]);
      return fullPath;
    } else if (extensionApi.env.isWindows) {
      // grab full path for Windows
      const { stdout: fullPath } = await extensionApi.process.exec('where.exe', [executable]);
      // remove all line break/carriage return characters from full path
      return fullPath.replace(/(\r\n|\n|\r)/gm, '');
    }
    throw new Error('Platform not supported: only Mac and Windows platforms are supported');
  }

  protected getMacadamPath(): string {
    return this.#macadamPath;
  }

  protected getUtilitiesPath(): string | undefined {
    return this.#utilitiesPath;
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
    const parameters: string[] = ['init', options.imagePath];
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
    return result;
  }

  async removeVm(options: RemoveVmOptions) {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath, 
      ['rm', '-f'],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  async startVm(options: StartVmOptions) {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath, 
      ['start'],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  async stopVm(options: StopVmOptions) {
    if (!this.#initialized) {
      throw new Error('component not initialized. You must call init() before');
    }
    return await extensionApi.process.exec(
      this.#macadamPath, 
      ['stop'],
      this.getFinalOptions(options.runOptions, options.containerProvider),
    );
  }

  protected isVmDetails(vm: unknown): vm is VmDetails {
    return !!vm && 
      typeof vm === 'object' &&
      'Image' in vm &&
      'Running' in vm &&
      'Starting' in vm &&
      'CPUs' in vm &&
      'Memory' in vm &&
      'DiskSize' in vm &&
      'Port' in vm &&
      'RemoteUsername' in vm &&
      'IdentityPath' in vm &&
      'VMType' in vm;
  }

  protected getFinalOptions(runOptions?: extensionApi.RunOptions, containerProvider?: string): extensionApi.RunOptions {
    const finalOptions: extensionApi.RunOptions = { 
      ...runOptions ?? {},
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
}

import Node from '../../models/node';
import { readNode } from '../file-system/reader';
import { writeNode } from '../file-system/writer';
import fs from 'fs';
import path from 'path';

export default class Cache {
  nodes: Map<string, Node> = new Map();
  usageCount = 0;
  lruRank: Map<string, number> = new Map();
  lastPages: Map<string, number> = new Map();
  cacheLimit = 100;
  cacheEvictionPercentage = 0.3;
  evicting = false;

  constructor(cacheLimit: number) {
    this.cacheLimit = cacheLimit;
  }

  async getNode(path: string) {
    let result: Node;

    if (this.nodes.has(path)) {
      result = this.nodes.get(path)!;
      this.updateNodeFrequency(path);
    } else {
      result = await readNode(path);
      this.nodes.set(path, result);
      this.lruRank.set(path, 0);
    }
    await this.applyCacheEviction();
    return result;
  }

  updateNodeFrequency(key: string) {
    this.lruRank.set(key, this.usageCount);
    this.usageCount += 1;
  }

  async addNode(path: string, node: Node) {
    this.lruRank.set(path, 0);
    this.nodes.set(path, node);
    await this.applyCacheEviction();
  }

  *getFilesRecurs(folder: string): Generator<string> {
    const files = fs.readdirSync(folder, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        yield* this.getFilesRecurs(path.join(folder, file.name));
      } else {
        yield file.name;
      }
    }
  }

  getLastPage(folder: string): number {
    if (!this.lastPages.has(folder)) {
      if (!fs.existsSync(folder)) {
        return NaN;
      }
      const fileNumbers: number[] = [];
      for (const file of this.getFilesRecurs(folder)) {
        const match = file.match(/\d*/);
        if (match) {
          const parsedNumber = match.length && parseInt(match[0]);
          if (parsedNumber && !isNaN(parsedNumber))
            fileNumbers.push(parsedNumber);
        }
      }

      fileNumbers.sort((a, b) => b - a);
      if (fileNumbers.length) {
        this.lastPages.set(folder, fileNumbers[0]);
      } else {
        return NaN; // let's not cache this as it's a starting point
      }
    }

    return this.lastPages.get(folder)!;
  }

  updateLastPage(folder: string, value: number) {
    this.lastPages.set(folder, value);
  }

  async applyCacheEviction() {
    if (this.nodes.size > this.cacheLimit && !this.evicting) {
      // Determine least frequently used node
      const lruEntries = Array.from(this.lruRank.entries());
      lruEntries.sort(([k1, v1], [k2, v2]) => v1 - v2);
      const keys = lruEntries
        .map(([k, v]) => k)
        .slice(0, Math.floor(this.cacheEvictionPercentage * this.cacheLimit));
      if (keys) {
        this.evictFromCache(keys);
      }
    }
  }

  async evictFromCache(keys: string[]) {
    this.evicting = true;
    const listOfPromises: Promise<void>[] = [];
    for (const key of keys) {
      const node = this.nodes.get(key);
      if (node) {
        listOfPromises.push(writeNode(node, key));
      }
    }
    await Promise.all(listOfPromises);
    for (const key of keys) {
      this.nodes.delete(key);
      this.lruRank.delete(key);
    }
    this.evicting = false;
  }

  async flush() {
    await this.evictFromCache(Array.from(this.nodes.keys()));
  }
}

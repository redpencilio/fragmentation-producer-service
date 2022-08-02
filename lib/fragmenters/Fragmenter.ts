import { DataFactory, NamedNode } from 'n3';
import Node from '../models/node';
import Resource from '../models/resource';
import * as RDF from 'rdf-js';
import path from 'path';
import Cache from '../storage/cache';
import { STREAM_PREFIX } from '../utils/constants';
const { namedNode } = DataFactory;

export interface FragmenterArgs {
  folder: string;
  relationPath: RDF.NamedNode;
  maxResourcesPerPage: number;
  maxNodeCountPerFolder: number;
  folderDepth: number;
  cache: Cache;
}
export default abstract class Fragmenter {
  folder: string;
  maxResourcesPerPage: number;
  relationPath: RDF.NamedNode;
  cache: Cache;
  maxNodeCountPerFolder: number;
  folderDepth: number;

  constructor({
    folder,
    maxResourcesPerPage,
    relationPath,
    maxNodeCountPerFolder,
    folderDepth,
    cache,
  }: FragmenterArgs) {
    this.folder = folder;
    this.maxResourcesPerPage = maxResourcesPerPage;
    this.relationPath = relationPath;
    this.maxNodeCountPerFolder = maxNodeCountPerFolder;
    this.folderDepth = folderDepth;
    this.cache = cache;
  }
  constructNewNode(): Node {
    const nodeId = (this.cache.getLastPage(this.folder) || 0) + 1;
    this.cache.updateLastPage(this.folder, nodeId);
    const node = new Node(
      nodeId,
      STREAM_PREFIX(this.folder),
      this.getRelationReference(nodeId, 1)
    );
    return node;
  }

  fileForNode(nodeId: number): string {
    // Determine in which subfolder nodeId should be located
    let subFolder: string = this.determineSubFolder(nodeId);
    return path.join(this.folder, subFolder, `${nodeId}.ttl`);
  }

  determineSubFolder(nodeId: number): string {
    if (nodeId === 1) {
      return '';
    } else {
      let folderChain: string[] = [];
      let rest = nodeId;
      let divider = this.maxNodeCountPerFolder;
      for (let i = 1; i < this.folderDepth; i++) {
        let wholeDiv = Math.floor(rest / divider) % divider;
        let folderNumber = wholeDiv + 1;
        folderChain.unshift(folderNumber.toString());
        rest = rest - wholeDiv * this.maxNodeCountPerFolder;
        divider = divider * this.maxNodeCountPerFolder;
      }
      folderChain.unshift('');
      return path.join(...folderChain);
    }
  }

  getRelationReference(sourceNodeId: number, targetNodeId: number): NamedNode {
    let sourceSubFolder: string = this.determineSubFolder(sourceNodeId);
    let targetSubFolder: string = this.determineSubFolder(targetNodeId);

    let relativePath = path.join(
      path.relative(sourceSubFolder, targetSubFolder),
      targetNodeId.toString()
    );
    if (!relativePath.startsWith('..')) {
      relativePath = `./${relativePath}`;
    }
    return namedNode(relativePath);
  }

  getViewFile() {
    return this.fileForNode(1);
  }

  shouldCreateNewPage(node: Node): boolean {
    return node.count() >= this.maxResourcesPerPage;
  }

  abstract addResource(resource: Resource): Promise<Node | null>;
}

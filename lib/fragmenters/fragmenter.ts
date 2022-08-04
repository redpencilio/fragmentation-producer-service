import { DataFactory, NamedNode } from 'n3';
import Node from '../models/node';
import * as RDF from 'rdf-js';
import path from 'path';
import Cache from '../storage/caching/cache';
import { STREAM_PREFIX } from '../utils/constants';
import MemberNew from '../models/member-new';
const { namedNode } = DataFactory;

export interface FragmenterArgs {
  folder: string;
  maxResourcesPerPage: number;
  maxNodeCountPerSubFolder: number;
  folderDepth: number;
  cache: Cache;
}
export default abstract class Fragmenter {
  folder: string;
  maxResourcesPerPage: number;
  abstract relationPath: RDF.NamedNode;
  cache: Cache;
  maxNodeCountPerSubFolder: number;
  folderDepth: number;

  constructor({
    folder,
    maxResourcesPerPage,
    maxNodeCountPerSubFolder,
    folderDepth,
    cache,
  }: FragmenterArgs) {
    this.folder = folder;
    this.maxResourcesPerPage = maxResourcesPerPage;
    this.maxNodeCountPerSubFolder = maxNodeCountPerSubFolder;
    this.folderDepth = folderDepth;
    this.cache = cache;
  }
  constructNewNode(): Node {
    const nodeId = (this.cache.getLastPage(this.folder) || 0) + 1;
    this.cache.updateLastPage(this.folder, nodeId);
    const node = new Node({
      id: nodeId,
      stream: STREAM_PREFIX(this.folder),
      view: this.getRelationReference(nodeId, 1),
    });
    return node;
  }

  fileForNode(nodeId: number): string {
    // Determine in which subfolder nodeId should be located
    const subFolder: string = this.determineSubFolder(nodeId);
    return path.join(this.folder, subFolder, `${nodeId}.ttl`);
  }

  determineSubFolder(nodeId: number): string {
    if (nodeId === 1) {
      return '';
    } else {
      const folderChain: string[] = [];
      let rest = nodeId;
      let divider = this.maxNodeCountPerSubFolder;
      for (let i = 1; i < this.folderDepth; i++) {
        const wholeDiv = Math.floor(rest / divider) % divider;
        const folderNumber = wholeDiv + 1;
        folderChain.unshift(folderNumber.toString());
        rest = rest - wholeDiv * this.maxNodeCountPerSubFolder;
        divider = divider * this.maxNodeCountPerSubFolder;
      }
      folderChain.unshift('');
      return path.join(...folderChain);
    }
  }

  protected getRelationReference(
    sourceNodeId: number,
    targetNodeId: number
  ): NamedNode {
    const sourceSubFolder: string = this.determineSubFolder(sourceNodeId);
    const targetSubFolder: string = this.determineSubFolder(targetNodeId);

    let relativePath = path.join(
      path.relative(sourceSubFolder, targetSubFolder),
      targetNodeId.toString()
    );
    if (!relativePath.startsWith('..')) {
      relativePath = `./${relativePath}`;
    }
    return namedNode(relativePath);
  }

  protected getViewFile() {
    return this.fileForNode(1);
  }

  protected shouldCreateNewPage(node: Node): boolean {
    return node.count >= this.maxResourcesPerPage;
  }

  abstract addMember(resource: MemberNew): Promise<Node | null>;
}

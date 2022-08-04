import { DataFactory } from 'n3';
import {
  generateTreeRelation,
  generateVersion,
  nowLiteral,
} from '../utils/utils';
import Fragmenter from './fragmenter';

const { namedNode } = DataFactory;

import { PURL, TREE } from '../utils/namespaces';
import Member from '../models/member';
import Node from '../models/node';
import Relation from '../models/relation';
import * as RDF from '@rdfjs/types';
import { TIME_TREE_RELATION_PATH } from '../utils/constants';

export default class TimeFragmenter extends Fragmenter {
  relationPath: RDF.NamedNode<string> = namedNode(TIME_TREE_RELATION_PATH);

  constructVersionedResource(resource: Member): Member {
    const versionedResourceId = generateVersion(resource.id);
    const versionedResource = new Member(versionedResourceId);

    versionedResource.dataMap = new Map(resource.dataMap);

    const dateLiteral = nowLiteral();

    // add resources about this version
    versionedResource.addProperty(PURL('isVersionOf').value, resource.id);

    versionedResource.addProperty(this.relationPath.value, dateLiteral);

    return versionedResource;
  }

  async closeNode(node: Node, timestamp: RDF.Literal): Promise<Node> {
    const currentNode = this.constructNewNode();
    node.add_relation(
      new Relation(
        generateTreeRelation(),
        TREE('GreaterThanOrEqualRelation'),
        timestamp,
        this.getRelationReference(node.metadata.id, currentNode.metadata.id),
        currentNode.metadata.id,
        this.relationPath
      )
    );
    this.cache.addNode(this.fileForNode(currentNode.metadata.id), currentNode);
    return currentNode;
  }

  async writeVersionedMember(versionedResource: Member): Promise<Node> {
    const lastPageNr = this.cache.getLastPage(this.folder);
    let currentNode: Node;
    let pageFile;
    if (lastPageNr) {
      pageFile = this.fileForNode(lastPageNr);
      currentNode = await this.cache.getNode(pageFile);
    } else {
      currentNode = this.constructNewNode();
      pageFile = this.fileForNode(currentNode.metadata.id);
      this.cache.addNode(pageFile, currentNode);
    }

    // let currentDataset = await createStore(readTriplesStream(pageFile));

    if (this.shouldCreateNewPage(currentNode)) {
      const closingNode = currentNode;
      const timestampLastResource = versionedResource.dataMap.get(
        this.relationPath.value
      )![0];
      // create a store with the new graph for the new file
      currentNode = await this.closeNode(
        closingNode,
        timestampLastResource as RDF.Literal
      );

      currentNode.add_member(versionedResource);

      // Clear the last page cache
    } else {
      currentNode.add_member(versionedResource);
    }
    return currentNode;
  }

  async addMember(resource: Member): Promise<Node> {
    const versionedResource: Member = this.constructVersionedResource(resource);
    const lastDataset = await this.writeVersionedMember(versionedResource);
    return lastDataset;
  }
}

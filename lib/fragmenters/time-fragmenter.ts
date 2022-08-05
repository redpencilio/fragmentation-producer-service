import { DataFactory } from 'n3';
import {
  generateTreeRelation,
  generateVersion,
  getFirstMatch,
  nowLiteral,
} from '../utils/utils';
import Fragmenter from './fragmenter';

const { namedNode, quad } = DataFactory;

import { PURL, TREE } from '../utils/namespaces';
import Node from '../models/node';
import Relation from '../models/relation';
import * as RDF from '@rdfjs/types';
import { TIME_TREE_RELATION_PATH } from '../utils/constants';
import Member from '../models/member';

export default class TimeFragmenter extends Fragmenter {
  relationPath: RDF.NamedNode<string> = namedNode(TIME_TREE_RELATION_PATH);

  constructVersionedMember(member: Member): Member {
    const versionedResourceId = generateVersion(member.id);
    const versionedMember = new Member(versionedResourceId);
    member.data.forEach(
      (quadObj) => {
        if (quadObj.subject.equals(member.id)) {
          versionedMember.addQuads(
            quad(
              versionedResourceId,
              quadObj.predicate,
              quadObj.object,
              quadObj.graph
            )
          );
        } else {
          versionedMember.addQuads(quadObj);
        }
      },
      null,
      null,
      null,
      null
    );

    const dateLiteral = nowLiteral();

    // add resources about this version
    versionedMember.addQuads(
      quad(versionedMember.id, PURL('isVersionOf'), member.id),
      quad(versionedMember.id, this.relationPath, dateLiteral)
    );

    return versionedMember;
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

  async addVersionedMember(versionedMember: Member): Promise<Node> {
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
      const timestampLastMember = getFirstMatch(
        versionedMember.data,
        versionedMember.id,
        this.relationPath
      )!.object;
      // create a store with the new graph for the new file
      currentNode = await this.closeNode(
        closingNode,
        timestampLastMember as RDF.Literal
      );
    }
    currentNode.add_member(versionedMember);
    return currentNode;
  }

  async addMember(resource: Member): Promise<Node> {
    const versionedResource: Member = this.constructVersionedMember(resource);
    const lastDataset = await this.addVersionedMember(versionedResource);
    return lastDataset;
  }
}

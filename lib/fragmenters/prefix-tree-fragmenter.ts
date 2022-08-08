import { DataFactory } from 'n3';
const { literal } = DataFactory;
import Node from '../models/node';
import Relation from '../models/relation';
import { TREE } from '../utils/namespaces';
import { generateTreeRelation, getFirstMatch } from '../utils/utils';
import * as RDF from 'rdf-js';

import Fragmenter from './fragmenter';
import RelationCache from '../storage/caching/relationCache';
import { namedNode } from '@rdfjs/data-model';
import { PREFIX_TREE_RELATION_PATH } from '../utils/constants';
import Member from '../models/member';

export default class PrefixTreeFragmenter extends Fragmenter {
  relationPath: RDF.NamedNode<string> = namedNode(PREFIX_TREE_RELATION_PATH);
  relationCache: RelationCache = new RelationCache();
  async addMember(member: Member): Promise<Node | null> {
    const viewFile = this.getViewFile();
    let viewNode: Node;
    // Check if the view node exists, if not, create one

    try {
      viewNode = await this.cache.getNode(viewFile);
    } catch (e) {
      viewNode = this.constructNewNode();
      await this.cache.addNode(this.getViewFile(), viewNode);
      this.relationCache.addRelation('', this.getViewFile());
    }
    let node = viewNode;
    let currentValue = '';
    // Find longest prefix which is stored in prefixCache
    const resourceValue = getFirstMatch(
      member.data,
      member.id,
      this.relationPath
    )?.object.value.toLowerCase();
    if (resourceValue) {
      const match = this.relationCache.getLongestMatch(resourceValue);

      if (match) {
        node = await this.cache.getNode(match.nodeFile);
        currentValue = match.prefix;
      }
      const result = await this._addResource(
        member,
        node,
        currentValue,
        resourceValue,
        currentValue.length
      );

      return result;
    }
    throw new Error(
      `No triple with predicate ${this.relationPath.value} found`
    );
  }

  async _addResource(
    member: Member,
    node: Node,
    prefixValue = '',
    resourceValue: string,
    depth = 0
  ): Promise<Node> {
    let childMatch = node.relationsMap.get(prefixValue + resourceValue[depth]);
    console.log(prefixValue + resourceValue[depth]);
    console.log(node.relationsMap);
    let curDepth = depth;
    let curPrefixValue = prefixValue;
    let curNode = node;
    while (childMatch && curDepth <= resourceValue.length) {
      // Check if we have to add the resource to a child of the current node, to the current node itself or if we have to split the current node.
      curNode = await this.cache.getNode(this.fileForNode(childMatch.targetId));
      curDepth += 1;
      curPrefixValue = childMatch.value.value;
      childMatch = curNode.relationsMap.get(
        curPrefixValue + resourceValue[curDepth]
      );
    }

    // Add the resource to the current node, if it is full: split.
    if (this.shouldCreateNewPage(node)) {
      curNode.add_member(member);
      // the current node has to be splitted
      await this.splitNode(curNode, prefixValue, resourceValue, depth);
    } else {
      // we can simply add the new resource to the current node as a member
      curNode.add_member(member);
    }

    return curNode;
  }

  async splitNode(
    node: Node,
    currentValue: string,
    resourceValue: string,
    depth: number
  ) {
    if (depth >= resourceValue.length) {
      return;
    }
    // Determine the token at the given depth which occurs the most and split off members matching that specific token
    const memberGroups: { [key: string]: Member[] } = {};
    let pathValue: RDF.Term | undefined;
    node.members.forEach((member) => {
      pathValue = getFirstMatch(member.data, null, this.relationPath)?.object;
      if (pathValue) {
        const character = pathValue.value.charAt(depth).toLowerCase();
        if (memberGroups[character]) {
          memberGroups[character].push(member);
        } else {
          memberGroups[character] = [member];
        }
      }
    });
    const mostOccuringToken = Object.keys(memberGroups).reduce((k1, k2) =>
      memberGroups[k1].length > memberGroups[k2].length ? k1 : k2
    );
    let newRelationType: RDF.Term;
    if (mostOccuringToken === '') {
      newRelationType = TREE('EqualsRelation');
      // if the mostOccuringToken is an empty string => a lot of members have the same value for path => add equalrelation
    } else {
      newRelationType = TREE('PrefixRelation');
      // else create a new relation and node with prefix value containing mostOccuringToken
    }
    const newNode: Node = this.constructNewNode();
    node.add_relation(
      new Relation(
        generateTreeRelation(),
        newRelationType,
        literal(currentValue + mostOccuringToken),
        this.getRelationReference(node.metadata.id, newNode.metadata.id),
        newNode.metadata.id,
        this.relationPath
      )
    );

    node.delete_members(memberGroups[mostOccuringToken]);
    newNode.add_members(...memberGroups[mostOccuringToken]);
    await this.cache.addNode(this.fileForNode(newNode.metadata.id), newNode);
    this.relationCache.addRelation(
      currentValue + mostOccuringToken,
      this.fileForNode(newNode.metadata.id)
    );
  }
}

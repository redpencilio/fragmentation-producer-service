import { DataFactory } from 'n3';
const { namedNode } = DataFactory;
import Relation from './relation';
import * as RDF from 'rdf-js';
import MemberNew from './member-new';

export type Metadata = {
  id: number;
  stream: RDF.NamedNode;
  view: RDF.NamedNode;
};

export default class Node {
  members: MemberNew[] = [];
  relationsMap: Map<string, Relation> = new Map();

  constructor(readonly metadata: Metadata) {}

  get idNamedNode() {
    return namedNode(`./${this.metadata.id}`);
  }

  get count() {
    return this.members.length;
  }

  add_members(...members: MemberNew[]) {
    this.members.push(...members);
  }

  add_member(member: MemberNew) {
    this.members.push(member);
  }

  add_relation(relation: Relation) {
    this.relationsMap.set(relation.value.value, relation);
  }

  add_relations(...relations: Relation[]) {
    relations.forEach(this.add_relation);
  }

  delete_members(members: MemberNew[]) {
    members.forEach((member) => {
      const index = this.members.indexOf(member);
      this.members.splice(index, 1);
    });
  }
}

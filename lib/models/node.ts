import { DataFactory } from 'n3';
const { namedNode } = DataFactory;
import Relation from './relation';
import * as RDF from 'rdf-js';
import Member from './member';

export type Metadata = {
  id: number;
  stream: RDF.NamedNode;
  view: RDF.NamedNode;
};

export default class Node {
  members: Member[] = [];
  relationsMap: Map<string, Relation> = new Map();

  constructor(readonly metadata: Metadata) {}

  get idNamedNode() {
    return namedNode(`./${this.metadata.id}`);
  }

  get count() {
    return this.members.length;
  }

  add_members(...members: Member[]) {
    this.members.push(...members);
  }

  add_member(member: Member) {
    this.members.push(member);
  }

  add_relation(relation: Relation) {
    this.relationsMap.set(relation.value.value, relation);
  }

  add_relations(...relations: Relation[]) {
    relations.forEach((item) => this.add_relation(item));
  }

  delete_members(members: Member[]) {
    members.forEach((member) => {
      const index = this.members.indexOf(member);
      this.members.splice(index, 1);
    });
  }
}

import * as RDF from 'rdf-js';

export default class Relation {
  id: RDF.NamedNode;
  type: RDF.NamedNode;
  value: RDF.Literal;
  target: RDF.NamedNode;
  targetId: number;
  path: RDF.NamedNode;

  constructor(
    id: RDF.NamedNode,
    type: RDF.NamedNode,
    value: RDF.Literal,
    target: RDF.NamedNode,
    targetId: number,
    path: RDF.NamedNode
  ) {
    this.id = id;
    this.type = type;
    this.value = value;
    this.target = target;
    this.targetId = targetId;
    this.path = path;
  }
}

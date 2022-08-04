import * as RDF from 'rdf-js';

export default class Relation {
  constructor(
    readonly id: RDF.NamedNode,
    readonly type: RDF.NamedNode,
    readonly value: RDF.Literal,
    readonly target: RDF.NamedNode,
    readonly targetId: number,
    readonly path: RDF.NamedNode
  ) {}
}

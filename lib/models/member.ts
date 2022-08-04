import { Store } from 'n3';
import * as RDF from 'rdf-js';
import { importToStore } from '../utils/utils';

export default class Member {
  data: Store;

  constructor(readonly id: RDF.NamedNode, data: Store = new Store()) {
    this.data = data;
  }

  addQuads(...quads: RDF.Quad[]) {
    this.data.addQuads(quads);
  }

  importStore(store: Store) {
    this.data.addQuads(store.getQuads(null, null, null, null));
  }

  async importStream(stream: RDF.Stream<RDF.Quad>): Promise<void> {
    return importToStore(this.data, stream);
  }
}

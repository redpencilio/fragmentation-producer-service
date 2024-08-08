import DatasetTransformer, {
  DatasetConfiguration,
} from './dataset-transformer';
import { Readable } from 'stream';
import rdfParser from 'rdf-parse';

import { DataFactory, NamedNode, Store } from 'n3';
import { createStore, Member, RDF_NAMESPACE } from '@lblod/ldes-producer';
const { namedNode } = DataFactory;
export interface RDFDatasetConfiguration extends DatasetConfiguration {
  datatype: string;
}

async function* getResources(store: Store, resourceType: string) {
  const matches = store.getSubjects(
    RDF_NAMESPACE('type'),
    namedNode(resourceType),
    null
  );
  for (const resourceId of matches) {
    const resourceStore = new Store(
      store.getQuads(resourceId, null, null, null)
    );
    const resource = new Member(resourceId as NamedNode, resourceStore);
    yield resource;
  }
}

export default class RDFTransformer implements DatasetTransformer {
  async transform(
    input: Readable,
    config: RDFDatasetConfiguration
  ): Promise<Readable> {
    const quadStream = rdfParser.parse(input, {
      contentType: config.datatype,
    });

    const store = await createStore(quadStream);

    return Readable.from(getResources(store, config.resourceType));
  }
}

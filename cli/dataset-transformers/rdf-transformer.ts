import DatasetTransformer, {
  DatasetConfiguration,
} from './dataset-transformer';
import { Readable } from 'stream';
import rdfParser from 'rdf-parse';

import { RDF_NAMESPACE } from '../../lib/utils/namespaces';
import { DataFactory, NamedNode, Store } from 'n3';
import MemberNew from '../../lib/models/member-new';
import { createStore } from '../../lib/utils/utils';
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
    const resource = new MemberNew(resourceId as NamedNode, resourceStore);
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

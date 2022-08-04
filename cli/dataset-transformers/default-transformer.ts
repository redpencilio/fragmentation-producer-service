import DatasetTransformer, {
  DatasetConfiguration,
} from './dataset-transformer';
import { Readable, Stream, PassThrough } from 'stream';

import readline from 'readline';
import { EXAMPLE, RDF_NAMESPACE } from '../../lib/utils/namespaces';
import Resource from '../../lib/models/resource';
import dataFactory from '@rdfjs/data-model';

export interface DefaultDatasetConfiguration extends DatasetConfiguration {
  propertyType: string;
}

export default class DefaultTransformer implements DatasetTransformer {
  transform(input: Readable, config: DefaultDatasetConfiguration): Readable {
    const readLineInterface = readline.createInterface({
      input: input,
    });

    const resultStream = new PassThrough({ objectMode: true });

    readLineInterface
      .on('line', async (input) => {
        let id = dataFactory.namedNode(
          encodeURI(config.resourceIdPrefix + input)
        );
        let resource = new Resource(id);
        resource.addProperty(
          RDF_NAMESPACE('type').value,
          dataFactory.namedNode(config.resourceType)
        );
        resource.addProperty(config.propertyType, dataFactory.literal(input));
        resultStream.push(resource);
      })
      .on('close', () => {
        resultStream.end();
      });
    return resultStream;
  }
}

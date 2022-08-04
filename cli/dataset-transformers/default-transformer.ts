import DatasetTransformer, {
  DatasetConfiguration,
} from './dataset-transformer';
import { Readable, PassThrough } from 'stream';

import readline from 'readline';
import { RDF_NAMESPACE } from '../../lib/utils/namespaces';
import { DataFactory } from 'n3';
import Member from '../../lib/models/member';
const { quad, namedNode, literal } = DataFactory;
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
        const id = namedNode(encodeURI(config.resourceIdPrefix + input));
        const member = new Member(id);
        member.addQuads(
          quad(
            member.id,
            RDF_NAMESPACE('type'),
            namedNode(config.resourceType)
          ),
          quad(member.id, namedNode(config.propertyType), literal(input))
        );
        resultStream.push(member);
      })
      .on('close', () => {
        resultStream.end();
      });
    return resultStream;
  }
}

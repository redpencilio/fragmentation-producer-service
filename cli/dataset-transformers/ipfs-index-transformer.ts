import { Readable, PassThrough } from 'stream';
import DatasetTransformer from './dataset-transformer';
import readline from 'readline';
import { RDF_NAMESPACE } from '../../lib/utils/namespaces';
import { DefaultDatasetConfiguration } from './default-transformer';
import Member from '../../lib/models/member';
import { DataFactory } from 'n3';
const { quad, namedNode, literal } = DataFactory;
export class IPFSIndexTransformer implements DatasetTransformer {
  transform(input: Readable, config: DefaultDatasetConfiguration): Readable {
    const readLineInterface = readline.createInterface({
      input: input,
    });

    const resultStream = new PassThrough({ objectMode: true });

    readLineInterface
      .on('line', async (input) => {
        readLineInterface.pause();
        const list = JSON.parse(input);
        const id = namedNode(encodeURI(config.resourceIdPrefix + list[0]));
        const member = new Member(id);
        member.addQuads(
          quad(
            member.id,
            RDF_NAMESPACE('type'),
            namedNode(config.resourceType)
          ),
          quad(member.id, namedNode(config.propertyType), literal(list[1]))
        );
        resultStream.push(member);
        readLineInterface.resume();
      })
      .on('close', () => {
        resultStream.end();
      });
    resultStream.on('pause', () => {
      readLineInterface.pause();
    });
    resultStream.on('resume', () => {
      readLineInterface.resume();
    });
    return resultStream;
  }
}

import { Newable } from '../../lib/utils/utils';
import CSVTransformer from './csv-transformer';
import DatasetTransformer from './dataset-transformer';
import DefaultTransformer from './default-transformer';
import { IPFSIndexTransformer } from './ipfs-index-transformer';
import RDFTransformer from './rdf-transformer';

export const FRAGMENTER_MAP: Record<string, Newable<DatasetTransformer>> = {
  'default-transformer': DefaultTransformer,
  'csv-transformer': CSVTransformer,
  'rdf-transformer': RDFTransformer,
  'ipfs-index-transformer': IPFSIndexTransformer,
};

const EXTENSION_MAP: Record<string, Newable<DatasetTransformer>> = {
  '.csv': CSVTransformer,
};

export function createTransformer(options?: {
  name?: string;
  extension?: string;
}) {
  if (options?.name) {
    if (options.name in FRAGMENTER_MAP) {
      return new FRAGMENTER_MAP[options.name]();
    } else {
      throw new Error(`Transformer ${options.name} not found`);
    }
  } else if (options?.extension && options.extension in EXTENSION_MAP) {
    return new EXTENSION_MAP[options.extension]();
  } else {
    return new DefaultTransformer();
  }
}

import CSVTransformer from './csv-transformer';
import DatasetTransformer from './dataset-transformer';
import DefaultTransformer from './default-transformer';
import { IPFSIndexTransformer } from './ipfs-index-transformer';
import RDFTransformer from './rdf-transformer';

export function createTransformer(options?: {
  name?: string;
  extension?: string;
}): DatasetTransformer {
  if (options?.name) {
    switch (options.name) {
      case 'default-transformer':
        return new DefaultTransformer();
      case 'csv-transformer':
        return new CSVTransformer();
      case 'rdf-transformer':
        return new RDFTransformer();
      case 'ipfs-index-transformer':
        return new IPFSIndexTransformer();
      default:
        throw new Error(`Transformer ${options.name} not found`);
    }
  } else {
    switch (options?.extension) {
      case '.csv':
        return new CSVTransformer();
      default:
        return new DefaultTransformer();
    }
  }
}

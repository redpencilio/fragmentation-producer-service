import { Command, Option } from 'commander';
import Node from '../lib/models/node';
import PromiseQueue from '../lib/utils/promise-queue';
import fs from 'fs';
import DefaultTransformer from './dataset-transformers/default-transformer';
import DatasetTransformer, {
  DatasetConfiguration,
} from './dataset-transformers/dataset-transformer';
import CSVTransformer from './dataset-transformers/csv-transformer';
import path from 'path';
import { IPFSIndexTransformer } from './dataset-transformers/ipfs-index-transformer';
import Cache from '../lib/storage/caching/cache';
import RDFTransformer from './dataset-transformers/rdf-transformer';
import {
  FOLDER_DEPTH,
  PAGE_RESOURCES_COUNT,
  SUBFOLDER_NODE_COUNT,
} from '../lib/utils/constants';
import {
  createFragmenter,
  FRAGMENTER_MAP,
} from '../lib/fragmenters/fragmenter-factory';

const transformerMap = new Map<string, DatasetTransformer>();
transformerMap.set('csv-transformer', new CSVTransformer());
transformerMap.set('default-transformer', new DefaultTransformer());
transformerMap.set('ipfs-transformer', new IPFSIndexTransformer());
transformerMap.set('rdf-transformer', new RDFTransformer());

const extensionMap = new Map<string, DatasetTransformer>();
extensionMap.set('.csv', new CSVTransformer());

function getTransformer(extension: string): DatasetTransformer {
  return extensionMap.get(extension) || new DefaultTransformer();
}

const UPDATE_QUEUE = new PromiseQueue<Node | null | void>();

const program = new Command();

program
  .name('fragment-dataset')
  .description('CLI tool to create a fragmented version of a provided dataset');

program
  .argument('<dataset_file>', 'The dataset which should be fragmented')
  .requiredOption(
    '-c, --config <config_file>',
    'JSON configuration file which describes how the dataset should be parsed'
  )
  .requiredOption(
    '-o, --output <output_folder>',
    'The destination folder in which the fragmented dataset should be stored'
  )
  .addOption(
    new Option(
      '--cache-size <cache_size>',
      'The maximum size of the node cache'
    )
      .default('1000')
      .argParser(parseInt)
  )
  .addOption(
    new Option(
      '-f, --fragmenter <fragmenter>',
      'The fragmenter which is to be used'
    )
      .choices(Object.keys(FRAGMENTER_MAP))
      .default('time-fragmenter')
  )
  .addOption(
    new Option(
      '-t, --transformer <dataset_transformer>',
      'The dataset transformer which should be applied, overrides automatic selection of transformer based on file extension'
    ).choices([...transformerMap.keys()] as string[])
  )
  .action(async (datasetFile, options) => {
    const jsonData = fs.readFileSync(options.config, 'utf8');
    const datasetConfig: DatasetConfiguration = JSON.parse(jsonData);
    let transformer: DatasetTransformer;
    if (options.transformer) {
      transformer = transformerMap.get(options.transformer)!;
    } else {
      transformer = getTransformer(path.extname(datasetFile));
    }
    await fragmentDataset(
      transformer,
      datasetFile,
      datasetConfig,
      options.fragmenter || 'time-fragmenter',
      options.cacheSize,
      options.output
    );
  });

program.parse();

export default async function fragmentDataset(
  transformer: DatasetTransformer,
  datasetFile: string,
  datasetConfiguration: DatasetConfiguration,
  fragmenterName: string,
  cacheSizeLimit: number,
  outputFolder: string
): Promise<void> {
  const cache: Cache = new Cache(cacheSizeLimit);
  const fragmenter = createFragmenter(fragmenterName, {
    folder: outputFolder,
    maxResourcesPerPage: PAGE_RESOURCES_COUNT,
    maxNodeCountPerSubFolder: SUBFOLDER_NODE_COUNT,
    folderDepth: FOLDER_DEPTH,
    cache,
  });
  const fileStream = fs.createReadStream(datasetFile);
  const transformedStream = await transformer.transform(
    fileStream,
    datasetConfiguration
  );
  return new Promise<void>((resolve) => {
    transformedStream
      .on('data', async (resource) => {
        transformedStream.pause();

        await UPDATE_QUEUE.push(() => fragmenter.addMember(resource));
        transformedStream.resume();
      })
      .on('close', async () => {
        console.log('finished loading resources');
        await UPDATE_QUEUE.push(() => fragmenter.cache.flush());
        resolve();
      });
  });
}

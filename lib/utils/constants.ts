import namespace from '@rdfjs/namespace';

export const FOLDER_DEPTH = parseInt(process.env.FOLDER_DEPTH || '1');
export const SUBFOLDER_NODE_COUNT = parseInt(
  process.env.SUBFOLDER_NODE_COUNT || '10'
);
export const PAGE_RESOURCES_COUNT = parseInt(
  process.env.PAGE_RESOURCES_COUNT || '10'
);
export const STREAM_PREFIX = namespace(
  process.env.LDES_STREAM_PREFIX || 'http://mu.semte.ch/streams/'
);
export const TIME_TREE_RELATION_PATH =
  process.env.TIME_TREE_RELATION_PATH ||
  'http://www.w3.org/ns/prov#generatedAtTime';

export const PREFIX_TREE_RELATION_PATH =
  process.env.PREFIX_TREE_RELATION_PATH || 'https://example.org/name';

export const CACHE_SIZE = parseInt(process.env.CACHE_SIZE || '10');

export const BASE_FOLDER = process.env.DATA_FOLDER || './data';

export const ENABLE_AUTH = process.env.ENABLE_AUTH === 'true' ? true : false;

export const AUTH_USERNAME = process.env.AUTH_USERNAME || 'username';
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'password';

export const ACCEPTED_CONTENT_TYPES = [
  'application/ld+json',
  'application/n-quads',
  'application/n-triples',
  'application/trig',
  'text/n3',
  'text/turtle',
];

export const BASE_URL = process.env.BASE_URL ?? '';

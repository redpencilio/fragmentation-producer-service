export const CONTEXT = {
  member: { '@id': 'https://w3id.org/tree#member', '@type': '@id' },
  relation: { '@id': 'https://w3id.org/tree#relation', '@type': '@id' },
  view: { '@id': 'https://w3id.org/tree#view', '@type': '@id' },
  generatedAtTime: {
    '@id': 'http://www.w3.org/ns/prov#generatedAtTime',
    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
  },
  isVersionOf: {
    '@id': 'http://purl.org/dc/terms/isVersionOf',
    '@type': '@id',
  },
  tree: 'https://w3id.org/tree#',
  ex: 'http://example.org/',
  ldes: 'http://w3id.org/ldes#',
  schema: 'http://schema.org/',
  uuid: 'http://mu.semte.ch/vocabularies/core/uuid',
  node: { '@id': 'tree:node', '@type': '@id' },
  path: { '@id': 'tree:path', '@type': '@id' },
};

export const FRAME = {
  '@context': CONTEXT,
};

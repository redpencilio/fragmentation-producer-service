# Implementation of an TREE fragmentation service

This application provides two parts:

- A webservice which allows you to query a fragmented dataset and add resources to it.
- A CLI tool which allows you to convert a dataset to a fragmented version following the LDES and TREE specifications.

## LDES web service

### Running the LDES web service

The web service in this repository can be run locally or in a docker configuration.

#### Locally

In order to run the service locally, run the `npm start` script. The service will be exposed on port 3000.

### Configuration

The following environment variables can be configured:

- `BASE_FOLDER`: the parent folder to store the LDES streams in. (default: `./data`)
- `LDES_STREAM_PREFIX`: the stream prefix to use to identify the streams. This prefix is used in conjunction with the folder name of the stream. (default: `http://mu.semte.ch/streams/`)
- `TIME_TREE_RELATION_PATH`: the path on which the relations should be defined when fragmenting resources using the time-fragmenter. This is also the predicate which is used when adding a timestamp to a new version of a resource. (default: `http://www.w3.org/ns/prov#generatedAtTime`)
- `PREFIX_TREE_RELATION_PATH`: the path on which the relations should be defined when fragmenting resources using the prefix-tree-fragmenter. (default: `https://example.org/name`)
- `CACHE_SIZE`: the maximum number of pages the cache should keep in memory. (default: `10`)
- `FOLDER_DEPTH`: the number of levels the data folder structure should contain. (default: `1`, a flat folder structure)
- `PAGE_RESOURCES_COUNT`: the number of resources (members) one page should contain. (default: `10`)
- `SUBFOLDER_NODE_COUNT`: the maximum number of nodes (pages) a subfolder should contain. (default: `10`)

### Using the LDES web service

The web service provides the following two endpoints:

- `GET /:folder/:subfolder?/:nodeId`: this endpoint allows you to query a specific node represented in an RDF format to your liking. Using the HTTP Accept header, you can provide which representation of the data you would like to receive. Typically, the view node of the dataset is located in `/:folder/1` while the other nodes are additionally stored in subfolders.

- `POST /:folder` allows you to add a new resource to a dataset located in `folder`. The post body can containing the resource in any RDF format to your liking. The post body format should be supplied using the `Content-Type` HTTP header. This endpoints expects the following query parameters:
  - `resource: <resource_id>`: the id of the resource which is to be added
  - `fragmenter: <fragmenter_type>`: the type of fragmenter to use, defaults to `time-fragmenter`. The other option is `prefix-tree-fragmenter`.

#### Example 1: adding a resource using the time-fragmenter

In order to add a movie to a time-based LDES stream, you can execute the following POST request: `POST /movies?resource=https://example.org/movies/800005`
The body can for example contain a turtle document:

```.ttl
<https://example.org/movies/800005> a <https://example.org/Movie>;
    <https://example.org/name> "My new movie";
    <https://example.org/genres> "Comedy|Romance|Action".
```

In this case, the supplied Content-Type header should be `text/turtle`.

#### Example 2: adding a resource using the prefix-tree-fragmenter

In order to add a movie to a prefix-tree dataset, you can execute the following POST request: `POST /movies?resource=https://example.org/movies/800005?fragmenter=prefix-tree-fragmenter`
The body can for example contain a turtle document:

```.ttl
<https://example.org/movies/800005> a <https://example.org/Movie>;
    <https://example.org/name> "My new movie";
    <https://example.org/genres> "Comedy|Romance|Action".
```

In this case, the supplied Content-Type header should be `text/turtle`.

## Using the fragmentation CLI tool (out of date)

In order to use the fragmentation CLI tool, this application provides the `fragment-dataset` npm script.

The CLI tool expects the following options:

- `--config <config_file.json>`: this required option allows you to provided a json configuration file which describes how your dataset should be interpreted.
- `--fragmenter <fragmenter>`: the type of fragmenter which should be used to fragment the provided dataset, the default fragmenter is: `time-fragmenter`.
- `--output <output_folder>`: the output folder in which the fragmented version of the provided dataset should be stored.

As a parameter, the CLI tool expects a file containing the dataset which should be fragmented.

Currently, the CLI tool supports three different types of input datasets:

- A `.csv` dataset. When using a csv file as input dataset, the provided json configuration file should contain how the different csv fields should be mapped to RDF predicates.
- An index dump of the IPFS Search engine (https://ipfs-search.com/) which can retrieved from https://github.com/ipfs-search/ipfs-search-extractor. When using this type of dataset you can sepcify the predicates which should be used in the json config file.
- A standard text-file. When using a standard text file as input dataset, the CLI tool will parse each line as a seperate resource and use the contents of the line as object values for a specified predicate in the json configuration file.

The json configuration file should always contain the following key/value pairs:

- `stream: <stream_uri>`: the URI of the stream in which the resources of the dataset should be stored.
- `resourceType: <resource_type_uri>`: the URI describing the type which should be attributed to the resources.
- `resourceIdPrefix: <resource_id_prefix_uri`: the URI which should be prepended to the resource ID's.

When using a standard text file, the configuration file should also contain the following key/value pair:

- `propertyType: <predicate_uri>`: this describes the predicate which will be used in combination with the resource value.

When using a csv dataset as input, the configuration file should additionally contain the following options:

- `resourceIdField: <resource_id_field>`: this option allows you to specify the csv field which should be used as the resource id.
- `propertyMappings: <property_mappings>`: this is a json object describing how the different csv fields should be mapped to RDF predicates of the resource.

When using an IPFS export as input, the configuration file should also contain the following key/value pair:

- `propertyType: <predicate_uri>`: this describes the uri which will be prepended to the hashes contained in the IPFS dump.

### Example 2: fragmenting an ordinary text file

This repository contains a `default-config.json` which is a configuration suitable for loading a dataset containing a list of streetnames. In order to run the CLI tool with this configuration, execute `npm run fragment-dataset -- -c default-config.json -o data/streetnames -f prefix-tree-fragmenter <streetname_dataset>`.
The resulting dataset will be stored in the `data/streetnames` folder. This example applies a prefix-tree-fragmenter to the dataset, but you can also replace this by a time-fragmenter.

### Example 3: fragmenting a csv movie dataset

This repository also contains a `csv-config.json` as an example on how to write a configuration when fragmenting a csv dataset. This configuration can be used in combination with a GroupLens MovieLens dataset, such as https://files.grouplens.org/datasets/movielens/ml-latest-small.zip. The fragmenter can be applied on the `movies.csv` file supplied in dataset archive. You can run the CLI tool with this configuration by executing `npm run fragment-dataset -- -c csv-config.json -o data/movies -f prefix-tree-fragmenter <movie_dataset.csv>`. The resulting dataset will be stored in the `data/movies` folder.

## Components overview

### Fragmenters

`fragmenters/Fragmenter.ts` provides a base abstract class which can be used to implement new types of fragmenters. It provides the following methods:

- `constructNewNode` constructs a new node with an incremented id
- `fileForNode` returns the file location of a node given a node id
- `determineSubFolder` determines the folder the node should be located in
- `shouldCreateNewPage` determines whether a node has reached its limit in terms of resource count
- `addResource` is an abstract method which is responsible to add a new resource to a dataset and is the main method which should be implemented by new fragmenters.

`fragmenters/TimeFragmenter.ts` implements a versioning time-based LDES fragmenter. When adding a resource to a dataset using this fragmenter, it adds a timestamp and a version to the resource. The relations it uses are GreaterThanRelations.

`fragmenters/PrefixTreeFragmenter.ts` stores resources in a prefix-tree based dataset. The relations it uses are PrefixRelations.

### Caching

The cache stores a list of nodes in combination with their `modified` status. It also provides a `flush` function which is responsible for writing back all modified nodes.

### Dataset Transformers

Dataset transformers provide a way in order to convert Readable text streams to a stream of `Resource` instances each containing an id and a triplestore. `dataset-transformers/dataset-transformer.ts` provides an interface containing a `transform` method which emits a stream of resources based on a readable stream and a configuration.

`default-transformer.ts` is an implementation which is to be used for ordinary text files and converts each line to a resource.

`csv-transformer.ts` reads each line of a provided csv filestream and converts it based on a csv json configuration.

These transformers are mainly used by the CLI tool which can be found in `fragment-dataset.ts`

Prefix tree implementation based on https://github.com/Dexagod/linked_data_tree.

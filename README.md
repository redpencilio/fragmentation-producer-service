# Implementation of an LDES web service

## Getting started

This application provides two parts:

-   A CLI tool which allows you to convert a dataset to a fragmented version following the LDES and TREE specifications.
-   A webservice which allows you to query a fragmented dataset and add resources to it.

Run `npm install` in order to install the necessary libraries.

### Using the fragmentation CLI tool

In order to use the fragmentation CLI tool, this application provides the `fragment-dataset` npm script.

The CLI tool expects the following options:

-   `--config <config_file.json>`: this required option allows you to provided a json configuration file which describes how your dataset should be interpreted.
-   `--fragmenter <fragmenter>`: the type of fragmenter which should be used to fragment the provided dataset, the default fragmenter is: `time-fragmenter`.
-   `--output <output_folder>`: the output folder in which the fragmented version of the provided dataset should be stored.

As a parameter, the CLI tool expects a file containing the dataset which should be fragmented.

Currently, the CLI tool supports two different types of input datasets:

-   A `.csv` dataset. When using a csv file as input dataset, the provided json configuration file should contain how the different csv fields should be mapped to RDF predicates.
-   A standard text-file. When using a standard text file as input dataset, the CLI tool will parse each line as a seperate resource and use the contents of the line as object values for a specified predicate in the json configuration file.

The json configuration file should always contain the following key/value pairs:

-   `stream: <stream_uri>`: the URI of the stream in which the resources of the dataset should be stored.
-   `resourceType: <resource_type_uri>`: the URI describing the type which should be attributed to the resources.
-   `resourceIdPrefix: <resource_id_prefix_uri`: the URI which should be prepended to the resource ID's.

When using a standard text file, the configuration file should also contain the following key/value pair:

-   `propertyType: <predicate_uri>`: this describes the predicate which will be used in combination with the resource value.

When using a csv dataset as input, the configuration file should additionally contain the following options:

-   `resourceIdField: <resource_id_field>`: this option allows you to specify the csv field which should be used as the resource id.
-   `propertyMappings: <property_mappings>`: this is a json object describing how the different csv fields should be mapped to RDF predicates of the resource.

#### Example 1: fragmenting an ordinary text file

This repository contains a `default-config.json` which is a configuration suitable for loading a dataset containing a list of streetnames. In order to run the CLI tool with this configuration, execute `npm run fragment-dataset -- -c default-config.json -o data/streetnames -f prefix-tree-fragmenter <streetname_dataset>`.
The resulting dataset will be stored in the `data/streetnames` folder. This example applies a prefix-tree-fragmenter to the dataset, but you can also replace this by a time-fragmenter.

#### Example 2: fragmenting a csv movie dataset

This repository also contains a `csv-config.json` as an example on how to write a configuration when fragmenting a csv dataset. This configuration can be used in combination with a GroupLens MovieLens dataset, such as https://files.grouplens.org/datasets/movielens/ml-latest-small.zip. The fragmenter can be applied on the `movies.csv` file supplied in dataset archive. You can run the CLI tool with this configuration by executing `npm run fragment-dataset -- -c csv-config.json -o data/movies -f prefix-tree-fragmenter <movie_dataset.csv>`. The resulting dataset will be stored in the `data/movies` folder.

### Running the LDES web service

After having fragmented a dataset, you can query it using the web service.
The web service in this repository can be run locally or using the supplied docker configuration:

-   In order to run the service locally, run the `npm start` script. The service will be exposed on port 3000.

-   Using the supplied docker-compose and docker-compose.dev configurations, you can run the service in a docker container. By default, the service will be exposed on port 8888, you can configure how the data is mounted in the compose files.

Using the `DATA_FOLDER` environment variable, you can configure in which base data folder the service will look for the fragmented datasets.

The web service provides the following two endpoints:

-   `GET /:folder/:subfolder?/:nodeId`: this endpoint allows you to query a specific node represented in an RDF format to your liking. Using the HTTP Accept header, you can provide which representation of the data you would like to receive. Typically, the view node of the dataset is located in `/:folder/1` while the other nodes are additionally stored in subfolders.

-   `POST /:folder` allows you to add a new resource to a dataset located in `folder`. The post body can containing the resource in any RDF format to your liking. The post body format should be supplied using the `Content-Type` HTTP header. This endpoints expects the following query parameters:
    -   `resource: <resource_id>`: the id of the resource which is to be added
    -   `fragmenter: <fragmenter_type>`: the type of fragmenter to use, defaults to `time-fragmenter`. The other option is `prefix-tree-fragmenter`.
    -   `stream: <stream_id>`: the id of the stream the resource should be stored in.
    -   `relation-path: <relation_path>`: the path on which the relations are defined.

#### Example 3: adding a resource to the fragmenter movie dataset

In order to add a movie to the movie-dataset, you can execute the following POST request: `POST /movies?resource=https://example.org/movies/800005&fragmenter=prefix-tree-fragmenter&stream=http://mu.semte.ch/services/ldes-prefix-fragmenter/movies&relation-path=https://example.org/name`.

The body can for example contain a turtle document:

```.ttl
<https://example.org/movies/800005> a <https://example.org/Movie>;
    <https://example.org/name> "My new movie";
    <https://example.org/genres> "Comedy|Romance|Action".
```

In this case, the supplied Content-Type header should be `text/turtle`.

## Components overview

### Fragmenters

`fragmenters/Fragmenter.ts` provides a base abstract class which can be used to implement new types of fragmenters. It provides the following methods:

-   `constructNewNode` constructs a new node with an incremented id
-   `fileForNode` returns the file location of a node given a node id
-   `determineSubFolder` determines the folder the node should be located in
-   `shouldCreateNewPage` determines whether a node has reached its limit in terms of resource count
-   `addResource` is an abstract method which is responsible to add a new resource to a dataset and is the main method which should be implemented by new fragmenters.

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

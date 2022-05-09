import { Readable } from "stream";

export interface DatasetConfiguration {
	stream: string;
	resourceType: string;
	resourceIdPrefix: string;
}

export default interface DatasetTransformer {
	transform(
		input: Readable,
		config: DatasetConfiguration
	): Readable | Promise<Readable>;
}

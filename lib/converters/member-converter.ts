import rdfParser from 'rdf-parse';
import nodeStream from 'stream';
import Member from '../models/member';
import { NamedNode, Quad } from '@rdfjs/types';

export default async function extractMembers(body: any, contentType: string): Promise<Iterable<Member>>{
  const quadStream = rdfParser.parse(nodeStream.Readable.from(body), {
    contentType,
  });
  const memberMap = new Map<string, Member>();
  return new Promise((resolve, reject) =>
    quadStream
    .on('data', (quad: Quad) => {
      const member = memberMap.get(quad.subject.value);
      if(member){
        member.addQuads(quad);
      } else {
        const newMember = new Member(quad.subject as NamedNode);
        newMember.addQuads(quad);
        memberMap.set(quad.subject.value, newMember);
      }
    })
    .on('error', reject)
    .once('end', () => resolve(memberMap.values()))
  );
}

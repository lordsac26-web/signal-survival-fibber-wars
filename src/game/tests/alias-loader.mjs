import { readFile } from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
export async function resolve(specifier,context,nextResolve){
  if(specifier==='@/api/base44Client')return {url:'data:text/javascript,export const base44 = globalThis.__profileClient;',shortCircuit:true};
  if(specifier.startsWith('@/'))return {url:new URL(`${specifier.slice(2)}${/\.[a-z]+$/.test(specifier)?'':'.js'}`,root).href,shortCircuit:true};
  if(specifier==='profileValidation')return {url:new URL('../base44/shared/profileValidation.ts',root).href,shortCircuit:true};
  return nextResolve(specifier,context);
}
export async function load(url,context,nextLoad){
  if(url.endsWith('/profileValidation.ts'))return {format:'module',source:await readFile(new URL(url),'utf8'),shortCircuit:true};
  return nextLoad(url,context);
}
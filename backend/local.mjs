import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleRequest} from './worker.mjs';
export function sqliteBinding(db){
  return {prepare(sql){return {bind(...args){return {
    async first(){return db.prepare(sql).get(...args)||null;},
    async all(){return {results:db.prepare(sql).all(...args)};},
    async run(){return db.prepare(sql).run(...args);}
  };}};}};
}
export function createLocalHandler(root){
  const directory=path.join(root,'..','_wdcc-feedback-local');mkdirSync(directory,{recursive:true});
  const db=new DatabaseSync(path.join(directory,'feedback.sqlite'));
  db.exec(readFileSync(fileURLToPath(new URL('./schema.sql',import.meta.url)),'utf8'));
  const env={DB:sqliteBinding(db),ALLOWED_ORIGINS:'http://127.0.0.1:4187,http://localhost:4187',RATE_LIMIT_SECRET:'local-test-only'};
  return async request=>handleRequest(request,env,{waitUntil(){}},{localTest:true});
}

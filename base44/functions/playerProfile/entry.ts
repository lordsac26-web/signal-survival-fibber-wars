import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { validateProfile } from '../../shared/profileValidation.ts';
export default async function(req) {
  try {
    const client=createClientFromRequest(req),user=await client.auth.me();
    if(!user) return Response.json({error:'Sign in required'},{status:401});
    const body=await req.json();if(!['load','save'].includes(body.action)) return Response.json({error:'Unknown operation'},{status:400});
    const owned=await client.entities.SaveSync.filter({created_by_id:user.id},'-updated_date',100);
    const managed=owned.filter(r=>Number.isInteger(r.revision));
    let record=managed.sort((a,b)=>String(a.created_date).localeCompare(String(b.created_date)) || a.id.localeCompare(b.id))[0];
    if(record && record.created_by_id!==user.id) return Response.json({error:'Not your save'},{status:403});
    if(body.action==='load') return Response.json({recordId:record?.id || null,revision:record?.revision || 0,data:record?.data || owned[0]?.data || null,commitId:record?.commit_id || null});
    if(typeof body.commitId!=='string' || body.commitId.length>80 || !Number.isInteger(body.baseRevision) || body.baseRevision<0) return Response.json({error:'Invalid save revision'},{status:400});
    const data=validateProfile(body.data,user.id,record?.data);
    if(record?.commit_id===body.commitId) return Response.json({revision:record.revision,data:record.data,commitId:record.commit_id});
    if((record?.revision || 0)!==body.baseRevision) return Response.json({conflict:true,revision:record.revision,data:record.data});
    if(!record){
      record=await client.entities.SaveSync.create({data,revision:1,commit_id:body.commitId});
      const all=await client.entities.SaveSync.filter({created_by_id:user.id},'created_date',100);
      const canonical=all.filter(r=>Number.isInteger(r.revision)).sort((a,b)=>String(a.created_date).localeCompare(String(b.created_date)) || a.id.localeCompare(b.id))[0];
      if(canonical.id!==record.id) return Response.json({conflict:true,revision:canonical.revision,data:canonical.data});
    } else {
      await client.entities.SaveSync.updateMany({id:record.id,created_by_id:user.id,revision:body.baseRevision},{$set:{data,revision:body.baseRevision+1,commit_id:body.commitId}});
      record=await client.entities.SaveSync.get(record.id);
      if(record.created_by_id!==user.id) return Response.json({error:'Not your save'},{status:403});
      if(record.commit_id!==body.commitId) return Response.json({conflict:true,revision:record.revision,data:record.data});
    }
    return Response.json({revision:record.revision,data:record.data,commitId:record.commit_id});
  } catch(error){return Response.json({error:error.message || 'Profile request failed'},{status:error.status || 400})}
}
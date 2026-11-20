import { describe, expect, it } from 'vitest'
import { ClientGrantApi } from './clientGrants'
import { AuthContractError } from './auth'
const id='cfe4373d-1fc2-4c3c-9500-b9b0a4572bd9'
const grant={id,coach_id:19,scope:'training_summary.read',status:'ACTIVE',
  consent_version:'v2-03c-1',granted_at:'2026-11-19T10:00:00Z',expires_at:null,revoked_at:null,
  glucose_before:8.7,notes:'PRIVATE-HEALTH'}
describe('V2-03C.4A client grant contract',()=>{
  it('list is authenticated and projects only consent fields', async()=>{
    const api=new ClientGrantApi(async (url,init)=>{
      expect(url).toBe('/api/v1/client/coach-grants')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token')
      return new Response(JSON.stringify([grant]))
    })
    const result=await api.list('token')
    expect(result).toHaveLength(1)
    expect(result[0].coach_id).toBe(19)
    expect(JSON.stringify(result)).not.toContain('glucose')
    expect(JSON.stringify(result)).not.toContain('PRIVATE-HEALTH')
  })
  it('rejects malformed DTOs instead of showing demo data',async()=>{
    await expect(new ClientGrantApi(async()=>new Response('[{"coach_id":1}]')).list('token'))
      .rejects.toBeInstanceOf(AuthContractError)
  })
  it('revokes owner grant via explicit DELETE',async()=>{
    const api=new ClientGrantApi(async (url,init)=>{
      expect(url).toBe('/api/v1/client/coach-grants/'+id)
      expect(init?.method).toBe('DELETE')
      return new Response(null,{status:204})
    })
    await expect(api.revoke('token',id)).resolves.toBeUndefined()
  })
  it('explicit regrant submits fixed consent version and scope',async()=>{
    const api=new ClientGrantApi(async (_url,init)=>{
      expect(JSON.parse(String(init?.body))).toEqual({
        coach_id:19,scope:'training_summary.read',consent_version:'v2-03c-1',expires_at:null,
      })
      return new Response(JSON.stringify(grant))
    })
    await expect(api.regrant('token',19,'training_summary.read',null)).resolves.toMatchObject({coach_id:19})
  })
  it('never calls network without session or with bad identifiers',async()=>{
    const api=new ClientGrantApi(async()=>{throw new Error('should not fetch')})
    await expect(api.list('')).rejects.toMatchObject({status:401})
    await expect(api.revoke('token','INVALID')).rejects.toBeInstanceOf(AuthContractError)
  })
  it('lists only active linked coaches using a minimal safe DTO',async()=>{
    const api=new ClientGrantApi(async(url,init)=>{
      expect(url).toBe('/api/v1/client/coach-grants/available-coaches')
      expect(init?.method).toBe('GET')
      return new Response(JSON.stringify([{coach_id:19,display_name:'Coach Alex',email:'private@example.test'}]))
    })
    const result=await api.availableCoaches('token')
    expect(result).toEqual([{coach_id:19,display_name:'Coach Alex'}])
    expect(JSON.stringify(result)).not.toContain('private')
  })
  it('rejects unsafe coach selector responses',async()=>{
    const api=new ClientGrantApi(async()=>new Response(JSON.stringify([{coach_id:19,display_name:' '}])) )
    await expect(api.availableCoaches('token')).rejects.toBeInstanceOf(AuthContractError)
  })
  it('reads owner consent audit and projects away private fields',async()=>{
    const api = new ClientGrantApi(async(url, init)=>{
      expect(url).toBe('/api/v1/client/coach-grants/'+id+'/history')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token')
      return new Response(JSON.stringify({grant_id:id,events:[{
        id,grant_id:id,coach_id:19,scope:'training_summary.read',action:'REVOKED',
        consent_version:'v2-03c-1',occurred_at:'2026-11-20T10:00:00Z',
        glucose:11,secret:'PRIVATE',
      }]}))
    })
    const timeline = await api.history('token',id)
    expect(timeline.events).toHaveLength(1)
    expect(timeline.events[0].action).toBe('REVOKED')
    expect(JSON.stringify(timeline)).not.toContain('glucose')
    expect(JSON.stringify(timeline)).not.toContain('PRIVATE')
  })
  it('rejects wrong owner id or broken timeline event',async()=>{
    const api=new ClientGrantApi(async()=>new Response(JSON.stringify({
      grant_id:id,events:[{action:'GRANTED'}],
    })))
    await expect(api.history('token',id)).rejects.toBeInstanceOf(AuthContractError)
    await expect(api.history('token','bad-id')).rejects.toBeInstanceOf(AuthContractError)
  })
})

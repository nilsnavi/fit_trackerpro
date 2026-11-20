import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../../shared/auth/session'
import { ClientGrantApi, type ClientGrant, type GrantScope } from '../../shared/api/clientGrants'
import { Button, Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'
import { SignatureIcon } from '../../shared/ui/SignatureIcon'

const api=new ClientGrantApi()
const names: Record<GrantScope,string>={
  'training_summary.read':'Сводка тренировок',
  'workout_history.read':'История тренировок',
}
const scopes: GrantScope[]=['training_summary.read','workout_history.read']
function status(grant: ClientGrant): 'ACTIVE'|'REVOKED'|'EXPIRED' {
  if(grant.status!=='ACTIVE') return grant.status
  return grant.expires_at && new Date(grant.expires_at).getTime()<=Date.now() ? 'EXPIRED' : 'ACTIVE'
}
export function AthleteConsents(){
  const identity=useSessionStore(s=>s.profile?.id)
  const token=useSessionStore(s=>s.accessToken)
  const cache=useQueryClient()
  const [confirm,setConfirm]=useState<string|null>(null)
  const [restore,setRestore]=useState<string|null>(null)
  const [coachId,setCoachId]=useState<number|null>(null)
  const [selectedScopes,setSelectedScopes]=useState<GrantScope[]>([])
  const [notice,setNotice]=useState('')
  const key=['athlete',identity,'coach-grants']
  const coachesKey=['athlete',identity,'available-coaches']
  const query=useQuery({queryKey:key,enabled:!!token&&!!identity,queryFn:({signal})=>api.list(token!,signal),staleTime:0,refetchOnWindowFocus:true})
  const coaches=useQuery({queryKey:coachesKey,enabled:!!token&&!!identity,queryFn:({signal})=>api.availableCoaches(token!,signal),staleTime:0,refetchOnWindowFocus:true})
  const refresh=async()=>{await Promise.all([cache.invalidateQueries({queryKey:key}),cache.invalidateQueries({queryKey:coachesKey})])}
  const revoke=useMutation({
    mutationFn:(id:string)=>api.revoke(token!,id),
    onSuccess:async()=>{setConfirm(null);setNotice('Разрешение отозвано на сервере.');await refresh()},
    onError:()=>setNotice('Не удалось отозвать согласие. Проверьте подключение и повторите.'),
  })
  const regrant=useMutation({
    mutationFn:(g:ClientGrant)=>api.regrant(token!,g.coach_id,g.scope,null),
    onSuccess:async()=>{setRestore(null);setNotice('Новое согласие отправлено на сервер.');await refresh()},
    onError:()=>setNotice('Разрешение не выдано. Проверьте активность связи с тренером.'),
  })
  const grant=useMutation({
    mutationFn:async()=>{if(!coachId||selectedScopes.length===0)throw new Error('Выберите тренера и хотя бы одно разрешение');for(const scope of selectedScopes)await api.regrant(token!,coachId,scope,null)},
    onSuccess:async()=>{setCoachId(null);setSelectedScopes([]);setNotice('Выбранные разрешения выданы.');await refresh()},
    onError:()=>setNotice('Не удалось выдать все выбранные разрешения. Проверьте список и повторите.'),
  })
  const busy=revoke.isPending||regrant.isPending||grant.isPending
  const toggleScope=(scope:GrantScope)=>setSelectedScopes(current=>current.includes(scope)?current.filter(x=>x!==scope):[...current,scope])
  const available=coaches.data?.filter(c=>!query.data?.some(g=>g.coach_id===c.coach_id&&g.scope&&status(g)==='ACTIVE'))??[]
  return <div className="ftp-page ftp-consents">
    <div className="ftp-heading"><div><p className="ftp-eyebrow">ATHLETE / ПРИВАТНОСТЬ</p>
      <h1>Мои <em>разрешения.</em></h1><p>Вы сами управляете тем, какую информацию о тренировках может видеть ваш тренер.</p></div>
      <StatusPill variant="lime">ПОД ВАШИМ КОНТРОЛЕМ</StatusPill>
    </div>
    <Card eyebrow="ВАЖНО" title="Ваши данные принадлежат вам">
      <p>Связь с тренером сама по себе не предоставляет доступ к вашей истории. Каждое разрешение действует отдельно. Данные о здоровье и глюкозе не входят в эти разрешения.</p>
      <p className="ftp-security-note"><SignatureIcon name="shield" size={18}/> После отзыва доступ к соответствующим данным блокируется сервером.</p>
    </Card>
    {notice && <p role="status" className="ftp-consent-notice">{notice}</p>}
    {coaches.isError ? <Card><p role="alert">Не удалось загрузить список ваших активных тренеров.</p><Button tone="secondary" onClick={()=>{void coaches.refetch()}}>Повторить</Button></Card>
    : coaches.isPending ? <Card><p role="status">Проверяем подключённых тренеров…</p></Card>
    : available.length>0 ? <Card eyebrow="НОВОЕ РАЗРЕШЕНИЕ" title="Выберите тренера">
      <p>Отметьте только те категории данных, которые готовы открыть. Каждая категория оформляется отдельным согласием.</p>
      <div className="ftp-coach-picker">{available.map(coach=><button key={coach.coach_id} type="button" className={'ftp-coach-option'+(coachId===coach.coach_id?' is-selected':'')} onClick={()=>setCoachId(coach.coach_id)} aria-pressed={coachId===coach.coach_id}>
        <span className="ftp-coach-avatar"><SignatureIcon name="clients" size={20}/></span><span><strong>{coach.display_name}</strong><small>Подключённый тренер</small></span><span className="ftp-coach-check">{coachId===coach.coach_id?'✓':''}</span>
      </button>)}</div>
      <div className="ftp-scope-picker"><p className="ftp-eyebrow">РАЗРЕШИТЬ ДОСТУП К</p>{scopes.map(scope=><label key={scope} className="ftp-scope-option"><input type="checkbox" checked={selectedScopes.includes(scope)} onChange={()=>toggleScope(scope)}/><span><strong>{names[scope]}</strong><small>{scope==='training_summary.read'?'Сводные показатели завершённых тренировок':'Список завершённых тренировок и их подходов'}</small></span></label>)}</div>
      <Button disabled={!coachId||selectedScopes.length===0||busy} onClick={()=>grant.mutate()}>Подтвердить выбранные разрешения</Button>
      <p className="ftp-security-note">Согласия выдаются бессрочно до отзыва. Их можно отозвать в любой момент.</p>
    </Card> : <Card><EmptyState title="Нет тренеров для подключения" description="Здесь появятся только тренеры, с которыми у вас уже есть активная подтверждённая связь. Попросите тренера отправить приглашение."/></Card>}
    {query.isPending ? <Card><p role="status">Проверяем ваши разрешения на сервере…</p></Card>
      : query.isError ? <Card><p role="alert">Не удалось получить список согласий.</p><Button tone="secondary" onClick={()=>{void query.refetch()}}>Повторить</Button></Card>
      : query.data.length===0 ? <Card><EmptyState title="Вы ещё не выдавали разрешений" description="Выданные согласия появятся здесь и будут доступны для отзыва."/></Card>
      : <div className="ftp-consent-grid">{query.data.map(g=>{
        const state=status(g),active=state==='ACTIVE'
        return <Card key={g.id} eyebrow={'ТРЕНЕР №'+g.coach_id} title={names[g.scope]}>
          <div className="ftp-consent-meta"><StatusPill variant={active?'lime':'neutral'}>{active?'Разрешено':state==='REVOKED'?'Отозвано':'Истекло'}</StatusPill><span>Выдано: {new Date(g.granted_at).toLocaleDateString('ru-RU')}</span></div>
          <p>Доступ только к категории «{names[g.scope]}». Данные о здоровье не включены.</p>
          {(active || (g.status==='ACTIVE' && state==='EXPIRED')) ? confirm===g.id ? <div className="ftp-consent-confirm"><p>Отозвать доступ к этой категории?</p><div className="ftp-consent-actions"><Button disabled={busy} onClick={()=>revoke.mutate(g.id)}>Подтвердить отзыв</Button><Button tone="ghost" disabled={busy} onClick={()=>setConfirm(null)}>Отмена</Button></div></div> : <Button tone="secondary" disabled={busy} onClick={()=>{setNotice('');setConfirm(g.id);setRestore(null)}}>{active?'Отозвать разрешение':'Закрыть истёкшее согласие'}</Button>
          : restore===g.id ? <div className="ftp-consent-confirm"><p>Повторно разрешить тренеру №{g.coach_id} доступ к «{names[g.scope]}» без ограничения срока?</p><div className="ftp-consent-actions"><Button disabled={busy} onClick={()=>regrant.mutate(g)}>Разрешить снова</Button><Button tone="ghost" disabled={busy} onClick={()=>setRestore(null)}>Отмена</Button></div></div> : <Button tone="secondary" disabled={busy} onClick={()=>{setNotice('');setRestore(g.id);setConfirm(null)}}>Выдать разрешение снова</Button>}
        </Card>
      })}</div>}
  </div>
}

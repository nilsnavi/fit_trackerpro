import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '../../shared/auth/session'
import { ClientGrantApi, type ClientGrant } from '../../shared/api/clientGrants'
import { Button, Card, EmptyState, StatusPill } from '../../shared/ui/PremiumUI'
import { SignatureIcon } from '../../shared/ui/SignatureIcon'

const api=new ClientGrantApi()
const names: Record<string,string>={
  'training_summary.read':'Сводка тренировок',
  'workout_history.read':'История тренировок',
}
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
  const [notice,setNotice]=useState('')
  const key=['athlete',identity,'coach-grants']
  const query=useQuery({queryKey:key,enabled:!!token&&!!identity,queryFn:({signal})=>api.list(token!,signal),
    staleTime:0,refetchOnWindowFocus:true})
  const revoke=useMutation({
    mutationFn:(id:string)=>api.revoke(token!,id),
    onSuccess:async()=>{setConfirm(null);setNotice('Разрешение отозвано на сервере.');await cache.invalidateQueries({queryKey:key})},
    onError:()=>setNotice('Не удалось отозвать согласие. Проверьте подключение и повторите.'),
  })
  const regrant=useMutation({
    mutationFn:(g:ClientGrant)=>api.regrant(token!,g.coach_id,g.scope,null),
    onSuccess:async()=>{setRestore(null);setNotice('Новое согласие отправлено на сервер.');await cache.invalidateQueries({queryKey:key})},
    onError:()=>setNotice('Разрешение не выдано. Проверьте активность связи с тренером.'),
  })
  const busy=revoke.isPending||regrant.isPending
  return <div className="ftp-page ftp-consents">
    <div className="ftp-heading"><div><p className="ftp-eyebrow">ATHLETE / ПРИВАТНОСТЬ</p>
      <h1>Мои <em>разрешения.</em></h1><p>Вы сами управляете тем, какую информацию о тренировках может видеть ваш тренер.</p></div>
      <StatusPill variant="lime">ПОД ВАШИМ КОНТРОЛЕМ</StatusPill>
    </div>
    <Card eyebrow="ВАЖНО" title="Ваши данные принадлежат вам">
      <p>Связь с тренером сама по себе не предоставляет доступ к вашей истории. Каждое разрешение действует отдельно. Данные о здоровье и глюкозе не входят в эти разрешения.</p>
      <p className="ftp-security-note"><SignatureIcon name="shield" size={18}/> После отзыва доступ к соответствующим данным должен блокироваться сервером.</p>
    </Card>
    {notice && <p role="status" className="ftp-consent-notice">{notice}</p>}
    {query.isPending ? <Card><p role="status">Проверяем ваши разрешения на сервере…</p></Card>
      : query.isError ? <Card><p role="alert">Не удалось получить список согласий.</p>
        <Button tone="secondary" onClick={()=>{void query.refetch()}}>Повторить</Button></Card>
      : query.data.length===0 ? <Card><EmptyState title="Вы ещё не выдавали разрешений"
        description="Когда вы подключите тренера, здесь появятся доступные для управления согласия."/></Card>
      : <div className="ftp-consent-grid">{query.data.map(g=>{
        const state=status(g),active=state==='ACTIVE'
        return <Card key={g.id} eyebrow={'ТРЕНЕР №'+g.coach_id} title={names[g.scope]}>
          <div className="ftp-consent-meta"><StatusPill variant={active?'lime':'neutral'}>{active?'Разрешено':state==='REVOKED'?'Отозвано':'Истекло'}</StatusPill>
          <span>Выдано: {new Date(g.granted_at).toLocaleDateString('ru-RU')}</span></div>
          <p>Доступ только к категории «{names[g.scope]}». Данные о здоровье не включены.</p>
          {active ? confirm===g.id ? <div className="ftp-consent-confirm">
              <p>Отозвать доступ тренера №{g.coach_id} к этой категории?</p>
              <div className="ftp-consent-actions"><Button disabled={busy} onClick={()=>revoke.mutate(g.id)}>Подтвердить отзыв</Button>
                <Button tone="ghost" disabled={busy} onClick={()=>setConfirm(null)}>Отмена</Button></div>
            </div> : <Button tone="secondary" disabled={busy} onClick={()=>{setNotice('');setConfirm(g.id);setRestore(null)}}>Отозвать разрешение</Button>
          : restore===g.id ? <div className="ftp-consent-confirm">
              <p>Повторно разрешить тренеру №{g.coach_id} доступ к «{names[g.scope]}» без ограничения срока?</p>
              <div className="ftp-consent-actions"><Button disabled={busy} onClick={()=>regrant.mutate(g)}>Разрешить снова</Button>
                <Button tone="ghost" disabled={busy} onClick={()=>setRestore(null)}>Отмена</Button></div>
            </div> : <Button tone="secondary" disabled={busy} onClick={()=>{setNotice('');setRestore(g.id);setConfirm(null)}}>Выдать разрешение снова</Button>}
        </Card>
      })}</div>}
    <p className="ftp-security-note">Выдача первого согласия новому тренеру появится после подключения безопасного списка активных тренеров. Ввод чужого ID вручную не требуется.</p>
  </div>
}

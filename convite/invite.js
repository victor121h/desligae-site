const config=window.DESLIGAE||{};
const el=id=>document.getElementById(id);
const normalize=code=>typeof code==='string'&&/^[A-Fa-f0-9]{24}$/.test(code.trim())?code.trim().toUpperCase():null;
let activeCode='',generation=0,requestController=null;
function row(label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;el('rules').append(dt,dd);}
function clearActions(){activeCode='';el('actions').hidden=true;el('open').removeAttribute('href');el('install').hidden=true;el('install').removeAttribute('href');el('copy').textContent='Copiar código';}
function secureURL(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash?url:null;}catch{return null;}
}
function storeURL(){const store=secureURL(config.appStoreURL);return store&&store.hostname==='apps.apple.com'?store:null;}
function invitationResponse(value,code){
  const uuid=value=>typeof value==='string'&&/^[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}$/.test(value);
  if(!value||value.code!==code||!uuid(value.targetID)||(value.kind==='clan'&&value.challenge!=null)||!['clan','challenge'].includes(value.kind)||!['available','expirado','revogado','iniciado','lotado'].includes(value.status)
    ||!['title','description','inviterName','expiresAt'].every(key=>typeof value[key]==='string')||!Number.isFinite(Date.parse(value.expiresAt)))throw Error('A resposta do convite não pôde ser confirmada. Consulte novamente.');
  if(value.kind==='challenge'){
    const c=value.challenge;
    if(!c||!uuid(c.id)||c.id.toLowerCase()!==value.targetID.toLowerCase()||!['strict','competitive'].includes(c.mode)||!Number.isFinite(c.limitMinutes)||!Number.isFinite(c.maximumParticipants)
      ||!Number.isFinite(Date.parse(c.startAt))||!Number.isFinite(Date.parse(c.endAt))||typeof c.timeZoneID!=='string'||!c.scoring
      ||!['verifiedDayPoints','completionPoints','extraMinutes','extraPenalty','extrasPerDay'].every(key=>Number.isFinite(c.scoring[key])))throw Error('As regras do convite não puderam ser confirmadas. Consulte novamente.');
  }
  return value;
}
async function inspect(input){
  const revision=++generation;requestController?.abort();requestController=null;
  clearActions();el('details').hidden=true;el('rules').replaceChildren();
  el('inviter').textContent='CONVITE PRIVADO';el('invite-title').textContent='Confira seu convite';
  el('lookup').querySelector('button').disabled=false;
  const code=normalize(input);
  if(!code){el('status').textContent='Confira os 24 caracteres do código, usando apenas números e letras de A a F.';return;}
  if(!config.backendURL||!config.publishableKey){el('status').textContent='O serviço de convites ainda não está ativado. Guarde este código para retomar no aplicativo.';return;}
  const base=secureURL(config.backendURL);
  if(!base){el('status').textContent='A configuração do serviço está indisponível. Guarde o código e tente novamente.';return;}
  const controller=new AbortController();requestController=controller;
  const timeout=setTimeout(()=>controller.abort(),15000);
  el('status').textContent='Consultando o convite…';el('lookup').querySelector('button').disabled=true;
  try{
    const response=await fetch(new URL('/functions/v1/desligae',base),{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},body:JSON.stringify({action:'previewInvite',payload:{code}}),signal:controller.signal});
    let result;try{result=await response.json();}catch{throw Error('Não foi possível consultar o convite. Guarde o código e tente novamente.');}
    if(revision!==generation)return;
    if(!response.ok)throw Error(typeof result?.message==='string'?result.message.slice(0,300):'Não foi possível consultar o convite.');
    const invitation=invitationResponse(result,code);
    el('inviter').textContent=`CONVITE DE ${invitation.inviterName}`;
    el('invite-title').textContent=invitation.title;el('description').textContent=invitation.description;
    const c=invitation.kind==='challenge'?invitation.challenge:null;
    if(c){const date=x=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short',timeZone:c.timeZoneID}).format(new Date(x));
      row('Limite diário',`${c.limitMinutes} min para o conjunto de apps`);row('Modo',c.mode==='strict'?'Rígido':'Competitivo');row('Início',date(c.startAt));row('Fim',date(c.endAt));row('Fuso',c.timeZoneID);row('Participantes',`Até ${c.maximumParticipants}`);
      row('Pontos provisórios',`${c.scoring.verifiedDayPoints} por dia verificado; ${c.scoring.completionPoints} pela conclusão`);
      if(c.mode==='competitive')row('Tempo extra',`${c.scoring.extraMinutes} min por −${c.scoring.extraPenalty} pontos; até ${c.scoring.extrasPerDay}/dia`);
      el('terms').textContent='Regras fixadas, sem entrada tardia. Desistência não transfere saldo permanente e não ganha bônus de conclusão. Empates compartilham posição. Falhas de conexão/permissão não geram vitória ou derrota. Resultados permanecem não verificados sem evidência permitida; a seleção de apps não é certificada entre participantes.';
    }else{el('terms').textContent='Clã privado. Seu apelido ficará visível aos integrantes. Desafios internos exigem adesão própria; entrar no clã não ativa bloqueios.';}
    el('details').hidden=false;
    const messages={expirado:'Este convite expirou. Peça um novo código a quem convidou você.',revogado:'Este convite foi revogado. Peça um novo convite a quem o enviou.',iniciado:'Este desafio já foi iniciado e não aceita entrada tardia.',lotado:'Este grupo ou desafio está lotado. Não é possível entrar com este convite.'};
    if(invitation.status!=='available'){el('status').textContent=messages[invitation.status];return;}
    activeCode=code;el('status').textContent='Leia as condições e confirme sua participação no app.';
    el('open').href=`desligae://invite/${code}`;el('actions').hidden=false;
    const store=storeURL();
    if(store){el('install').href=store.href;el('install').hidden=false;}
    else{el('status').textContent+=' O app ainda não tem um link público de instalação.';}
  }catch(error){
    if(revision!==generation)return;
    clearActions();el('details').hidden=true;
    el('status').textContent=error.name==='AbortError'?'A consulta demorou demais. Guarde o código e tente novamente.':error.message||'Não foi possível consultar. Guarde o código e tente novamente.';
  }finally{clearTimeout(timeout);if(revision===generation){requestController=null;el('lookup').querySelector('button').disabled=false;}}
}
el('lookup').addEventListener('submit',event=>{event.preventDefault();inspect(el('code').value);});
el('copy').addEventListener('click',async()=>{
  const code=activeCode,revision=generation;if(!code)return;
  try{await navigator.clipboard.writeText(code);if(revision===generation)el('copy').textContent='Código copiado';}
  catch{if(revision===generation)el('status').textContent=`Copie manualmente: ${code}`;}
});
function configuredBase(){
  const configured=config.invitePath??'/convite';
  if(typeof configured!=='string'||!/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(configured)||configured.includes('//'))return null;
  return configured.replace(/\/$/,'');
}
function incomingCode(){
  const url=new URL(location.href);let path;
  if(/%2f|%5c/i.test(url.pathname))return null;
  try{path=decodeURIComponent(url.pathname);}catch{return null;}
  const base=configuredBase();
  if(base===null||url.hash)return null;
  if(path===base||(base===''&&path==='/')){
    const entries=[...url.searchParams.entries()];
    return entries.length===1&&entries[0][0]==='code'?normalize(entries[0][1]):null;
  }
  return !url.search&&path.startsWith(base+'/')?normalize(path.slice(base.length+1)):null;
}

// Referral (indicação) links: /r/CODE or <invitePath>/r/CODE, optional ?s=<origin>.
// Same rules as Core/ReferralLink.swift: 6–16 ASCII letters/digits, no fragment, `s` at most once.
const referralSources=['story','report','achievement','referral','clan','challenge'];
const referralCode=code=>typeof code==='string'&&/^[A-Za-z0-9]{6,16}$/.test(code)?code.toUpperCase():null;
let referralGeneration=0,referralController=null,activeReferral='',visitSent=false;
function incomingReferral(){
  const url=new URL(location.href);let path;
  const base=configuredBase();
  const prefixes=[...new Set(['/r/',base?base+'/r/':null].filter(Boolean))];
  const raw=url.pathname,prefix=prefixes.find(item=>raw.startsWith(item));
  if(!prefix)return null;
  if(/%2f|%5c/i.test(raw)||url.hash)return{code:null};
  try{path=decodeURIComponent(raw);}catch{return{code:null};}
  let rest=path.slice(prefix.length);if(rest.endsWith('/'))rest=rest.slice(0,-1);
  const sources=url.searchParams.getAll('s');if(sources.length>1)return{code:null};
  const source=sources.length===1&&referralSources.includes(sources[0].toLowerCase())?sources[0].toLowerCase():null;
  return{code:rest.includes('/')?null:referralCode(rest),source};
}
function referralEndpoint(){
  if(!config.backendURL||!config.publishableKey)return null;
  const base=secureURL(config.backendURL);
  return base?new URL('/functions/v1/desligae-referrals',base):null;
}
function referralRequest(endpoint,action,payload,extra={}){
  return fetch(endpoint,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json',apikey:config.publishableKey},
    body:JSON.stringify({action,payload}),...extra});
}
// Counts one anonymous page visit per load. No cookie, no storage, no identifier; failures are ignored.
function recordVisit(code,source){
  if(visitSent)return;visitSent=true;
  const endpoint=referralEndpoint();if(!endpoint)return;
  // Sent at load (not on unload), so no keepalive: keepalive + CORS preflight is unreliable in some browsers.
  try{referralRequest(endpoint,'linkVisit',source?{code,source}:{code}).catch(()=>{});}catch{}
}
function inviterName(value){
  if(typeof value!=='string')return null;
  const name=value.trim().replace(/\s+/g,' ');
  return name.length>=1&&name.length<=40&&!/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(name)?name:null;
}
function showReferralActions(code){
  activeReferral=code;el('referral-copy').textContent='Copiar código';
  el('referral-open').href=`desligae://r/${code}`;el('referral-actions').hidden=false;
}
function hideReferralActions(){activeReferral='';el('referral-actions').hidden=true;el('referral-open').removeAttribute('href');}
function referralUnconfirmed(revision,message){
  if(revision!==referralGeneration)return;
  el('referral-inviter').textContent='CONVITE';el('referral-title').textContent='Você recebeu um convite para o Desligaê';
  el('referral-status').textContent=message;
}
async function showReferral(code,source){
  const revision=++referralGeneration;referralController?.abort();referralController=null;
  el('invite-view').hidden=true;el('referral-view').hidden=false;
  const store=storeURL();el('referral-install').hidden=!store;
  if(store)el('referral-install').href=store.href;else el('referral-install').removeAttribute('href');
  hideReferralActions();
  const normalized=referralCode(code);
  if(!normalized){
    el('referral-code-box').hidden=true;el('referral-code').textContent='';
    el('referral-inviter').textContent='CONVITE';el('referral-title').textContent='Link de convite incompleto';
    el('referral-status').textContent='Este link não tem um código válido. Peça o link de novo a quem te convidou.';
    return;
  }
  el('referral-code').textContent=normalized;el('referral-code-box').hidden=false;
  el('referral-inviter').textContent='CONVITE';el('referral-title').textContent='Você recebeu um convite para o Desligaê';
  recordVisit(normalized,source);
  const endpoint=referralEndpoint();
  // Without the preview service the code is still usable: the server validates it at signup.
  if(!endpoint){el('referral-status').textContent='';showReferralActions(normalized);return;}
  const controller=new AbortController();referralController=controller;
  const timeout=setTimeout(()=>controller.abort(),10000);
  el('referral-status').textContent='Conferindo o convite…';
  try{
    const response=await referralRequest(endpoint,'previewReferral',{code:normalized},{signal:controller.signal});
    let result=null;try{result=await response.json();}catch{}
    if(revision!==referralGeneration)return;
    if(!response.ok||!result||typeof result.valid!=='boolean'||('code' in result&&result.code!==normalized)){
      // Unknown action on an older server, rate limit or a reply for another code: no name, code still usable.
      showReferralActions(normalized);
      return referralUnconfirmed(revision,'Não foi possível confirmar o convite agora. Você ainda pode usar o código.');
    }
    if(!result.valid){
      el('referral-title').textContent='Convite não encontrado';
      el('referral-status').textContent='Não encontramos este código. Confira o link com quem te convidou.';
      return;
    }
    const name=inviterName(result.inviterFirstName);
    el('referral-inviter').textContent=name?'CONVITE PESSOAL':'CONVITE';
    el('referral-title').textContent=name?`Você foi convidado(a) por ${name}`:'Você recebeu um convite para o Desligaê';
    el('referral-status').textContent='';
    showReferralActions(normalized);
  }catch(error){
    if(revision!==referralGeneration)return;
    showReferralActions(normalized);
    referralUnconfirmed(revision,error?.name==='AbortError'?'A consulta demorou. Você ainda pode usar o código.':'Não foi possível confirmar o convite agora. Você ainda pode usar o código.');
  }finally{clearTimeout(timeout);if(revision===referralGeneration)referralController=null;}
}
el('referral-copy').addEventListener('click',async()=>{
  const code=activeReferral,revision=referralGeneration;if(!code)return;
  try{await navigator.clipboard.writeText(code);if(revision===referralGeneration)el('referral-copy').textContent='Código copiado';}
  catch{if(revision===referralGeneration)el('referral-status').textContent=`Copie manualmente: ${code}`;}
});

const referral=incomingReferral();
if(referral){showReferral(referral.code,referral.source);}
else{
  const incoming=incomingCode();
  if(incoming){el('code').value=incoming;inspect(incoming);}
  else if(location.search||location.pathname.includes('/convite/')){el('status').textContent='Este link não contém um código de convite válido. Cole abaixo apenas o código recebido.';}
}

'use strict';

// Enter your backend URLs. All displayed data comes from the API.
const FRIENDS_CONFIG = {
  friendsUrl: '',         // GET -> { friends: [...] }
  requestsUrl: '',        // GET -> { requests: [...] }
  progressUrl: '',        // GET ?friendId=... -> { progress: {...} }
  actionUrl: '',          // POST { action, friendId } or { action, requestId }
  logoutUrl: '',          // POST; backend should clear its session cookie
  credentials: 'include',
  getHeaders: () => ({})  // Optional authentication headers; never embed secret keys.
};

let friends = [];
let requests = [];
let activeTab = 'friends';
let busy = false;
let progressController;
const $ = id => document.getElementById(id);
const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const format = value => valid(value) ? value.toLocaleString('en-US', {maximumFractionDigits:1}) : '—';

// Round FIRST, then choose a color using the displayed percentage.
// Over 100% stays green, while the bar/ring fill is capped at 100%.
function getProgress(consumed, target) {
  if (!valid(consumed) || !valid(target) || target === 0) return {percent:null,fill:0,color:'#b5bec7'};
  const percent = Math.round(consumed / target * 100);
  return {percent,fill:Math.min(100,percent),color:percent>=80?'#16a354':percent>=50?'#f5c400':percent>=30?'#ef4444':'#9164df'};
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function paint(node, progress) {
  node.style.setProperty('--pct', `${progress.fill}%`);
  node.style.setProperty('--progress-color', progress.color);
}
function track(progress, label) {
  const node = element('div','friend-track');
  paint(node,progress);
  node.append(element('span'));
  node.setAttribute('role','progressbar');
  node.setAttribute('aria-label',label);
  node.setAttribute('aria-valuemin','0');
  node.setAttribute('aria-valuemax','100');
  if(progress.percent!==null) node.setAttribute('aria-valuenow',String(progress.fill));
  node.setAttribute('aria-valuetext',progress.percent===null?'Unavailable':`${progress.percent}%`);
  return node;
}
function button(text, cls, callback) {
  const node = element('button',cls,text);
  node.type='button'; node.disabled=busy; node.addEventListener('click',callback); return node;
}
function showError(message='') { $('error').textContent=message; $('error').hidden=!message; }
function person(friend) {
  const node=element('div','friend-person');
  node.append(element('div','friend-name',friend.name || friend.username || 'User'));
  node.append(element('div','username',`@${friend.username || '—'}`));
  return node;
}
function render() {
  $('friends-count').textContent=`(${friends.length})`;
  $('requests-count').textContent=String(requests.length);
  for (const tab of ['friends','requests']) {
    const selected=activeTab===tab;
    $(tab+'-tab').classList.toggle('selected',selected);
    $(tab+'-tab').setAttribute('aria-selected',String(selected));
    $(tab+'-tab').tabIndex=selected?0:-1;
  }
  const list=$('friends-list'); list.replaceChildren();
  list.setAttribute('aria-labelledby',activeTab+'-tab');
  const query=$('search').value.trim().toLowerCase().replace(/^@/,'');
  const items=(activeTab==='friends'?friends:requests).filter(f=>String(f.username || '').toLowerCase().includes(query));
  items.sort((a,b)=>$('sort').value==='streak'?(b.streak||0)-(a.streak||0):$('sort').value==='progress'?(getProgress(b.calories?.consumed,b.calories?.target).percent ?? -1)-(getProgress(a.calories?.consumed,a.calories?.target).percent ?? -1):String(a.name||a.username).localeCompare(String(b.name||b.username)));
  if(!items.length) list.append(element('p','empty',query?'No matching usernames.':activeTab==='friends'?'No friends yet.':'No pending friend requests.'));
  for(const friend of items) {
    if(activeTab==='requests') {
      const row=element('div','request-row'); row.append(person(friend));
      const actions=element('div','request-actions');
      actions.append(button('Accept','primary',()=>performAction('accept',friend)),button('Decline','outline',()=>performAction('decline',friend)));
      row.append(actions); list.append(row); continue;
    }
    const row=element('article','friend-row'); const identity=person(friend);
    identity.append(element('p','streak',`🔥 ${format(friend.streak)}-day streak`)); row.append(identity);
    const progress=getProgress(friend.calories?.consumed,friend.calories?.target);
    const nutrition=element('div','friend-nutrition');
    const label=element('p','calorie-label');label.append(element('strong','',format(friend.calories?.consumed)),document.createTextNode(` / ${format(friend.calories?.target)} kcal`));
    nutrition.append(label,track(progress,`${friend.username} calorie progress`));row.append(nutrition);
    const ring=element('div','friend-ring');paint(ring,progress);ring.append(element('span','',progress.percent===null?'—':`${progress.percent}%`));ring.setAttribute('aria-hidden','true');row.append(ring);
    row.append(button('View Progress','view-button',()=>openProgress(friend)));
    const menu=element('details','friend-menu');const summary=element('summary','','⋮');summary.setAttribute('aria-label',`Options for ${friend.username}`);menu.append(summary,button('Remove Friend','',()=>performAction('remove',friend)));row.append(menu);list.append(row);
  }
}
async function request(url, options={}) {
  if(!url) throw new Error('Configure the required backend URL in friends.js.');
  const controller=new AbortController();
  const external=options.signal;
  const abort=()=>controller.abort();
  external?.addEventListener('abort',abort,{once:true});
  if(external?.aborted) controller.abort();
  const timer=setTimeout(abort,30000);
  try {
    const headers=new Headers(FRIENDS_CONFIG.getHeaders());
    if(options.body) headers.set('Content-Type','application/json');
    const response=await fetch(url,{...options,headers,credentials:FRIENDS_CONFIG.credentials,signal:controller.signal});
    if(!response.ok) throw new Error(response.status===401?'Please log in again.':`Request failed (${response.status}). Please try again.`);
    if(response.status===204) return {};
    const data=await response.json();
    if(data.success===false) throw new Error(typeof data.message==='string'?data.message:'The request could not be completed.');
    return data;
  } finally {clearTimeout(timer);external?.removeEventListener('abort',abort);}
}
function validateList(data,key) {
  if(!Array.isArray(data[key]) || data[key].some(item=>!item || typeof item!=='object' || typeof item.username!=='string' || !['string','number'].includes(typeof item.id))) throw new Error(`Invalid ${key} response. Check the API format in README.`);
  return data[key];
}
async function load() {
  if(busy) return;
  if(!FRIENDS_CONFIG.friendsUrl || !FRIENDS_CONFIG.requestsUrl) {
    friends=[]; requests=[]; showError(); $('status').textContent=''; render(); return;
  }
  busy=true;$('refresh').disabled=true;showError();$('status').textContent='Loading…';render();
  try {
    {
      const [f,r]=await Promise.all([request(FRIENDS_CONFIG.friendsUrl),request(FRIENDS_CONFIG.requestsUrl)]);
      const nextFriends=validateList(f,'friends'),nextRequests=validateList(r,'requests');friends=nextFriends;requests=nextRequests;
      $('status').textContent='Friends updated.';
    }
  } catch(error) {showError(error.name==='AbortError'?'Request timed out. Please try again.':error.message);$('status').textContent='Could not refresh friends.';}
  finally {busy=false;$('refresh').disabled=false;render();}
}
async function performAction(action,item) {
  if(busy) return;
  if(action==='remove' && !confirm(`Remove @${item.username} from your friends?`)) return;
  busy=true;render();showError();
  try {
    await request(FRIENDS_CONFIG.actionUrl,{method:'POST',body:JSON.stringify(action==='remove'?{action,friendId:item.id}:{action,requestId:item.id})});
    busy=false;await load();
  } catch(error) {showError(error.message);} finally {busy=false;render();}
}
function renderProgress(friend, data) {
  const root=$('progress-content'); root.replaceChildren();root.append(element('h3','progress-person',`@${friend.username}`));
  const stats=element('div','progress-stats');stats.append(element('span','',`🔥 ${format(data.streak)}-day streak`),element('span','',`Level ${format(data.level)}`));root.append(stats);
  for(const [key,title,unit] of [['calories','Calories','kcal'],['protein','Protein','g'],['carbs','Carbs','g'],['fat','Fat','g']]) {
    const metric=data[key] || {};const progress=getProgress(metric.consumed,metric.target);const block=element('div','progress-metric');
    const label=element('div','metric-label');label.append(element('strong','',title),element('span','',`${format(metric.consumed)} / ${format(metric.target)} ${unit} · ${progress.percent===null?'—':progress.percent+'%'}`));
    block.append(label,track(progress,title));root.append(block);
  }
  root.append(element('p','progress-note','Progress shared by this friend. Unavailable values are shown as —.'));
}
async function openProgress(friend) {
  progressController?.abort(); progressController=new AbortController();
  $('progress-content').replaceChildren(element('p','status','Loading progress…'));$('progress-dialog').showModal();
  try {
    let data;
    {
      const url=new URL(FRIENDS_CONFIG.progressUrl,location.href);url.searchParams.set('friendId',friend.id);
      if(!FRIENDS_CONFIG.progressUrl) throw new Error('Configure progressUrl in friends.js.');
      const result=await request(url.href,{signal:progressController.signal});
      if(!result.progress || typeof result.progress!=='object') throw new Error('Invalid progress response.');data=result.progress;
    }
    if($('progress-dialog').open) renderProgress(friend,data);
  } catch(error) {if($('progress-dialog').open) $('progress-content').replaceChildren(element('p','notice',error.name==='AbortError'?'Request cancelled or timed out.':error.message));}
}
for(const tab of ['friends','requests']) {
  $(tab+'-tab').addEventListener('click',()=>{activeTab=tab;render();});
  $(tab+'-tab').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();activeTab=event.key==='Home'?'friends':event.key==='End'?'requests':activeTab==='friends'?'requests':'friends';render();$(activeTab+'-tab').focus();}});
}
$('search-form').addEventListener('submit',event=>{event.preventDefault();render();});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);$('refresh').addEventListener('click',load);
$('close-dialog').addEventListener('click',()=>$('progress-dialog').close());
$('progress-dialog').addEventListener('close',()=>progressController?.abort());
$('logout').addEventListener('click',async()=>{try{{if(!FRIENDS_CONFIG.logoutUrl) throw new Error('Configure logoutUrl in friends.js.');await request(FRIENDS_CONFIG.logoutUrl,{method:'POST'});}location.href='login.html';}catch(error){showError(error.message);}});
load();

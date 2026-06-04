// 简单 SPA：数据保存在 localStorage，可管理 车间->机组->房间->点位 的 CRUD
const view = document.getElementById('view');

// 数据模型（持久化在 localStorage）
let workshops = [];
let units = [];
let rooms = [];
let points = [];
let events = []; // {id,type:'unit'|'point',targetId,action:'on'|'off'|'blocked',at:ISO}

function load(){
  try{
    workshops = JSON.parse(localStorage.getItem('workshops')||'[]');
    units = JSON.parse(localStorage.getItem('units')||'[]');
    rooms = JSON.parse(localStorage.getItem('rooms')||'[]');
    points = JSON.parse(localStorage.getItem('points')||'[]');
    events = JSON.parse(localStorage.getItem('events')||'[]');
    // 清理历史数据：移除旧版点位对象中的 value 字段（如果存在）
    try{
      let cleaned = false;
      if(Array.isArray(points)){
        points.forEach(p=>{ if(p && Object.prototype.hasOwnProperty.call(p,'value')){ delete p.value; cleaned = true; } });
      }
      if(cleaned){ localStorage.setItem('points', JSON.stringify(points)); console.log('清理历史点位字段: 已移除 value 字段'); }
    }catch(_){ /* ignore migration errors */ }
  }catch(e){workshops=[];units=[];rooms=[];points=[]}
}
// 立即加载（不自动填充示例数据）
load();
function save(){
  localStorage.setItem('workshops',JSON.stringify(workshops));
  localStorage.setItem('units',JSON.stringify(units));
  localStorage.setItem('rooms',JSON.stringify(rooms));
  localStorage.setItem('points',JSON.stringify(points));
  localStorage.setItem('events',JSON.stringify(events));
}

function navTo(hash){
  const route = (hash||location.hash||'#workshops').replace('#','');
  renderRoute(route);
  // 高亮导航
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===('#'+route)));
  // 触发视图淡入动效
  view.classList.remove('fade-in');
  // 强制重绘以重置动画
  void view.offsetWidth;
  view.classList.add('fade-in');
}

window.addEventListener('hashchange', ()=>navTo());
document.addEventListener('DOMContentLoaded', ()=>navTo());

// Helpers
const byId = (arr,id)=>arr.find(x=>x.id===Number(id));
const nextId = arr=> (arr.length?Math.max(...arr.map(x=>x.id))+1:1);

// 模态与内联错误帮助函数
function showInlineError(inputElem, msg){
  clearInlineError(inputElem);
  if(!msg) return;
  inputElem.classList.add('input-error');
  const span = document.createElement('div'); span.className='error-text'; span.textContent=msg;
  inputElem.parentNode.insertBefore(span, inputElem.nextSibling);
}
function clearInlineError(inputElem){
  inputElem.classList.remove('input-error');
  const next = inputElem.nextSibling; if(next && next.classList && next.classList.contains('error-text')) next.remove();
}

function showModal(options){
  const modal = document.getElementById('modal'); const title = document.getElementById('modalTitle'); const body = document.getElementById('modalBody'); const save = document.getElementById('modalSave'); const cancel = document.getElementById('modalCancel');
  title.textContent = options.title || '';
  body.innerHTML = '';
  (options.fields||[]).forEach(f=>{
    const wrapper = document.createElement('div'); wrapper.style.marginBottom='8px';
    const label = document.createElement('label'); label.textContent = f.label||''; label.style.display='block'; label.style.fontWeight='600'; label.style.marginBottom='6px';
    let input;
    if(f.type==='textarea'){
      input = document.createElement('textarea'); input.rows = f.rows||6;
    } else {
      input = document.createElement('input'); input.type = f.type||'text';
    }
    input.id = f.id; input.value = f.value||''; input.placeholder = f.placeholder||''; input.style.width='100%'; input.oninput = ()=> clearInlineError(input);
    wrapper.appendChild(label); wrapper.appendChild(input); body.appendChild(wrapper);
  });
  const modalContent = modal.querySelector('.modal-content');
  modal.classList.remove('hidden');
  // show animation
  modal.classList.add('show'); modalContent.classList.add('show');
  // focus first input
  setTimeout(()=>{
    const first = modal.querySelector('input,textarea'); if(first) first.focus();
  },50);
  // handle ESC and tab trap
  function onKey(e){
    if(e.key==='Escape'){ modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown',onKey); if(options.onCancel) options.onCancel(); }
    if(e.key==='Tab'){
      const focusables = Array.from(modal.querySelectorAll('input,textarea,button')).filter(el=>!el.disabled);
      if(!focusables.length) return;
      const idx = focusables.indexOf(document.activeElement);
      if(e.shiftKey){ if(idx<=0){ focusables[focusables.length-1].focus(); e.preventDefault(); } }
      else { if(idx===focusables.length-1){ focusables[0].focus(); e.preventDefault(); } }
    }
  }
  document.addEventListener('keydown', onKey);
  save.onclick = ()=>{
    const values = {};
    let ok = true;
    (options.fields||[]).forEach(f=>{ const input = document.getElementById(f.id); const val = input.value.trim(); if(f.required && !val){ showInlineError(input, f.requiredMsg || '必填'); ok = false; } values[f.id]=val; });
    if(!ok) return;
    modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown', onKey);
    options.onSave && options.onSave(values);
  };
  cancel.onclick = ()=>{ modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown', onKey); if(options.onCancel) options.onCancel(); };
}

// 顶部 toast 提示
function showToast(msg, type){
  const c = document.getElementById('toastContainer'); if(!c) return;
  const t = document.createElement('div'); t.className = 'toast' + (type==='error'? ' error':''); t.textContent = msg; c.appendChild(t);
  // 自动淡出并移除
  const duration = 3000;
  setTimeout(()=>{ t.classList.add('hide'); }, duration-220);
  setTimeout(()=>{ t.remove(); }, duration);
}

// 通用确认模态：message 文本，onConfirm/onCancel 回调
function showConfirm(message, onConfirm, onCancel){
  const modal = document.getElementById('modal'); const title = document.getElementById('modalTitle'); const body = document.getElementById('modalBody'); const save = document.getElementById('modalSave'); const cancel = document.getElementById('modalCancel');
  title.textContent = '确认'; body.innerHTML = `<p class="small">${message}</p>`;
  const modalContent = modal.querySelector('.modal-content');
  modal.classList.remove('hidden'); modal.classList.add('show'); modalContent.classList.add('show');
  // focus 保存按钮
  setTimeout(()=>{ save.focus(); },50);
  function onKey(e){ if(e.key==='Escape'){ modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown',onKey); if(onCancel) onCancel(); } }
  document.addEventListener('keydown', onKey);
  save.onclick = ()=>{ modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown',onKey); onConfirm && onConfirm(); };
  cancel.onclick = ()=>{ modal.classList.add('hidden'); modal.classList.remove('show'); modalContent.classList.remove('show'); document.removeEventListener('keydown',onKey); onCancel && onCancel(); };
}

// 机组编辑
// 机组编辑
function renderUnits(){
  // 渲染基本结构（select 保留，并仅刷新列表以避免切换时丢失选择）
  const prevSelected = document.getElementById('workshopForUnit')?.value;
  const workshopOptions = workshops.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  view.innerHTML=`
    <h1>机组编辑</h1>
    <div class="form">
      <select id="workshopForUnit">${workshopOptions}</select>
      <input id="unitName" placeholder="新机组名称">
      <div><button id="addUnit">添加机组</button></div>
    </div>
    <div class="list"><table><thead><tr><th>名称</th><th class="small">操作</th></tr></thead><tbody id="unitsBody"></tbody></table></div>`;

  const select = document.getElementById('workshopForUnit');
  // 恢复之前的选择（如果仍然存在），否则保持第一个
  if(prevSelected && Array.from(select.options).some(o=>o.value===String(prevSelected))){ select.value = prevSelected; }
  else if(select.options.length) select.selectedIndex = 0;

  const body = document.getElementById('unitsBody');
  function refreshList(){
    body.innerHTML = '';
    const wid = Number(select.value || (workshops[0]?.id||0));
    units.filter(u=>u.workshopId===wid).forEach(u=>{
      const tr = document.createElement('tr');
      tr.innerHTML=`<td>${u.name}</td><td class="small"><button data-id="${u.id}" class="edit">编辑</button> <button data-id="${u.id}" class="del">删除</button></td>`;
      body.appendChild(tr);
    });
    // 绑定行内操作（删除需确认）
    body.querySelectorAll('.del').forEach(btn=>btn.onclick=e=>{
      const id=Number(e.target.dataset.id); const u = byId(units,id);
      showConfirm(`确认删除机组 “${u?.name||''}”？此操作会删除其下所有房间与点位。`, ()=>{
        const removedRoomIds = rooms.filter(r=>r.unitId===id).map(r=>r.id);
        units = units.filter(x=>x.id!==id);
        rooms = rooms.filter(r=>r.unitId!==id);
        points = points.filter(p=>!removedRoomIds.includes(p.roomId));
        save(); refreshList();
      });
    });
    body.querySelectorAll('.edit').forEach(btn=>btn.onclick=e=>{
      const id=Number(e.target.dataset.id); const u=byId(units,id);
      const tr = e.target.closest('tr'); const nameTd = tr.children[0]; const opsTd = tr.children[1];
      // 替换为内联编辑行
      nameTd.innerHTML = `<input class="inline-edit" value="${u.name}">`;
      opsTd.innerHTML = `<button class="save">保存</button> <button class="cancel">取消</button>`;
      const input = nameTd.querySelector('input'); input.focus();
      // 键盘支持：Enter 保存，Esc 取消
      input.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); opsTd.querySelector('.save').click(); } else if(ev.key==='Escape'){ ev.preventDefault(); opsTd.querySelector('.cancel').click(); } });
      opsTd.querySelector('.save').onclick = ()=>{
        const newVal = input.value.trim(); if(!newVal){ showInlineError(input,'请输入机组名称'); return; }
        showConfirm(`确认保存对机组 “${u.name}” 的修改？`, ()=>{ u.name = newVal; save(); refreshList(); });
      };
      opsTd.querySelector('.cancel').onclick = ()=>{ refreshList(); };
    });
  }

  document.getElementById('addUnit').onclick = ()=>{
    const input = document.getElementById('unitName'); const name = input.value.trim();
    clearInlineError(input);
    if(!name){ showInlineError(input,'请输入名称'); return; }
    // 读取当前最新的 select 值，避免闭包引用导致的 stale value
    const workshopSelect = document.getElementById('workshopForUnit'); const workshopId = Number(workshopSelect?.value || 0);
    if(!workshopId){ showToast('请先创建并选择车间','error'); return; }
    const wsName = byId(workshops,workshopId)?.name||'';
    showConfirm(`确认在车间 “${wsName}” 下添加机组 “${name}”？`, ()=>{ units.push({id:nextId(units),name,workshopId}); save(); refreshList(); showToast('添加机组成功'); });
  };
  select.onchange = refreshList;
  // 首次填充列表
  refreshList();
}

// 房间编辑（按机组）
function renderRooms(){
  // 局部刷新房间列表，保留之前选择
  const prevWorkshop = document.getElementById('workshopForRoom')?.value;
  const prevUnit = document.getElementById('unitSelect')?.value;
  const workshopOptions = workshops.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  view.innerHTML=`<h1>房间编辑</h1>
    <div class="form">
      <select id="workshopForRoom">${workshopOptions}</select>
      <select id="unitSelect"></select>
      <input id="roomName" placeholder="新房间名称">
      <div><button id="addRoom">添加房间</button></div>
    </div>
    <div class="list"><table><thead><tr><th>名称</th><th>所属机组</th><th class="small">操作</th></tr></thead><tbody id="roomsBody"></tbody></table></div>`;
  const selectWorkshop = document.getElementById('workshopForRoom');
  const unitSelect = document.getElementById('unitSelect');
  // 恢复上一次选择
  if(prevWorkshop && Array.from(selectWorkshop.options).some(o=>o.value===String(prevWorkshop))){ selectWorkshop.value = prevWorkshop; }
  if(!selectWorkshop.options.length && workshops.length) selectWorkshop.selectedIndex = 0;

  function updateUnits(){ unitSelect.innerHTML = units.filter(u=>u.workshopId==selectWorkshop.value).map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
    if(prevUnit && Array.from(unitSelect.options).some(o=>o.value===String(prevUnit))){ unitSelect.value = prevUnit; }
    else if(unitSelect.options.length) unitSelect.selectedIndex = 0;
  }

  const body = document.getElementById('roomsBody');
  function refresh(){
    body.innerHTML='';
    const uid=Number(unitSelect.value||0);
    rooms.filter(r=>r.unitId===uid).forEach(r=>{
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.name}</td><td>${byId(units,r.unitId)?.name||'—'}</td><td class="small"><button data-id="${r.id}" class="edit">编辑</button> <button data-id="${r.id}" class="del">删除</button></td>`; body.appendChild(tr);
    });
    body.querySelectorAll('.del').forEach(b=>b.onclick=e=>{ const rid=Number(e.target.dataset.id); const r = byId(rooms,rid);
      showConfirm(`确认删除房间 “${r?.name||''}”？此操作会删除该房间下所有点位。`, ()=>{ rooms=rooms.filter(x=>x.id!==rid); points=points.filter(p=>p.roomId!==rid); save(); refresh(); });
    });
    body.querySelectorAll('.edit').forEach(b=>b.onclick=e=>{
      const r=byId(rooms,e.target.dataset.id);
      const tr = e.target.closest('tr'); const nameTd = tr.children[0]; const unitTd = tr.children[1]; const opsTd = tr.children[2];
      nameTd.innerHTML = `<input class="inline-edit" value="${r.name}">`;
      opsTd.innerHTML = `<button class="save">保存</button> <button class="cancel">取消</button>`;
      const input = nameTd.querySelector('input'); input.focus();
      input.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); opsTd.querySelector('.save').click(); } else if(ev.key==='Escape'){ ev.preventDefault(); opsTd.querySelector('.cancel').click(); } });
      opsTd.querySelector('.save').onclick = ()=>{ const v = input.value.trim(); if(!v){ showInlineError(input,'请输入房间名'); return; } showConfirm(`确认保存对房间 “${r.name}” 的修改？`, ()=>{ r.name = v; save(); refresh(); }); };
      opsTd.querySelector('.cancel').onclick = ()=>{ refresh(); };
    });
  }
  document.getElementById('roomName').addEventListener('input', e=> clearInlineError(e.target));
  document.getElementById('addRoom').onclick=()=>{const name=document.getElementById('roomName').value.trim(); const uid=Number(unitSelect.value); const input=document.getElementById('roomName'); clearInlineError(input); if(!name){ showInlineError(input,'请输入房间名'); return; } if(!uid){ showToast('请选择机组','error'); return; } const unitName = byId(units,uid)?.name || '';
    showConfirm(`确认在机组 “${unitName}” 下添加房间 “${name}”？`, ()=>{ rooms.push({id:nextId(rooms),unitId:uid,name}); save(); refresh(); showToast('添加房间成功'); });
  };
  selectWorkshop.onchange=()=>{ updateUnits(); refresh(); };
  unitSelect.onchange=refresh; updateUnits(); refresh();
}

// 点位编辑（按房间）
function renderPoints(){
  // 局部刷新点位列表，保留选择
  const prevWorkshop = document.getElementById('workshopForPoint')?.value;
  const prevUnit = document.getElementById('unitForPoint')?.value;
  const prevRoom = document.getElementById('roomSelect')?.value;
  const workshopOptions = workshops.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  view.innerHTML=`<h1>点位编辑</h1>
    <div class="form">
      <select id="workshopForPoint">${workshopOptions}</select>
      <select id="unitForPoint"></select>
      <select id="roomSelect"></select>
      <input id="pointName" placeholder="新点位名称">
      <div><button id="addPoint">添加点位</button></div>
    </div>
    <div class="list"><table><thead><tr><th>名称</th><th>房间</th><th>值</th><th class="small">操作</th></tr></thead><tbody id="pointsBody"></tbody></table></div>`;
  const selectWorkshop = document.getElementById('workshopForPoint');
  const unitForPoint = document.getElementById('unitForPoint');
  const roomSelect = document.getElementById('roomSelect');
  // 恢复选择
  if(prevWorkshop && Array.from(selectWorkshop.options).some(o=>o.value===String(prevWorkshop))){ selectWorkshop.value = prevWorkshop; }

  function updateUnits(){ unitForPoint.innerHTML = units.filter(u=>u.workshopId==selectWorkshop.value).map(u=>`<option value="${u.id}">${u.name}</option>`).join('');
    if(prevUnit && Array.from(unitForPoint.options).some(o=>o.value===String(prevUnit))){ unitForPoint.value = prevUnit; }
    else if(unitForPoint.options.length) unitForPoint.selectedIndex = 0;
  }
  function updateRooms(){ roomSelect.innerHTML=rooms.filter(r=>r.unitId==unitForPoint.value).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
    if(prevRoom && Array.from(roomSelect.options).some(o=>o.value===String(prevRoom))){ roomSelect.value = prevRoom; }
    else if(roomSelect.options.length) roomSelect.selectedIndex = 0;
  }
  const body = document.getElementById('pointsBody');
  function refresh(){
    updateRooms(); const rid=Number(roomSelect.value||0); body.innerHTML=''; points.filter(p=>p.roomId===rid).forEach(p=>{const tr=document.createElement('tr'); tr.innerHTML=`<td>${p.name}</td><td>${byId(rooms,p.roomId)?.name||'—'}</td><td class="small"><button data-id="${p.id}" class="edit">编辑</button> <button data-id="${p.id}" class="del">删除</button></td>`; body.appendChild(tr);});
    body.querySelectorAll('.del').forEach(b=>b.onclick=e=>{const id=Number(e.target.dataset.id); const p=byId(points,id); showConfirm(`确认删除点位 “${p?.name||''}”？`, ()=>{ points=points.filter(x=>x.id!==id); save(); refresh(); });});
    body.querySelectorAll('.edit').forEach(b=>b.onclick=e=>{
      const p=byId(points,e.target.dataset.id);
      const tr = e.target.closest('tr'); const nameTd = tr.children[0]; const roomTd = tr.children[1]; const valTd = tr.children[2]; const opsTd = tr.children[3];
      nameTd.innerHTML = `<input class="inline-edit name" value="${p.name}">`;
      // removed value column — no valTd
      opsTd.innerHTML = `<button class="save">保存</button> <button class="cancel">取消</button>`;
      const nameInput = nameTd.querySelector('input'); const valInput = valTd.querySelector('input'); nameInput.focus();
      function pointsSave(){ const nv = nameInput.value.trim(); if(!nv){ showInlineError(nameInput,'请输入点位名'); return; } const apply=()=>{ p.name = nv; save(); refresh(); }; showConfirm(`确认保存对点位 “${p.name}” 的修改？`, apply); }
      nameInput.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); pointsSave(); } else if(ev.key==='Escape'){ ev.preventDefault(); opsTd.querySelector('.cancel').click(); } });
      opsTd.querySelector('.save').onclick = pointsSave;
      opsTd.querySelector('.cancel').onclick = ()=>{ refresh(); };
    });
  }
  document.getElementById('pointName').addEventListener('input', e=> clearInlineError(e.target));
  document.getElementById('addPoint').onclick=()=>{const input=document.getElementById('pointName'); const name=input.value.trim(); const rid=Number(roomSelect.value); clearInlineError(input); if(!name){ showInlineError(input,'请输入点位名'); return; } const roomName = byId(rooms,rid)?.name||''; showConfirm(`确认在房间 “${roomName}” 下添加点位 “${name}”？`, ()=>{ points.push({id:nextId(points),roomId:rid,name}); save(); refresh(); showToast('添加点位成功'); }); };
  selectWorkshop.onchange=()=>{ updateUnits(); updateRooms(); refresh(); };
  unitForPoint.onchange=()=>{ updateRooms(); refresh(); };
  roomSelect.onchange=refresh; updateUnits(); updateRooms(); refresh();
}

// 实时编辑（简单模拟）
let realtimeInterval=null;
function renderRealtime(){
  const wsOptions = '<option value="0">全部车间</option>' + workshops.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  view.innerHTML=`<h1>实时编辑</h1>
    <div class="form">
      <select id="rtWorkshop">${wsOptions}</select>
      <input id="rtSearch" placeholder="搜索机组或点位（模糊）">
      <div><button id="rtSim">输入事件</button></div>
    </div>
    <div class="list">
      <div id="rtResults"></div>
      <div id="rtSelected" style="margin-top:.8rem"></div>
      <p class="small">当前值：<span id="rtCur">—</span></p>
    </div>`;
  const results = document.getElementById('rtResults'); const selectedBox = document.getElementById('rtSelected'); const cur=document.getElementById('rtCur');
  const search = document.getElementById('rtSearch');
  function renderResults(q){
    const s = (q||'').trim().toLowerCase();
    if(!s){ results.innerHTML = '<p class="small">请输入关键词以搜索。</p>'; return; }
    const selectedWorkshop = Number(document.getElementById('rtWorkshop').value||0);
    const unitMatches = units.filter(u=>u.name.toLowerCase().includes(s) && (selectedWorkshop===0 || u.workshopId===selectedWorkshop));
    const pointMatches = points.filter(p=>{
      if(!p.name.toLowerCase().includes(s)) return false;
      if(selectedWorkshop===0) return true;
      const room = byId(rooms,p.roomId); if(!room) return false;
      const unit = byId(units,room.unitId); if(!unit) return false;
      return unit.workshopId===selectedWorkshop;
    });
    let html = '<div class="rt-grid">';
    if(unitMatches.length){ html += '<div class="rt-section"><h4 class="small">机组</h4><div class="rt-list">'; unitMatches.forEach(u=> html += `<div class="rt-item"><button class="rt-select" data-type="unit" data-id="${u.id}"><div class="rt-title">${u.name}</div><div class="rt-sub small">机组</div></button></div>`); html += '</div></div>'; }
    if(pointMatches.length){ html += '<div class="rt-section"><h4 class="small">点位</h4><div class="rt-list">'; pointMatches.forEach(p=> html += `<div class="rt-item"><button class="rt-select" data-type="point" data-id="${p.id}"><div class="rt-title">${p.name}</div><div class="rt-sub small">${byId(rooms,p.roomId)?.name||'—'}</div></button></div>`); html += '</div></div>'; }
    html += '</div>';
    results.innerHTML = (unitMatches.length||pointMatches.length) ? html : '<p class="small">未找到匹配项。</p>';
    results.querySelectorAll('.rt-select').forEach(b=>b.onclick = e=>{ const btn = e.currentTarget; const type=btn.dataset.type; const id=Number(btn.dataset.id); showSelected(type,id); });
  }
  // 当车间选择变更时重新渲染结果
  const wk = document.getElementById('rtWorkshop'); wk.addEventListener('change', ()=>{ const q = document.getElementById('rtSearch').value || ''; renderResults(q); });
  function showSelected(type,id){
    selectedBox.innerHTML = '';
    if(type==='unit'){
      const u = byId(units,id); if(!u) return;
      const status = u.status||'off';
      selectedBox.innerHTML = `<div><strong>机组：${u.name}</strong> <div class="small">状态：${status}</div></div><div style="margin-top:.5rem"><button id="unitOn">开启</button> <button id="unitOff">关闭</button></div>`;
      document.getElementById('unitOn').onclick = ()=>{
        showModal({ title:'选择时间与日志', fields:[{id:'actionTime',label:'操作时间',type:'datetime-local',required:true,requiredMsg:'请选择时间'},{id:'actionNote',label:'事件日志',type:'textarea',rows:3,required:true,requiredMsg:'请输入事件日志'}], onSave: vals=>{
          const iso = new Date(vals.actionTime).toISOString();
          u.status='on'; u.lastActionAt = iso; u.lastActionNote = vals.actionNote;
          events.push({id:nextId(events),type:'unit',targetId:u.id,action:'on',at:iso,note:vals.actionNote}); save(); showToast('已开启机组：'+u.name+' @ '+ new Date(iso).toLocaleString());
        } });
      };
      document.getElementById('unitOff').onclick = ()=>{
        showModal({ title:'选择时间与日志', fields:[{id:'actionTime',label:'操作时间',type:'datetime-local',required:true,requiredMsg:'请选择时间'},{id:'actionNote',label:'事件日志',type:'textarea',rows:3,required:true,requiredMsg:'请输入事件日志'}], onSave: vals=>{
          const iso = new Date(vals.actionTime).toISOString();
          u.status='off'; u.lastActionAt = iso; u.lastActionNote = vals.actionNote;
          events.push({id:nextId(events),type:'unit',targetId:u.id,action:'off',at:iso,note:vals.actionNote}); save(); showToast('已关闭机组：'+u.name+' @ '+ new Date(iso).toLocaleString());
        } });
      };
      cur.textContent = '—';
    }else if(type==='point'){
      const p = byId(points,id); if(!p) return;
      p.status = p.status||'on';
      selectedBox.innerHTML = `<div><strong>点位：${p.name}</strong> <div class="small">所在房间：${byId(rooms,p.roomId)?.name||'—'}</div></div><div style="margin-top:.5rem"><button id="pointOn">开启</button> <button id="pointBlock">屏蔽</button></div>`;
      document.getElementById('pointOn').onclick = ()=>{
        showModal({ title:'选择时间与日志', fields:[{id:'actionTime',label:'操作时间',type:'datetime-local',required:true,requiredMsg:'请选择时间'},{id:'actionNote',label:'事件日志',type:'textarea',rows:3,required:true,requiredMsg:'请输入事件日志'}], onSave: vals=>{
          const iso = new Date(vals.actionTime).toISOString();
          p.status='on'; p.lastActionAt = iso; p.lastActionNote = vals.actionNote;
          events.push({id:nextId(events),type:'point',targetId:p.id,action:'on',at:iso,note:vals.actionNote}); save(); showToast('已开启点位：'+p.name+' @ '+ new Date(iso).toLocaleString());
        } });
      };
      document.getElementById('pointBlock').onclick = ()=>{
        showModal({ title:'选择时间与日志', fields:[{id:'actionTime',label:'操作时间',type:'datetime-local',required:true,requiredMsg:'请选择时间'},{id:'actionNote',label:'事件日志',type:'textarea',rows:3,required:true,requiredMsg:'请输入事件日志'}], onSave: vals=>{
          const iso = new Date(vals.actionTime).toISOString();
          p.status='blocked'; p.lastActionAt = iso; p.lastActionNote = vals.actionNote;
          events.push({id:nextId(events),type:'point',targetId:p.id,action:'blocked',at:iso,note:vals.actionNote}); save(); showToast('已屏蔽点位：'+p.name+' @ '+ new Date(iso).toLocaleString());
        } });
      };
      cur.textContent = '—';
    }
  }
  // 搜索事件
  search.addEventListener('input', e=> renderResults(e.target.value));
  // 初始提示
  renderResults('');
  // 模拟开关保留
  document.getElementById('rtSim').onclick=()=>{
    // 弹出模态以手动输入事件（按名称匹配目标）
    showModal({ title:'手动输入事件', fields:[
      {id:'evtType',label:'类型 (unit 或 point)',type:'text',required:true,requiredMsg:'请输入 unit 或 point',placeholder:'unit 或 point'},
      {id:'evtName',label:'目标名称（精确匹配）',type:'text',required:true,requiredMsg:'请输入目标名称'},
      {id:'evtAction',label:'操作 (on/off/blocked)',type:'text',required:true,requiredMsg:'请输入操作'},
      {id:'actionTime',label:'操作时间',type:'datetime-local',required:true,requiredMsg:'请选择时间'},
      {id:'actionNote',label:'事件日志',type:'textarea',rows:3,required:true,requiredMsg:'请输入事件日志'}
    ], onSave: vals=>{
      const typ = vals.evtType.trim(); const name = vals.evtName.trim(); const action = vals.evtAction.trim();
      const t = new Date(vals.actionTime); if(isNaN(t)){ showToast('无效时间','error'); return; }
      const iso = t.toISOString();
      if(typ==='unit'){
        const u = units.find(x=>x.name===name);
        if(!u){ showToast('未找到机组：'+name,'error'); return; }
        u.status = action==='on'?'on':(action==='off'?'off':u.status);
        u.lastActionAt = iso; u.lastActionNote = vals.actionNote;
        events.push({id:nextId(events),type:'unit',targetId:u.id,action:action,at:iso,note:vals.actionNote}); save(); showToast('已记录机组事件：'+u.name);
      } else if(typ==='point'){
        const p = points.find(x=>x.name===name);
        if(!p){ showToast('未找到点位：'+name,'error'); return; }
        p.status = action==='on'?'on':(action==='off'?'off':(action==='blocked'?'blocked':p.status));
        p.lastActionAt = iso; p.lastActionNote = vals.actionNote;
        events.push({id:nextId(events),type:'point',targetId:p.id,action:action,at:iso,note:vals.actionNote}); save(); showToast('已记录点位事件：'+p.name);
      } else { showToast('类型必须为 unit 或 point','error'); return; }
      // 刷新统计/实时视图
      renderRealtime();
    } });
  };
}

// 统计
function renderStats(){
  // 按月聚合 events，显示机组与点位的 on/off/blocked 计数，并提供月份选择与 Top N 控件
  view.innerHTML = `<h1>统计（按月）</h1><div class="list"><div id="monthlyControls" class="small"></div><div id="monthlyStats"></div></div>`;
  const controls = document.getElementById('monthlyControls');
  const container = document.getElementById('monthlyStats'); container.innerHTML='';
  if(!events || !events.length){ container.innerHTML = '<p class="small">暂无事件记录。</p>'; return; }
  // 聚合并记录按 id 的分解
  const map = {}; // monthKey -> {unit:{on,off,blocked}, point:{...}, unitsById:{}, pointsById:{}}
  events.forEach(ev=>{
    if(!ev.at) return; const d = new Date(ev.at); if(isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!map[key]) map[key] = {unit:{on:0,off:0,blocked:0}, point:{on:0,off:0,blocked:0}, unitsById:{}, pointsById:{}};
    const month = map[key];
    if(ev.type==='unit' || ev.type==='point'){
      const target = month[ev.type];
      if(ev.action==='on') target.on++;
      else if(ev.action==='off') target.off++;
      else if(ev.action==='blocked') target.blocked++;
      const byId = ev.type==='unit' ? month.unitsById : month.pointsById;
      const id = ev.targetId;
      if(!byId[id]) byId[id] = {on:0,off:0,blocked:0};
      if(ev.action==='on') byId[id].on++;
      else if(ev.action==='off') byId[id].off++;
      else if(ev.action==='blocked') byId[id].blocked++;
    }
  });
  const months = Object.keys(map).sort((a,b)=> b.localeCompare(a));
  // 控件：月份选择 (type=month) 与 Top N
  controls.innerHTML = '';
  const monthInput = document.createElement('input'); monthInput.type='month'; monthInput.id='statsMonth'; monthInput.value = months[0] || '';
  const topInput = document.createElement('input'); topInput.type='number'; topInput.min=1; topInput.max=100; topInput.value=10; topInput.id='statsTopN'; topInput.style.width='6ch';
  const labelMonth = document.createElement('label'); labelMonth.style.marginRight='8px'; labelMonth.appendChild(document.createTextNode('选择月份：'));
  const labelTop = document.createElement('label'); labelTop.style.marginLeft='12px'; labelTop.appendChild(document.createTextNode('Top N：'));
  controls.appendChild(labelMonth); controls.appendChild(monthInput); controls.appendChild(labelTop); controls.appendChild(topInput);
  const exportBtn = document.createElement('button'); exportBtn.id='exportStatsCsv'; exportBtn.textContent='导出 CSV'; exportBtn.style.marginLeft='12px'; controls.appendChild(exportBtn);
  function renderMonth(monthKey, topN){
    container.innerHTML='';
    if(!monthKey || !map[monthKey]){ container.innerHTML = '<p class="small">该月无事件或未选择月份。</p>'; return; }
    const data = map[monthKey];
    const parts = monthKey.split('-'); const year = parts[0]; const month = parts[1];
    const el = document.createElement('div'); el.style.marginBottom='14px';
    el.innerHTML = `<h3>${year} 年 ${parseInt(month,10)} 月</h3>
      <div class="small">机组：开启 ${data.unit.on} / 关闭 ${data.unit.off} / 屏蔽 ${data.unit.blocked}</div>
      <div class="small">点位：开启 ${data.point.on} / 关闭 ${data.point.off} / 屏蔽 ${data.point.blocked}</div>`;
    // 机组分解
    const unitsArr = Object.entries(data.unitsById).map(([id,c])=>({id, total:c.on+c.off+c.blocked, on:c.on,off:c.off,blocked:c.blocked})).sort((a,b)=>b.total-a.total).slice(0,topN);
    if(unitsArr.length){ const uDiv = document.createElement('div'); uDiv.innerHTML = '<strong>机组（按事件数排序）</strong>'; const ul = document.createElement('ul'); ul.className='small'; unitsArr.forEach(u=>{ const nameObj = units.find(x=>x.id==u.id); const name = nameObj?nameObj.name:`未知(${u.id})`; const li = document.createElement('li'); li.textContent = `${name}：总 ${u.total}（开启 ${u.on} / 关闭 ${u.off} / 屏蔽 ${u.blocked}）`; ul.appendChild(li); }); uDiv.appendChild(ul); el.appendChild(uDiv); }
    // 点位分解
    const pointsArr = Object.entries(data.pointsById).map(([id,c])=>({id, total:c.on+c.off+c.blocked, on:c.on,off:c.off,blocked:c.blocked})).sort((a,b)=>b.total-a.total).slice(0,topN);
    if(pointsArr.length){ const pDiv = document.createElement('div'); pDiv.innerHTML = '<strong>点位（按事件数排序）</strong>'; const ul2 = document.createElement('ul'); ul2.className='small'; pointsArr.forEach(p=>{ const nameObj = points.find(x=>x.id==p.id); const name = nameObj?nameObj.name:`未知(${p.id})`; const li = document.createElement('li'); li.textContent = `${name}：总 ${p.total}（开启 ${p.on} / 关闭 ${p.off} / 屏蔽 ${p.blocked}）`; ul2.appendChild(li); }); pDiv.appendChild(ul2); el.appendChild(pDiv); }
    container.appendChild(el);
    // 事件明细（可折叠）
    const eventsForMonth = events.filter(ev=>{
      if(!ev.at) return false; const d=new Date(ev.at); if(isNaN(d)) return false; return d.getFullYear()==parseInt(year,10) && (d.getMonth()+1)==parseInt(month,10);
    }).sort((a,b)=> new Date(b.at) - new Date(a.at));
    const evDiv = document.createElement('div'); evDiv.style.marginTop='8px';
    const evToggle = document.createElement('button'); evToggle.textContent = `显示事件明细（共 ${eventsForMonth.length} 条）`;
    const evList = document.createElement('div'); evList.style.display='none'; evList.style.marginTop='6px';
    evToggle.onclick = ()=>{ if(evList.style.display==='none'){ evList.style.display='block'; evToggle.textContent = `隐藏事件明细（共 ${eventsForMonth.length} 条）`; } else { evList.style.display='none'; evToggle.textContent = `显示事件明细（共 ${eventsForMonth.length} 条）`; } };
    if(eventsForMonth.length===0){ const p=document.createElement('p'); p.className='small'; p.textContent='该月无事件明细。'; evList.appendChild(p); }
    else{
      const ul = document.createElement('ul'); ul.className='small'; eventsForMonth.forEach(ev=>{
        const t = new Date(ev.at); const tstr = isNaN(t)?ev.at:t.toLocaleString();
        const name = ev.type==='unit' ? (byId(units,ev.targetId)?.name||`未知(${ev.targetId})`) : (byId(points,ev.targetId)?.name||`未知(${ev.targetId})`);
        const li = document.createElement('li'); li.textContent = `${tstr} — ${ev.type==='unit'?'机组':'点位'} ${name} — ${ev.action} ${ev.note?('— '+ev.note):''}`;
        ul.appendChild(li);
      });
      evList.appendChild(ul);
    }
    evDiv.appendChild(evToggle); evDiv.appendChild(evList); el.appendChild(evDiv);
  }
  // CSV 导出函数
  function exportCsv(monthKey, topN){
    if(!monthKey || !map[monthKey]){ showToast('该月无事件或未选择月份','error'); return; }
    const data = map[monthKey];
    const rows = [];
    rows.push(['Scope','Name','On','Off','Blocked','Total']);
    // 机组汇总
    const unitTotal = data.unit.on + data.unit.off + data.unit.blocked;
    rows.push(['机组汇总','ALL',data.unit.on,data.unit.off,data.unit.blocked,unitTotal]);
    // 机组 TopN
    const unitsArrAll = Object.entries(data.unitsById).map(([id,c])=>({id, total:c.on+c.off+c.blocked, on:c.on,off:c.off,blocked:c.blocked})).sort((a,b)=>b.total-a.total);
    const unitsTop = unitsArrAll.slice(0,topN);
    unitsTop.forEach(u=>{ const nameObj = units.find(x=>x.id==u.id); const name = nameObj?nameObj.name:`未知(${u.id})`; rows.push(['机组',name,u.on,u.off,u.blocked,u.total]); });
    // 空行
    rows.push(['']);
    // 点位汇总
    const pointTotal = data.point.on + data.point.off + data.point.blocked;
    rows.push(['点位汇总','ALL',data.point.on,data.point.off,data.point.blocked,pointTotal]);
    const pointsArrAll = Object.entries(data.pointsById).map(([id,c])=>({id, total:c.on+c.off+c.blocked, on:c.on,off:c.off,blocked:c.blocked})).sort((a,b)=>b.total-a.total);
    const pointsTop = pointsArrAll.slice(0,topN);
    pointsTop.forEach(p=>{ const nameObj = points.find(x=>x.id==p.id); const name = nameObj?nameObj.name:`未知(${p.id})`; rows.push(['点位',name,p.on,p.off,p.blocked,p.total]); });
    // 事件明细（全部）
    rows.push(['']);
    rows.push(['事件明细']);
    rows.push(['Time','Type','Name','Action','Note']);
    // 全部事件（本月）按时间降序
    const evs = events.filter(ev=>{ if(!ev.at) return false; const d=new Date(ev.at); if(isNaN(d)) return false; return d.getFullYear()==parseInt(monthKey.split('-')[0],10) && (d.getMonth()+1)==parseInt(monthKey.split('-')[1],10); }).sort((a,b)=> new Date(b.at)-new Date(a.at));
    evs.forEach(ev=>{ const t = new Date(ev.at); const tstr = isNaN(t)?ev.at:t.toLocaleString(); const nm = ev.type==='unit'? (byId(units,ev.targetId)?.name||`未知(${ev.targetId})`) : (byId(points,ev.targetId)?.name||`未知(${ev.targetId})`); rows.push([tstr, ev.type, nm, ev.action, ev.note||'']); });
    // 转换为 CSV（加 BOM 以兼容 Excel 中文显示）
    const esc = v=>`"${String(v||'').replace(/"/g,'""') }"`;
    const csv = rows.map(r=> r.map(esc).join(',')).join('\r\n');
    const csvWithBOM = '\uFEFF' + csv;
    const blob = new Blob([csvWithBOM],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `stats_${monthKey}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('CSV 已下载');
  }
  exportBtn.addEventListener('click', ()=> exportCsv(monthInput.value, parseInt(topInput.value,10)||10));
  monthInput.addEventListener('change', ()=>{ renderMonth(monthInput.value, parseInt(topInput.value,10)||10); });
  topInput.addEventListener('change', ()=>{ renderMonth(monthInput.value, parseInt(topInput.value,10)||10); });
  // 首次渲染：默认选最新有数据的月份
  renderMonth(monthInput.value || months[0], parseInt(topInput.value,10)||10);
}

// 车间管理
function renderWorkshops(){
  view.innerHTML=`<h1>车间管理</h1>
    <div class="form">
      <input id="workshopName" placeholder="新车间名称">
      <div>
        <button id="addWorkshop">添加车间</button>
        <button id="exportData">导出</button>
        <button id="importData">导入</button>
      </div>
    </div>
    <div class="list"><table><thead><tr><th>名称</th><th class="small">操作</th></tr></thead><tbody id="workshopsBody"></tbody></table></div>`;
  const body=document.getElementById('workshopsBody'); body.innerHTML='';
  workshops.forEach(w=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${w.name}</td><td class="small"><button data-id="${w.id}" class="edit">编辑</button> <button data-id="${w.id}" class="del">删除</button></td>`; body.appendChild(tr); });
  document.getElementById('workshopName').addEventListener('input', e=> clearInlineError(e.target));
  document.getElementById('addWorkshop').onclick=()=>{ const input=document.getElementById('workshopName'); const name=input.value.trim(); clearInlineError(input); if(!name){ showInlineError(input,'请输入车间名称'); return; } showConfirm(`确认添加车间 “${name}”？`, ()=>{ workshops.push({id:nextId(workshops),name}); save(); renderWorkshops(); showToast('添加车间成功'); }); };
  // 导出：下载 JSON
  document.getElementById('exportData').onclick=()=>{
    const data = {workshops,units,rooms,points,events};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hierarchy_export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  // 导入：弹出文本框让用户粘贴 JSON
  document.getElementById('importData').onclick=()=>{
    showModal({ title:'导入数据', fields:[{id:'importJson',label:'JSON 内容',type:'textarea',rows:8,required:true,requiredMsg:'请粘贴 JSON'}], onSave: vals=>{
      try{
        const d = JSON.parse(vals.importJson);
        workshops = d.workshops||[]; units = d.units||[]; rooms = d.rooms||[]; points = d.points||[]; events = d.events||[];
        save(); renderWorkshops(); showToast('导入成功');
      }catch(e){ showToast('导入失败：无效 JSON','error'); }
    } });
  };
  body.querySelectorAll('.del').forEach(b=>b.onclick=e=>{ const id=Number(e.target.dataset.id); const w = byId(workshops,id); showConfirm(`确认删除车间 “${w?.name||''}”？此操作会删除该车间下所有机组/房间/点位。`, ()=>{ workshops=workshops.filter(x=>x.id!==id); const removedUnits = units.filter(u=>u.workshopId===id).map(u=>u.id); units = units.filter(u=>u.workshopId!==id); const removedRooms = rooms.filter(r=>removedUnits.includes(r.unitId)).map(r=>r.id); rooms = rooms.filter(r=>!removedRooms.includes(r.id)); points = points.filter(p=>!removedRooms.includes(p.roomId)); save(); renderWorkshops(); }); });
  body.querySelectorAll('.edit').forEach(b=>b.onclick=e=>{
    const w=byId(workshops,e.target.dataset.id);
    const tr = e.target.closest('tr'); const nameTd = tr.children[0]; const opsTd = tr.children[1];
    nameTd.innerHTML = `<input class="inline-edit" value="${w.name}">`;
    opsTd.innerHTML = `<button class="save">保存</button> <button class="cancel">取消</button>`;
    const input = nameTd.querySelector('input'); input.focus();
    input.addEventListener('keydown',(ev)=>{ if(ev.key==='Enter'){ ev.preventDefault(); opsTd.querySelector('.save').click(); } else if(ev.key==='Escape'){ ev.preventDefault(); opsTd.querySelector('.cancel').click(); } });
    opsTd.querySelector('.save').onclick = ()=>{ const v = input.value.trim(); if(!v){ showInlineError(input,'请输入车间名'); return; } w.name = v; save(); renderWorkshops(); };
    opsTd.querySelector('.cancel').onclick = ()=>{ renderWorkshops(); };
  });
}

// 导航默认：如果存在车间页则访问车间，否则机组
function renderRoute(route){
  if(route==='workshops') renderWorkshops();
  else if(route==='units') renderUnits();
  else if(route==='rooms') renderRooms();
  else if(route==='points') renderPoints();
  else if(route==='realtime') renderRealtime();
  else if(route==='stats') renderStats();
  else renderWorkshops();
}


// Version compatible avec l'ouverture directe de index.html
// Firebase est chargé avec les bibliothèques "compat" dans index.html.

const firebaseConfig = {
  apiKey: "AIzaSyBkeYHZc9Na0UHjETg9GABYsDZFx1bLtQ",
  authDomain: "esp32-b9013.firebaseapp.com",
  databaseURL: "https://esp32-b9013-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "esp32-b9013",
  storageBucket: "esp32-b9013.appspot.com",
  messagingSenderId: "547189202345",
  appId: "1:547189202345:web:054bd09f1f7e66f7b538b8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const rootRef = db.ref("gestionCaisse");

let data = { incomes: {}, expenses: {} };
let chart;

const $ = id => document.getElementById(id);
const today = new Date();
const iso = d => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset()*60000).toISOString().slice(0,10);
};
const money = n => `${Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} $`;
const fmtDate = d => new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
const uidData = obj => Object.entries(obj || {}).map(([id,value])=>({id,...value}));

function getIncomes(){ return uidData(data.incomes); }
function getExpenses(){ return uidData(data.expenses); }

function totals(){
  const income=getIncomes().reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=getExpenses().reduce((s,x)=>s+Number(x.amount||0),0);
  return {income,expense,balance:income-expense};
}

function updateStats(){
  const t=totals();
  const worked=getIncomes().filter(x=>x.status==='worked' && Number(x.amount||0)>0).length;
  $('balance').textContent=money(t.balance);
  $('income').textContent=money(t.income);
  $('expenses').textContent=money(t.expense);
  $('workedDays').textContent=worked;
  $('sideBalance').textContent=money(t.balance);
  $('expenseBalance').textContent=money(t.balance);
}

function operations(){
  return [
    ...getIncomes().map(x=>({...x,kind:'income',
      title:x.status==='not_worked'?'Journée non travaillée':(x.type==='half'?'Versement demi-journée':'Versement journée complète'),
      detail:x.note || (x.status==='not_worked'?'Aucune activité':'Versement reçu'),amount:Number(x.amount||0)})),
    ...getExpenses().map(x=>({...x,kind:'expense',title:x.reason,detail:x.note||'Dépense',amount:Number(x.amount||0)}))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

function renderRecent(){
  const arr=operations().slice(0,6);
  $('recentOperations').innerHTML=arr.length?arr.map(op=>`
    <div class="operation"><div class="op-icon ${op.kind==='expense'?'expense':''}">${op.kind==='expense'?'−':'+'}</div>
    <div><div class="op-title">${op.title}</div><div class="op-sub">${op.detail}</div></div>
    <div class="op-date">${fmtDate(op.date)}</div>
    <div class="op-amount ${op.kind==='expense'?'negative':'positive'}">${op.kind==='expense'?'−':'+'}${money(op.amount)}</div></div>`).join(''):'<div class="empty">Aucune opération.</div>';
}

function renderWeek(){
  const start=new Date(today);
  start.setDate(start.getDate()-((start.getDay()+6)%7));
  const rows=[];
  for(let i=0;i<5;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const ds=iso(d),item=getIncomes().find(x=>x.date===ds);
    rows.push(`<div class="week-row"><div class="day"><strong>${d.toLocaleDateString('fr-FR',{weekday:'long'})}</strong><small>${fmtDate(ds)}</small></div><div class="${item?.status==='worked'?'worked':'not-worked'}">${item?.status==='worked'?`Travaillé · <b>${money(item.amount)}</b>`:'Non travaillé'}</div></div>`);
  }
  $('weekSummary').innerHTML=rows.join('');
}

function renderChart(){
  if(typeof Chart==='undefined') return;
  const days=Number($('chartPeriod').value),labels=[],inc=[],exp=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);const ds=iso(d);
    labels.push(d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}));
    inc.push(getIncomes().filter(x=>x.date===ds).reduce((s,x)=>s+Number(x.amount||0),0));
    exp.push(getExpenses().filter(x=>x.date===ds).reduce((s,x)=>s+Number(x.amount||0),0));
  }
  if(chart) chart.destroy();
  chart=new Chart($('cashChart'),{type:'line',data:{labels,datasets:[
    {label:'Versements',data:inc,tension:.35},{label:'Dépenses',data:exp,tension:.35}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}}});
}

function renderHistory(){
  let arr=operations();
  const type=$('historyType').value,period=$('historyPeriod').value;
  if(type!=='all')arr=arr.filter(x=>x.kind===type);
  if(period!=='all'){
    const now=new Date();
    arr=arr.filter(x=>{
      const d=new Date(x.date+'T12:00:00');
      if(period==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
      const monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));monday.setHours(0,0,0,0);
      return d>=monday;
    });
  }
  $('historyTable').innerHTML=arr.length?`<div style="overflow:auto"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Journée</th><th>Montant</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td><span class="badge ${x.kind}">${x.kind==='income'?'VERSEMENT':'DÉPENSE'}</span></td><td>${x.title}<br><small style="color:#9aa2ae">${x.detail}</small></td><td>${x.kind==='income'?(x.status==='not_worked'?'Non travaillée':x.type==='half'?'Demi-journée':'Complète'):'—'}</td><td class="${x.kind==='expense'?'negative':'positive'}"><b>${x.kind==='expense'?'−':'+'}${money(x.amount)}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Aucune opération correspondant aux filtres.</div>';
}

function refresh(){updateStats();renderRecent();renderWeek();renderChart();renderHistory();}

function toast(msg){
  const t=$('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

function showPage(page){
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
  const titles={
    dashboard:['Tableau de bord','Vue générale de votre activité financière'],
    versements:['Versements','Enregistrez les journées et les montants reçus'],
    depenses:['Dépenses','Suivez chaque sortie d’argent'],
    historique:['Historique','Consultez toutes les opérations enregistrées']
  };
  $('pageTitle').textContent=titles[page][0];
  $('pageSubtitle').textContent=titles[page][1];
  window.scrollTo({top:0,behavior:'smooth'});
}

// Navigation : elle fonctionne même si Firebase rencontre un problème.
document.querySelectorAll('[data-page]').forEach(b=>{
  b.addEventListener('click',()=>{
    showPage(b.dataset.page);
    document.querySelectorAll('.mobile-nav-link').forEach(x=>{
      x.classList.toggle('active', x.dataset.page===b.dataset.page);
    });
  });
});

$('incomeDate').value=iso(today);
$('expenseDate').value=iso(today);
$('todayLabel').textContent=today.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

$('incomeForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const status=$('workStatus').value;
  const item={
    date:$('incomeDate').value,
    amount:status==='not_worked'?0:Number($('incomeAmount').value||0),
    type:status==='not_worked'?'none':$('incomeType').value,
    status,
    note:$('incomeNote').value,
    createdAt:Date.now()
  };
  try{
    await rootRef.child('incomes').push(item);
    toast('Versement enregistré dans Firebase');
    e.target.reset();$('incomeDate').value=iso(today);
  }catch(err){console.error(err);toast('Firebase refuse l’écriture : vérifiez les règles.');}
});

$('workStatus').addEventListener('change',e=>{
  const disabled=e.target.value==='not_worked';
  $('incomeAmount').disabled=disabled;$('incomeType').disabled=disabled;
  if(disabled)$('incomeAmount').value=0;
});

$('expenseForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const item={
    date:$('expenseDate').value,
    amount:Number($('expenseAmount').value),
    reason:$('expenseReason').value,
    note:$('expenseNote').value,
    createdAt:Date.now()
  };
  try{
    await rootRef.child('expenses').push(item);
    toast('Dépense enregistrée dans Firebase');
    e.target.reset();$('expenseDate').value=iso(today);
  }catch(err){console.error(err);toast('Firebase refuse l’écriture : vérifiez les règles.');}
});

$('chartPeriod').addEventListener('change',renderChart);
$('historyType').addEventListener('change',renderHistory);
$('historyPeriod').addEventListener('change',renderHistory);

// Lecture temps réel
rootRef.on('value',snapshot=>{
  const value=snapshot.val()||{};
  data={incomes:value.incomes||{},expenses:value.expenses||{}};
  refresh();
});

// Affichage immédiat, même avant la première réponse Firebase.
refresh();

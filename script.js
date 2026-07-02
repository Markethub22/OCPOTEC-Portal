// Server clock
function updateClock(){
  const el=document.getElementById('serverClock');
  if(!el) return;
  const d=new Date();
  const h=String(d.getHours()).padStart(2,'0');
  const m=String(d.getMinutes()).padStart(2,'0');
  const s=String(d.getSeconds()).padStart(2,'0');
  el.textContent=`${h}:${m}:${s}`;
}
setInterval(updateClock,1000);updateClock();

// Mobile menu
document.addEventListener('click',e=>{
  const t=e.target.closest('.menu-toggle');
  if(t){document.querySelector('.nav-links').classList.toggle('open');}
});

// Toast
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2600);
}

// Forms
document.addEventListener('submit',e=>{
  if(e.target.matches('form[data-mock]')){
    e.preventDefault();
    const kind=e.target.dataset.mock;
    if(kind==='login') toast('Welcome back! Redirecting to dashboard…');
    else if(kind==='signup') toast('Account created! Check your email.');
    else toast('Submitted successfully.');
    e.target.reset();
  }
});

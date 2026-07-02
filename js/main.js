/* ==========================================================================
   LUMIRA v3 — shared page engine
   Three.js r128 + GSAP ScrollTrigger. Page-aware via body[data-scene/data-journey].
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  var hasTHREE = typeof THREE !== 'undefined';
  var COLORS = { peri: 0x5A6FD8, iris: 0x8B7FD4, aqua: 0x7FD4C1, lilac: 0xDAD6F2 };
  var SCENE_CLR = { medical: COLORS.peri, surgical: COLORS.iris, cosmetic: COLORS.aqua };
  var pageScene = document.body.getAttribute('data-scene');
  var baseColor = SCENE_CLR[pageScene] || COLORS.peri;
  var journey = document.body.getAttribute('data-journey') || 'descent';

  /* NAV */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  function navScroll() {
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 20);
    nav.classList.toggle('on-dark', y < window.innerHeight * 0.85);
  }
  window.addEventListener('scroll', navScroll, { passive: true });
  navScroll();
  if (toggle) toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('open'); });
  });
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* THREE.JS SCENE */
  var canvas = document.getElementById('cell-canvas');
  var sceneState = { progress: 0 };

  function initThree() {
    if (!canvas || !hasTHREE) { if (canvas) canvas.classList.add('ready'); return null; }
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 120);
    camera.position.set(0, 0, journey === 'calm' ? 12 : 15);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);

    var group = new THREE.Group(); scene.add(group);
    var shellMat = new THREE.MeshBasicMaterial({ color: baseColor, wireframe: true, transparent: true, opacity: 0.55 });
    var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), shellMat); group.add(shell);
    var coreMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.30 });
    var core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 2), coreMat); group.add(core);

    function ring(r, tilt, color, op) {
      var pts = new THREE.EllipseCurve(0, 0, r, r * 0.42, 0, Math.PI * 2).getPoints(128);
      var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: op }));
      line.rotation.x = tilt; group.add(line);
    }
    ring(5.6, 0.5, COLORS.lilac, 0.40); ring(7.0, -0.6, COLORS.iris, 0.30); ring(6.3, 1.4, baseColor, 0.28);

    var electrons = [];
    function electron(r, tilt, color, speed, size) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), new THREE.MeshBasicMaterial({ color: color }));
      group.add(m); electrons.push({ m: m, r: r, tilt: tilt, speed: speed, a: Math.random() * 6.28 });
    }
    electron(5.6, 0.5, COLORS.aqua, 0.6, 0.30); electron(7.0, -0.6, COLORS.aqua, 0.4, 0.20);
    electron(6.3, 1.4, baseColor, 0.5, 0.24); electron(5.6, 0.5, COLORS.lilac, 0.35, 0.16);

    var N = 680, pos = new Float32Array(N * 3), base = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var rr = 9 + Math.random() * 22, th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
      var x = rr * Math.sin(ph) * Math.cos(th), y = rr * Math.sin(ph) * Math.sin(th) * 0.6, z = rr * Math.cos(ph);
      pos[i*3]=base[i*3]=x; pos[i*3+1]=base[i*3+1]=y; pos[i*3+2]=base[i*3+2]=z;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: COLORS.lilac, size: 0.075, transparent: true, opacity: 0.5 }));
    scene.add(particles);

    var tmx = 0, tmy = 0, mx = 0, my = 0;
    window.addEventListener('mousemove', function (e) { tmx = e.clientX/innerWidth-0.5; tmy = e.clientY/innerHeight-0.5; }, { passive: true });

    /* Scroll journey keyframes — descent is dramatic, calm is interior-page gentle */
    var KF = journey === 'calm' ? [
      [0.00, 12, 1.00, 1.15, baseColor], [0.50, 8, 1.20, 1.40, baseColor], [1.00, 14, 0.95, 1.60, baseColor]
    ] : [
      [0.00, 15, 1.00, 1.00, COLORS.peri],
      [0.15, 10, 1.10, 1.05, COLORS.peri],   /* faster initial push */
      [0.30, 5.0, 1.60, 1.25, COLORS.iris],  /* deep zoom in */
      [0.45, 4.2, 1.80, 1.40, COLORS.iris],  /* closest approach */
      [0.55, 6.5, 1.40, 1.55, COLORS.aqua],  /* pull back, color shifts */
      [0.70, 10, 1.10, 1.70, COLORS.peri],
      [0.85, 13, 1.00, 1.85, COLORS.lilac],
      [1.00, 18, 0.90, 2.10, COLORS.lilac]   /* wide field at footer */
    ];

    function lerp3(a, b, t) { var e = t*t*(3-2*t); return { camZ:a[1]+(b[1]-a[1])*e, scale:a[2]+(b[2]-a[2])*e, spread:a[3]+(b[3]-a[3])*e, color:new THREE.Color(a[4]).lerp(new THREE.Color(b[4]), e) }; }
    function sample(p) {
      var a = KF[0], b = KF[KF.length-1];
      for (var k = 0; k < KF.length-1; k++) { if (p >= KF[k][0] && p <= KF[k+1][0]) { a=KF[k]; b=KF[k+1]; break; } }
      var span = (b[0]-a[0])||1, t = Math.max(0, Math.min(1, (p-a[0])/span));
      return lerp3(a, b, t);
    }

    var clock = new THREE.Clock(), curScale = 1, curSpread = 1;
    function loop() {
      requestAnimationFrame(loop);
      var t = clock.getElapsedTime(); var s = sample(sceneState.progress);
      group.rotation.y = t * 0.06 + sceneState.progress * (journey === 'calm' ? 1.2 : 3.8);
      shell.rotation.x = t * 0.14; shell.rotation.z = t * 0.08; core.rotation.y = -t * 0.22;
      curScale += (s.scale - curScale) * 0.07; shell.scale.setScalar(curScale); core.scale.setScalar(curScale);
      shellMat.color.lerp(s.color, 0.05); coreMat.color.lerp(s.color, 0.05);
      electrons.forEach(function (e2) {
        e2.a += e2.speed * 0.016;
        var x = Math.cos(e2.a)*e2.r*curScale, y = Math.sin(e2.a)*e2.r*0.42*curScale;
        e2.m.position.set(x, y*Math.cos(e2.tilt), y*Math.sin(e2.tilt));
      });
      curSpread += (s.spread - curSpread) * 0.045;
      var arr = particles.geometry.attributes.position.array;
      for (var j = 0; j < N; j++) { arr[j*3]=base[j*3]*curSpread; arr[j*3+1]=base[j*3+1]*curSpread; arr[j*3+2]=base[j*3+2]*curSpread; }
      particles.geometry.attributes.position.needsUpdate = true; particles.rotation.y = t * 0.018;
      mx += (tmx-mx)*0.05; my += (tmy-my)*0.05;
      group.rotation.x = my * 0.4; camera.position.x = mx * 2.8;
      camera.position.z += (s.camZ - camera.position.z) * 0.07;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    }
    loop();
    requestAnimationFrame(function () { canvas.classList.add('ready'); });
    window.addEventListener('resize', function () {
      camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    });
    return true;
  }

  var threeOK = (!reduce) ? initThree() : (canvas && canvas.classList.add('ready'));

  /* GSAP SCROLL SYSTEM */
  if (hasGSAP && !reduce) {
    gsap.registerPlugin(ScrollTrigger);

    /* master progress */
    ScrollTrigger.create({ trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2,
      onUpdate: function (self) { sceneState.progress = self.progress; } });

    /* hero parallax out */
    var heroEl = document.querySelector('.hero-content, .ih-inner');
    if (heroEl) gsap.to(heroEl, { yPercent: -16, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: heroEl.closest('.hero,.interior-hero'), start: 'top top', end: 'bottom top', scrub: true } });

    /* word-stagger */
    gsap.utils.toArray('[data-words]').forEach(function (el) {
      gsap.fromTo(el.querySelectorAll('.w'), { yPercent: 115, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.0, ease: 'power4.out', stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    /* general reveals — scale + opacity */
    gsap.utils.toArray('.reveal').forEach(function (el) {
      var dir = el.getAttribute('data-dir') || 'up';
      var from = dir === 'left' ? { x: -50, opacity: 0 } : dir === 'right' ? { x: 50, opacity: 0 } : { y: 44, scale: 0.96, opacity: 0 };
      var to   = dir === 'left' || dir === 'right' ? { x: 0, opacity: 1, duration: 1, ease: 'power3.out' } : { y: 0, scale: 1, opacity: 1, duration: 1, ease: 'power3.out' };
      gsap.fromTo(el, from, Object.assign(to, { scrollTrigger: { trigger: el, start: 'top 86%' } }));
    });

    /* staggered grids */
    gsap.utils.toArray('.stagger-grid').forEach(function (grid) {
      var items = grid.querySelectorAll('.sg-item');
      gsap.fromTo(items, { y: 40, opacity: 0, scale: 0.94 },
        { y: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: grid, start: 'top 82%' } });
    });

    /* svc-panel reveals */
    gsap.utils.toArray('.svc-panel').forEach(function (panel) {
      var vis = panel.querySelector('.svc-visual'), cop = panel.querySelector('.svc-copy');
      if (vis) gsap.fromTo(vis, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: panel, start: 'top 74%' } });
      if (cop) gsap.fromTo(cop, { x: 44, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: panel, start: 'top 74%' } });
    });

    /* zoom-section parallax (signature moment) */
    var zoomBg = document.querySelector('.zoom-bg');
    if (zoomBg) {
      gsap.fromTo(zoomBg, { scale: 0.7 }, { scale: 1.55,
        scrollTrigger: { trigger: '.zoom-section', start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
    }

    /* stat reel underline trigger */
    gsap.utils.toArray('.stat-item').forEach(function (item, i) {
      ScrollTrigger.create({ trigger: item, start: 'top 85%', once: true,
        onEnter: function () { setTimeout(function () { item.classList.add('in'); }, i * 120); } });
    });

    /* counters */
    gsap.utils.toArray('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count')), suffix = el.getAttribute('data-suffix') || '';
      ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () {
        gsap.to({ v: 0 }, { v: target, duration: 1.8, ease: 'power2.out',
          onUpdate: function () { var v = this.targets()[0].v; el.textContent = (target%1===0?Math.round(v):v.toFixed(1)) + suffix; } }); } });
    });

  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.style.opacity=1; el.style.transform='none'; });
    document.querySelectorAll('[data-words] .w').forEach(function (w) { w.style.transform='none'; w.style.opacity=1; });
    document.querySelectorAll('.sg-item,.svc-visual,.svc-copy').forEach(function (el) { el.style.opacity=1; el.style.transform='none'; });
    document.querySelectorAll('.stat-item').forEach(function (el) { el.classList.add('in'); });
    document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix')||''); });
  }

  /* BOOKING CALENDAR widget */
  var calGrid = document.getElementById('calGrid');
  if (calGrid) {
    var days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var avail = [3,5,7,9,10,12,14,16,17,19,21,23,24];
    var selDay = null, selTime = null;
    var html = days.map(function(d){ return '<div class="cal-day hd">'+d+'</div>'; }).join('');
    var offset = 2; // start on Tuesday
    for (var i=0;i<offset;i++) html+='<div class="cal-day empty"></div>';
    for (var d=1;d<=28;d++){
      var isAv = avail.indexOf(d)>-1;
      html+='<div class="cal-day'+(isAv?' avail':'')+(d===7?' sel':'')+'" data-d="'+d+'">'+(d<10?'0':'')+d+'</div>';
    }
    calGrid.innerHTML = html;
    selDay = 7;
    calGrid.addEventListener('click', function(e){
      var t=e.target; if(!t.classList.contains('avail')) return;
      calGrid.querySelectorAll('.sel').forEach(function(el){el.classList.remove('sel');}); t.classList.add('sel'); selDay=t.getAttribute('data-d');
    });
    var timeGrid = document.getElementById('calTimes');
    if (timeGrid) {
      ['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM'].forEach(function(t,i){
        var d=document.createElement('div'); d.className='cal-time'+(i===1?' sel':''); d.textContent=t;
        d.addEventListener('click',function(){ timeGrid.querySelectorAll('.sel').forEach(function(el){el.classList.remove('sel');}); d.classList.add('sel'); selTime=t; });
        timeGrid.appendChild(d);
      });
      selTime='10:00 AM';
    }
    var confirm = document.getElementById('calConfirm');
    if (confirm) confirm.addEventListener('click', function(){
      confirm.textContent = 'Request sent — we\'ll confirm within 24hrs'; confirm.style.background='#3a9e8c';
    });
  }

  /* MEMBERSHIP MODAL */
  var joinBtn = document.getElementById('joinBtn');
  var modalBg = document.getElementById('memberModal');
  var modalClose = document.getElementById('modalClose');
  if (joinBtn && modalBg) {
    joinBtn.addEventListener('click', function(){ modalBg.classList.add('open'); });
    if (modalClose) modalClose.addEventListener('click', function(){ modalBg.classList.remove('open'); });
    modalBg.addEventListener('click', function(e){ if(e.target===modalBg) modalBg.classList.remove('open'); });
    var mForm = document.getElementById('memberForm');
    if (mForm) mForm.addEventListener('submit', function(e){
      e.preventDefault(); var btn=mForm.querySelector('.mbtn');
      btn.textContent='Request received — we\'ll be in touch'; btn.style.background='#3a9e8c';
    });
  }

  /* CHATBOT WIDGET */
  var chatForm = document.getElementById('chatForm');
  var chatInput = document.getElementById('chatInput');
  var chatMsgs = document.getElementById('chatMsgs');
  var chatTyping = document.getElementById('chatTyping');
  if (chatForm && chatInput && chatMsgs) {
    var SYSTEM = 'You are a helpful patient-facing assistant for Lumira Dermatology in Atlanta, GA. Answer questions about skin conditions, services (medical, surgical, cosmetic dermatology), booking appointments, and what to expect at a visit. Be warm, concise, and professional. Never give specific medical diagnoses. Always suggest scheduling a consultation for anything requiring an exam.';
    function appendMsg(text, role) {
      var div = document.createElement('div'); div.className='chat-msg '+(role==='user'?'user':'bot'); div.textContent=text; chatMsgs.appendChild(div); chatMsgs.scrollTop=chatMsgs.scrollHeight;
    }
    chatForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var q = chatInput.value.trim(); if(!q) return;
      chatInput.value=''; appendMsg(q,'user');
      if (chatTyping) chatTyping.classList.add('show');
      try {
        var resp = await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:300, system:SYSTEM, messages:[{role:'user',content:q}] })
        });
        var data = await resp.json();
        var ans = (data.content&&data.content[0]&&data.content[0].text) ? data.content[0].text : 'I\'d be happy to help with that — please call us at 404·555·0142 or book a consultation below.';
        if (chatTyping) chatTyping.classList.remove('show');
        appendMsg(ans,'bot');
      } catch(err) {
        if (chatTyping) chatTyping.classList.remove('show');
        appendMsg('Happy to help — please call 404·555·0142 or book a consultation for a more detailed answer.','bot');
      }
    });
  }

  /* FAQ ACCORDION */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        if (o !== item) { o.classList.remove('open'); o.querySelector('.faq-a').style.maxHeight = null; }
      });
      if (isOpen) { item.classList.remove('open'); a.style.maxHeight = null; }
      else { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });

})();

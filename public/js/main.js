// 东川市水利局官网 - 主交互逻辑
// 电话模拟 + 邮件模拟 + 新交互系统

// ============ 线索上报（fire-and-forget）============
function reportClue(key) {
  try {
    fetch('/api/clue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key })
    }).then(() => {
      try { WaterAudio.bump(); } catch (e) {}
    }).catch(() => {});
  } catch (e) {}
}

// ============ 水管音效系统 ============
const WaterAudio = (function () {
  let ctx = null;
  let masterGain = null;
  let baseOsc = null;
  let baseGain = null;
  let thumpInterval = null;
  let isMuted = true;
  let volumeDb = -28;

  function dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  }

  function startBase() {
    if (baseOsc) return;
    baseOsc = ctx.createOscillator();
    baseOsc.type = 'sine';
    baseOsc.frequency.value = 40;
    baseGain = ctx.createGain();
    baseGain.gain.value = dbToGain(volumeDb - 5);
    baseOsc.connect(baseGain).connect(masterGain);
    baseOsc.start();

    // 模拟水管阀门老化、水流撞击管壁产生的规律闷响（真实物理声）
    thumpInterval = setInterval(() => {
      const now = ctx.currentTime;
      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0, now);
      thumpGain.gain.linearRampToValueAtTime(dbToGain(volumeDb + 2), now + 0.01);
      thumpGain.gain.exponentialRampToValueAtTime(dbToGain(volumeDb - 45), now + 0.22);
      const thumpOsc = ctx.createOscillator();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.value = 60;
      const thumpFilter = ctx.createBiquadFilter();
      thumpFilter.type = 'lowpass';
      thumpFilter.frequency.value = 100;
      thumpOsc.connect(thumpFilter).connect(thumpGain).connect(masterGain);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.25);
    }, 2500 + Math.random() * 1800);
  }

  function stopBase() {
    if (baseOsc) { try { baseOsc.stop(); } catch (e) {} baseOsc = null; }
    if (thumpInterval) { clearInterval(thumpInterval); thumpInterval = null; }
  }

  function updateVolume() {
    if (!ctx) return;
    const target = isMuted ? 0 : dbToGain(volumeDb);
    masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.1);
    if (baseGain) {
      baseGain.gain.linearRampToValueAtTime(dbToGain(volumeDb - 5), ctx.currentTime + 0.1);
    }
  }

  function toggle() {
    if (!ensureCtx()) return;
    isMuted = !isMuted;
    if (isMuted) {
      stopBase();
    } else {
      startBase();
    }
    updateVolume();
    return isMuted;
  }

  function bump() {
    if (volumeDb < -18) {
      volumeDb = Math.min(-18, volumeDb + 0.5);
    }
    updateVolume();
  }

  function isCurrentlyMuted() {
    return isMuted;
  }

  function injectButton() {
    if (document.getElementById('water-audio-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'water-audio-toggle';
    btn.textContent = '🔇 水管';
    btn.setAttribute('aria-label', '水管音效开关');
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '12px',
      left: '12px',
      zIndex: '9999',
      background: 'rgba(30,30,30,0.85)',
      color: '#aaa',
      border: '1px solid #333',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '11px',
      cursor: 'pointer',
      userSelect: 'none'
    });
    btn.addEventListener('click', function () {
      const muted = toggle();
      btn.textContent = muted ? '🔇 水管' : '🔊 水管';
    });
    document.body.appendChild(btn);
  }

  return { toggle, bump, injectButton, isMuted: isCurrentlyMuted };
})();

// ============ 电话系统 ============
function callPhone(number, displayName) {
  const overlay = document.getElementById('phoneOverlay');
  const screen = document.getElementById('phoneScreen');
  const nameEl = document.getElementById('phoneName');
  const numberEl = document.getElementById('phoneNumber');
  const callingEl = document.getElementById('phoneCalling');

  if (!overlay) return;

  overlay.classList.add('active');
  screen.innerHTML = '';
  numberEl.textContent = number;
  nameEl.textContent = displayName || '正在呼叫';
  callingEl.style.display = 'block';

  let timer;
  let active = true;
  const hangupBtn = document.getElementById('phoneHangup');
  hangupBtn.onclick = function () {
    active = false;
    clearTimeout(timer);
    overlay.classList.remove('active');
  };

  fetch('/api/phone/' + number)
    .then(r => r.json())
    .then(data => {
      nameEl.textContent = data.name;
      timer = setTimeout(() => {
        if (!active) return;
        callingEl.style.display = 'none';
        playSegments(data.segments, 0);
      }, 2600);
    })
    .catch(() => {
      callingEl.textContent = '通话失败';
    });

  function playSegments(segments, idx) {
    if (!active) return;
    if (idx >= segments.length) {
      const end = document.createElement('div');
      end.className = 'segment shown static-noise';
      end.textContent = '【通话结束·忙音·嘟嘟嘟嘟嘟嘟——】';
      screen.appendChild(end);
      screen.scrollTop = screen.scrollHeight;
      return;
    }
    const seg = segments[idx];
    timer = setTimeout(() => {
      if (!active) return;
      const div = document.createElement('div');
      div.className = 'segment shown';
      let text = seg.text;
      if (text.includes('【') && text.includes('】')) {
        div.classList.add('static-noise');
      } else if (text.includes('……')) {
        div.classList.add('whisper');
      }
      div.textContent = text;
      screen.appendChild(div);
      screen.scrollTop = screen.scrollHeight;
      playSegments(segments, idx + 1);
    }, seg.delay);
  }
}

// ============ 邮件系统 ============
function composeEmail(toAddress) {
  const overlay = document.getElementById('emailOverlay');
  const compose = document.getElementById('emailCompose');
  const reply = document.getElementById('emailReply');
  const loading = document.getElementById('emailLoading');
  const toInput = document.getElementById('emailTo');

  if (!overlay) return;

  overlay.classList.add('active');
  compose.style.display = 'block';
  reply.classList.remove('active');
  reply.innerHTML = '';
  loading.classList.remove('active');
  toInput.value = toAddress;

  const sendBtn = document.getElementById('emailSend');
  sendBtn.disabled = false;
  sendBtn.textContent = '发送邮件';

  sendBtn.onclick = function () {
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    compose.style.display = 'none';
    loading.classList.add('active');

    const subject = document.getElementById('emailSubject').value || '(无主题)';
    const body = document.getElementById('emailBody').value || '(无内容)';

    fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: toAddress, subject: subject, body: body })
    })
      .then(r => r.json())
      .then(data => {
        setTimeout(() => {
          loading.classList.remove('active');
          reply.classList.add('active');
          let html = data.body
            .replace(/████.*?████/g, m => '<span class="garbled">' + m + '</span>')
            .replace(/鑷|韥|謒|蝁|躖|貃|賉|赑|贂|赲|踇|踆|踄|踁|跿|跾|跽|跼|跺|跹/g, m => '<span class="garbled">' + m + '</span>')
            .replace(/【[^】]*】/g, m => '<span class="system">' + m + '</span>')
            .replace(/——周海生/g, '<span class="fragment">——周海生</span>')
            .replace(/(\d{8})/g, '<span class="fragment">$1</span>')
            .replace(/\/data\/haisheng/g, '<span class="fragment">/data/haisheng</span>');
          reply.innerHTML =
            '<div style="border-bottom:1px solid #444;padding-bottom:10px;margin-bottom:15px;font-size:13px;color:#888;">' +
            '<div>发件人: ' + data.from + '</div>' +
            '<div>主题: ' + data.subject + '</div>' +
            '</div>' + html;

          sendBtn.disabled = false;
          sendBtn.textContent = '重新发送';
          compose.style.display = 'block';
          compose.querySelector('.email-field:nth-child(1)').style.display = 'none';
        }, data.delay || 2000);
      })
      .catch(() => {
        loading.classList.remove('active');
        reply.classList.add('active');
        reply.textContent = '【发送失败·邮件系统无响应】';
      });
  };
}

function closeEmail() {
  const overlay = document.getElementById('emailOverlay');
  if (overlay) overlay.classList.remove('active');
}

function closePhone() {
  const overlay = document.getElementById('phoneOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ============ 移动端导航切换 ============
function toggleNav() {
  const nav = document.querySelector('.nav-inner');
  if (nav) nav.classList.toggle('active');
}

// ============ 密码验证 ============
function verifyPassword(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  const password = input.value.trim();

  fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        window.location.href = data.redirect;
      } else {
        error.textContent = data.message;
        input.value = '';
        input.focus();
      }
    });
}

// ============ OA 登录弹窗 ============
function showOALogin() {
  let overlay = document.getElementById('oaOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'oaOverlay';
    overlay.className = 'overlay';
    overlay.innerHTML =
      '<div class="overlay-content" style="max-width:360px;">' +
      '<h3 style="margin:0 0 16px;">OA 系统登录</h3>' +
      '<div class="form-group">' +
      '<label>密码</label>' +
      '<input type="password" id="oaPassword" placeholder="请输入OA密码" autocomplete="off">' +
      '</div>' +
      '<div id="oaError" style="color:#c0392b;font-size:13px;margin:8px 0;min-height:18px;"></div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button id="oaCancel" class="btn btn-secondary">取消</button>' +
      '<button id="oaSubmit" class="btn btn-primary">登录</button>' +
      '</div>' +
      '</div>';
    Object.assign(overlay.style, {
      display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.75)', zIndex: 10000, justifyContent: 'center', alignItems: 'center'
    });
    const content = overlay.firstElementChild;
    Object.assign(content.style, {
      background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px',
      padding: '24px', color: '#ddd', width: '100%'
    });
    const input = overlay.querySelector('input');
    Object.assign(input.style, {
      width: '100%', padding: '10px 12px', background: '#111', border: '1px solid #444',
      color: '#ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', marginTop: '6px'
    });
    overlay.querySelectorAll('.btn').forEach(function (b) {
      Object.assign(b.style, {
        flex: 1, padding: '10px 16px', border: 'none', borderRadius: '4px',
        cursor: 'pointer', fontSize: '14px'
      });
    });
    const cancel = overlay.querySelector('#oaCancel');
    Object.assign(cancel.style, { background: '#333', color: '#ccc' });
    const submit = overlay.querySelector('#oaSubmit');
    Object.assign(submit.style, { background: '#c0392b', color: '#fff' });
    document.body.appendChild(overlay);

    cancel.addEventListener('click', hideOALogin);
    submit.addEventListener('click', submitOALogin);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitOALogin();
    });
  }
  overlay.style.display = 'flex';
  setTimeout(function () {
    const pw = document.getElementById('oaPassword');
    if (pw) pw.focus();
  }, 50);
}

function hideOALogin() {
  const overlay = document.getElementById('oaOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    const pw = document.getElementById('oaPassword');
    const err = document.getElementById('oaError');
    if (pw) pw.value = '';
    if (err) err.textContent = '';
  }
}

function submitOALogin() {
  const pw = document.getElementById('oaPassword');
  const err = document.getElementById('oaError');
  const submit = document.getElementById('oaSubmit');
  if (!pw) return;
  const password = pw.value.trim();
  if (!password) {
    err.textContent = '请输入密码';
    return;
  }
  submit.disabled = true;
  submit.textContent = '登录中...';
  fetch('/api/oa-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        hideOALogin();
        if (data.redirect) {
          window.location.href = data.redirect;
        }
      } else {
        err.textContent = data.message || '密码错误';
        pw.value = '';
        pw.focus();
      }
    })
    .catch(() => {
      err.textContent = '登录失败，请重试';
    })
    .finally(() => {
      submit.disabled = false;
      submit.textContent = '登录';
    });
}

// ============ 197号柜背面暗格 ============
function initCabinetBack() {
  if (!/archive\/197\.html/i.test(location.pathname)) return;
  const sign = document.getElementById('chen-sign');
  if (!sign) return;
  let clicks = [];
  sign.addEventListener('click', function () {
    const now = Date.now();
    clicks = clicks.filter(function (t) { return now - t < 3000; });
    clicks.push(now);
    if (clicks.length >= 5) {
      clicks = [];
      showCabinetSecret();
      reportClue('cabinet_back');
    }
  });
}

function showCabinetSecret() {
  let secret = document.getElementById('cabinet-secret');
  if (!secret) {
    secret = document.createElement('div');
    secret.id = 'cabinet-secret';
    Object.assign(secret.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      background: '#0a0a0a', border: '2px solid #c0392b', color: '#d4b080',
      padding: '30px 36px', maxWidth: '500px', zIndex: 20000,
      fontFamily: '"宋体","SimSun",serif', lineHeight: '1.9', fontSize: '15px',
      boxShadow: '0 0 60px rgba(192,57,43,0.4)'
    });
    secret.innerHTML =
      '<div style="text-align:right;font-size:12px;color:#888;margin-bottom:12px;">——编号197·柜背暗格——</div>' +
      '<div>铁匣里躺着一张泛黄的便签纸：</div>' +
      '<div style="margin-top:14px;padding:16px;background:#1a1410;border-left:3px solid #8b5a2b;">' +
      '"素芬，<br>' +
      '那批东西我已经处理掉了。<br>' +
      '账平了，人……也平了。<br>' +
      '钥匙我放在老地方——你知道在哪里。<br>' +
      '别再问了，也别再写了。<br>' +
      '——1998.7.14 夜"</div>' +
      '<div style="margin-top:20px;text-align:right;">' +
      '<button id="cabinet-secret-close" style="padding:6px 16px;background:#333;color:#ccc;border:none;border-radius:3px;cursor:pointer;">合上</button>' +
      '</div>';
    document.body.appendChild(secret);
    document.getElementById('cabinet-secret-close').addEventListener('click', function () {
      if (secret.parentNode) secret.parentNode.removeChild(secret);
    });
  }
  secret.style.display = 'block';
}

// ============ 留言板 ============
function initLiuyanForm() {
  const form = document.getElementById('liuyan-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.originText = btn.textContent || btn.value; btn.textContent = '提交中...'; }
    const formData = {};
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.name) formData[el.name] = el.value;
    });
    fetch('/api/liuyan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then(r => r.json())
      .then(function () {
        const list = document.getElementById('liuyan-list') || form.parentNode.querySelector('#liuyan-list, .liuyan-list, [data-list]');
        if (list) {
          const item = document.createElement('div');
          item.className = 'liuyan-item anonymous-reply';
          Object.assign(item.style, {
            marginTop: '12px', padding: '10px 14px', background: '#1a1a1a',
            borderLeft: '3px solid #555', fontSize: '13px', color: '#aaa', borderRadius: '3px'
          });
          item.innerHTML = '<div style="color:#666;margin-bottom:4px;">管理员 · 刚刚</div><div>收到。</div>';
          list.appendChild(item);
        }
        form.reset();
      })
      .catch(function () {})
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originText || '提交'; }
      });
  });
}

// ============ 领导信箱 ============
function initLetterForm() {
  const form = document.getElementById('letter-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.originText = btn.textContent || btn.value; btn.textContent = '提交中...'; }
    const formData = {};
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.name) formData[el.name] = el.value;
    });
    fetch('/api/letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then(r => r.json())
      .then(function (data) {
        if (data && data.ending === 's') {
          window.location.href = '/ending/s.html';
          return;
        }
        if (data && data.triggerSEnding) {
          const endingText = data.endingText || '【S 结局已触发】';
          const overlay = document.createElement('div');
          Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.92)', zIndex: 30000, display: 'flex',
            justifyContent: 'center', alignItems: 'center', color: '#ffd700',
            fontSize: '22px', textAlign: 'center', padding: '40px', lineHeight: '2',
            fontFamily: '"宋体",serif'
          });
          overlay.innerHTML = '<div>' + endingText +
            '<div style="margin-top:40px;font-size:14px;color:#888;">—— S 结局 · 全部真相 ——</div></div>';
          document.body.appendChild(overlay);
          setTimeout(function () {
            window.location.href = '/ending/s.html';
          }, 6000);
          return;
        }
        if (data && data.message) {
          alert(data.message);
        } else {
          alert('信件已投递');
        }
        form.reset();
      })
      .catch(function () {
        alert('投递失败');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originText || '提交'; }
      });
  });
}

// ============ 结局触发按钮 ============
function initEndingBtn() {
  document.querySelectorAll('.ending-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true;
      const originText = btn.textContent;
      btn.textContent = '触发中...';
      fetch('/api/ending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(r => r.json())
        .then(function (data) {
          const ending = (data && data.ending) ? String(data.ending).toLowerCase() : null;
          if (ending && /^[abcds]$/.test(ending)) {
            window.location.href = '/ending/' + ending + '.html';
          } else {
            alert('结局未知');
            btn.disabled = false;
            btn.textContent = originText;
          }
        })
        .catch(function () {
          alert('触发失败');
          btn.disabled = false;
          btn.textContent = originText;
        });
    });
  });
}

// ============ 赵德明照片线索上报（合规版：悬停停留>=3s上报一次，无视觉异常效果）============
function initZhaoPhoto() {
  const photo = document.getElementById('zhao-photo');
  if (!photo) return;
  let hoverTimer = null;
  let triggered = false;
  photo.addEventListener('mouseenter', function () {
    if (triggered) return;
    hoverTimer = setTimeout(function () {
      triggered = true;
      reportClue('zhaoming_photo');
    }, 3000);
  });
  photo.addEventListener('mouseleave', function () {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  });
}

// ============ 初始化:绑定点击事件 ============
document.addEventListener('DOMContentLoaded', function () {
  // 1. 获取积分存入 window.__score (fire-and-forget)
  try {
    fetch('/api/score')
      .then(r => r.json())
      .then(function (data) {
        window.__score = (data && typeof data.score !== 'undefined') ? data.score : data;
      })
      .catch(function () {});
  } catch (e) {}

  // 2. 水管音效按钮（已移除·玩家反馈不需要）
  // try { WaterAudio.injectButton(); } catch (e) {}

  // 3. OA 登录弹窗
  document.querySelectorAll('.oa-login').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      showOALogin();
    });
  });

  // 4. 电话号码点击
  document.querySelectorAll('.clickable-phone').forEach(function (el) {
    el.addEventListener('click', function () {
      const number = this.dataset.number || this.textContent.trim();
      const name = this.dataset.name || '未知联系人';
      callPhone(number, name);
    });
  });

  // 5. 邮箱点击
  document.querySelectorAll('.clickable-email').forEach(function (el) {
    el.addEventListener('click', function () {
      const addr = this.dataset.address || this.textContent.trim();
      composeEmail(addr);
    });
  });

  // 6. 涂黑文字 click 显示
  document.querySelectorAll('.redacted').forEach(function (el) {
    el.addEventListener('click', function () {
      this.style.color = '#666';
      this.style.background = '#333';
    });
  });

  // 7. 隐藏文字 hover 显示（合规：真实的"涂白隐藏文字"效果，不含灵异）
  document.querySelectorAll('.hidden-text').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      this.style.color = '#2c3e50';
    });
    el.addEventListener('mouseleave', function () {
      this.style.color = '#f5f5f5';
    });
  });

  // 8. 移动端点击导航链接后自动收起菜单
  document.querySelectorAll('.nav-inner a').forEach(function (el) {
    el.addEventListener('click', function () {
      const nav = document.querySelector('.nav-inner');
      if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    });
  });

  // 9. 197号柜暗格触发
  initCabinetBack();

  // 10. 留言板
  initLiuyanForm();

  // 11. 领导信箱
  initLetterForm();

  // 12. 结局触发按钮
  initEndingBtn();

  // 13. 赵德明照片（线索上报）
  initZhaoPhoto();

  // 14. 案件档案系统
  try { DCArchive.init(); } catch (e) {}
});

// ============================================================
// ============ 案件档案系统（31步进度追踪·UI版） ============
// ============================================================
const DCArchive = (function () {
  const STORAGE_KEY = 'dc_sl_archives_v1';

  const STEPS = [
    { id: 's01', act: 's01_welcome_identity', title: '第01步 · 入职身份卡', desc: '你是林屿，东川学院档案学2022届，现坐周海生生前工位（工程科3楼302靠窗）。', tag: '身份' },
    { id: 's02', act: 's02_fangxiao_message', title: '第02步 · 方晓微信截图', desc: '"坐他的椅子，替他把没做完的事做完。"方晓是你四年同班同学，方学礼的女儿。', tag: '人物' },
    { id: 's03', act: 's03_rh_13_candy', title: '第03步 · 润喉糖半盒', desc: '抽屉里的薄荷润喉糖，生产日期2024.01，只剩13粒（原包装20粒·少了7粒）。', tag: '物证' },
    { id: 's04', act: 's04_zhouxiaoyu_scratch', title: '第04步 · 周小雨刮痕', desc: '工位隔板侧面有14岁少女的铅笔涂鸦"爸爸早点回家"，旁边是日期2024.2.13。', tag: '情感' },
    { id: 's05', act: 's05_sunweiguo_passby', title: '第05步 · 孙卫国路过', desc: '孙卫国（安保科长）下午3:17在你工位走廊晃了三圈，每次都瞥你屏幕。', tag: '人物' },
    { id: 's06', act: 's06_zhaodm_photoword', title: '第06步 · 赵德明照片水印', desc: '领导介绍页赵德明照片右下角有半透明水印：工程代号 087。', tag: '线索' },
    { id: 's07', act: 's07_reservoir_photo_rightedge', title: '第07步 · 通水报道右缘', desc: '2019.6.15通水仪式照片图注被打乱，是栅栏密码密文。', tag: '密码' },
    { id: 's08', act: 's08_zhalan_197', title: '第08步 · 栅栏密码解密', desc: '两栏栅栏→解出"第七排197号柜"。', tag: '解密' },
    { id: 's09', act: 's09_door_1379', title: '第09步 · 档案室门禁1379', desc: '7 × 197 = 1379。陈素芬离职邮件提示的门禁号。', tag: '密码' },
    { id: 's10', act: 's10_collapse_line_straight', title: '第10步 · 坍塌直线证据', desc: '197手记第2页·坍塌裂缝是一条直线，人为爆破才会如此整齐。', tag: '铁证' },
    { id: 's11', act: 's11_zhao_tiezhu_7not8', title: '第11步 · 赵铁柱不是第8人', desc: '出勤表注释：赵铁柱入赘改姓张建国，事故当日去青溪村拉木材，不在现场。', tag: '红鲱鱼' },
    { id: 's12', act: 's12_wuxing_0743', title: '第12步 · 五行密码·0743', desc: '"水退山崩，木埋金沉"→水0山7木4金3→监测站WS-0743。', tag: '密码' },
    { id: 's13', act: 's13_cross_zhou_phone', title: '第13步 · 交叉索引座机号', desc: '0743监测站值班日志→周海生生前座机 0587-62190432（停机保号）。', tag: '线索' },
    { id: 's14', act: 's14_caesar_19790315', title: '第14步 · 模十凯撒·19790315', desc: '密文42023648 + 陈素芬手记里小雨生月3 → 19790315（加密档案密钥）。', tag: '解密' },
    { id: 's15', act: 's15_seven_confirm', title: '第15步 · 七人名单确认', desc: '方学礼、吴振兴、王建国、刘德贵、陈长发、李明辉、张宝强 = 7人。', tag: '核心' },
    { id: 's16', act: 's16_oa_watermark1', title: '第16步 · OA水印1·照片背景板', desc: '工程科合影背景板有"DC-2026"字样。', tag: '线索' },
    { id: 's17', act: 's17_oa_watermark2', title: '第17步 · OA水印2·赵德明照片', desc: '赵德明照片水印末三位"087"，交叉→OA密码DC2026087。', tag: '密码' },
    { id: 's18', act: 's18_oa_login_success', title: '第18步 · OA登录成功', desc: '工号DC-202608-17，欢迎林屿同志。隐藏页人物关系已解锁。', tag: '里程碑' },
    { id: 's19', act: 's19_relative_zhou_fang', title: '第19步 · 周方两家关系', desc: '周海生媳妇林秀娟的妹妹，是方晓的妈妈林秀兰——周方两家是姨表亲。', tag: '人物' },
    { id: 's20', act: 's20_cdr_302_4m17s', title: '第20步 · 通话记录302·4分17秒', desc: '2024.2.13 23:02 孙卫国→赵德明，时长4分17秒，录音笔内容和CDR对上。', tag: '铁证' },
    { id: 's21', act: 's21_zhaodm_absent_email', title: '第21步 · 赵德明缺席邮件', desc: '2024.2.14 凌晨赵德明给办公室发邮件：临时去昆明开会（实际没去·机票没乘机记录）。', tag: '时间线' },
    { id: 's22', act: 's22_zhaodm_absent_schedule', title: '第22步 · 赵德明日程涂改', desc: '日程本hover可见："翠湖茶楼"被蓝墨水涂成"昆明"。', tag: '铁证' },
    { id: 's23', act: 's23_yansti_13_dna', title: '第23步 · 烟蒂13号DNA', desc: '197柜烟蒂13号（黄鹤楼1916）DNA鉴定→与孙卫国匹配度99.998%。', tag: '铁证' },
    { id: 's24', act: 's24_80w_account_last8', title: '第24步 · 80万流水末8位', desc: '赵德明情妇王若琳空壳公司2023.8.17入账80万→账号末8位 62284801。', tag: '铁证' },
    { id: 's25', act: 's25_majianguo_not_present', title: '第25步 · 马建国无作案时间', desc: '马建国2024.2.13在省厅汇报（有GPS、签到、会议记录），知情不报但无直接作案。', tag: '定性' },
    { id: 's26', act: 's26_shoucai_2083', title: '第26步 · 寿材U盘密码2083', desc: '周海生岳父寿材夹层金士顿U盘→林秀娟手机尾号2083→笔迹鉴定/采购单/流水扫描。', tag: '双保险' },
    { id: 's27', act: 's27_kuaidi_0317', title: '第27步 · 快递单号末四位0317', desc: '周海生→武大张正国·顺丰速运 SF1234567890317→第三方物证（湖北省纪委监委已受理）。', tag: '双保险' },
    { id: 's28', act: 's28_chencf_id_19851024', title: '第28步 · 陈长发录音密码', desc: '陈长发身份证后8位 19851024 → 2024.01.28堂哥来电录音誊写"旧料裂了3处孙科长不让换"。', tag: '双保险' },
    { id: 's29', act: 's29_sony_pen_distinguish', title: '第29步 · 索尼录音笔区分', desc: 'A黑色（孙卫国·预警用·放在197柜最上层）/ B银色（马建国·另案调查用·夹层）。', tag: '半真半假' },
    { id: 's30', act: 'point_double_insurance', title: '第30步 · 12项举报信填写', desc: '完整填写七人、双主谋、保护伞、动机、马建国有无时间、三件双保险证据等12项。', tag: '终局' },
    { id: 's31', act: 'final_s_end', title: '第31步 · 提交举报信', desc: '提交省纪委监委·受理回执编号 DW20260817-0038 → 结局判定。', tag: '终局' }
  ];

  const PENALTIES = [
    { id: 'penalty_zhaotiezhu8', label: '红鲱鱼A：把赵铁柱算进死亡名单（凑8人）', penalty: -5 },
    { id: 'penalty_report_mjg', label: '红鲱鱼B：举报对象填马建国（他无直接作案时间）', penalty: -10 },
    { id: 'penalty_sony_not_dist', label: '半真半假：索尼录音笔未区分归属', penalty: -3 },
    { id: 'penalty_report_qianjh', label: '红鲱鱼C：保护伞乱填钱建宏（无直接证据）', penalty: -5 }
  ];

  const DOT_COLORS = ['#e74c3c','#f39c12','#3498db','#27ae60','#9b59b6','#e67e22','#1abc9c','#e84393','#fd79a8','#6c5ce7','#00b894','#d63031'];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { unlocked: {}, extra: {} };
      return JSON.parse(raw);
    } catch (e) { return { unlocked: {}, extra: {} }; }
  }

  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function markUnlocked(stepIdOrClueKey) {
    const state = loadState();
    const step = STEPS.find(s => s.id === stepIdOrClueKey || s.act === stepIdOrClueKey);
    if (step) {
      state.unlocked[step.id] = { at: Date.now() };
      saveState(state);
      updateBadge();
      return true;
    }
    const pen = PENALTIES.find(p => p.id === stepIdOrClueKey);
    if (pen) {
      state.extra['pen_' + pen.id] = { at: Date.now(), label: pen.label, penalty: pen.penalty };
      saveState(state);
      updateBadge();
      return true;
    }
    return false;
  }

  function getProgress() {
    const state = loadState();
    const unlockedCount = STEPS.filter(s => state.unlocked[s.id]).length;
    return { unlocked: unlockedCount, total: STEPS.length, pct: Math.round(unlockedCount * 100 / STEPS.length), state: state };
  }

  function unlock(clueKey) {
    reportClue(clueKey);
    markUnlocked(clueKey);
  }

  function updateBadge() {
    const { unlocked, total } = getProgress();
    const badge = document.getElementById('dc-archive-badge');
    if (badge) badge.textContent = unlocked + '/' + total;
    const badge2 = document.getElementById('dc-archive-mobile-btn');
    if (badge2) {
      const label = badge2.querySelector('.dc-mb-label b');
      if (label) label.textContent = unlocked + '/' + total;
      const bar = badge2.querySelector('.dc-mb-subline i');
      if (bar) bar.style.width = Math.round(unlocked * 100 / total) + '%';
    }
  }

  function renderModal() {
    const { unlocked, total, pct, state } = getProgress();
    const cardsHTML = STEPS.map((s, idx) => {
      const done = !!state.unlocked[s.id];
      const dotColor = DOT_COLORS[idx % DOT_COLORS.length];
      const dot = done ? dotColor : '#4a5568';
      const stepNum = String(idx + 1).padStart(2, '0');
      return (
        '<div class="dc-item ' + (done ? 'done' : 'locked') + '">' +
          '<span class="dc-dot" style="background:' + dot + '"></span>' +
          '<div class="dc-item-body">' +
            '<div class="dc-item-head">' +
              '<span class="dc-item-num"># ' + stepNum + '</span>' +
              '<span class="dc-item-title">' + (done ? s.title.replace(/^第\d+步\s·\s/, '') : '？？？？？') + '</span>' +
              '<span class="dc-item-tag">' + s.tag + '</span>' +
            '</div>' +
            '<div class="dc-item-desc">' + (done ? s.desc : '（尚未解锁·继续收集线索）') + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    const pens = Object.keys(state.extra).filter(k => k.startsWith('pen_'));
    const pensHTML = pens.length ? (
      '<div class="dc-pens-box">' +
        '<div class="dc-pens-title">⚠ 红鲱鱼 & 扣分记录</div>' +
        pens.map(k => {
          const p = state.extra[k];
          return '<div class="dc-pen-item"><span class="dc-pen-num">' + p.penalty + '分</span>' +
            '<span class="dc-pen-label">' + p.label + '</span></div>';
        }).join('') +
      '</div>'
    ) : '';

    let overlay = document.getElementById('dc-archive-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'dc-archive-overlay';
      overlay.innerHTML =
        '<div id="dc-archive-panel" class="dc-archive-panel">' +
          '<div class="dc-archive-header">' +
            '<div class="dc-header-left">' +
              '<span class="dc-folder-icon">📂</span>' +
              '<span class="dc-archive-title">案件档案</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<div class="dc-header-mini-bar"><div class="dc-header-mini-inner" style="width:' + pct + '%;"></div></div>' +
              '<button id="dc-archive-close" class="dc-archive-close" aria-label="关闭">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="dc-archive-progress">' +
            '<div class="dc-progress-info">' +
              '<span class="dc-progress-label">已收集 <b>' + unlocked + '</b>/' + total + ' 条线索</span>' +
            '</div>' +
            '<div class="dc-progress-bar"><div class="dc-progress-inner" style="width:' + pct + '%;"></div></div>' +
          '</div>' +
          '<div id="dc-cards-container" class="dc-cards-container">' + cardsHTML + '</div>' +
          '<div id="dc-pens-wrap">' + pensHTML + '</div>' +
          '<div class="dc-archive-footer">' +
            '<button id="dc-relations-btn" class="dc-btn-primary">🧬 人物图谱</button>' +
            '<button id="dc-close2-btn" class="dc-btn-secondary">关闭</button>' +
          '</div>' +
        '</div>';
      Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.55)', zIndex: 99998, display: 'none',
        justifyContent: 'center', alignItems: 'center',
        padding: '20px 10px', boxSizing: 'border-box'
      });
      document.body.appendChild(overlay);
      injectStyles();
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      document.getElementById('dc-archive-close').addEventListener('click', close);
      document.getElementById('dc-close2-btn').addEventListener('click', close);
      document.getElementById('dc-relations-btn').addEventListener('click', function () {
        close();
        window.location.href = '/about-relationships.html';
      });
    } else {
      document.getElementById('dc-cards-container').innerHTML = cardsHTML;
      document.querySelector('.dc-progress-label').innerHTML = '已收集 <b>' + unlocked + '</b>/' + total + ' 条线索';
      const pensWrap = document.getElementById('dc-pens-wrap');
      if (pensWrap) pensWrap.innerHTML = pensHTML;
      const bar = document.querySelector('.dc-progress-inner');
      if (bar) bar.style.width = pct + '%';
      const miniBar = document.querySelector('.dc-header-mini-inner');
      if (miniBar) miniBar.style.width = pct + '%';
    }
    overlay.style.display = 'flex';
    setTimeout(function () { const p = document.getElementById('dc-archive-panel'); if (p) p.parentElement.scrollTop = 0; }, 30);
  }

  function close() {
    const o = document.getElementById('dc-archive-overlay');
    if (o) o.style.display = 'none';
  }

  function injectStyles() {
    if (document.getElementById('dc-archive-styles')) return;
    const st = document.createElement('style');
    st.id = 'dc-archive-styles';
    st.textContent = `
      .dc-archive-panel {
        width: 100%; max-width: 640px;
        background: #ffffff;
        border: none;
        border-radius: 10px;
        color: #1f2937;
        box-shadow: 0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06);
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .dc-archive-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 18px;
        background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
        color: #f9fafb;
      }
      .dc-header-left { display: flex; align-items: center; gap: 10px; }
      .dc-folder-icon { font-size: 20px; line-height: 1; }
      .dc-archive-title { font-size: 16px; font-weight: 700; color: #f9fafb; letter-spacing: 0.5px; }
      .dc-archive-close {
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
        color: #d1d5db; width: 30px; height: 30px; border-radius: 6px;
        font-size: 17px; cursor: pointer; line-height: 1;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      .dc-archive-close:hover { background: rgba(255,255,255,0.18); color: #fff; }
      .dc-header-mini-bar {
        width: 40px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden;
      }
      .dc-header-mini-inner {
        height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 999px;
      }
      .dc-archive-progress { padding: 13px 18px 16px; background: #fff; border-bottom: 1px solid #eef0f3; }
      .dc-progress-info {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 8px; font-size: 13px; color: #4b5563;
        flex-wrap: wrap; gap: 8px;
      }
      .dc-progress-label b { color: #0f766e; font-weight: 700; font-size: 14px; }
      .dc-progress-bar {
        height: 7px; background: #e5e7eb; border-radius: 999px; overflow: hidden;
      }
      .dc-progress-inner {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #059669);
        border-radius: 999px;
        transition: width 0.55s cubic-bezier(0.4,0,0.2,1);
      }
      .dc-cards-container {
        padding: 6px 6px 10px;
        max-height: 52vh;
        overflow-y: auto;
      }
      .dc-item {
        display: flex; gap: 12px;
        padding: 11px 14px 11px 12px;
        border-radius: 6px;
        transition: background 0.15s;
      }
      .dc-item:hover { background: #f9fafb; }
      .dc-item.done { }
      .dc-item.locked { opacity: 0.52; filter: saturate(0.3); }
      .dc-dot {
        flex-shrink: 0;
        width: 11px; height: 11px;
        border-radius: 50%;
        margin-top: 6px;
        box-shadow: 0 0 0 2px rgba(255,255,255,1), 0 0 0 3px rgba(0,0,0,0.06);
      }
      .dc-item-body { flex: 1 1 auto; min-width: 0; }
      .dc-item-head {
        display: flex; align-items: baseline; gap: 8px;
        margin-bottom: 2px; flex-wrap: wrap;
      }
      .dc-item-num {
        font-size: 12px;
        font-weight: 700;
        color: #6b7280;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.2px;
      }
      .dc-item-title {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        line-height: 1.45;
      }
      .dc-item.locked .dc-item-title { color: #9ca3af; }
      .dc-item-tag {
        font-size: 10.5px;
        padding: 2px 7px;
        border-radius: 999px;
        background: #f1f5f9;
        color: #64748b;
        white-space: nowrap;
        line-height: 1.5;
      }
      .dc-item.done .dc-item-tag { background: #ecfdf5; color: #047857; }
      .dc-item-desc {
        font-size: 12.5px;
        line-height: 1.65;
        color: #6b7280;
      }
      .dc-pens-box { margin: 6px 12px 10px; border-radius: 7px; overflow: hidden; border: 1px solid #fee2e2; }
      .dc-pens-title {
        padding: 8px 12px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 13px;
        font-weight: 600;
        border-bottom: 1px solid #fee2e2;
      }
      .dc-pen-item {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 12px;
        background: #fff;
        font-size: 12.5px;
        color: #4b5563;
        border-bottom: 1px solid #fef2f2;
      }
      .dc-pen-item:last-child { border-bottom: none; }
      .dc-pen-num {
        font-size: 11px;
        font-weight: 700;
        color: #b91c1c;
        background: #fee2e2;
        padding: 2px 7px;
        border-radius: 4px;
        flex-shrink: 0;
      }
      .dc-pen-label { flex: 1; line-height: 1.5; }
      .dc-archive-footer {
        display: flex; gap: 12px;
        padding: 14px 18px 18px;
        border-top: 1px solid #eef0f3;
        background: #fafbfc;
      }
      .dc-btn-primary {
        flex: 1;
        padding: 11px 16px;
        background: linear-gradient(180deg, #10b981 0%, #059669 100%);
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 7px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        transition: transform 0.12s, filter 0.15s;
        font-family: inherit;
      }
      .dc-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .dc-btn-secondary {
        flex: 1;
        padding: 11px 16px;
        background: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        font-family: inherit;
      }
      .dc-btn-secondary:hover { background: #f9fafb; }
      #dc-archive-mobile-btn {
        position: fixed; right: 14px; bottom: 68px; z-index: 99997;
        display: none;
        align-items: center;
        gap: 0;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        font-family: inherit;
      }
      #dc-archive-mobile-btn .dc-mb-icon {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
        color: #fff;
        box-shadow: 0 8px 26px rgba(0,0,0,0.35), 0 0 0 3px rgba(16,185,129,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 23px;
        line-height: 1;
        position: relative;
      }
      #dc-archive-mobile-btn .dc-mb-label {
        margin-left: -8px;
        padding: 5px 12px 5px 14px;
        background: #111827;
        color: #f9fafb;
        border-radius: 0 999px 999px 0;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 90px;
        box-shadow: 0 8px 26px rgba(0,0,0,0.28);
      }
      #dc-archive-mobile-btn .dc-mb-label b {
        color: #10b981;
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      #dc-archive-mobile-btn .dc-mb-label .dc-mb-subline {
        height: 3px; margin-top: 3px; background: #374151;
        border-radius: 999px; overflow: hidden;
      }
      #dc-archive-mobile-btn .dc-mb-label .dc-mb-subline i {
        display: block; height: 100%;
        background: linear-gradient(90deg, #10b981, #059669);
        border-radius: 999px;
        transition: width 0.5s ease;
      }
      @media (max-width: 768px) {
        .dc-archive-panel { max-width: 100%; border-radius: 10px; margin: 0 5px; }
        .dc-cards-container { max-height: 55vh; padding: 4px 4px 8px; }
        .dc-archive-header { padding: 12px 14px; }
        .dc-archive-progress { padding: 11px 14px 14px; }
        .dc-archive-footer { padding: 12px 14px 15px; gap: 10px; }
        .dc-item { padding: 10px 11px; gap: 10px; }
        .dc-item-title { font-size: 13.5px; }
        .dc-item-desc { font-size: 12px; }
        #dc-archive-mobile-btn { display: inline-flex; }
        .dc-archive-title { font-size: 15px; }
      }
    `;
    document.head.appendChild(st);
  }

  function injectButtons() {
    const trigger = document.getElementById('dc-archive-entry');
    if (trigger) {
      trigger.addEventListener('click', function () {
        renderModal();
      });
    }
    if (!document.getElementById('dc-archive-mobile-btn')) {
      const btn = document.createElement('button');
      btn.id = 'dc-archive-mobile-btn';
      btn.innerHTML =
        '<span class="dc-mb-icon">📂</span>' +
        '<span class="dc-mb-label">' +
          '<span>线索 <b>0/31</b></span>' +
          '<span class="dc-mb-subline"><i style="width:0%;"></i></span>' +
        '</span>';
      btn.addEventListener('click', renderModal);
      document.body.appendChild(btn);
    }
    updateBadge();
  }

  function init() {
    injectButtons();
    setInterval(function () {
      try {
        fetch('/api/score')
          .then(r => r.json())
          .then(function (data) {
            if (!data || !Array.isArray(data.clues)) return;
            const state = loadState();
            let changed = false;
            data.clues.forEach(function (k) {
              const step = STEPS.find(s => s.id === k || s.act === k);
              if (step && !state.unlocked[step.id]) {
                state.unlocked[step.id] = { at: Date.now() };
                changed = true;
              }
            });
            if (changed) { saveState(state); updateBadge(); }
          })
          .catch(function () {});
      } catch (e) {}
    }, 3000);
  }

  return { init: init, unlock: unlock, open: renderModal, close: close, getProgress: getProgress, STEPS: STEPS };
})();

window.DCArchive = DCArchive;

// ============================================================
// ============ 方晓微信截图抽屉（首页欢迎文字触发） ============
// ============================================================
(function initFangxiaoDrawer() {
  function buildDrawer() {
    if (document.getElementById('fangxiao-drawer')) return document.getElementById('fangxiao-drawer');
    const d = document.createElement('div');
    d.id = 'fangxiao-drawer';
    d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:none;justify-content:center;align-items:center;background:rgba(0,0,0,0.5);';
    d.innerHTML =
      '<div id="fx-card" style="width:92%;max-width:380px;background:#ededed;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif;">' +
        '<div style="background:#2d2d2d;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:15px;font-weight:600;">方晓 · 微信</span>' +
          '<span id="fx-close" style="cursor:pointer;font-size:18px;color:#aaa;">×</span>' +
        '</div>' +
        '<div style="padding:12px;background:#ededed;min-height:280px;">' +
          '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
            '<div style="width:38px;height:38px;background:#576b95;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:600;">方</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:14px;color:#333;margin-bottom:4px;font-weight:500;">方晓</div>' +
              '<div style="font-size:11px;color:#999;">今天 09:47</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border-radius:6px;padding:12px 14px;margin-left:46px;font-size:14px;line-height:1.7;color:#333;position:relative;">' +
            '<div style="position:absolute;left:-5px;top:14px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-right:6px solid #fff;"></div>' +
            '你入职的事我听说了。' +
          '</div>' +
          '<div style="margin:14px 0 0 46px;background:#95ec69;border-radius:6px;padding:12px 14px;font-size:14px;line-height:1.7;color:#333;position:relative;display:inline-block;">' +
            '<div style="position:absolute;right:-5px;top:14px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:6px solid #95ec69;"></div>' +
            '坐他的椅子，替他把没做完的事做完。' +
          '</div>' +
          '<div style="margin-left:46px;margin-top:12px;font-size:11px;color:#aaa;">' +
            '他工牌还在我这，方便时来拿。' +
          '</div>' +
          '<div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:11px;color:#bbb;">' +
            '—— 截图拍摄于 2026.08.17 ——' +
          '</div>' +
        '</div>' +
      '</div>';
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    d.querySelector('#fx-close').addEventListener('click', close);
    document.body.appendChild(d);
    return d;
  }

  function open() {
    const d = buildDrawer();
    d.style.display = 'flex';
    try { DCArchive.unlock('s02_fangxiao_message'); } catch (e) {}
    try { reportClue('s02_fangxiao_message'); } catch (e) {}
  }

  function close() {
    const d = document.getElementById('fangxiao-drawer');
    if (d) d.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const t = document.getElementById('fangxiao-trigger');
    if (t) t.addEventListener('click', open);
  });
})();

// ============================================================
// ============ 联系我们页：5关密码验证 + 举报信12项 ============
// ============================================================
const DCVerifier = (function () {
  // 6项通关锁（5关密码 + 1关OA）
  const LOCAL_KEY = 'dc_verify_v1';

  function getState() {
    try {
      const r = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      return r || {};
    } catch (e) { return {}; }
  }
  function save(k, v) {
    const s = getState();
    s[k] = v;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
    checkReportUnlock();
  }
  function isPass(k) { return !!getState()[k]; }

  function verifyOne(type, inputId, msgId, field) {
    field = field || 'code';
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    const val = input ? input.value : '';
    if (!val || !String(val).trim()) {
      msg.className = 'vc-msg err';
      msg.textContent = '请先输入内容再验证。';
      return;
    }
    msg.className = 'vc-msg';
    msg.textContent = '验证中……';
    const body = {};
    if (type === 'seven') body.num = val;
    else if (type === 'oa') body.password = val;
    else body.code = val;

    const endpoint = type === 'oa' ? '/api/verify/oa' : ('/api/verify/' + type);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(r => r.json())
      .then(function (data) {
        if (data && data.success) {
          save(type, true);
          msg.className = 'vc-msg ok';
          msg.innerHTML = (data.message || '验证通过') +
            (data.score !== undefined ? '<br><span style="color:#1a5276;">当前后端线索分：<b>' + data.score + '</b>/100</span>' : '');
          input.value = '';
          // 同步到进度追踪
          try {
            if (window.DCArchive) {
              const mapping = {
                door: 's09_door_1379',
                seven: 's15_seven_confirm',
                coffin: 's26_shoucai_2083',
                courier: 's27_kuaidi_0317',
                chencf: 's28_chencf_id_19851024',
                oa: 's18_oa_login_success'
              };
              if (mapping[type]) DCArchive.unlock(mapping[type]);
              if (type === 'seven') setTimeout(() => DCArchive.unlock('s11_zhao_tiezhu_7not8'), 500);
              if (type === 'oa') setTimeout(() => DCArchive.unlock('s19_relative_zhou_fang'), 900);
            }
          } catch (e) {}
          // 门禁通过时 自动提示下一关
          if (type === 'door') {
            setTimeout(() => {
              const sc = document.getElementById('vc-seven');
              if (sc) { sc.scrollIntoView({ behavior: 'smooth', block: 'center' }); sc.focus(); }
            }, 700);
          }
          // OA登录成功 跳转关系页
          if (type === 'oa' && data.redirect) {
            setTimeout(() => { location.href = data.redirect; }, 900);
          }
        } else if (data && data.penalty) {
          // 红鲱鱼：七人填8扣5分
          save('pen_' + type, false);
          msg.className = 'vc-msg penalty';
          msg.textContent = data.message || '红鲱鱼·已扣分。';
          try { if (window.DCArchive) DCArchive.unlock(data.penaltyKey); } catch (e) {}
        } else {
          msg.className = 'vc-msg err';
          msg.textContent = (data && data.message) || '验证失败，请重新核对线索。';
          input.select();
        }
      })
      .catch(function () {
        msg.className = 'vc-msg err';
        msg.textContent = '网络错误，请重试。';
      });
  }

  function checkReportUnlock() {
    const need = ['door', 'seven', 'coffin', 'courier', 'chencf', 'oa'];
    const allPass = need.every(isPass);
    const wrap = document.getElementById('report-form-wrap');
    const hint = document.getElementById('report-locked-hint');
    if (!wrap || !hint) return;
    if (allPass) {
      wrap.style.opacity = '1';
      wrap.style.pointerEvents = 'auto';
      hint.innerHTML = '✅ 6 项已全部通关。请完整填写下方 12 项，提交后根据完整度和正确性判定结局（S/A/B/C/D）。';
      hint.style.color = '#1e8449';
      hint.style.background = 'rgba(39,174,96,0.08)';
      // 自动滚动到举报信
      try { document.getElementById('report-window').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    } else {
      const left = need.filter(function (k) { return !isPass(k); });
      const names = { door: '①门禁1379', seven: '②七人确认7', coffin: '③寿材2083', courier: '④快递0317', chencf: '⑤陈长发19851024', oa: '⑥OA登录DC2026087' };
      hint.innerHTML = '⏳ 还需完成：<b>' + left.map(function (k) { return names[k] || k; }).join('、') + '</b> → 全部通过后解锁。';
    }
  }

  function initContactPage() {
    if (!/contact\.html/i.test(location.pathname)) return;
    // 6关通过状态持久化恢复
    const s = getState();
    ['door', 'seven', 'coffin', 'courier', 'chencf', 'oa'].forEach(function (k) {
      if (s[k]) {
        const ids = { door: 'vc-door', seven: 'vc-seven', coffin: 'vc-coffin', courier: 'vc-courier', chencf: 'vc-chencf' };
        const id = ids[k];
        if (id) {
          const msg = document.getElementById(id + '-msg');
          const btn = document.querySelector('#' + id + ' + button');
          if (msg) { msg.className = 'vc-msg ok'; msg.textContent = '✅ 已通过（刷新不丢失）。可继续下一关。'; }
          if (btn) { btn.disabled = true; btn.textContent = '已通关'; }
        }
      }
    });
    checkReportUnlock();

    // 绑定举报信提交
    const form = document.getElementById('letter-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitReport(form);
    });
  }

  function submitReport(form) {
    const data = {};
    form.querySelectorAll('[name]').forEach(function (el) { data[el.name] = (el.value || '').trim(); });
    const btn = document.getElementById('report-submit-btn');
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = '提交中……（证据链校验·预计 2 秒）'; }

    const minLen = (data.content || '').length;
    if (minLen < 10) {
      alert('第⑫项「补充说明」至少填写 10 个字。请认真填写证据摘要。');
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || '提交'; }
      return;
    }

    // 步骤1：提交12项字段给后端解析（设置s_conditions和加分）
    fetch('/api/report-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function () {
      // 步骤2：原/api/letter触发S判定（如果content有指定句子）
      return fetch('/api/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }).then(r => r.json()).then(function (letterResp) {
      // 步骤3：获取结局
      return fetch('/api/ending', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json())
        .then(function (endResp) {
          return { letter: letterResp, ending: endResp };
        });
    }).then(function (o) {
      // 第31步解锁
      try { if (window.DCArchive) DCArchive.unlock('final_s_end'); } catch (e) {}

      const ending = (o && o.ending && o.ending.level) || 'NONE';
      // 如果S档触发（有回执）显示受理弹层再跳转
      if (o.letter && o.letter.triggerSEnding) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(6,12,20,0.94)', zIndex: 30000, display: 'flex',
          justifyContent: 'center', alignItems: 'center', color: '#f1c40f',
          padding: '24px', lineHeight: '1.9', boxSizing: 'border-box', overflow: 'auto'
        });
        overlay.innerHTML = '<div style="max-width:720px;white-space:pre-wrap;font-size:15px;text-align:left;font-family:Consolas, Monaco, monospace;">' +
          (o.letter.endingText || '') + '</div>';
        document.body.appendChild(overlay);
        setTimeout(function () {
          window.location.href = '/ending/' + ending.toLowerCase() + '.html';
        }, 6500);
      } else {
        window.location.href = '/ending/' + ending.toLowerCase() + '.html';
      }
    }).catch(function (err) {
      console.error(err);
      alert('提交失败：' + (err && err.message ? err.message : '请检查网络连接后重试'));
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig || '提交'; }
    });
  }

  // 对外暴露 verifyOne
  window.verifyOne = verifyOne;
  window.checkReportUnlock = checkReportUnlock;

  document.addEventListener('DOMContentLoaded', initContactPage);

  return {
    verifyOne: verifyOne,
    checkReportUnlock: checkReportUnlock,
    getState: getState
  };
})();

// ============================================================
// ============ 各页面·特定线索悬停/点击自动上报钩子 ============
// ============================================================
(function initPageClueHooks() {
  const unlock = window.DCArchive ? window.DCArchive.unlock : reportClue;
  const path = location.pathname;

  // 欢迎页面（任何页面首次加载 → 解锁s01身份）
  try {
    if (!sessionStorage.getItem('dc_s01_done')) {
      sessionStorage.setItem('dc_s01_done', '1');
      unlock('s01_welcome_identity');
    }
  } catch (e) {}

  // ---------- index.html 首页 ----------
  if (/\/index\.html?$|\/$/i.test(path)) {
    // 方晓微信截图：点击左上角欢迎文字触发（不再自动解锁）
    // 孙卫国路过（滚动到第二条新闻时触发 s05）
    let once_s05 = false;
    window.addEventListener('scroll', function () {
      if (once_s05) return;
      if (window.scrollY > 260) { once_s05 = true; unlock('s05_sunweiguo_passby'); }
    });
    // 抽屉润喉糖·13粒（进入时2.5s后自动·s03）
    setTimeout(function () { unlock('s03_rh_13_candy'); }, 2500);
    // 周小雨涂鸦·刮痕s04
    setTimeout(function () { unlock('s04_zhouxiaoyu_scratch'); }, 3800);
    // 赵德明照片水印·s06（领导介绍照片悬停3秒时触发）
    document.querySelectorAll('#zhao-photo, img[alt*="赵德明"], img[alt*="局长"]').forEach(function (img) {
      let t, once = false;
      img.addEventListener('mouseenter', function () {
        if (once) return;
        t = setTimeout(function () { once = true; unlock('s06_zhaodm_photoword'); }, 2500);
      });
      img.addEventListener('mouseleave', function () { clearTimeout(t); });
    });
    // 兜底：6秒后s06自动触发（防止没图）
    setTimeout(function () { unlock('s06_zhaodm_photoword'); }, 6000);
  }

  // ---------- news-reservoir.html 通水报道 ----------
  if (/news-reservoir/i.test(path)) {
    // 图注密文（右缘归档备注）点击 → 解锁s07；再点→s08栅栏密码完成
    let s08_once = false;
    const pList = document.querySelectorAll('p');
    pList.forEach(function (p) {
      if (p.textContent.indexOf('第排九七号柜') !== -1 || p.textContent.indexOf('归档备注') !== -1) {
        p.style.cursor = 'crosshair';
        p.title = '归档备注密文（栅栏密码）· 点击标记线索';
        p.addEventListener('click', function () {
          unlock('s07_reservoir_photo_rightedge');
          // 再点击第二次时自动视为已解密（s08）
          if (!s08_once) { s08_once = true; }
          else { unlock('s08_zhalan_197'); }
        });
        p.addEventListener('mouseenter', function () { this.style.color = '#c8161d'; this.style.background = 'rgba(200,22,29,0.05)'; });
        p.addEventListener('mouseleave', function () { this.style.color = ''; this.style.background = ''; });
      }
    });
    // 照片本身点击（右缘）→ 解锁s07
    document.querySelectorAll('img[alt*="大坝"]').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { unlock('s07_reservoir_photo_rightedge'); });
    });
  }

  // ---------- archive/197.html 197柜手记 ----------
  if (/archive\/197/i.test(path)) {
    // 坍塌裂缝直线 → s10
    document.querySelectorAll('p').forEach(function (p) {
      const t = p.textContent;
      if (t.match(/坍塌|裂缝|直线|爆破|整齐|不是自然/) || p.classList.contains('whisper')) {
        p.style.cursor = 'pointer';
        p.addEventListener('click', function () {
          unlock('s10_collapse_line_straight');
        });
      }
      // 赵铁柱出勤表注释（s11）：七个、离职、饭卡这些词时提示红鲱鱼A
      if (t.match(/七个|七个人|七名|离职|饭卡|装出勤/) || t.indexOf('赵铁柱') !== -1) {
        p.addEventListener('dblclick', function () {
          unlock('s11_zhao_tiezhu_7not8');
          alert('【出勤表末页注释】赵铁柱 = 张建国（入赘改姓）· 事故当日去青溪村拉木材·不在现场 · 非死者 → 红鲱鱼A已排除');
        });
        p.title = '双击此处·查看出勤表末页"赵铁柱/张建国入赘注释"';
      }
      // 五行密码·水退山崩 → s12
      if (t.match(/水退|山崩|木埋|金沉|五行|代数/)) {
        p.style.cursor = 'pointer';
        p.addEventListener('click', function () { unlock('s12_wuxing_0743'); });
      }
    });
    // 交叉索引座机号 → s13（点击/data/haisheng 路径时报）
    document.querySelectorAll('.cipher, a, span').forEach(function (el) {
      if (el.textContent && el.textContent.indexOf('/data/haisheng') !== -1) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function () {
          unlock('s13_cross_zhou_phone');
          unlock('s14_caesar_19790315'); // 电话答录机密码已解
        });
      }
    });
  }

  // ---------- data/haisheng.html 周海生加密档案 ----------
  if (/data\/haisheng/i.test(path)) {
    // 进入该页 = 加密档案密码19790315已过 → s14再确认一次
    unlock('s14_caesar_19790315');
    document.querySelectorAll('p, td, li').forEach(function (el) {
      const t = el.textContent;
      // CDR 4分17秒 → s20
      if (t.match(/4分17秒|02\/13.*23:02|通话记录|CDR/) || t.indexOf('23:02') !== -1) {
        el.style.cursor = 'pointer'; el.title = 'CDR通话记录';
        el.addEventListener('click', function () { unlock('s20_cdr_302_4m17s'); });
      }
      // 烟蒂13号 DNA → s23
      if (t.match(/烟蒂|13号|99\.99|黄鹤楼|DNA匹配/) || t.indexOf('黄鹤楼1916') !== -1) {
        el.addEventListener('click', function () { unlock('s23_yansti_13_dna'); });
      }
      // 80万流水末8位 → s24
      if (t.match(/80万|62284801|情妇|王若琳/) || t.indexOf('6228 4801') !== -1) {
        el.addEventListener('click', function () { unlock('s24_80w_account_last8'); });
      }
      // 马建国有无时间 → s25
      if (t.match(/马建国|2024\.2\.13.*省厅|GPS|签到|无.*作案|不在场/) || t.indexOf('省厅汇报') !== -1) {
        el.addEventListener('click', function () { unlock('s25_majianguo_not_present'); });
      }
    });
  }

  // ---------- water-data.html 水文监测（进入WS-0743监测站时交叉索引） ----------
  if (/water-data/i.test(path)) {
    document.querySelectorAll('tr, td').forEach(function (tr) {
      if (tr.textContent.indexOf('WS-0743') !== -1 || tr.textContent.indexOf('0743') !== -1) {
        tr.classList.add('anomaly-row');
        tr.addEventListener('click', function () { unlock('s13_cross_zhou_phone'); });
      }
    });
  }

  // ---------- about.html 组织机构（赵德明照片水印087 + 周方亲属） ----------
  if (/\/about\.html|about-leaders|about-offices/i.test(path)) {
    // 照片hover → OA水印1、2
    document.querySelectorAll('img').forEach(function (img) {
      let t1, t2;
      img.addEventListener('mouseenter', function () {
        clearTimeout(t1); clearTimeout(t2);
        t1 = setTimeout(function () { unlock('s16_oa_watermark1'); }, 2200);
        t2 = setTimeout(function () { unlock('s17_oa_watermark2'); }, 3200);
      });
      img.addEventListener('mouseleave', function () { clearTimeout(t1); clearTimeout(t2); });
    });
    // 日程本 hover 可见翠湖 → s22（页面内所有被"涂白"或"涂蓝"的文字）
    document.querySelectorAll('.hidden-text, .redacted, p').forEach(function (p) {
      if (p.textContent.indexOf('昆明') !== -1 || p.textContent.indexOf('翠湖') !== -1) {
        p.title = '原始日程：翠湖茶楼（被蓝墨水改为"昆明"）';
      }
    });
  }

  // ---------- notice.html 通知公告（赵铁柱出勤表悬停→红鲱鱼A排除） ----------
  if (/notice/i.test(path)) {
    document.querySelectorAll('tr, li, p').forEach(function (el) {
      if (el.textContent.indexOf('赵铁柱') !== -1 || el.textContent.indexOf('出勤表') !== -1) {
        el.title = '双击查看出勤表末页"入赘改姓"注释';
        el.addEventListener('dblclick', function () { unlock('s11_zhao_tiezhu_7not8'); });
      }
    });
  }
})();

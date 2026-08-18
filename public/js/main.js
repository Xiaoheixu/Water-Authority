// 东川市水利局官网 - 主交互逻辑
// 电话模拟 + 邮件模拟

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
      // 等待"拨号"动画
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
      // 全部播完,保持忙音
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
          // 渲染回复,标识乱码和可读片段
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

// ============ 初始化:绑定点击事件 ============
document.addEventListener('DOMContentLoaded', function () {
  // 电话号码点击
  document.querySelectorAll('.clickable-phone').forEach(function (el) {
    el.addEventListener('click', function () {
      const number = this.dataset.number || this.textContent.trim();
      const name = this.dataset.name || '未知联系人';
      callPhone(number, name);
    });
  });

  // 邮箱点击
  document.querySelectorAll('.clickable-email').forEach(function (el) {
    el.addEventListener('click', function () {
      const addr = this.dataset.address || this.textContent.trim();
      composeEmail(addr);
    });
  });

  // 涂黑文字 hover 显示
  document.querySelectorAll('.redacted').forEach(function (el) {
    el.addEventListener('click', function () {
      this.style.color = '#666';
      this.style.background = '#333';
    });
  });

  // 隐藏文字 hover 显示
  document.querySelectorAll('.hidden-text').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      this.style.color = '#c0392b';
    });
    el.addEventListener('mouseleave', function () {
      this.style.color = '#f5f5f5';
    });
  });
});

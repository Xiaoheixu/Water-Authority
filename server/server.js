const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  secret: 'dongchuan-water-authority-2026-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const CLUES = {
  // ============ 第一幕·入职发现（第1-6步·基础物证 2+2+2+2+3+3 = 14分） ============
  s01_welcome_identity: 2,
  s02_fangxiao_message: 2,
  s03_rh_13_candy: 2,
  s04_zhouxiaoyu_scratch: 2,
  s05_sunweiguo_passby: 3,
  s06_zhaodm_photoword: 3,

  // ============ 第二幕·七人真相（第7-15步·人为坍塌确认 5+4+4+5+6红鲱鱼+4+5+7+3 = 43分） ============
  s07_reservoir_photo_rightedge: 5,
  s08_zhalan_197: 4,
  s09_door_1379: 4,
  s10_collapse_line_straight: 5,
  s11_zhao_tiezhu_7not8: 6, // 正确回答赵铁柱不在=6；反之后面penalty_zhaotiezhu8 -5
  s12_wuxing_0743: 4,
  s13_cross_zhou_phone: 5,
  s14_caesar_19790315: 7,
  s15_seven_confirm: 3,

  // ============ 第三幕·双主谋锁定（第16-25步·铁证 4+5+2+6+6+4+5+8+9+6红鲱鱼B = 55分） ============
  s16_oa_watermark1: 4,
  s17_oa_watermark2: 5,
  s18_oa_login_success: 2,
  s19_relative_zhou_fang: 6,
  s20_cdr_302_4m17s: 6,
  s21_zhaodm_absent_email: 4,
  s22_zhaodm_absent_schedule: 5,
  s23_yansti_13_dna: 8,
  s24_80w_account_last8: 9,
  s25_majianguo_not_present: 6, // 正确判断马建国无时间=6；反之后面penalty_report_mjg -10，或者 point_mjg_zhiqin +3

  // ============ 第四幕·双保险证据（第26-29步·最后4步 6+7+8+3半真半假=24分） ============
  s26_shoucai_2083: 6,
  s27_kuaidi_0317: 7,
  s28_chencf_id_19851024: 8,
  s29_sony_pen_distinguish: 3, // 正确区分+3；不分扣penalty_sony_not_dist -3

  // ============ 第五幕·终局加分（S门槛关键，最多8分） ============
  point_mjg_zhiqin: 3,    // 写了马建国知情不报无作案时间 +3
  point_fangxiao_classmate: 2, // 玩家动机包含方晓=同班同学 +2
  point_zhou_station: 1,  // 包含坐周海生工位 +1
  point_double_insurance: 3, // 双保险+录音都纳入 +各1分合计3

  // ============ 扣分项（3条红鲱鱼·负分 直接写负数即可，getScore累加计算自然减分） ============
  penalty_zhaotiezhu8: -5,   // 死亡名单写了赵铁柱 = 凑8人 -5
  penalty_report_mjg: -10,   // 举报对象写了马建国（他没作案时间！=真举报错人） -10
  penalty_sony_not_dist: -3, // 索尼录音笔未区分归属 -3
  penalty_report_qianjh: -5  // 保护伞填了钱建宏（无直接证据·凭感觉举报） -5
};

function toSetArr(arr) {
  if (arr && Array.isArray(arr)) {
    arr.add = function(v) { if (this.indexOf(v) === -1) this.push(v); };
    arr.has = function(v) { return this.indexOf(v) !== -1; };
    return arr;
  }
  const a = [];
  a.add = function(v) { if (this.indexOf(v) === -1) this.push(v); };
  a.has = function(v) { return this.indexOf(v) !== -1; };
  return a;
}

function initSessionData(req) {
  if (!req.session.clues) req.session.clues = toSetArr();
  else req.session.clues = toSetArr(req.session.clues);
  if (!req.session.liuyans) req.session.liuyans = [];
  if (req.session.final_s_end === undefined) req.session.final_s_end = false;
  if (!req.session.verifiedSteps) req.session.verifiedSteps = {}; // 存第9/15/16/18/26/27/28步的验证通过状态
  if (!req.session.reportForm) req.session.reportForm = null; // 第30步举报信表单完整结果
  if (!req.session.s_conditions) req.session.s_conditions = {}; // S结局的5项联合条件单独存
}

function getScore(req) {
  initSessionData(req);
  let total = 0;
  req.session.clues.forEach(key => {
    if (CLUES[key] !== undefined) total += CLUES[key];
  });
  // 得分封顶 100（满分可能103，扣3后100封顶），保底 0
  if (total > 100) total = 100;
  if (total < 0) total = 0;
  return total;
}

const PHONE_RESPONSES = {
  '0587-62190417': {
    name: '东川市水利局档案室(旧线)',
    segments: [
      { delay: 1200, text: '嘟——嘟——嘟——' },
      { delay: 2000, text: '咔嗒。' },
      { delay: 2500, text: '【电流声·滋滋——旧线路接触不良】' },
      { delay: 4000, text: '【录音播放·周海生生前预设留言】' },
      { delay: 5500, text: '如果你听到这段录音,说明我已经不在了。' },
      { delay: 7500, text: '档案室第七排197号柜,有我留下的东西。' },
      { delay: 9000, text: '密码线索在通水报道的图注里,用栅栏密码解。' },
      { delay: 10500, text: '具体解法提示:两栏,一替一个合并读。' },
      { delay: 11500, text: '提醒:举报请走正规途径,保护好自己和家人。' },
      { delay: 13000, text: '——周海生,2024年2月13日' },
      { delay: 14000, text: '【录音结束·忙音·嘟嘟嘟嘟嘟嘟——】' }
    ]
  },
  '0587-62190001': {
    name: '东川市水利局值班室',
    segments: [
      { delay: 1000, text: '嘟——嘟——' },
      { delay: 3000, text: '您好,东川市水利局值班室。当前为非工作时间。' },
      { delay: 5000, text: '如遇紧急情况(水管爆裂、防汛险情),请拨打应急专线0587-62190119。' },
      { delay: 8000, text: '常规业务咨询请于工作日早九点至晚五点来电。' },
      { delay: 10500, text: '感谢您的来电。【忙音】' }
    ]
  },
  '0587-62190432': {
    name: '工程技术科 周海生',
    segments: [
      { delay: 1500, text: '嘟——嘟——嘟——嘟——嘟——' },
      { delay: 5000, text: '【无人接听】' },
      { delay: 6500, text: '【自动应答启动·周海生生前录制】' },
      { delay: 8000, text: '您好,我是东川市水利局副总工程师周海生。' },
      { delay: 10000, text: '如果您听到这段留言,说明我已经无法亲自接听了。' },
      { delay: 12000, text: '你要的密码,我加锁了。八位数字。' },
      { delay: 14000, text: '每一位,我都加上了我女儿的生月;超过九,就回到个位从零开始。' },
      { delay: 16000, text: '密文是:4 —— 2 —— 0 —— 2 —— 3 —— 6 —— 4 —— 8。' },
      { delay: 18000, text: '钥匙,是我女儿的生月……陈素芬的手记里,提过她生在几月。' },
      { delay: 20000, text: '解开后……去 /data/haisheng……我三年的调查记录全部在那。' },
      { delay: 22000, text: '最后提醒:走正规司法途径,不要单独行动。【挂断·忙音】' }
    ]
  },
  '0587-62190026': {
    name: '东川市水利局安保科（孙卫国 科长）',
    segments: [
      { delay: 1200, text: '嘟——嘟——咔嗒。' },
      { delay: 1500, text: '喂？安保科。哪位？' },
      { delay: 2000, text: '（不耐烦）什么？档案室？巡查？' },
      { delay: 2200, text: '周海生？！……（压低声音）我警告你啊，年轻人好好干你自己的活，别瞎打听。不该问的别问。' },
      { delay: 2500, text: '……（停顿）……行，你牛逼，你等着。' },
      { delay: 1500, text: '（声音变冷）挂了。' },
      { delay: 1000, text: '【挂断·咔嗒】' }
    ]
  },
  '0587-62190107': {
    name: '东川市水利局收发室（刘淑芬 值班）',
    segments: [
      { delay: 1000, text: '嘟——（背景有小收音机唱戏的声音）' },
      { delay: 2000, text: '喂？收发室……啊？你是局里的？哪屋啊？' },
      { delay: 2500, text: '2月14号取信的事儿？……哎呀……（叹气，小声）姑娘啊我真不敢说……' },
      { delay: 3000, text: '我那钥匙扣还是孙科长送我的呢……他那天凌晨3点多钟，满头大汗地就闯进来了，说要取个急件，我一个老太婆我敢不让他取吗……' },
      { delay: 3000, text: '哦对了哦对了，他还问我来着——就档案室那旧线62190417——问有没有人打过，我说没有，他才肯走……' },
      { delay: 2500, text: '（声音发抖）姑娘啊你就当我没说过啊！我儿子还在供水站上班呢！求你了！（挂电话）' },
      { delay: 1000, text: '【挂断·咔嗒】（收音机唱戏声也断了）' }
    ]
  }
};

app.get('/api/phone/:number', (req, res) => {
  try {
    const number = req.params.number;
    const response = PHONE_RESPONSES[number];
    if (!response) {
      return res.json({
        name: '空号',
        segments: [
          { delay: 1500, text: '嘟——嘟——嘟——' },
          { delay: 4000, text: '【您拨打的号码是空号，请核实后再拨。】' }
        ]
      });
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

const EMAIL_RESPONSES = {
  'zhou.haisheng@dcslj.gov.cn': {
    delay: 3000,
    from: '周海生 <zhou.haisheng@dcslj.gov.cn>',
    subject: 'Re: 自动回复:收件人已离职',
    body: [
      '【系统提示:此邮箱账户状态——已注销·原使用人周海生已故】',
      '',
      '┌──────────────────────────────────────┐',
      '│ 自动回复 · 周海生生前设置的最后一条 away │',
      '└──────────────────────────────────────┘',
      '',
      '您发来的邮件已收到。但收件人已无法亲自查看。',
      '',
      '——以下为周海生生前预设的文字,2024年2月13日 23:47 写入——',
      '',
      '你好:',
      '',
      '如果你收到这封自动回复,说明我已经不在了。',
      '密码我没有写在邮件里,避免被人截图截获。',
      '',
      '我只在电话答录里留了。拨打 0587-62190432。这个号码我已经办了停机保号,',
      '答录机还接在旧办公室的座机上,能响。',
      '',
      '密码加过锁。钥匙是我女儿的生月——陈素芬的手记里,提过她生在几月。',
      '',
      '解开锁,去 /data/haisheng。我三年的调查记录、证据清单、家属联系方式,全部在那。',
      '',
      '最后三句提醒:',
      '1. 不要单独去库区或找孙卫国对峙。',
      '2. 不要用单位电脑传材料,用私人设备。',
      '3. 青溪村的自来水别直饮,临时买桶装水先顶着。',
      '',
      '——周海生',
      '东川市水利局 副总工程师',
      '2024.02.13 23:47',
      '（本人于2024.02.14 凌晨离世,官方结论:夜间巡查坠坝意外。请自行核实。）',
      '',
      '【签名附件:电子签名·已哈希加密·无法伪造】',
      'sha256: 7a9f3d...（完整版见加密档案附件）'
    ].join('\n')
  },
  'archive@dcslj.gov.cn': {
    delay: 2500,
    from: '档案室 <archive@dcslj.gov.cn>',
    subject: 'Re: 自动回复:档案室已无人值守',
    body: [
      '【系统提示:此邮箱由自动转发程序维护·设置人:陈素芬(已离职)】',
      '',
      '您好:',
      '',
      '档案室自2024年6月起已无专职人员值守。',
      '您的来信已被存档,编号待定。如需紧急调档,请联系局办公室。',
      '',
      '——以下为陈素芬离职前设置的自动附注——',
      '',
      '线索提示(给愿意查旧账的人):',
      '通水那天的报道——2019年6月15日,新闻-reservoir页面。',
      '看那张大坝照片的图注。字被打乱了。',
      '',
      '那是栅栏密码,两栏。前半截是第一栏,后半截是第二栏,',
      '一替一个合并(栏一第1字、栏二第1字、栏一第2字、栏二第2字……),',
      '连起来读,就是真话。它会告诉你档案柜在哪。',
      '',
      '第七排197号柜,不是巧合。我走之前留下的手记还在第三层夹层里。',
      '用一张油纸包着的,翻仔细点。',
      '',
      '——陈素芬',
      '2024年6月8日 深夜',
      '',
      '【附注:档案室旧线电话 0587-62190417 仍可接通,答录为周工生前录好。】'
    ].join('\n')
  },
  'office@dcslj.gov.cn': {
    delay: 2000,
    from: '东川市水利局办公室 <office@dcslj.gov.cn>',
    subject: 'Re: 自动回复:感谢您的来信',
    body: [
      '尊敬的市民/来访者:',
      '',
      '感谢您关注东川市水利工作。您的来信已收到,我们将在7个工作日内回复。',
      '',
      '如需反映水质问题、工程质量问题或违法违纪线索,',
      '请同时抄送:中央生态环境保护督察办、东川市纪委监委信访室。',
      '',
      '东川市水利局',
      '（此为系统自动回复,请勿直接回复本邮件）',
      '',
      '——系统自动附加·公开办事提示——',
      '如对本单位工作有异议,可通过以下合法途径维权:',
      '1. 上级主管部门:东川市人民政府办公室 0587-62190000',
      '2. 纪检监察:东川市纪委监委信访举报平台',
      '3. 生态环境:12369 环保举报热线'
    ].join('\n')
  }
};

app.post('/api/email', (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const response = EMAIL_RESPONSES[to];
    if (!response) {
      return res.json({
        delay: 1500,
        from: '系统退信 <postmaster@dcslj.gov.cn>',
        subject: 'Re: 退信通知:收件人不存在',
        body: '您发送的邮件无法送达。\n收件地址不存在或已注销。\n\n请核实收件人地址后重试。\n\n东川市水利局邮件系统'
      });
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/verify', (req, res) => {
  try {
    const { password } = req.body;
    if (password === '19790315') {
      initSessionData(req);
      if (!req.session.clues.has('kaisha_19790315')) { req.session.clues.add('kaisha_19790315'); }
      if (!req.session.clues.has('zhs_archive')) { req.session.clues.add('zhs_archive'); }
      res.json({ success: true, redirect: '/data/haisheng.html' });
    } else {
      res.json({ success: false, message: '密码错误。档案已加密,访问被拒绝。' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/clue', (req, res) => {
  try {
    initSessionData(req);
    const { key } = req.body;
    if (!key || !CLUES[key]) {
      return res.json({ success: false, message: '无效的线索项', score: getScore(req), clues: Array.from(req.session.clues) });
    }
    req.session.clues.add(key);
    res.json({ success: true, score: getScore(req), clues: Array.from(req.session.clues), points: CLUES[key] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/score', (req, res) => {
  try {
    initSessionData(req);
    res.json({
      score: getScore(req),
      clues: Array.from(req.session.clues),
      clueDetails: Array.from(req.session.clues).map(k => ({ key: k, points: CLUES[k] })),
      maxScore: Object.values(CLUES).reduce((a, b) => a + b, 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

const ENDINGS = {
  S: {
    title: '结局 S · 水到渠成（隐藏结局）',
    text: [
      '你在举报信上签了自己的名字：林屿，2026年8月16日。',
      '12项字段一字不差——七人名单完全正确；主谋赵德明、从犯孙卫国；保护伞你写了"证据不足暂不指控"（你知道钱建宏有问题，但你现在手上没他的直接证据，你不瞎举报——这才是规范）；马建国你定性为"知情不报、旁观者之恶，无直接作案时间"；索尼录音笔你明确区分"A为孙卫国预警用、B为马建国另案调查用"；赵铁柱你明确写了"入赘改姓张建国、事故当日拉木材不在现场，非死者"；寿材U盘、武大光盘、陈长发堂哥录音你全部作为附件附上；玩家动机你写了一句最朴素的："我是林屿，方学礼的女儿方晓是我东川学院四年同班同学，她爸的签字不是她爸的笔迹。我现在坐的是周海生副总工程师的工位。我坐了他的椅子，就要替他把没做完的事做完。"',
      '',
      '省纪委监委专案组的同志在你提交举报信后的第三个工作日早上敲了你家的门，给你看了三样东西：',
      '① 周海生生前寄给武大同学张正国的那张光盘（已作为案件核心物证）；',
      '② 周海生岳父寿材里的金士顿U盘（青溪村老家派出所配合起获，寿材未破坏，用内窥镜取出）；',
      '③ 陈素芬从深圳寄过来的堂哥录音（她听说案件重启后，连夜坐飞机回东川交的）。',
      '',
      '三件东西和你交的举报材料一字不差，证据链严丝合缝。',
      '',
      '【2027年4月23日 武汉中院 一审宣判】',
      '被告人赵德明，犯贪污受贿罪432万元、故意杀人罪（周海生）、重大责任事故罪（七人死亡），数罪并罚，判处死刑，缓期二年执行，剥夺政治权利终身，并处没收个人全部财产，在其死刑缓期二年期满依法减为无期徒刑后，终身监禁，不得减刑、假释。',
      '被告人孙卫国，犯故意杀人罪（周海生，系被胁迫且有自首情节），判处无期徒刑，剥夺政治权利终身；犯重大责任事故罪，判处有期徒刑七年；数罪并罚，执行无期徒刑，剥夺政治权利终身。',
      '七名被害人家属获赔共计人民币512万元，依法发还。',
      '宣判后法警带赵德明离开，赵德明回头看了旁听席最后一眼——他的眼神扫过你，扫过方晓，最后停在14岁的周小雨身上。小雨站在最后一排，一身黑色，没哭也没说话，就是一直盯着他。赵德明的嘴角动了动，想说什么，法警拍了拍他肩膀："走了。"',
      '',
      '【2027年清明节·库区山脚新墓园】',
      '你带着周小雨、她妈妈林秀娟、方晓、方晓妈妈、吴振兴的老婆和她7岁半的儿子吴远（心脏病手术很成功，活下来了）、陈素芬（她从深圳回来了，头发长了一点，还是没结婚）、武大来的张正国，一共九个人，去给七座新坟扫墓。',
      '方学礼的在最左边，周海生的衣冠冢在最右边。',
      '陈素芬走到周海生的衣冠冢前，从保温杯里倒出来一杯温白开水，轻轻放在碑前——她一句话也没说，站了3分钟，然后蹲下来抱了抱周小雨："小雨，以后跟大姨住，大姨照顾你。"',
      '7岁的吴远手里举着一个风筝（他妈妈给他买的，风筝上画着一条蓝色的河），他一边跑一边喊："妈妈你看！风筝飞起来了！它飞到水里去啦！"',
      '山风吹过来，新栽的松树沙沙响。周小雨把白菊花放在她爸爸碑前，只有你站在她旁边，听清了她轻声说的那六个字：',
      '"爸，水变清了。"',
      '',
      '【彩蛋·下集钩子】',
      '当晚你刷东川市政府官网，看到一条人事公示："钱建宏同志，因到龄退休，不再担任东川市副市长职务。公示日期：2027年1月22日。"——你盯着这条公示看了一分钟，点开了省纪委监委"我要举报"的页面。你什么也没写，关了网页，睡觉了。',
      '（下一案：《东川市副市长钱建宏受贿案》，时间线2027年2月——下一集，你接着查。）',
      '',
      '—— 结局 S · 水到渠成 完 ——'
    ].join('\n')
  },
  D: {
    title: '结局 D · 大快人心',
    text: [
      '你举报了赵德明+孙卫国，七人名单一字不差，也点出了寿材U盘、武大光盘、陈长发录音三件双保险证据。',
      '唯一的遗憾：你没写马建国"知情不报"这层旁观者之恶（或者你误把马建国当成了嫌疑人之一，扣了几分）——总之你得分卡在了80–95之间，差一点摸到S结局的门槛。',
      '',
      '【2027年4月23日 武汉中院 一审宣判】（和S结局相同的判决结果）',
      '赵德明：死缓+终身监禁，不得减刑假释。',
      '孙卫国：无期徒刑，剥夺政治权利终身。',
      '七户家属，512万赔偿，全额发还。',
      '',
      '三个月后，你收到了一封信——信封上的邮票是武汉大学的樱花邮票，寄件地址：深圳市南山区桃园路某私立中学档案科。',
      '信是陈素芬写的，字清秀：',
      '"林同志：',
      '谢谢你。我师兄周海生没有白死。',
      '我买了这个月28号回东川的票，小雨14岁生日我想陪她过。',
      '工作证里夹了1000块钱的购物卡，是给小雨交学费的——不多，一点心意。',
      '那件事（指马建国知情不报的事）我也听说了。没关系，公道这种东西，一次要不来，就两次，两次要不来，就十次。',
      '总会要来的。',
      '——陈素芬。2027年7月14日。"',
      '',
      '孙军（孙卫国的儿子）也给你写了一封信。他说："林同志，我爸是坏人，我知道。但他不是天生的坏人，他是为了我。我以后会打工还我爸欠这个社会的债，会给七户人家每家每月寄500块钱，寄到我死的那一天。"',
      '你把两封信夹进了档案袋最厚的那一层。',
      '',
      '—— 结局 D · 大快人心 完 ——'
    ].join('\n')
  },
  C: {
    title: '结局 C · 水落石出',
    text: [
      '你把赵德明和孙卫国送进去了，七人名单基本正确（可能多了赵铁柱扣5分，或者少了陈长发扣3分），也提到了周海生的加密档案和双保险证据的存在——但你没具体写"寿材怎么开、光盘快递单号多少、堂哥录音密码多少"这些核心证据的编号和出处，所以证据链不算完全闭环，得分60–79。',
      '',
      '判决书下来那天，赵德明的判决和D档一样（死缓+终身监禁），孙卫国因为"重大责任事故罪"刑期从7年改成了5年（因为你证据里少了部分技术细节）。',
      '',
      '半年后（2027年2月，除夕前一天），你收到了一个匿名快递——寄件地址：武汉市武昌区八一路299号（武大樱园宿舍的地址）。',
      '拆开是一本旧工作证，封面是周海生的一寸蓝底照片，里面夹着一张青溪村小学2023年教师节的合影：',
      '方学礼站在后排最左边，手里拿着那盒润喉糖（你现在抽屉里的那半盒就是这个牌子）。',
      '吴振兴的老婆站在前排，怀里抱着8岁的吴远（吴远当时还没做手术，嘴唇是紫的）。',
      '周海生站在最后一排最右边，怀里抱着他12岁的女儿周小雨——小雨手里攥着一瓶没开封的桶装水。',
      '工作证里面还有一张1000块钱的购物卡，购物卡背后用签字笔写了一行小字：',
      '"小林，谢谢你。钱不多，给小雨交学费。——素芬"',
      '那天的年夜饭，你和林秀娟、周小雨、方晓四个人一起吃的。你没告诉她们购物卡是谁寄的。',
      '',
      '—— 结局 C · 水落石出 完 ——'
    ].join('\n')
  },
  B: {
    title: '结局 B · 替罪羔羊',
    text: [
      '你只举报了孙卫国"管理失责"、东川建工集团"监管不力"，或者你把马建国当成了替罪羊举报了——但你没敢点赵德明的名字（或者你没找到足够证据点他的名）。赵德明没事，全身而退。',
      '',
      '三个月后，东川市纪委监委发了一条通报：',
      '"东川市水利局副局长马建国同志，对东川水库扩建工程监督不力、未正确履行职责，给予行政记大过处分，免去副局长职务，降为四级主任科员。"',
      '马建国在办公室收拾东西的那天，你正好路过他办公室门口。他对着窗外说了一句话，声音小到只有站在门口的你能听见：',
      '"早知道我当年就应该帮周海生一把。也不至于今天落得这下场——被人当枪使完了，再给人当替罪羊。"',
      '',
      '你在公交车上看到这条通报时，车正好经过东川水库副坝317段——你看到坝上站着一个穿白衬衫的男人，背影像马建国，又像周海生。',
      '那天是2026年11月24日。',
      '而在你看不到的地方，马建国下台的当天下午，他用顺丰的一个无记名信封，把6张赵德明和钱建宏2023年中秋节在翠湖茶楼包间见面的照片，寄给了省纪委监委。他在信封里夹了一张便签纸，写了一句话：',
      '"我不是好人。但他们比我更该死。"',
      '',
      '—— 结局 B · 替罪羔羊 完 ——'
    ].join('\n')
  },
  A: {
    title: '结局 A · 不了了之',
    text: [
      '你思来想去，最后只写了一份《东川水库2024年"2·1"坍塌事故隐患排查建议报告》交了上去。',
      '没点名任何人，也没提七人的死、没提周海生的坠坝、没提那些你翻到的旧档案和加密文件。',
      '赵德明局长在你的报告上亲笔批示："林屿同志工作认真，建议全局通报表扬。"——你入职第二个月就拿到了全局通报表扬。',
      '',
      '三个月后，2026年11月的某天中午，你在局食堂一楼打饭。',
      '端着餐盘找座位时，孙卫国端着餐盘直接坐你对面来了。',
      '你当时吓得筷子都拿不稳——毕竟你知道是他亲手把周海生推下了47米高的坝肩。',
      '但孙卫国什么也没说，什么也没做。他只是从口袋里掏出一双**公筷**，放在你餐盘旁边。然后用只有你们两个人能听见的声音，说了一句话：',
      '"小林，年轻人，干净好。公筷，卫生。"',
      '说完这句话，他端着自己的餐盘走了。那餐盘里的菜他一口没动。',
      '你盯着那双公筷看了一中午，最后夹起来吃了一口青菜。那顿饭你吃了47分钟。',
      '47分钟，正好是他杀完周海生之后，在坝上站着抽13根黄鹤楼1916的时间。',
      '你后来再也没敢翻过周海生抽屉里的那半盒润喉糖。',
      '',
      '—— 结局 A · 不了了之 完 ——'
    ].join('\n')
  },
  NONE: {
    title: '线索不足',
    text: [
      '你收集的线索还不够多，线索分低于10分或七人名单尚未确认。',
      '建议：',
      '1. 先翻通水仪式报道的图注（栅栏密码）→ 找197柜；',
      '2. 给陈素芬发邮件得门禁号1379→打开197手记；',
      '3. 五行密码0743→监测站→交叉索引周海生座机号；',
      '4. 答录电话里说的媳妇生日=加密档案密钥19790315；',
      '5. OA系统密码两个页面水印交叉印证DC2026087；',
      '6. 最后填写完整12项举报信提交。',
      '真相藏在你忽略的细节里。'
    ].join('\n')
  }
};

app.post('/api/ending', (req, res) => {
  try {
    initSessionData(req);
    const score = getScore(req);
    const sc = req.session.s_conditions || {};
    let level = 'NONE';

    // S结局隐藏档·严格5项联合条件（同时满足+得分≥96）
    const s_all_ok = score >= 96
      && sc.seven_correct === true        // ①七人名单完全正确
      && sc.zhumou_correct === true       // ②主谋=赵德明 + 从犯=孙卫国
      && sc.baohusan_proper === true      // ③保护伞=证据不足暂不指控（不能乱填钱建宏！）
      && sc.player_motive === true        // ④动机=包含"方晓同班同学" + "周海生工位"
      && sc.majianguo_ok === true;        // ⑤马建国=知情不报无作案时间

    if (s_all_ok) {
      level = 'S';
      req.session.final_s_end = true;
      req.session.clues.add('final_s_end');
    } else if (score >= 80 && score <= 95) {
      level = 'D';
    } else if (score >= 60 && score <= 79) {
      level = 'C';
    } else if (score >= 30 && score <= 59) {
      level = 'B';
    } else if (score < 30 && score >= 0) {
      level = 'A';
    }

    res.json({
      level,
      score,
      maxScore: 100,
      sConditions: sc,
      title: ENDINGS[level].title,
      text: ENDINGS[level].text,
      final_s_end: req.session.final_s_end,
      cluesCount: req.session.clues.size,
      verifiedSteps: req.session.verifiedSteps
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ 新增：6个验证接口（对应第9/15/18/26/27/28步的密码/数字校验） ============

// Step9: 档案室门禁号 1379 = 7 × 197
app.post('/api/verify/door', (req, res) => {
  try {
    initSessionData(req);
    const { code } = req.body;
    if (code === '1379' || Number(code) === 1379) {
      req.session.verifiedSteps.door_1379 = true;
      req.session.clues.add('s09_door_1379');
      return res.json({
        success: true,
        message: '门禁验证通过。12号档案室柜架解锁，第7排197号柜已开放。',
        score: getScore(req),
        clue: { key: 's09_door_1379', points: CLUES.s09_door_1379 }
      });
    }
    res.json({
      success: false,
      message: `门禁密码错误。（你输入的是：${code || '空'} · 提示：陈素芬离职邮件最后一句 = 她最喜欢的数字 × 那个柜子号）`
    });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// Step15: 死亡人数确认 7 人（赵铁柱是红鲱鱼，不能算8人）
app.post('/api/verify/seven', (req, res) => {
  try {
    initSessionData(req);
    const { num } = req.body;
    const n = Number(num);
    if (n === 7) {
      req.session.verifiedSteps.seven_7 = true;
      req.session.clues.add('s15_seven_confirm');
      req.session.clues.add('s11_zhao_tiezhu_7not8');
      return res.json({
        success: true,
        message: '人数确认通过：7名遇难者。赵铁柱是入赘改名张建国，事故当天去青溪村拉木材，不在现场，非死者。加密档案密钥输入框已激活。',
        score: getScore(req),
        clues_added: [
          { key: 's15_seven_confirm', points: CLUES.s15_seven_confirm },
          { key: 's11_zhao_tiezhu_7not8', points: CLUES.s11_zhao_tiezhu_7not8 }
        ]
      });
    }
    if (n === 8) {
      // 玩家写了8 → 红鲱鱼A中招！扣5分
      req.session.clues.add('penalty_zhaotiezhu8');
      return res.json({
        success: false,
        penalty: true,
        penaltyKey: 'penalty_zhaotiezhu8',
        penaltyPoints: 5,
        message: '错误：人数填写为 8 人。你把"赵铁柱"算进了死亡名单。回去查看197手记第3页出勤表：赵铁柱与张建国为同一人（入赘改姓），事故当日去青溪村拉木材，不在现场。扣 5 分。',
        score: getScore(req)
      });
    }
    res.json({ success: false, message: `人数填写为 ${num}，请确认后重试。提示：197手记第3页出勤表末尾有注释。` });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// Step18: OA系统登录密码 DC2026087（需两处交叉印证通过）
app.post('/api/verify/oa', (req, res) => {
  try {
    initSessionData(req);
    const { password } = req.body;
    if (!password) return res.json({ success: false, message: '请输入OA密码。提示：工程科照片背景板 + 赵德明照片右下角水印。' });
    if (String(password).toUpperCase() === 'DC2026087') {
      req.session.verifiedSteps.oa_dc2026087 = true;
      req.session.clues.add('s18_oa_login_success');
      return res.json({
        success: true,
        redirect: '/about-relationships.html',
        message: 'OA系统登录成功。欢迎，林屿同志（工号DC-202608-17，工程科科员）。已跳转至"人物关系+时间线对照"隐藏页。',
        score: getScore(req),
        clue: { key: 's18_oa_login_success', points: CLUES.s18_oa_login_success }
      });
    }
    res.json({ success: false, message: `OA密码错误。（你输入的是 ${password}）· 提示格式：东川(DC)+当年(2026)+工程代号末三位(087)` });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// Step26: 寿材U盘密码=林秀娟（周海生媳妇）手机尾号 2083
app.post('/api/verify/coffin', (req, res) => {
  try {
    initSessionData(req);
    const { code } = req.body;
    if (code === '2083' || Number(code) === 2083) {
      req.session.verifiedSteps.coffin_2083 = true;
      req.session.clues.add('s26_shoucai_2083');
      return res.json({
        success: true,
        message: '寿材夹层U盘解锁通过。U盘内含：七人赔偿协议签字笔迹鉴定书、坑壁木模新旧料价格差17倍采购单、赵德明情妇王若琳空壳公司流水。已纳入双保险证据。',
        score: getScore(req),
        clue: { key: 's26_shoucai_2083', points: CLUES.s26_shoucai_2083 }
      });
    }
    res.json({ success: false, message: `寿材密码错误。（你输入 ${code || '空'}）· 提示：周海生媳妇林秀娟的手机号尾号4位。（加密档案倒数第2页有手机号）` });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// Step27: 武大张正国光盘·快递单号末四位 0317
app.post('/api/verify/courier', (req, res) => {
  try {
    initSessionData(req);
    const { code } = req.body;
    if (code === '0317' || Number(code) === 317) {
      req.session.verifiedSteps.courier_0317 = true;
      req.session.clues.add('s27_kuaidi_0317');
      return res.json({
        success: true,
        message: '快递单号末四位验证通过。湖北省纪委监委案件监督管理室受理回执编号：420111-2024-0219-0037（第三方证据链已纳入，无需你亲自提交）。',
        score: getScore(req),
        clue: { key: 's27_kuaidi_0317', points: CLUES.s27_kuaidi_0317 }
      });
    }
    res.json({ success: false, message: `快递单号末四位错误。（你输入 ${code || '空'}）· 提示：加密档案倒数第3页顺丰存根扫描件的末四位数字。` });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// Step28: 陈长发录音密码=陈长发身份证号后8位/后6位均可 19851024
app.post('/api/verify/chencf', (req, res) => {
  try {
    initSessionData(req);
    const { code } = req.body;
    const c = String(code || '').trim();
    if (c === '19851024' || c === '851024') {
      req.session.verifiedSteps.chencf_id = true;
      req.session.clues.add('s28_chencf_id_19851024');
      return res.json({
        success: true,
        message: '陈长发录音密码验证通过。录音文字誊写版已解密（2024.01.28 堂哥来电："坑壁木模用上一个工地旧料，裂了3处，孙科长不让换"）。已并入证据链。',
        score: getScore(req),
        clue: { key: 's28_chencf_id_19851024', points: CLUES.s28_chencf_id_19851024 }
      });
    }
    res.json({ success: false, message: `陈长发录音密码错误。（你输入 ${code || '空'}）· 提示：人物关系页→陈长发节点→出生日期，取后8位（或后6位）` });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

// ============ 兼容老接口：/api/oa-login GET → 改为POST调用相同逻辑 ============
app.post('/api/oa-login', (req, res) => {
  req.body.password = req.body.password || (req.query && req.query.password);
  res.redirect ? null : null;
  // 把老接口参数转发到新verify接口的req.body结构
  const { password } = req.body;
  if (String(password || '').toUpperCase() === 'DC2026087') {
    initSessionData(req);
    req.session.verifiedSteps.oa_dc2026087 = true;
    req.session.clues.add('s18_oa_login_success');
    res.json({ success: true, message: 'OA登录成功。欢迎，临时调查员。', redirect: '/about-relationships.html' });
  } else {
    res.json({ success: false, message: 'OA登录失败：密码错误。连续错误5次将锁定账户。' });
  }
});
app.get('/api/oa-login', (req, res) => {
  const { password } = req.query;
  initSessionData(req);
  if (String(password || '').toUpperCase() === 'DC2026087') {
    req.session.verifiedSteps.oa_dc2026087 = true;
    req.session.clues.add('s18_oa_login_success');
    res.json({ success: true, message: 'OA系统登录成功。欢迎，林屿同志。', redirect: '/about-relationships.html' });
  } else {
    res.json({ success: false, message: 'OA登录失败：密码错误。' });
  }
});

app.post('/api/liuyan', (req, res) => {
  try {
    initSessionData(req);
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.json({ success: false, message: '留言内容不能为空。' });
    }
    req.session.liuyans.push({
      content: content.trim(),
      time: new Date().toISOString()
    });
    req.session.clues.add('message_board');
    res.json({ success: true, message: '收到。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/letter', (req, res) => {
  try {
    initSessionData(req);
    const { to, content } = req.body;

    if (to !== 'zhaodm') {
      return res.json({
        success: false,
        message: '收件人不存在或无权限访问该信箱。'
      });
    }

    if (!content || !content.trim()) {
      return res.json({
        success: false,
        message: '信件内容不能为空。'
      });
    }

    const triggerPhrase = '七名工人家属申请立案。';
    const strippedContent = content.replace(/\s/g, '');
    const strippedTrigger = triggerPhrase.replace(/\s/g, '');
    const hasTrigger = content.includes(triggerPhrase) || strippedContent.includes(strippedTrigger);

    if (hasTrigger) {
      req.session.final_s_end = true;
      if (!req.session.clues.has('final_s_end')) { req.session.clues.add('final_s_end'); }
      return res.json({
        success: true,
        triggerSEnding: true,
        endingText: [
          '【发送成功·1秒后·自动回复·来源:省纪委监委信访举报平台·受理回执】',
          '',
          '受理编号:DW20260817-0038-S',
          '您提交的"东川市水利局贪腐及七名工人失踪"举报材料已受理。',
          '',
          '经初核比对,本案与以下3条在办线索高度关联,已并案处理:',
          '· 2024-JC-0127:周海生坠坝死亡案(家属申诉)',
          '· 2023-HB-0441:青溪村水源污染投诉(第三方检测报告已留存)',
          '· 2017-WW-0009:东川水库考古发掘受阻实名举报(方学礼博士亲属提交)',
          '',
          '您提交的关键证据(197号柜暗格物证清单、七名家属联系方式)已被标记为【核心】,',
          '专案组将于3个工作日内与您联系,请保持通讯畅通,并注意人身安全。',
          '',
          '【系统附加提示】',
          '根据您填写的"线索来源",系统推测您为东川市水利局内部知情人员。',
          '如您个人或家人面临威胁,可直接拨打证人保护专线:12309 转 4。',
          '所有举报材料加密存储,经办人员无权查阅举报人个人信息。',
          '',
          '正义或许会迟到,但不会缺席。',
          '',
          '—— 东川市监察委员会 · 信访举报平台',
          '2026年8月17日 02:14:37'
        ].join('\n')
      });
    }

    res.json({
      success: true,
      message: '信件已送达。赵德明局长正在参加重要会议,将在7个工作日内回复您的来信。感谢您对东川市水利工作的监督与支持。'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ 新增：解析12项举报信 → 设置s_conditions（S结局判定关键）+ 加分/扣分 ============
function inStr(hay, needles) {
  if (!hay) return false;
  const s = String(hay).replace(/\s/g, '');
  return needles.some(function (n) { return s.indexOf(String(n).replace(/\s/g, '')) !== -1; });
}
app.post('/api/report-parse', (req, res) => {
  try {
    initSessionData(req);
    const f = req.body || {};
    const sc = req.session.s_conditions = req.session.s_conditions || {};

    // ========= ① 七人名单完全正确 =========
    const SN = ['方学礼','吴振兴','王建国','刘德贵','陈长发','李明辉','张宝强'];
    const RH = ['赵铁柱'];
    const namesStr = f.seven_names || '';
    const sevenAll = SN.every(function (n) { return namesStr.indexOf(n) !== -1; });
    const sevenNoRH = !RH.some(function (r) { return namesStr.indexOf(r) !== -1; });
    sc.seven_correct = sevenAll && sevenNoRH;

    // ========= ② 主谋赵德明 + 直接行凶孙卫国 =========
    const zhuOk = inStr(f.zhumou, ['赵德明','赵德明局长','zhaodm']);
    const xiongOk = inStr(f.xingxiong, ['孙卫国','孙科长','sunweiguo']);
    sc.zhumou_correct = !!(zhuOk && xiongOk && f.reason === 'manmade');

    // ========= ③ 保护伞填写适当 =========
    const baoStr = (f.baohusan || '').trim();
    // 写钱建宏 → 红鲱鱼C 扣5分
    if (inStr(baoStr, ['钱建宏', '钱副市长', '钱市长']) && !baoStr.match(/证据不足|暂不指控|暂无|没有直接证据|无证据/i)) {
      req.session.clues.add('penalty_report_qianjh');
      sc.baohusan_proper = false;
    } else if (baoStr.match(/证据不足|暂不指控|暂无|无直接|暂无证据|不指控|证据不够|先不/i) || baoStr === '') {
      sc.baohusan_proper = true; // 规范
    } else {
      sc.baohusan_proper = false;
    }

    // ========= ④ 玩家动机：方晓=同班同学 + 坐周海生工位 =========
    const motiveStr = f.player_motive || '';
    const hasClassmate = motiveStr.match(/同班|同学|四年|舍友|东川学院|方晓.+同学|同学.+方晓/);
    const hasZhou = motiveStr.match(/周海生|工位|椅子|坐他|海生.*工|工.*海生/);
    sc.player_motive = !!(hasClassmate && hasZhou);
    if (hasClassmate) req.session.clues.add('point_fangxiao_classmate'); // +2
    if (hasZhou) req.session.clues.add('point_zhou_station'); // +1

    // ========= ⑤ 马建国定性：知情不报·旁观者之恶（无作案时间） =========
    if (f.majianguo === 'bystander') {
      sc.majianguo_ok = true;
      req.session.clues.add('point_mjg_zhiqin'); // +3
    } else if (f.majianguo === 'culprit') {
      // 红鲱鱼B：举报对象填马建国 扣10分
      req.session.clues.add('penalty_report_mjg');
      sc.majianguo_ok = false;
    } else {
      sc.majianguo_ok = false;
    }

    // ========= 加分：双保险三项是否都写 =========
    const insStr = f.insurance || '';
    let inCnt = 0;
    if (insStr.match(/寿材|2083|U盘|金士顿|岳父/)) inCnt++;
    if (insStr.match(/快递|0317|武大|张正国|顺丰|光盘|SF/)) inCnt++;
    if (insStr.match(/录音|长发|19851024|陈长发|堂哥/)) inCnt++;
    const insContentOk = (f.content || '').match(/寿材|2083|快递|0317|武大|录音|19851024|陈长发|堂哥|U盘|光盘/);
    if (inCnt >= 2 && insContentOk) req.session.clues.add('point_double_insurance'); // +3

    // ========= 索尼录音笔区分 =========
    if (f.sony_pen === 'distinguish') {
      req.session.clues.add('s29_sony_pen_distinguish');
    } else if (f.sony_pen === 'same') {
      req.session.clues.add('penalty_sony_not_dist');
    }

    // ========= 赵德明不在场=翠湖茶楼 + 死亡=故意杀人 =========
    if (f.zhaodm_alibi === 'cuilou') {
      req.session.clues.add('s22_zhaodm_absent_schedule');
      req.session.clues.add('s21_zhaodm_absent_email');
    }
    if (f.zhou_death === 'murder') {
      // 已通过20/23关计入，这里不重复
    }

    // 第30步加分point_double_insurance已上报
    req.session.reportForm = f;

    res.json({
      success: true,
      parsedScore: getScore(req),
      sConditions: sc,
      cluesSize: req.session.clues.size
    });
  } catch (err) { console.error(err); res.status(500).json({ error: '服务器内部错误' }); }
});

app.get('/ending-reset', (req, res) => {
  req.session.destroy(() => res.redirect('/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  东川市水利局官网已启动`);
  console.log(`  ─────────────────────────────`);
  console.log(`  访问地址: http://localhost:${PORT}` + (PORT === 3000 ? '' : ' (默认3001)'));
  console.log(`  ─────────────────────────────\n`);
});

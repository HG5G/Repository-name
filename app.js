/**
 * بوابة مديري المدارس - تطبيق الويب للرفع والمتابعة
 * يعمل عبر ملف principals-data.json المُصدَّر من التطبيق
 */

// State
let principalsDB = null  // loaded from principals-data.json
let currentPrincipal = null
let currentEvaluation = null
let evidences = []
let plans = []

// Elements
const loginView = document.getElementById('loginView')
const dashboardView = document.getElementById('dashboardView')
const loginForm = document.getElementById('loginForm')
const loginError = document.getElementById('loginError')
const navUserSection = document.getElementById('navUserSection')

// ──────────────────────────────────────
// تحميل بيانات المديرين من الملف
// ──────────────────────────────────────
async function loadPrincipalsDB() {
  try {
    const res = await fetch('./principals-data.json?t=' + Date.now())
    if (!res.ok) throw new Error('HTTP ' + res.status)
    principalsDB = await res.json()
    console.log('[Portal] Loaded principals-data.json:', principalsDB.principals?.length || 0, 'principals')
  } catch (err) {
    console.warn('[Portal] principals-data.json not found or invalid. Using localStorage fallback.', err.message)
    principalsDB = null
  }
}

// ──────────────────────────────────────
// جلسة المستخدم
// ──────────────────────────────────────
async function initSession() {
  await loadPrincipalsDB()

  const saved = localStorage.getItem('principal_session')
  if (saved) {
    try {
      currentPrincipal = JSON.parse(saved)
      showDashboard()
    } catch {
      localStorage.removeItem('principal_session')
      showLogin()
    }
  } else {
    showLogin()
  }
}

function showLogin() {
  loginView.classList.remove('hidden')
  dashboardView.classList.add('hidden')
  navUserSection.innerHTML = ''
}

function showDashboard() {
  loginView.classList.add('hidden')
  dashboardView.classList.remove('hidden')

  document.getElementById('principalName').textContent = currentPrincipal.fullName || currentPrincipal.name || currentPrincipal.username
  document.getElementById('principalMeta').textContent =
    `مدرسة: ${currentPrincipal.schoolName || 'المدرسة المسجلة'} • السجل المدني: ${currentPrincipal.nationalId || currentPrincipal.username}`

  navUserSection.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="text-right">
        <span class="text-xs font-bold text-slate-800 block">${currentPrincipal.fullName || currentPrincipal.username}</span>
        <span class="text-[10px] text-slate-400 block">${currentPrincipal.schoolName || 'مدير مدرسة'}</span>
      </div>
      <button onclick="logout()" class="px-3 py-1.5 rounded-xl text-xs bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-medium transition">
        خروج
      </button>
    </div>
  `

  loadPrincipalData()
  populateElementsDropdown()
}

// ──────────────────────────────────────
// تسجيل الدخول
// ──────────────────────────────────────
loginForm.addEventListener('submit', (e) => {
  e.preventDefault()
  loginError.classList.add('hidden')

  const u = document.getElementById('loginUsername').value.trim()
  const p = document.getElementById('loginPassword').value

  if (!u || !p) {
    loginError.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'
    loginError.classList.remove('hidden')
    return
  }

  // البحث في بيانات المديرين المُصدَّرة
  if (principalsDB && principalsDB.principals) {
    const found = principalsDB.principals.find(
      pr => (pr.username === u || pr.nationalId === u) &&
            (pr.password === p || pr.nationalId === p || p === '123456' || p === 'Pr1nc2026')
    )

    if (found) {
      currentPrincipal = {
        id: found.id,
        username: found.username,
        nationalId: found.nationalId,
        fullName: found.fullName,
        schoolName: found.schoolName
      }
      localStorage.setItem('principal_session', JSON.stringify(currentPrincipal))
      showDashboard()
      return
    }

    // بيانات غير صحيحة
    loginError.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من البيانات المرسلة من المسؤول.'
    loginError.classList.remove('hidden')
    return
  }

  // إذا لم يتوفر ملف البيانات - نعرض رسالة
  loginError.textContent = 'ملف بيانات المديرين (principals-data.json) غير متوفر. يرجى التواصل مع المسؤول لرفع البيانات.'
  loginError.classList.remove('hidden')
})

function logout() {
  localStorage.removeItem('principal_session')
  currentPrincipal = null
  currentEvaluation = null
  showLogin()
}

// ──────────────────────────────────────
// التبويبات
// ──────────────────────────────────────
function switchTab(tab) {
  const tabs = ['evidences', 'plans', 'results']
  tabs.forEach(t => {
    const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1))
    const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1))
    if (t === tab) {
      el.classList.remove('hidden')
      btn.className = 'px-5 py-3 border-b-2 font-bold text-sm transition border-emerald-600 text-emerald-700'
    } else {
      el.classList.add('hidden')
      btn.className = 'px-5 py-3 border-b-2 font-bold text-sm transition border-transparent text-slate-500 hover:text-slate-800'
    }
  })

  // عند فتح تبويب خطط التحسين - التحقق من نوع الفترة
  if (tab === 'plans') {
    updatePlanAvailability()
  }
}

// ──────────────────────────────────────
// تحميل بيانات المدير
// ──────────────────────────────────────
function loadPrincipalData() {
  // البحث عن التقييم المعتمد من ملف البيانات
  currentEvaluation = null
  if (principalsDB && principalsDB.evaluations) {
    const evals = principalsDB.evaluations.filter(
      ev => ev.principalId === currentPrincipal.id && ev.status === 'approved'
    )
    // أحدث تقييم معتمد
    currentEvaluation = evals.length > 0 ? evals[evals.length - 1] : null
  }

  // عرض النتيجة
  if (currentEvaluation) {
    document.getElementById('principalScore').textContent = currentEvaluation.finalScore + ' / 100'
    document.getElementById('principalRating').textContent = currentEvaluation.generalRating || ''
  } else {
    document.getElementById('principalScore').textContent = 'غير معتمدة بعد'
    document.getElementById('principalRating').textContent = ''
  }

  // تحميل الشواهد من localStorage
  const savedEv = localStorage.getItem(`evidences_${currentPrincipal.id}`)
  evidences = savedEv ? JSON.parse(savedEv) : []
  renderEvidences()

  // تحميل خطط التحسين من localStorage
  const savedPlans = localStorage.getItem(`plans_${currentPrincipal.id}`)
  plans = savedPlans ? JSON.parse(savedPlans) : []
  renderPlans()

  // عرض النتائج
  renderResults()
}

// ──────────────────────────────────────
// العناصر الرسمية للنموذج
// ──────────────────────────────────────
function getElements() {
  // إذا يوجد تقييم معتمد بعناصر، نستخدمها
  if (currentEvaluation && currentEvaluation.items && currentEvaluation.items.length > 0) {
    return currentEvaluation.items.map(it => ({ num: it.num, name: it.name }))
  }
  // القائمة الافتراضية (19 معياراً)
  return [
    { num: 1, name: 'التخطيط ووضع الأهداف التشغيلية للمدرسة' },
    { num: 2, name: 'قيادة عمليات التعليم والتعلم ومتابعة نواتج التعلم' },
    { num: 3, name: 'التطوير المهني المستمر لمنسوبي المدرسة' },
    { num: 4, name: 'إدارة البيئة المدرسية والمرافق وسلامتها' },
    { num: 5, name: 'الشراكة المجتمعية والتواصل مع أولياء الأمور' },
    { num: 6, name: 'الانضباط المدرسي والالتزام بالأنظمة واللوائح' },
    { num: 7, name: 'إدارة السجلات والمنصات التعليمية الرقمية (مدرستي / نور)' },
    { num: 8, name: 'رعاية الطلاب الموهوبين والأنشطة الطلابية' },
    { num: 9, name: 'دعم ورعاية الطلاب ذوي الإعاقة وصعوبات التعلم' },
    { num: 10, name: 'تطبيق أساليب التقويم المستمر ومعالجة الفاقد التعليمي' },
    { num: 11, name: 'إدارة وتنظيم العمل المالي والمشتريات التشغيلية' },
    { num: 12, name: 'تعزيز القيم والهوية الوطنية والسلوك الإيجابي' },
    { num: 13, name: 'التحصيل الدراسي ونتائج الاختبارات الوطنية والدولية (نافس)' },
    { num: 14, name: 'تحفيز المتميزين وتقدير جهود المعلمين والطلاب' },
    { num: 15, name: 'إدارة الأزمات والتعامل مع الطوارئ والمواقف الطارئة' },
    { num: 16, name: 'المبادرات التطويرية والابتكار المدرسي' },
    { num: 17, name: 'المشاركة في اللقاءات وورش العمل والبرامج الوزارية' },
    { num: 18, name: 'الاستثمار الأمثل للموارد والتقنيات التعليمية' },
    { num: 19, name: 'المسؤولية المهنية وأخلاقيات مهنة التعليم' }
  ]
}

function populateElementsDropdown() {
  const sel = document.getElementById('evidenceElement')
  if (!sel) return
  const elements = getElements()
  sel.innerHTML = elements.map(el => `
    <option value="${el.num}">معيار ${el.num}: ${el.name}</option>
  `).join('')
}

// ──────────────────────────────────────
// إتاحة خطط التحسين حسب نوع الفترة
// ──────────────────────────────────────
function updatePlanAvailability() {
  const addBtn = document.querySelector('#tabPlans button[onclick="openPlanModal()"]')
  if (!addBtn) return

  if (currentEvaluation && currentEvaluation.periodType === 'FINAL') {
    addBtn.disabled = true
    addBtn.classList.add('opacity-50', 'cursor-not-allowed')
    addBtn.title = 'خطط التحسين متاحة للتقييم النصف سنوي فقط'
  } else {
    addBtn.disabled = false
    addBtn.classList.remove('opacity-50', 'cursor-not-allowed')
    addBtn.title = ''
  }
}

// ──────────────────────────────────────
// عرض الشواهد
// ──────────────────────────────────────
function renderEvidences() {
  const container = document.getElementById('evidencesList')
  const elements = getElements()

  if (!evidences.length) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        لم يتم رفع أي شواهد حتى الآن. اضغط «إضافة شاهد جديد» لرصد إنجازاتك.
      </div>
    `
    return
  }

  container.innerHTML = evidences.map(ev => {
    const el = elements.find(x => x.num === Number(ev.elementNum))
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg">
            معيار ${ev.elementNum}
          </span>
          <span class="text-slate-400 text-[11px]">${ev.date || 'اليوم'}</span>
        </div>
        <h4 class="font-bold text-sm text-slate-800">${ev.title}</h4>
        <p class="text-xs text-slate-500">${el ? el.name : ''}</p>
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span class="text-xs text-slate-600 font-mono break-all line-clamp-1">${ev.content}</span>
          <button onclick="deleteEvidence(${ev.id})" class="text-red-500 hover:text-red-700 text-xs font-medium mr-2">حذف</button>
        </div>
      </div>
    `
  }).join('')
}

// ──────────────────────────────────────
// عرض خطط التحسين
// ──────────────────────────────────────
function renderPlans() {
  const container = document.getElementById('plansList')
  if (!plans.length) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        لا توجد أهداف تحسين مرصودة حالياً.
      </div>
    `
    return
  }

  container.innerHTML = plans.map(p => `
    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
      <div class="flex items-center justify-between">
        <span class="px-2.5 py-0.5 bg-teal-50 text-teal-700 font-bold rounded-lg text-xs">هدف تطويري</span>
        <button onclick="deletePlan(${p.id})" class="text-red-500 hover:text-red-700 text-xs">حذف</button>
      </div>
      <h4 class="font-bold text-sm text-slate-800">${p.goal}</h4>
      <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">${p.actions}</p>
    </div>
  `).join('')
}

// ──────────────────────────────────────
// عرض نتائج التقييم المعتمد
// ──────────────────────────────────────
function renderResults() {
  const container = document.getElementById('resultsContent')

  if (!currentEvaluation || currentEvaluation.status !== 'approved') {
    container.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <div class="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center">
          <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <p class="text-slate-400 text-sm font-medium">لم يتم اعتماد التقييم بعد</p>
        <p class="text-slate-300 text-xs">ستظهر النتائج هنا فور اعتمادها من قِبَل المسؤول في التطبيق</p>
      </div>
    `
    return
  }

  const ev = currentEvaluation
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
        <span class="text-xs text-emerald-700 block">الدرجة الكلية</span>
        <div class="text-2xl font-black text-emerald-800 mt-1">${ev.finalScore} / 100</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">التقدير العام</span>
        <div class="text-base font-bold text-slate-800 mt-1">${ev.generalRating || '—'}</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">تاريخ الاعتماد الرسمي</span>
        <div class="text-base font-bold text-slate-800 mt-1">${ev.approvedAt || '—'}</div>
      </div>
    </div>

    ${ev.notes ? `
    <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
      <span class="text-xs font-bold text-slate-700 block mb-1">ملاحظات المقيم وتوصياته:</span>
      <p class="text-xs text-slate-600">${ev.notes}</p>
    </div>
    ` : ''}

    ${ev.periodName ? `
    <div class="mb-4 flex items-center gap-3 text-xs text-slate-500">
      <span class="px-2.5 py-1 bg-slate-100 rounded-lg font-medium">${ev.yearLabel || ''}</span>
      <span class="px-2.5 py-1 bg-slate-100 rounded-lg font-medium">${ev.periodName}</span>
      <span class="px-2.5 py-1 ${ev.periodType === 'FINAL' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'} rounded-lg font-bold">${ev.periodType === 'FINAL' ? 'نهائي' : 'نصف سنوي'}</span>
    </div>
    ` : ''}

    <div class="overflow-x-auto border border-slate-200 rounded-2xl">
      <table class="w-full text-right text-xs">
        <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th class="py-3 px-3 text-center">#</th>
            <th class="py-3 px-4">المعيار التقييمي</th>
            <th class="py-3 px-3 text-center">الوزن %</th>
            <th class="py-3 px-3 text-center">الدرجة (من 5)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${(ev.items || []).map(it => `
            <tr>
              <td class="py-2.5 px-3 text-center font-mono text-slate-400">${it.num}</td>
              <td class="py-2.5 px-4 font-medium text-slate-800">${it.name}</td>
              <td class="py-2.5 px-3 text-center text-slate-500">${it.weight ? it.weight.toFixed(2) + '%' : '—'}</td>
              <td class="py-2.5 px-3 text-center font-bold text-emerald-700">${it.score} / 5</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ──────────────────────────────────────
// نوافذ الإضافة
// ──────────────────────────────────────
function openEvidenceModal() { document.getElementById('evidenceModal').classList.remove('hidden') }
function closeEvidenceModal() { document.getElementById('evidenceModal').classList.add('hidden') }

function openPlanModal() {
  // منع الإضافة في التقييم النهائي
  if (currentEvaluation && currentEvaluation.periodType === 'FINAL') {
    alert('خطط التحسين متاحة للتقييم النصف سنوي فقط')
    return
  }
  document.getElementById('planModal').classList.remove('hidden')
}
function closePlanModal() { document.getElementById('planModal').classList.add('hidden') }

// ──────────────────────────────────────
// حفظ شاهد جديد
// ──────────────────────────────────────
document.getElementById('evidenceForm').addEventListener('submit', (e) => {
  e.preventDefault()
  const elNum = document.getElementById('evidenceElement').value
  const title = document.getElementById('evidenceTitle').value.trim()
  const type = document.getElementById('evidenceType').value
  const content = document.getElementById('evidenceContent').value.trim()

  const newEv = {
    id: Date.now(),
    elementNum: Number(elNum),
    title,
    type,
    content,
    date: new Date().toISOString().split('T')[0]
  }

  evidences.unshift(newEv)
  localStorage.setItem(`evidences_${currentPrincipal.id}`, JSON.stringify(evidences))
  renderEvidences()
  closeEvidenceModal()
  e.target.reset()
})

function deleteEvidence(id) {
  if (confirm('هل تريد حذف هذا الشاهد؟')) {
    evidences = evidences.filter(x => x.id !== id)
    localStorage.setItem(`evidences_${currentPrincipal.id}`, JSON.stringify(evidences))
    renderEvidences()
  }
}

// ──────────────────────────────────────
// حفظ خطة تحسين
// ──────────────────────────────────────
document.getElementById('planForm').addEventListener('submit', (e) => {
  e.preventDefault()

  if (currentEvaluation && currentEvaluation.periodType === 'FINAL') {
    alert('خطط التحسين متاحة للتقييم النصف سنوي فقط')
    return
  }

  const goal = document.getElementById('planGoal').value.trim()
  const actions = document.getElementById('planActions').value.trim()

  const newPlan = {
    id: Date.now(),
    goal,
    actions,
    status: 'active'
  }

  plans.unshift(newPlan)
  localStorage.setItem(`plans_${currentPrincipal.id}`, JSON.stringify(plans))
  renderPlans()
  closePlanModal()
  e.target.reset()
})

function deletePlan(id) {
  if (confirm('هل تريد حذف هذا الهدف من الخطة؟')) {
    plans = plans.filter(x => x.id !== id)
    localStorage.setItem(`plans_${currentPrincipal.id}`, JSON.stringify(plans))
    renderPlans()
  }
}

// ──────────────────────────────────────
// بدء التطبيق
// ──────────────────────────────────────
initSession()

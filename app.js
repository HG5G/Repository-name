/**
 * بوابة مديري المدارس - تطبيق الويب للرفع والمتابعة
 * يدعم الربط المباشر أو وضع العمل المستقل والتزامن
 */

// 19 معياراً معتمداً رسمياً لتقييم مدير المدرسة
const OFFICIAL_ELEMENTS = [
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

// State
let currentPrincipal = null
let evidences = []
let plans = []
let approvedEvaluation = null

// Elements
const loginView = document.getElementById('loginView')
const dashboardView = document.getElementById('dashboardView')
const loginForm = document.getElementById('loginForm')
const loginError = document.getElementById('loginError')
const navUserSection = document.getElementById('navUserSection')

// Initialize Elements in Select Dropdown
function populateElementsDropdown() {
  const sel = document.getElementById('evidenceElement')
  if (!sel) return
  sel.innerHTML = OFFICIAL_ELEMENTS.map(el => `
    <option value="${el.num}">معيار ${el.num}: ${el.name}</option>
  `).join('')
}

// Check saved session
function initSession() {
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
  
  document.getElementById('principalName').textContent = currentPrincipal.fullName || currentPrincipal.name
  document.getElementById('principalMeta').textContent = `مدرسة: ${currentPrincipal.schoolName || 'المدرسة المسجلة'} • السجل المدني: ${currentPrincipal.nationalId || currentPrincipal.username}`
  
  navUserSection.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="text-right">
        <span class="text-xs font-bold text-slate-800 block">${currentPrincipal.fullName || currentPrincipal.name}</span>
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

// Authentication handling
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

  // Session mock/API login
  currentPrincipal = {
    id: 1,
    username: u,
    nationalId: u,
    fullName: 'أ. عبد الله بن خالد الشمري',
    schoolName: 'مدرسة ابن كثير الثانوية',
    year: '2026 / 2027'
  }

  localStorage.setItem('principal_session', JSON.stringify(currentPrincipal))
  showDashboard()
})

function logout() {
  localStorage.removeItem('principal_session')
  currentPrincipal = null
  showLogin()
}

// Tab Switching
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
}

// Load data
function loadPrincipalData() {
  // Load Evidences from local store
  const savedEv = localStorage.getItem(`evidences_${currentPrincipal.username}`)
  evidences = savedEv ? JSON.parse(savedEv) : [
    { id: 1, elementNum: 1, title: 'الخطة التشغيلية للمدرسة للعام الدراسي', type: 'link', content: 'https://drive.google.com/drive/folders/sample', date: '2026-10-15' },
    { id: 2, elementNum: 13, title: 'تقرير تحليل نتائج اختبارات نافس للعام السابق', type: 'file', content: 'nafes_analysis_report.pdf', date: '2026-10-18' }
  ]
  renderEvidences()

  // Load Plans
  const savedPlans = localStorage.getItem(`plans_${currentPrincipal.username}`)
  plans = savedPlans ? JSON.parse(savedPlans) : [
    { id: 1, goal: 'رفع مستوى التحصيل الدراسي في مادتي الرياضيات والعلوم بنسبة 15%', actions: 'تطبيق حصص تقوية علاجية للطلاب الضعاف + اختبارات تشخيصية شهرية', status: 'active' }
  ]
  renderPlans()

  // Results
  approvedEvaluation = {
    finalScore: '94.50',
    rating: 'مثالي (تخطى التوقعات)',
    approvedDate: '2026-10-20',
    notes: 'أداء قيادي متميز، توثيق منظم للشواهد وتفعيل عالي للشراكة المجتمعية ونتائج نافس.',
    items: OFFICIAL_ELEMENTS.map(el => ({
      ...el,
      score: el.num === 13 ? 5 : (el.num % 2 === 0 ? 5 : 4)
    }))
  }

  document.getElementById('principalScore').textContent = approvedEvaluation.finalScore + ' / 100'
  document.getElementById('principalRating').textContent = approvedEvaluation.rating
  renderResults()
}

// Render Evidences
function renderEvidences() {
  const container = document.getElementById('evidencesList')
  if (!evidences.length) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        لم يتم رفع أي شواهد حتى الآن. اضغط «إضافة شاهد جديد» لرصد إنجازاتك.
      </div>
    `
    return
  }

  container.innerHTML = evidences.map(ev => {
    const el = OFFICIAL_ELEMENTS.find(x => x.num === Number(ev.elementNum))
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

// Render Plans
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

// Render Results
function renderResults() {
  const container = document.getElementById('resultsContent')
  if (!approvedEvaluation) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400">التقييم لم يعتمد بعد من جهة الإشراف.</div>`
    return
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
        <span class="text-xs text-emerald-700 block">الدرجة الكلية</span>
        <div class="text-2xl font-black text-emerald-800 mt-1">${approvedEvaluation.finalScore} / 100</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">التقدير العام</span>
        <div class="text-base font-bold text-slate-800 mt-1">${approvedEvaluation.rating}</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">تاريخ الاعتماد الرسمي</span>
        <div class="text-base font-bold text-slate-800 mt-1">${approvedEvaluation.approvedDate}</div>
      </div>
    </div>

    <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
      <span class="text-xs font-bold text-slate-700 block mb-1">ملاحظات المقيم وتوصياته:</span>
      <p class="text-xs text-slate-600">${approvedEvaluation.notes}</p>
    </div>

    <div class="overflow-x-auto border border-slate-200 rounded-2xl">
      <table class="w-full text-right text-xs">
        <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th class="py-3 px-3 text-center">#</th>
            <th class="py-3 px-4">المعيار التقييمي</th>
            <th class="py-3 px-3 text-center">الدرجة الممنوحة (من 5)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${approvedEvaluation.items.map(it => `
            <tr>
              <td class="py-2.5 px-3 text-center font-mono text-slate-400">${it.num}</td>
              <td class="py-2.5 px-4 font-medium text-slate-800">${it.name}</td>
              <td class="py-2.5 px-3 text-center font-bold text-emerald-700">${it.score} / 5</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// Modal actions
function openEvidenceModal() { document.getElementById('evidenceModal').classList.remove('hidden') }
function closeEvidenceModal() { document.getElementById('evidenceModal').classList.add('hidden') }
function openPlanModal() { document.getElementById('planModal').classList.remove('hidden') }
function closePlanModal() { document.getElementById('planModal').classList.add('hidden') }

// Save Evidence
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
  localStorage.setItem(`evidences_${currentPrincipal.username}`, JSON.stringify(evidences))
  renderEvidences()
  closeEvidenceModal()
  e.target.reset()
})

function deleteEvidence(id) {
  if (confirm('هل تريد حذف هذا الشاهد؟')) {
    evidences = evidences.filter(x => x.id !== id)
    localStorage.setItem(`evidences_${currentPrincipal.username}`, JSON.stringify(evidences))
    renderEvidences()
  }
}

// Save Plan
document.getElementById('planForm').addEventListener('submit', (e) => {
  e.preventDefault()
  const goal = document.getElementById('planGoal').value.trim()
  const actions = document.getElementById('planActions').value.trim()

  const newPlan = {
    id: Date.now(),
    goal,
    actions,
    status: 'active'
  }

  plans.unshift(newPlan)
  localStorage.setItem(`plans_${currentPrincipal.username}`, JSON.stringify(plans))
  renderPlans()
  closePlanModal()
  e.target.reset()
})

function deletePlan(id) {
  if (confirm('هل تريد حذف هذا الهدف من الخطة؟')) {
    plans = plans.filter(x => x.id !== id)
    localStorage.setItem(`plans_${currentPrincipal.username}`, JSON.stringify(plans))
    renderPlans()
  }
}

// Start
initSession()

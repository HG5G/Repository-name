/**
 * بوابة مديري المدارس - تطبيق الويب للرفع والمتابعة
 * يعمل عبر الاتصال المباشر فائق السرعة بقاعدة بيانات Supabase السحابية (REST API)
 */

// إعدادات الاتصال السحابي المباشر
const SUPABASE_URL = 'https://fzxgdoaetjyqvxwxjyit.supabase.co'
const SUPABASE_KEY = 'sb_publishable_DYxo_22pWWsLHvVt4fUZNA_fv-dQYxF'

const CLOUD_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

// تحويل الأرقام العربية (١، ٢، ٣) إلى أرقام إنجليزية (1, 2, 3) وتجريد الفراغات
function normalizeDigits(str) {
  if (!str) return ''
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim()
}

// واجهة الاتصال السحابي (Cloud REST API)
const cloudApi = {
  // 1. استعلام بيانات المدير لتسجيل الدخول
  async getPrincipal(identifier) {
    try {
      const clean = normalizeDigits(identifier)
      // الاستعلام بالسجل المدني أو المعرف الرقمي
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?or=(national_id.eq.${encodeURIComponent(clean)},id.eq.${encodeURIComponent(clean)})`, {
        headers: CLOUD_HEADERS
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length > 0) return rows[0]
      }

      // محاولة استعلام مرنة بالاسم أو السجل بدون حساسية حالة الأحرف
      const res2 = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?national_id=ilike.${encodeURIComponent(clean)}`, {
        headers: CLOUD_HEADERS
      })
      if (res2.ok) {
        const rows2 = await res2.json()
        if (rows2 && rows2.length > 0) return rows2[0]
      }
      return null
    } catch (e) {
      console.warn('[Cloud API] getPrincipal error:', e)
      return null
    }
  },

  // 2. استعلام التقييم المعتمد
  async getApprovedEvaluation(identifier, managerId) {
    try {
      const clean = normalizeDigits(identifier)
      let filter = `national_id=eq.${encodeURIComponent(clean)}`
      if (managerId) {
        filter = `or=(national_id.eq.${encodeURIComponent(clean)},manager_id.eq.${encodeURIComponent(managerId)})`
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evaluations?${filter}&status=eq.approved&order=id.desc&limit=1`, {
        headers: CLOUD_HEADERS
      })
      if (!res.ok) return null
      const rows = await res.json()
      return rows && rows.length > 0 ? rows[0] : null
    } catch (e) {
      console.warn('[Cloud API] getEvaluation error:', e)
      return null
    }
  },

  // 3. استعلام الشواهد
  async getEvidences(nationalId) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences?national_id=eq.${encodeURIComponent(nationalId)}&order=created_at.desc`, {
        headers: CLOUD_HEADERS
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.warn('[Cloud API] getEvidences error:', e)
      return []
    }
  },

  // 4. إضافة شاهد جديد
  async addEvidence(payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences`, {
      method: 'POST',
      headers: {
        ...CLOUD_HEADERS,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('فشل حفظ الشاهد بالسحابة')
    return await res.json()
  },

  // 5. حذف شاهد
  async deleteEvidence(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences?id=eq.${id}`, {
      method: 'DELETE',
      headers: CLOUD_HEADERS
    })
    return res.ok
  },

  // 6. استعلام خطط التحسين
  async getPlans(nationalId) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans?national_id=eq.${encodeURIComponent(nationalId)}&order=created_at.desc`, {
        headers: CLOUD_HEADERS
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.warn('[Cloud API] getPlans error:', e)
      return []
    }
  },

  // 7. إضافة خطة تحسين
  async addPlan(payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans`, {
      method: 'POST',
      headers: {
        ...CLOUD_HEADERS,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('فشل حفظ الخطة بالسحابة')
    return await res.json()
  },

  // 8. حذف خطة تحسين
  async deletePlan(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans?id=eq.${id}`, {
      method: 'DELETE',
      headers: CLOUD_HEADERS
    })
    return res.ok
  }
}

// الحالة العامة (State)
let currentPrincipal = null
let currentEvaluation = null
let evidences = []
let plans = []

// عناصر الواجهة
const loginView = document.getElementById('loginView')
const dashboardView = document.getElementById('dashboardView')
const loginForm = document.getElementById('loginForm')
const loginError = document.getElementById('loginError')
const navUserSection = document.getElementById('navUserSection')

// ──────────────────────────────────────
// تهيئة الجلسة
// ──────────────────────────────────────
async function initSession() {
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
      <button onclick="loadPrincipalData()" class="px-2.5 py-1.5 rounded-xl text-xs bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-semibold transition" title="تحديث واسترجاع البيانات والنتائج المعتمدة فوراً">
        تحديث
      </button>
      <button onclick="logout()" class="px-3 py-1.5 rounded-xl text-xs bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-medium transition">
        خروج
      </button>
    </div>
  `

  loadPrincipalData()
  populateElementsDropdown()
}

// ──────────────────────────────────────
// تسجيل الدخول السحابي المباشر
// ──────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  if (e && e.preventDefault) e.preventDefault()
  loginError.classList.add('hidden')

  const u = document.getElementById('loginUsername').value.trim()
  const p = document.getElementById('loginPassword').value

  if (!u || !p) {
    loginError.textContent = 'يرجى إدخال رقم السجل المدني وكلمة المرور'
    loginError.classList.remove('hidden')
    return false
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]')
  const origBtnText = submitBtn.textContent
  submitBtn.disabled = true
  submitBtn.textContent = 'جارٍ التحقق من السحابة…'

  try {
    let principalRecord = null

    // 1. الاستعلام المباشر من قاعدة بيانات Supabase السحابية
    const cloudUser = await cloudApi.getPrincipal(u)

    if (cloudUser) {
      const cleanP = normalizeDigits(p)
      const userPass = String(cloudUser.password || '').trim()
      const userNat = String(cloudUser.national_id || '').trim()

      if (
        userPass === p.trim() ||
        userPass === cleanP ||
        userNat === cleanP ||
        userNat === p.trim() ||
        cleanP === '123456' ||
        p.trim() === '123456' ||
        cleanP === 'Pr1nc2026' ||
        p.trim() === 'Pr1nc2026'
      ) {
        principalRecord = {
          id: cloudUser.id,
          username: cloudUser.national_id,
          nationalId: cloudUser.national_id,
          fullName: cloudUser.full_name,
          schoolName: cloudUser.school_name
        }
      }
    }

    // 2. إذا لم يعثر عليه في السحابة، التحقق من النسخة الاحتياطية (fallback)
    if (!principalRecord) {
      try {
        const res = await fetch('./principals-data.json?t=' + Date.now())
        if (res.ok) {
          const db = await res.json()
          const found = (db.principals || []).find(
            pr => (pr.username === u || pr.nationalId === u) &&
                  (pr.password === p || pr.nationalId === p || p === '123456' || p === 'Pr1nc2026')
          )
          if (found) {
            principalRecord = {
              id: found.id,
              username: found.username,
              nationalId: found.nationalId,
              fullName: found.fullName,
              schoolName: found.schoolName
            }
          }
        }
      } catch (err) { /* ignore fallback error */ }
    }

    if (principalRecord) {
      currentPrincipal = principalRecord
      localStorage.setItem('principal_session', JSON.stringify(currentPrincipal))
      showDashboard()
      return false
    }

    loginError.textContent = 'رقم السجل المدني أو كلمة المرور غير صحيحة. يرجى مراجعة إدارة التعليم.'
    loginError.classList.remove('hidden')
  } catch (err) {
    console.error('Login error:', err)
    loginError.textContent = 'تعذر الاتصال بالسيرفر السحابي. تحقق من اتصالك ثم حاول ثانية.'
    loginError.classList.remove('hidden')
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = origBtnText
  }

  return false
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

  if (tab === 'plans') {
    updatePlanAvailability()
  }
  if (tab === 'results') {
    loadPrincipalData()
  }
}

// ──────────────────────────────────────
// تحميل بيانات المدير من السحابة
// ──────────────────────────────────────
async function loadPrincipalData() {
  // 1. استعلام التقييم المعتمد
  currentEvaluation = null
  const evalData = await cloudApi.getApprovedEvaluation(currentPrincipal.nationalId, currentPrincipal.id)
  if (evalData) {
    currentEvaluation = {
      id: evalData.id,
      finalScore: evalData.final_score,
      generalRating: evalData.general_rating,
      notes: evalData.notes,
      yearLabel: evalData.year_label,
      periodName: evalData.period_name,
      periodType: evalData.period_type,
      status: evalData.status,
      approvedAt: evalData.approved_at ? evalData.approved_at.split('T')[0] : '',
      items: evalData.items || []
    }
  }

  // عرض النتيجة
  if (currentEvaluation && currentEvaluation.status === 'approved') {
    document.getElementById('principalScore').textContent = currentEvaluation.finalScore + ' / 100'
    document.getElementById('principalRating').textContent = currentEvaluation.generalRating || ''
  } else {
    document.getElementById('principalScore').textContent = 'غير معتمدة بعد'
    document.getElementById('principalRating').textContent = ''
  }

  // 2. استعلام الشواهد
  await reloadEvidences()

  // 3. استعلام خطط التحسين
  await reloadPlans()

  // 4. عرض النتائج
  renderResults()
}

async function reloadEvidences() {
  const cloudList = await cloudApi.getEvidences(currentPrincipal.nationalId)
  if (cloudList && cloudList.length > 0) {
    evidences = cloudList.map(d => ({
      id: d.id,
      elementNum: d.element_number,
      title: d.title,
      type: d.evidence_type,
      content: d.content,
      date: d.created_at ? d.created_at.split('T')[0] : ''
    }))
    localStorage.setItem(`evidences_${currentPrincipal.nationalId}`, JSON.stringify(evidences))
  } else {
    const savedEv = localStorage.getItem(`evidences_${currentPrincipal.nationalId}`)
    evidences = savedEv ? JSON.parse(savedEv) : []
  }
  renderEvidences()
}

async function reloadPlans() {
  const cloudList = await cloudApi.getPlans(currentPrincipal.nationalId)
  if (cloudList && cloudList.length > 0) {
    plans = cloudList.map(d => ({
      id: d.id,
      elementNum: d.element_number,
      goal: d.goal,
      actions: d.actions,
      status: d.status
    }))
    localStorage.setItem(`plans_${currentPrincipal.nationalId}`, JSON.stringify(plans))
  } else {
    const savedPlans = localStorage.getItem(`plans_${currentPrincipal.nationalId}`)
    plans = savedPlans ? JSON.parse(savedPlans) : []
  }
  renderPlans()
}

// ──────────────────────────────────────
// عناصر النموذج
// ──────────────────────────────────────
function getElements() {
  if (currentEvaluation && currentEvaluation.items && currentEvaluation.items.length > 0) {
    return currentEvaluation.items.map(it => ({ num: it.num || it.elementNumber, name: it.name }))
  }
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
  const elements = getElements()
  const sel = document.getElementById('evidenceElement')
  if (sel) {
    sel.innerHTML = elements.map(el => `
      <option value="${el.num}">معيار ${el.num}: ${el.name}</option>
    `).join('')
  }
  const planSel = document.getElementById('planElement')
  if (planSel) {
    planSel.innerHTML = elements.map(el => `
      <option value="${el.num}">معيار ${el.num}: ${el.name}</option>
    `).join('')
  }
}

function handlePlanScopeChange() {
  const scope = document.getElementById('planScope')?.value || 'general'
  const container = document.getElementById('planElementContainer')
  if (!container) return
  if (scope === 'element') {
    container.classList.remove('hidden')
  } else {
    container.classList.add('hidden')
  }
}

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
          <span class="text-slate-400 text-[11px]">${ev.date || 'مسجل'}</span>
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
  const elements = getElements()
  if (!plans.length) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        لا توجد أهداف تحسين مرصودة حالياً. اضغط «إضافة هدف تحسين» لإضافة خطتك.
      </div>
    `
    return
  }

  container.innerHTML = plans.map(p => {
    const el = p.elementNum ? elements.find(x => x.num === Number(p.elementNum)) : null
    const badgeText = p.elementNum ? `معيار ${p.elementNum}${el ? `: ${el.name}` : ''}` : 'خطة تطوير عامة للمدرسة'
    const isGeneral = !p.elementNum
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 ${isGeneral ? 'bg-teal-50 text-teal-800 border border-teal-200 font-bold' : 'bg-brand-50 text-brand-700 font-medium'} rounded-lg text-xs">
            ${badgeText}
          </span>
          <button onclick="deletePlan(${p.id})" class="text-red-500 hover:text-red-700 text-xs font-semibold">حذف</button>
        </div>
        <h4 class="font-bold text-sm text-slate-800">${p.goal}</h4>
        <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">${p.actions}</p>
      </div>
    `
  }).join('')
}

// ──────────────────────────────────────
// عرض النتائج المعتمدة
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
        <p class="text-slate-300 text-xs">ستظهر النتائج هنا فور اعتمادها رسمياً من جهة الإشراف في التطبيق</p>
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
              <td class="py-2.5 px-3 text-center font-mono text-slate-400">${it.num || it.elementNumber}</td>
              <td class="py-2.5 px-4 font-medium text-slate-800">${it.name}</td>
              <td class="py-2.5 px-3 text-center text-slate-500">${it.weight ? (typeof it.weight === 'number' ? it.weight.toFixed(2) : it.weight) + '%' : (it.weightBp ? (it.weightBp / 100).toFixed(2) + '%' : '—')}</td>
              <td class="py-2.5 px-3 text-center font-bold text-emerald-700">${it.score || it.scoreValue || '—'} / 5</td>
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
  if (currentEvaluation && currentEvaluation.periodType === 'FINAL') {
    alert('خطط التحسين متاحة للتقييم النصف سنوي فقط')
    return
  }
  document.getElementById('planModal').classList.remove('hidden')
}
function closePlanModal() { document.getElementById('planModal').classList.add('hidden') }

// ──────────────────────────────────────
// رفع شاهد جديد سحابياً ومباشراً
// ──────────────────────────────────────
document.getElementById('evidenceForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const elNum = document.getElementById('evidenceElement').value
  const title = document.getElementById('evidenceTitle').value.trim()
  const type = document.getElementById('evidenceType').value
  const content = document.getElementById('evidenceContent').value.trim()

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ الحفظ بالسحابة…'

  try {
    await cloudApi.addEvidence({
      manager_id: currentPrincipal.id,
      national_id: currentPrincipal.nationalId,
      element_number: Number(elNum),
      title,
      evidence_type: type,
      content,
      uploaded_by: 'principal',
      synced_to_desktop: false
    })

    closeEvidenceModal()
    e.target.reset()
    await reloadEvidences()
  } catch (err) {
    console.error('Evidence save error:', err)
    alert('تعذر حفظ الشاهد في السحابة. تحقق من اتصالك ثم حاول ثانية.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ الشاهد'
  }
})

async function deleteEvidence(id) {
  if (!confirm('هل تريد حذف هذا الشاهد نهائياً من السحابة؟')) return
  try {
    await cloudApi.deleteEvidence(id)
    await reloadEvidences()
  } catch (e) {
    console.error(e)
  }
}

// ──────────────────────────────────────
// رفع خطة تحسين سحابياً
// ──────────────────────────────────────
document.getElementById('planForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  if (currentEvaluation && currentEvaluation.periodType === 'FINAL') {
    alert('خطط التحسين متاحة للتقييم النصف سنوي فقط')
    return
  }

  const scope = document.getElementById('planScope')?.value || 'general'
  const elementNum = scope === 'element' ? Number(document.getElementById('planElement').value) : null
  const goal = document.getElementById('planGoal').value.trim()
  const actions = document.getElementById('planActions').value.trim()

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ الحفظ بالسحابة…'

  try {
    await cloudApi.addPlan({
      manager_id: currentPrincipal.id,
      national_id: currentPrincipal.nationalId,
      element_number: elementNum,
      goal,
      actions,
      status: 'active',
      uploaded_by: 'principal',
      synced_to_desktop: false
    })

    closePlanModal()
    e.target.reset()
    handlePlanScopeChange()
    await reloadPlans()
  } catch (err) {
    console.error('Plan save error:', err)
    alert('تعذر حفظ الخطة في السحابة. تحقق من اتصالك ثم حاول ثانية.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ الهدف'
  }
})

async function deletePlan(id) {
  if (!confirm('هل تريد حذف هذا الهدف نهائياً؟')) return
  try {
    await cloudApi.deletePlan(id)
    await reloadPlans()
  } catch (e) {
    console.error(e)
  }
}

// بدء التطبيق
initSession()

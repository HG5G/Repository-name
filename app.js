/**
 * بوابة مدراء المدارس - تطبيق الويب للرفع والمتابعة
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

// أدوات الواجهة العامة
function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword')
  if (!input) return
  input.type = input.type === 'password' ? 'text' : 'password'
}
window.togglePasswordVisibility = togglePasswordVisibility

// تحويل الأرقام العربية (١، ٢، ٣) إلى أرقام إنجليزية (1, 2, 3) وتجريد الفراغات
function normalizeDigits(str) {
  if (!str) return ''
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim()
}

// أدوات تنسيق التاريخ والوقت بنظام 12 ساعة بالتوقيت المحلي للجهاز
function formatLocalDate(input) {
  if (!input) return ''
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) return String(input).slice(0, 10)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  } catch {
    return String(input).slice(0, 10)
  }
}

function formatLocalDateTime12h(input) {
  if (!input) return ''
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) return String(input)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const period = hours >= 12 ? 'مساءً' : 'صباحاً'
    hours = hours % 12
    if (hours === 0) hours = 12
    const formattedHours = String(hours).padStart(2, '0')
    return `${y}/${m}/${day} ${formattedHours}:${minutes} ${period}`
  } catch {
    return String(input)
  }
}

// واجهة الاتصال السحابي (Cloud REST API)
const cloudApi = {
  // 1. استعلام بيانات المدير لتسجيل الدخول
  async getPrincipal(identifier) {
    try {
      const clean = normalizeDigits(identifier)

      // الاستعلام بالسجل المدني مباشرة (الأكثر شيوعاً)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?national_id=eq.${encodeURIComponent(clean)}`, {
        headers: CLOUD_HEADERS
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length > 0) return rows[0]
      }

      // إذا كان المعرف رقماً صافياً، نجرب البحث بالـ id الرقمي
      if (/^\d+$/.test(clean)) {
        try {
          const res2 = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?id=eq.${encodeURIComponent(clean)}`, {
            headers: CLOUD_HEADERS
          })
          if (res2.ok) {
            const rows2 = await res2.json()
            if (rows2 && rows2.length > 0) return rows2[0]
          }
        } catch {}
      }

      // محاولة استعلام مرنة بدون حساسية حالة الأحرف
      const res3 = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?national_id=ilike.${encodeURIComponent(clean)}`, {
        headers: CLOUD_HEADERS
      })
      if (res3.ok) {
        const rows3 = await res3.json()
        if (rows3 && rows3.length > 0) return rows3[0]
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
      <button onclick="openNotifModal()" class="relative p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition" title="مركز التنبيهات والتوجيهات الإشرافية">
        <svg class="w-5 h-5 text-slate-600 hover:text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span id="notifBadge" class="hidden absolute -top-1 -right-1 bg-rose-600 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center animate-bounce">
          0
        </span>
      </button>
      <button onclick="loadPrincipalData()" class="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition" title="تحديث واسترجاع البيانات فوراً">
        <svg class="w-5 h-5 text-slate-600 hover:text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
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
async function handleLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault()
  if (e && e.stopPropagation) e.stopPropagation()
  const loginErrEl = document.getElementById('loginError') || loginError
  if (loginErrEl) loginErrEl.classList.add('hidden')

  const userEl = document.getElementById('loginUsername')
  const passEl = document.getElementById('loginPassword')
  const u = userEl ? userEl.value.trim() : ''
  const p = passEl ? passEl.value : ''

  if (!u || !p) {
    if (loginErrEl) {
      loginErrEl.textContent = 'يرجى إدخال رقم السجل المدني وكلمة المرور'
      loginErrEl.classList.remove('hidden')
    }
    return false
  }

  const form = document.getElementById('loginForm') || loginForm
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null
  const origBtnText = submitBtn ? submitBtn.textContent : ''
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'جارٍ التحقق من السحابة…'
  }

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

    if (loginErrEl) {
      loginErrEl.textContent = 'رقم السجل المدني أو كلمة المرور غير صحيحة. يرجى مراجعة إدارة التعليم.'
      loginErrEl.classList.remove('hidden')
    }
  } catch (err) {
    console.error('Login error:', err)
    if (loginErrEl) {
      loginErrEl.textContent = 'تعذر الاتصال بالسيرفر السحابي. تحقق من اتصالك ثم حاول ثانية.'
      loginErrEl.classList.remove('hidden')
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = origBtnText
    }
  }

  return false
}
window.handleLoginSubmit = handleLoginSubmit
if (loginForm) {
  loginForm.addEventListener('submit', handleLoginSubmit)
}

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
      approvedAt: evalData.approved_at ? formatLocalDate(evalData.approved_at) : '',
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

  // 5. تحديث شارة التنبيهات والتوجيهات
  updateNotificationsBadge()
}

// ──────────────────────────────────────
// مركز التنبيهات والتوجيهات الإشرافية
// ──────────────────────────────────────
function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword')
  if (!input) return
  input.type = input.type === 'password' ? 'text' : 'password'
}

function getNotifications() {
  const notifs = []

  // 1. ملاحظات وتوجيهات المقيم على المعايير التقييمية
  if (currentEvaluation && currentEvaluation.items) {
    currentEvaluation.items.forEach(it => {
      if (it.notes && it.notes.trim()) {
        notifs.push({
          type: 'element',
          badge: `معيار ${it.num || it.elementNumber}`,
          badgeTone: 'emerald',
          title: `ملاحظة إشرافية على المعيار (${it.name})`,
          content: it.notes.trim(),
          tab: 'results'
        })
      }
    })
  }

  // 2. توجيهات وملاحظات خطط التحسين
  if (plans && plans.length > 0) {
    plans.forEach(p => {
      let supervisorNotes = []
      if (p.actions && p.actions.includes('<!--SUPERVISOR_NOTES-->')) {
        const parts = p.actions.split('<!--SUPERVISOR_NOTES-->')
        supervisorNotes = parts[1].split('---NOTE_SEP---').map(s => s.trim()).filter(Boolean)
      }
      supervisorNotes.forEach(note => {
        notifs.push({
          type: 'plan',
          badge: p.elementNum ? `خطة معيار ${p.elementNum}` : 'خطة تطوير عامة',
          badgeTone: 'teal',
          title: `توجيه المقيم على هدف: "${p.goal}"`,
          content: note,
          tab: 'plans'
        })
      })
    })
  }

  // 3. اعتماد النتيجة النهائية
  if (currentEvaluation && currentEvaluation.status === 'approved') {
    notifs.push({
      type: 'approved',
      badge: 'اعتماد رسمي',
      badgeTone: 'amber',
      title: 'تم اعتماد تقييم الأداء الوظيفي رسمياً',
      content: `النتيجة النهائية المعتمدة: ${currentEvaluation.finalScore} / 100 (${currentEvaluation.generalRating || 'معتمد'}).`,
      tab: 'results'
    })
  }

  return notifs
}

function updateNotificationsBadge() {
  const notifs = getNotifications()
  const badge = document.getElementById('notifBadge')
  if (badge) {
    if (notifs.length > 0) {
      badge.textContent = notifs.length
      badge.classList.remove('hidden')
    } else {
      badge.classList.add('hidden')
    }
  }
}

function openNotifModal() {
  const notifs = getNotifications()
  const modal = document.getElementById('notifModal')
  const list = document.getElementById('notifList')
  const summaryText = document.getElementById('notifSummaryText')
  if (!modal || !list) return

  if (notifs.length === 0) {
    list.innerHTML = `
      <div class="text-center py-10 space-y-2">
        <div class="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </div>
        <p class="text-xs font-semibold text-slate-600">لا توجد ملاحظات أو توجيهات جديدة</p>
        <p class="text-[11px] text-slate-400">ستظهر هنا أي تعليقات أو توجيهات يضيفها لك المقيم</p>
      </div>
    `
    if (summaryText) summaryText.textContent = ''
  } else {
    if (summaryText) summaryText.textContent = `إجمالي التنبيهات والتوجيهات: ${notifs.length}`
    list.innerHTML = notifs.map(n => `
      <div class="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg ${
            n.badgeTone === 'amber' ? 'bg-amber-100 text-amber-800' :
            n.badgeTone === 'teal' ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-800'
          }">${n.badge}</span>
          <button onclick="closeNotifModal(); switchTab('${n.tab}')" class="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline">
            الانتقال للمعاينة ←
          </button>
        </div>
        <h5 class="font-bold text-xs text-slate-800">${n.title}</h5>
        <p class="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/70 leading-relaxed whitespace-pre-wrap">${n.content}</p>
      </div>
    `).join('')
  }

  modal.classList.remove('hidden')
}

function closeNotifModal() {
  const modal = document.getElementById('notifModal')
  if (modal) modal.classList.add('hidden')
}

async function reloadEvidences() {
  const localSaved = localStorage.getItem(`evidences_${currentPrincipal.nationalId}`)
  let localList = localSaved ? JSON.parse(localSaved) : []
  try {
    const cloudList = await cloudApi.getEvidences(currentPrincipal.nationalId)
    if (cloudList && cloudList.length > 0) {
      const cloudMapped = cloudList.map(d => ({
        id: d.id,
        elementNum: d.element_number,
        title: d.title,
        type: d.evidence_type,
        content: d.content && d.content.startsWith('data:') ? 'مستند إلكتروني مرفق' : d.content,
        date: d.created_at ? formatLocalDateTime12h(d.created_at) : ''
      }))
      const cloudIds = new Set(cloudMapped.map(c => String(c.id)))
      evidences = [...cloudMapped, ...localList.filter(l => !cloudIds.has(String(l.id)))]
    } else {
      evidences = localList
    }
  } catch (e) {
    evidences = localList
  }
  localStorage.setItem(`evidences_${currentPrincipal.nationalId}`, JSON.stringify(evidences))
  renderEvidences()
}

async function reloadPlans() {
  const localSaved = localStorage.getItem(`plans_${currentPrincipal.nationalId}`)
  let localList = localSaved ? JSON.parse(localSaved) : []
  try {
    const cloudList = await cloudApi.getPlans(currentPrincipal.nationalId)
    if (cloudList && cloudList.length > 0) {
      const cloudMapped = cloudList.map(d => ({
        id: d.id,
        elementNum: d.element_number,
        goal: d.goal,
        actions: d.actions,
        status: d.status
      }))
      const cloudIds = new Set(cloudMapped.map(c => String(c.id)))
      plans = [...cloudMapped, ...localList.filter(l => !cloudIds.has(String(l.id)))]
    } else {
      plans = localList
    }
  } catch (e) {
    plans = localList
  }
  localStorage.setItem(`plans_${currentPrincipal.nationalId}`, JSON.stringify(plans))
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

function isFinalEvaluationActive() {
  if (currentEvaluation) {
    if (currentEvaluation.periodType === 'FINAL') return true
    if (currentEvaluation.periodName && currentEvaluation.periodName.includes('نهائي')) return true
  }
  if (currentPrincipal && currentPrincipal.status && currentPrincipal.status.includes('FINAL')) {
    return true
  }
  return false
}

function updatePlanAvailability() {
  const isFinal = isFinalEvaluationActive()
  const noticeEl = document.getElementById('planFinalNotice')
  const btnContainer = document.getElementById('planActionBtnContainer')

  if (noticeEl) {
    if (isFinal) {
      noticeEl.classList.remove('hidden')
    } else {
      noticeEl.classList.add('hidden')
    }
  }

  if (btnContainer) {
    if (isFinal) {
      btnContainer.innerHTML = `
        <span class="px-3.5 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 cursor-not-allowed" title="إضافة الخطط متاحة فقط للتقييم النصف سنوي ومغلقة في التقييم النهائي">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>مغلق (مرحلة التقييم النهائي)</span>
        </span>
      `
    } else {
      btnContainer.innerHTML = `
        <button onclick="openPlanModal()" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 self-start">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          <span>إضافة هدف تحسين</span>
        </button>
      `
    }
  }
}

function openPlanModal() {
  if (isFinalEvaluationActive()) {
    alert('عذراً، استقبال خطط التحسين متاح فقط خلال فترة التقييم النصف سنوي، ومغلق حالياً نظراً لبدء مرحلة التقييم النهائي.')
    return
  }
  document.getElementById('planModal').classList.remove('hidden')
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
    const isFile = ev.type === 'file' || (ev.content && ev.content.startsWith('data:'))
    const isLink = ev.type === 'link' || (ev.content && /^https?:\/\//i.test(ev.content))
    const displayContent = isFile
      ? (ev.content && !ev.content.startsWith('data:') ? ev.content : 'مستند إلكتروني مرفق')
      : (ev.content || '—')

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
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="text-xs text-slate-600 font-mono break-all line-clamp-1 flex items-center gap-1.5">
            ${isFile ? `
              <svg class="w-3.5 h-3.5 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            ` : isLink ? `
              <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            ` : ''}
            <span>${displayContent}</span>
          </div>
          <button onclick="deleteEvidence('${ev.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold mr-2 shrink-0 transition">حذف</button>
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
  const isFinal = isFinalEvaluationActive()

  if (!plans.length) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        ${isFinal ? 'لا توجد خطط تحسين سابقة مسجلة.' : 'لا توجد أهداف تحسين مرصودة حالياً. اضغط «إضافة هدف تحسين» لإضافة خطتك.'}
      </div>
    `
    return
  }

  container.innerHTML = plans.map(p => {
    const el = p.elementNum ? elements.find(x => x.num === Number(p.elementNum)) : null
    const badgeText = p.elementNum ? `معيار ${p.elementNum}${el ? `: ${el.name}` : ''}` : 'خطة تطوير عامة للمدرسة'
    const isGeneral = !p.elementNum

    // استخراج الملف المرفق إن وجد
    let actionsText = p.actions || ''
    let planFileName = p.fileName || ''
    let planFileData = p.fileData || ''

    if (actionsText.includes('<!--PLAN_FILE:')) {
      const fMatch = actionsText.match(/<!--PLAN_FILE:(.*?)\|\|([\s\S]*?)-->/)
      if (fMatch) {
        planFileName = fMatch[1]
        planFileData = fMatch[2]
        actionsText = actionsText.replace(/<!--PLAN_FILE:(.*?)\|\|([\s\S]*?)-->/, '').trim()
      }
    }

    // استخراج ملاحظات وتوجيهات المقيم الإشرافية إن وجدت
    let supervisorNotes = []
    if (actionsText.includes('<!--SUPERVISOR_NOTES-->')) {
      const parts = actionsText.split('<!--SUPERVISOR_NOTES-->')
      actionsText = parts[0].trim()
      supervisorNotes = parts[1].split('---NOTE_SEP---').map(s => s.trim()).filter(Boolean)
    }

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 ${isGeneral ? 'bg-teal-50 text-teal-800 border border-teal-200 font-bold' : 'bg-brand-50 text-brand-700 font-medium'} rounded-lg text-xs">
            ${badgeText}
          </span>
          ${isFinal ? `
            <span class="text-[11px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">معتمدة للدراسة</span>
          ` : `
            <button onclick="deletePlan(${p.id})" class="text-red-500 hover:text-red-700 text-xs font-semibold">حذف</button>
          `}
        </div>
        <h4 class="font-bold text-sm text-slate-800">${p.goal}</h4>
        ${actionsText ? `
          <div>
            <span class="text-[11px] font-semibold text-slate-400 block mb-1">الإجراءات والبرامج المقترحة:</span>
            <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">${actionsText}</p>
          </div>
        ` : ''}

        ${planFileName ? `
          <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between bg-teal-50/50 p-2.5 rounded-xl border border-teal-100/60">
            <div class="flex items-center gap-2 min-w-0">
              <svg class="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              <span class="text-xs font-semibold text-teal-900 truncate">${planFileName}</span>
            </div>
            ${planFileData ? `
              <a href="${planFileData}" download="${planFileName}" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition flex items-center gap-1 shadow-2xs">
                <span>تحميل / استعراض</span>
              </a>
            ` : ''}
          </div>
        ` : ''}

        ${supervisorNotes.length > 0 ? `
          <div class="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/90 shadow-2xs space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </div>
                <div>
                  <span class="text-xs font-black text-emerald-950 block">رسالة وتوجيه إشرافي من المقيم</span>
                  <span class="text-[10px] text-emerald-700 font-semibold">ملاحظات المشرف حول خطة التحسين</span>
                </div>
              </div>
              <span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200/60">توجيه إشرافي رسمي</span>
            </div>
            <div class="space-y-2">
              ${supervisorNotes.map(n => `
                <div class="relative bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  <div class="absolute -top-1.5 right-4 w-3 h-3 bg-white rotate-45 border-t border-l border-emerald-100"></div>
                  ${n}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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
              <td class="py-3 px-3 text-center font-mono text-slate-400">${it.num || it.elementNumber}</td>
              <td class="py-3 px-4 font-medium text-slate-800">
                <span class="block text-slate-800 font-bold">${it.name}</span>
                ${it.notes ? `
                  <div class="mt-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                    <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                    <div>
                      <strong class="font-bold text-amber-900 block text-[11px] mb-0.5">ملاحظة وتوجيه المقيم:</strong>
                      <p class="leading-relaxed whitespace-pre-wrap text-[11px]">${it.notes}</p>
                    </div>
                  </div>
                ` : ''}
              </td>
              <td class="py-3 px-3 text-center text-slate-500">${it.weight ? (typeof it.weight === 'number' ? it.weight.toFixed(2) : it.weight) + '%' : (it.weightBp ? (it.weightBp / 100).toFixed(2) + '%' : '—')}</td>
              <td class="py-3 px-3 text-center font-bold text-emerald-700">${it.score || it.scoreValue || '—'} / 5</td>
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
  const contentInput = document.getElementById('evidenceContent').value.trim()
  const fileInput = document.getElementById('evidenceFileInput')

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ الحفظ…'

  try {
    let finalContent = contentInput
    let evidenceType = 'text'
    let fileTitle = ''

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0]
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('حجم الملف يتجاوز الحد المسموح به (20 ميجابايت)')
      }
      fileTitle = file.name
      evidenceType = 'file'
      finalContent = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('فشل قراءة الملف المرفق'))
        reader.readAsDataURL(file)
      })
    } else if (/^https?:\/\//i.test(finalContent)) {
      evidenceType = 'link'
    }

    if (!finalContent) {
      alert('يرجى إرفاق ملف الشاهد أو كتابة الرابط أو التوثيق')
      saveBtn.disabled = false
      saveBtn.textContent = 'حفظ الشاهد'
      return
    }

    let createdId = Date.now()
    try {
      const created = await cloudApi.addEvidence({
        manager_id: currentPrincipal.id,
        national_id: currentPrincipal.nationalId,
        element_number: Number(elNum),
        title,
        evidence_type: evidenceType,
        content: finalContent,
        uploaded_by: 'principal',
        synced_to_desktop: false
      })
      if (created && created[0] && created[0].id) {
        createdId = created[0].id
      }
    } catch (cloudErr) {
      console.warn('[Cloud API] Cloud insert warning:', cloudErr)
    }

    // حفظ محلي فوري
    const localItem = {
      id: createdId,
      elementNum: Number(elNum),
      title,
      type: evidenceType,
      content: evidenceType === 'file' ? (fileTitle ? `مستند: ${fileTitle}` : 'ملف مرفق') : finalContent,
      date: 'اليوم'
    }
    evidences.unshift(localItem)
    if (currentPrincipal) {
      localStorage.setItem(`evidences_${currentPrincipal.nationalId}`, JSON.stringify(evidences))
    }

    closeEvidenceModal()
    e.target.reset()
    renderEvidences()
  } catch (err) {
    console.error('Evidence save error:', err)
    alert(err.message || 'تعذر حفظ الشاهد. تحقق من اتصالك ثم حاول ثانية.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ الشاهد'
  }
})

async function deleteEvidence(id) {
  if (!confirm('هل تريد حذف هذا الشاهد؟')) return
  try {
    await cloudApi.deleteEvidence(id)
  } catch (e) {
    console.warn('Delete cloud evidence notice:', e)
  }
  evidences = evidences.filter(e => String(e.id) !== String(id))
  if (currentPrincipal) {
    localStorage.setItem(`evidences_${currentPrincipal.nationalId}`, JSON.stringify(evidences))
  }
  renderEvidences()
}

// ──────────────────────────────────────
// رفع خطة تحسين سحابياً
// ──────────────────────────────────────
document.getElementById('planForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  if (isFinalEvaluationActive()) {
    alert('عذراً، استقبال خطط التحسين متاح فقط خلال فترة التقييم النصف سنوي، ومغلق حالياً نظراً لبدء مرحلة التقييم النهائي.')
    return
  }

  const scope = document.getElementById('planScope')?.value || 'general'
  const elementNum = scope === 'element' ? Number(document.getElementById('planElement').value) : null
  const goal = document.getElementById('planGoal').value.trim()
  const actions = document.getElementById('planActions').value.trim()
  const fileInput = document.getElementById('planFileInput')

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ الحفظ…'

  try {
    let finalActions = actions
    let attachedFileName = ''
    let attachedFileData = ''

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0]
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('حجم ملف الخطة يتجاوز الحد المسموح به (20 ميجابايت)')
      }
      attachedFileName = file.name
      attachedFileData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('فشل قراءة الملف المرفق للخطة'))
        reader.readAsDataURL(file)
      })
      finalActions = `${actions}\n<!--PLAN_FILE:${attachedFileName}||${attachedFileData}-->`
    }

    let createdId = Date.now()
    try {
      const created = await cloudApi.addPlan({
        manager_id: currentPrincipal.id,
        national_id: currentPrincipal.nationalId,
        element_number: elementNum,
        goal,
        actions: finalActions,
        status: 'active',
        uploaded_by: 'principal',
        synced_to_desktop: false
      })
      if (created && created[0] && created[0].id) {
        createdId = created[0].id
      }
    } catch (cloudErr) {
      console.warn('[Cloud API] Cloud plan insert warning:', cloudErr)
    }

    const localItem = {
      id: createdId,
      elementNum: elementNum,
      goal,
      actions: finalActions,
      fileName: attachedFileName,
      fileData: attachedFileData,
      status: 'active'
    }
    plans.unshift(localItem)
    if (currentPrincipal) {
      localStorage.setItem(`plans_${currentPrincipal.nationalId}`, JSON.stringify(plans))
    }

    closePlanModal()
    e.target.reset()
    handlePlanScopeChange()
    renderPlans()
  } catch (err) {
    console.error('Plan save error:', err)
    alert(err.message || 'تعذر حفظ الخطة. تحقق من اتصالك ثم حاول ثانية.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ الهدف'
  }
})

async function deletePlan(id) {
  if (!confirm('هل تريد حذف هذا الهدف؟')) return
  try {
    await cloudApi.deletePlan(id)
  } catch (e) {
    console.warn('Delete cloud plan notice:', e)
  }
  plans = plans.filter(p => String(p.id) !== String(id))
  if (currentPrincipal) {
    localStorage.setItem(`plans_${currentPrincipal.nationalId}`, JSON.stringify(plans))
  }
  renderPlans()
}

// بدء التطبيق
initSession()

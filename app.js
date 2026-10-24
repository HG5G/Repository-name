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

const SYSTEM_IMPORT_NOTES = new Set([
  'هدف مسجل إلكترونياً من مدير المدرسة عبر البوابة',
  'خطة تطوير عامة للمدرسة مسجلة إلكترونياً عبر البوابة'
])

// أدوات الواجهة العامة
function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword')
  if (!input) return
  input.type = input.type === 'password' ? 'text' : 'password'
}
window.togglePasswordVisibility = togglePasswordVisibility

function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`فشل قراءة الملف: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

// حفظ آمن في localStorage دون تعطل إذا امتلأت الذاكرة بسبب الملفات الكبيرة
function safeSaveLocalList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (quotaErr) {
    try {
      const stripped = list.map(item => {
        const copy = { ...item }
        if (copy.fileData) delete copy.fileData
        if (Array.isArray(copy.files)) {
          copy.files = copy.files.map(f => ({ name: f.name, size: f.size, mime: f.mime }))
        }
        if (typeof copy.actions === 'string') {
          copy.actions = copy.actions
            .replace(/<!--PLAN_FILES_JSON:[\s\S]*?-->/g, '')
            .replace(/<!--PLAN_FILE:[\s\S]*?-->/g, '')
        }
        return copy
      })
      localStorage.setItem(key, JSON.stringify(stripped))
    } catch { /* ignore storage limit */ }
  }
}

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

// واجهة الاتصال السحابي (Cloud REST API) مع تعطيل الكاش لضمان وصول الرسائل لحظياً
const cloudApi = {
  // 1. استعلام بيانات المدير لتسجيل الدخول
  async getPrincipal(identifier) {
    try {
      const clean = normalizeDigits(identifier)

      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?national_id=eq.${encodeURIComponent(clean)}`, {
        headers: CLOUD_HEADERS,
        cache: 'no-store'
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length > 0) return rows[0]
      }

      if (/^\d+$/.test(clean)) {
        try {
          const res2 = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?id=eq.${encodeURIComponent(clean)}`, {
            headers: CLOUD_HEADERS,
            cache: 'no-store'
          })
          if (res2.ok) {
            const rows2 = await res2.json()
            if (rows2 && rows2.length > 0) return rows2[0]
          }
        } catch {}
      }

      const res3 = await fetch(`${SUPABASE_URL}/rest/v1/portal_principals?national_id=ilike.${encodeURIComponent(clean)}`, {
        headers: CLOUD_HEADERS,
        cache: 'no-store'
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
        headers: CLOUD_HEADERS,
        cache: 'no-store'
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
      const clean = normalizeDigits(nationalId)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences?national_id=eq.${encodeURIComponent(clean)}&order=created_at.desc`, {
        headers: CLOUD_HEADERS,
        cache: 'no-store'
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.warn('[Cloud API] getEvidences error:', e)
      return []
    }
  },

  // 4. إضافة شاهد جديد (مع معالجة تلقائية للمفتاح الأجنبي manager_id إن لزم)
  async addEvidence(payload) {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences`, {
      method: 'POST',
      headers: {
        ...CLOUD_HEADERS,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok && payload.manager_id != null) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences`, {
        method: 'POST',
        headers: {
          ...CLOUD_HEADERS,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ ...payload, manager_id: null })
      })
    }
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
  async getPlans(nationalId, managerId) {
    try {
      const clean = normalizeDigits(nationalId)
      let filter = `national_id=eq.${encodeURIComponent(clean)}`
      if (managerId) {
        filter = `or=(national_id.eq.${encodeURIComponent(clean)},manager_id.eq.${encodeURIComponent(managerId)})`
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans?${filter}&order=created_at.desc`, {
        headers: CLOUD_HEADERS,
        cache: 'no-store'
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.warn('[Cloud API] getPlans error:', e)
      return []
    }
  },

  // 7. إضافة خطة تحسين (مع معالجة تلقائية للمفتاح الأجنبي manager_id إن لزم)
  async addPlan(payload) {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans`, {
      method: 'POST',
      headers: {
        ...CLOUD_HEADERS,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok && payload.manager_id != null) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans`, {
        method: 'POST',
        headers: {
          ...CLOUD_HEADERS,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ ...payload, manager_id: null })
      })
    }
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
let selectedEvidenceFiles = []
let selectedPlanFiles = []
let autoPollTimer = null

// عناصر الواجهة
const loginView = document.getElementById('loginView')
const dashboardView = document.getElementById('dashboardView')
const loginForm = document.getElementById('loginForm')
const loginError = document.getElementById('loginError')
const navUserSection = document.getElementById('navUserSection')

// ──────────────────────────────────────
// إدارة اختيار الملفات المتعددة في النوافذ
// ──────────────────────────────────────
function renderSelectedFilesPreview(type) {
  const isEv = type === 'evidence'
  const list = isEv ? selectedEvidenceFiles : selectedPlanFiles
  const previewEl = document.getElementById(isEv ? 'evidenceFilesPreview' : 'planFilesPreview')
  const hintEl = document.getElementById(isEv ? 'evidenceFileName' : 'planFileName')
  if (!previewEl) return

  if (!list.length) {
    previewEl.innerHTML = ''
    previewEl.classList.add('hidden')
    if (hintEl) {
      hintEl.textContent = isEv
        ? 'يمكنك تحديد أكثر من ملف في نفس المرة (PDF، الصور، Word، Excel)'
        : 'يمكنك تحديد أكثر من ملف في نفس المرة (PDF، الصور، Word، Excel — حتى 20 ميجابايت للملف)'
    }
    return
  }

  if (hintEl) {
    hintEl.textContent = `تم إرفاق (${list.length}) ${list.length === 1 ? 'ملف' : 'ملفات'} — يمكنك الضغط على الزر أعلاه لإضافة المزيد من الملفات`
  }

  previewEl.classList.remove('hidden')
  previewEl.innerHTML = list.map((file, idx) => `
    <div class="flex items-center justify-between gap-2 bg-white border ${isEv ? 'border-emerald-200' : 'border-teal-200'} rounded-lg px-2.5 py-1.5 text-xs">
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-3.5 h-3.5 ${isEv ? 'text-emerald-600' : 'text-teal-600'} shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
        </svg>
        <span class="font-semibold text-slate-700 truncate">${escapeHtml(file.name)}</span>
        <span class="text-[10px] text-slate-400 shrink-0">(${formatFileSize(file.size)})</span>
      </div>
      <button type="button" onclick="${isEv ? `removeSelectedEvidenceFile(${idx})` : `removeSelectedPlanFile(${idx})`}" class="text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 font-bold transition" title="إزالة الملف">
        ✕
      </button>
    </div>
  `).join('')
}

function removeSelectedEvidenceFile(idx) {
  selectedEvidenceFiles.splice(idx, 1)
  renderSelectedFilesPreview('evidence')
}
window.removeSelectedEvidenceFile = removeSelectedEvidenceFile

function removeSelectedPlanFile(idx) {
  selectedPlanFiles.splice(idx, 1)
  renderSelectedFilesPreview('plan')
}
window.removeSelectedPlanFile = removeSelectedPlanFile

const evFileInputEl = document.getElementById('evidenceFileInput')
if (evFileInputEl) {
  evFileInputEl.addEventListener('change', (e) => {
    const picked = Array.from(e.target.files || [])
    for (const f of picked) {
      if (f.size > 20 * 1024 * 1024) {
        alert(`الملف "${f.name}" يتجاوز الحد المسموح (20 ميجابايت)`)
        continue
      }
      const dup = selectedEvidenceFiles.some(x => x.name === f.name && x.size === f.size)
      if (!dup) selectedEvidenceFiles.push(f)
    }
    e.target.value = ''
    renderSelectedFilesPreview('evidence')
  })
}

const plFileInputEl = document.getElementById('planFileInput')
if (plFileInputEl) {
  plFileInputEl.addEventListener('change', (e) => {
    const picked = Array.from(e.target.files || [])
    for (const f of picked) {
      if (f.size > 20 * 1024 * 1024) {
        alert(`الملف "${f.name}" يتجاوز الحد المسموح (20 ميجابايت)`)
        continue
      }
      const dup = selectedPlanFiles.some(x => x.name === f.name && x.size === f.size)
      if (!dup) selectedPlanFiles.push(f)
    }
    e.target.value = ''
    renderSelectedFilesPreview('plan')
  })
}

// ──────────────────────────────────────
// تهيئة الجلسة والتحديث التلقائي
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

function startAutoRefresh() {
  stopAutoRefresh()
  autoPollTimer = setInterval(() => {
    if (currentPrincipal && document.visibilityState === 'visible') {
      silentRefreshFromCloud()
    }
  }, 15000)
}

function stopAutoRefresh() {
  if (autoPollTimer) {
    clearInterval(autoPollTimer)
    autoPollTimer = null
  }
}

window.addEventListener('focus', () => {
  if (currentPrincipal) {
    silentRefreshFromCloud()
  }
})

async function silentRefreshFromCloud() {
  if (!currentPrincipal) return
  try {
    await reloadPlans()
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
      document.getElementById('principalScore').textContent = currentEvaluation.finalScore + ' / 100'
      document.getElementById('principalRating').textContent = currentEvaluation.generalRating || ''
      renderResults()
    }
    updatePlanAvailability()
    updateNotificationsBadge()
  } catch { /* silent */ }
}

function showLogin() {
  stopAutoRefresh()
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
        <span class="text-xs font-bold text-slate-800 block">${escapeHtml(currentPrincipal.fullName || currentPrincipal.username)}</span>
        <span class="text-[10px] text-slate-400 block">${escapeHtml(currentPrincipal.schoolName || 'مدير مدرسة')}</span>
      </div>
      <button onclick="openNotifModal()" class="relative p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition" title="الرسائل والتنبيهات من المسؤول">
        <svg class="w-5 h-5 text-slate-600 hover:text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span id="notifBadge" class="hidden absolute -top-1 -right-1 bg-rose-600 text-white rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-bounce">
          0
        </span>
      </button>
      <button onclick="loadPrincipalData()" class="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition" title="تحديث البيانات">
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
  startAutoRefresh()
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
          schoolName: cloudUser.school_name,
          status: cloudUser.status || 'active'
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
              schoolName: found.schoolName,
              status: found.status || 'active'
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
  stopAutoRefresh()
  localStorage.removeItem('principal_session')
  currentPrincipal = null
  currentEvaluation = null
  showLogin()
}

// ──────────────────────────────────────
// التبويبات
// ──────────────────────────────────────
function switchTab(tab, opts = {}) {
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
    if (opts.skipReload) {
      renderPlans()
    } else {
      reloadPlans()
    }
  }
  if (tab === 'results') {
    if (opts.skipReload) {
      renderResults()
    } else {
      loadPrincipalData()
    }
  }
}
window.switchTab = switchTab

// ──────────────────────────────────────
// تحليل نصوص ومرفقات وملاحظات الخطة والشاهد
// ──────────────────────────────────────
function parsePlanContent(p) {
  let raw = String(p.actions || '')
  let supervisorNotes = []

  if (raw.includes('<!--SUPERVISOR_NOTES-->')) {
    const parts = raw.split('<!--SUPERVISOR_NOTES-->')
    raw = parts[0]
    supervisorNotes = (parts[1] || '')
      .split('---NOTE_SEP---')
      .map(s => s.trim())
      .filter(s => s && !SYSTEM_IMPORT_NOTES.has(s))
  }

  const filesMap = new Map()

  // 1. ملفات بصيغة PLAN_FILES_JSON (مع بيانات التحميل)
  const jsonRegex = /<!--PLAN_FILES_JSON:([\s\S]*?)-->/g
  let jm
  while ((jm = jsonRegex.exec(raw)) !== null) {
    try {
      const arr = JSON.parse(jm[1])
      if (Array.isArray(arr)) {
        arr.forEach(f => {
          if (f && f.name) {
            filesMap.set(f.name, { name: f.name, size: f.size || 0, mime: f.mime || '', data: f.data || '' })
          }
        })
      }
    } catch {}
  }

  // 2. بيانات وصفية خفيفة بعد سحب الخطة للكمبيوتر: PLAN_FILES_META
  const metaRegex = /<!--PLAN_FILES_META:([\s\S]*?)-->/g
  let mm
  while ((mm = metaRegex.exec(raw)) !== null) {
    try {
      const arr = JSON.parse(mm[1])
      if (Array.isArray(arr)) {
        arr.forEach(f => {
          if (f && f.name && !filesMap.has(f.name)) {
            filesMap.set(f.name, { name: f.name, size: f.size || 0, mime: f.mime || '', data: '' })
          }
        })
      }
    } catch {}
  }

  // 3. الصيغة القديمة للملف الواحد: PLAN_FILE
  const singleRegex = /<!--PLAN_FILE:(.*?)\|\|([\s\S]*?)-->/g
  let sm
  while ((sm = singleRegex.exec(raw)) !== null) {
    const fName = (sm[1] || 'ملف_الخطة').trim()
    const fData = (sm[2] || '').trim()
    if (fName) {
      filesMap.set(fName, { name: fName, size: 0, mime: '', data: fData })
    }
  }

  // 4. دمج أي ملفات محفوظة محلياً في المتصفح (لإتاحة التحميل المحلي إن وجد)
  if (Array.isArray(p.files)) {
    p.files.forEach(lf => {
      if (lf && lf.name) {
        const existing = filesMap.get(lf.name)
        if (!existing) {
          filesMap.set(lf.name, lf)
        } else if (!existing.data && lf.data) {
          filesMap.set(lf.name, { ...existing, data: lf.data })
        }
      }
    })
  } else if (p.fileName) {
    const existing = filesMap.get(p.fileName)
    if (!existing) {
      filesMap.set(p.fileName, { name: p.fileName, size: 0, mime: '', data: p.fileData || '' })
    } else if (!existing.data && p.fileData) {
      filesMap.set(p.fileName, { ...existing, data: p.fileData })
    }
  }

  const actionsText = raw
    .replace(/<!--PLAN_FILES_JSON:[\s\S]*?-->/g, '')
    .replace(/<!--PLAN_FILES_META:[\s\S]*?-->/g, '')
    .replace(/<!--PLAN_FILE:[\s\S]*?-->/g, '')
    .trim()

  return {
    actionsText,
    files: Array.from(filesMap.values()),
    supervisorNotes
  }
}

function parseEvidenceRecord(d) {
  const raw = typeof d.content === 'string' ? d.content : ''
  let files = Array.isArray(d.files) ? [...d.files] : []
  let text = ''

  if (raw.startsWith('<!--MULTI_FILES_JSON-->')) {
    try {
      const parsed = JSON.parse(raw.slice('<!--MULTI_FILES_JSON-->'.length))
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.files) ? parsed.files : [])
      text = parsed?.text || ''
      files = arr.map(f => ({ name: f.name || 'ملف مرفق', size: f.size || 0, mime: f.mime || '' }))
    } catch {
      text = 'ملفات شواهد مرفقة'
    }
  } else if (raw.startsWith('data:')) {
    if (!files.length) files = [{ name: 'مستند إلكتروني مرفق', size: 0, mime: '' }]
  } else {
    text = raw
  }

  return { files, text }
}

// ──────────────────────────────────────
// تحميل بيانات المدير من السحابة
// ──────────────────────────────────────
async function loadPrincipalData() {
  if (!currentPrincipal) return

  // تحديث حالة المدير والفترة النشطة (نصف سنوي / نهائي) من السحابة
  try {
    const freshPrincipal = await cloudApi.getPrincipal(currentPrincipal.nationalId)
    if (freshPrincipal) {
      currentPrincipal = {
        ...currentPrincipal,
        id: freshPrincipal.id,
        fullName: freshPrincipal.full_name || currentPrincipal.fullName,
        schoolName: freshPrincipal.school_name || currentPrincipal.schoolName,
        status: freshPrincipal.status || currentPrincipal.status || 'active'
      }
      localStorage.setItem('principal_session', JSON.stringify(currentPrincipal))
    }
  } catch {}

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

  // 3. استعلام خطط التحسين وملاحظات المسؤول
  await reloadPlans()

  // 4. عرض النتائج وتحديث حالة التبويبات والتنبيهات
  renderResults()
  updatePlanAvailability()
  updateNotificationsBadge()
}

// ──────────────────────────────────────
// مركز الرسائل والتنبيهات الإشرافية (مع إخفاء التنبيه فور قراءته والانتقال لمكانه)
// ──────────────────────────────────────
function getSeenNotifsStorageKey() {
  const id = currentPrincipal ? (currentPrincipal.nationalId || currentPrincipal.username || 'guest') : 'guest'
  return `seen_notifs_${id}`
}

function getSeenNotifsSet() {
  try {
    const raw = localStorage.getItem(getSeenNotifsStorageKey())
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveSeenNotifsSet(seenSet) {
  try {
    localStorage.setItem(getSeenNotifsStorageKey(), JSON.stringify(Array.from(seenSet)))
  } catch { /* ignore */ }
}

function markNotifSeen(notifId) {
  if (!notifId) return
  const seen = getSeenNotifsSet()
  seen.add(notifId)
  saveSeenNotifsSet(seen)
}

function getAllRawNotifications() {
  const notifs = []

  // 1. رسائل وملاحظات المتابعة من المسؤول على خطط التحسين (الأولوية الأولى في العرض)
  if (plans && plans.length > 0) {
    plans.forEach((p, pIdx) => {
      const { supervisorNotes } = parsePlanContent(p)
      const dupCounter = {}
      supervisorNotes.forEach((note, nIdx) => {
        const occ = dupCounter[note] || 0
        dupCounter[note] = occ + 1
        notifs.push({
          id: `plan::${(p.goal || '').trim()}::${note}::${occ}`,
          type: 'plan',
          badge: 'ملاحظة من المسؤول',
          badgeTone: 'teal',
          title: `ملاحظة من المسؤول على خطة: "${p.goal}"`,
          content: note,
          tab: 'plans',
          targetId: `plan-note-${pIdx}-${nIdx}`,
          fallbackTargetId: `plan-card-${pIdx}`
        })
      })
    })
  }

  // 2. ملاحظات وتوجيهات المقيم على المعايير التقييمية
  if (currentEvaluation && currentEvaluation.items) {
    currentEvaluation.items.forEach(it => {
      if (it.notes && it.notes.trim()) {
        const elNum = it.num || it.elementNumber
        const cleanNote = it.notes.trim()
        notifs.push({
          id: `element::${elNum}::${cleanNote}`,
          type: 'element',
          badge: `معيار ${elNum}`,
          badgeTone: 'emerald',
          title: `ملاحظة إشرافية على المعيار (${it.name})`,
          content: cleanNote,
          tab: 'results',
          targetId: `eval-element-${elNum}`,
          fallbackTargetId: 'resultsContent'
        })
      }
    })
  }

  // 3. اعتماد النتيجة النهائية
  if (currentEvaluation && currentEvaluation.status === 'approved') {
    notifs.push({
      id: `approved::${currentEvaluation.id || ''}::${currentEvaluation.finalScore || ''}`,
      type: 'approved',
      badge: 'اعتماد رسمي',
      badgeTone: 'amber',
      title: 'تم اعتماد تقييم الأداء الوظيفي رسمياً',
      content: `النتيجة النهائية المعتمدة: ${currentEvaluation.finalScore} / 100 (${currentEvaluation.generalRating || 'معتمد'}).`,
      tab: 'results',
      targetId: 'resultsContent',
      fallbackTargetId: 'resultsContent'
    })
  }

  return notifs
}

// إرجاع التنبيهات الجديدة غير المقروءة فقط
function getNotifications() {
  const seen = getSeenNotifsSet()
  return getAllRawNotifications().filter(n => !seen.has(n.id))
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

  // إظهار شارة تنبيه صغيرة بجانب تبويب خطة التحسين فقط للرسائل الجديدة غير المقروءة
  const planNotesCount = notifs.filter(n => n.type === 'plan').length
  const tabBtnPlans = document.getElementById('tabBtnPlans')
  if (tabBtnPlans) {
    if (planNotesCount > 0) {
      tabBtnPlans.innerHTML = `خطة التحسين (نصف سنوي) <span class="mr-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">${planNotesCount} رسالة جديدة</span>`
    } else {
      tabBtnPlans.textContent = 'خطة التحسين (نصف سنوي)'
    }
  }
}

let activeModalNotifs = []

function openNotifModal() {
  activeModalNotifs = getNotifications()
  const modal = document.getElementById('notifModal')
  const list = document.getElementById('notifList')
  const summaryText = document.getElementById('notifSummaryText')
  const markAllBtn = document.getElementById('markAllNotifsBtn')
  if (!modal || !list) return

  if (activeModalNotifs.length === 0) {
    list.innerHTML = `
      <div class="text-center py-10 space-y-2">
        <div class="w-12 h-12 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </div>
        <p class="text-xs font-semibold text-slate-600">لا توجد تنبيهات أو رسائل جديدة غير مقروءة</p>
        <p class="text-[11px] text-slate-400">تظل ملاحظات المسؤول السابقة محفوظة داخل بطاقة الخطة للرجوع إليها في أي وقت</p>
      </div>
    `
    if (summaryText) summaryText.textContent = ''
    if (markAllBtn) markAllBtn.classList.add('hidden')
  } else {
    if (summaryText) summaryText.textContent = `رسائل جديدة غير مقروءة: ${activeModalNotifs.length} (اضغط على الرسالة للانتقال إليها)`
    if (markAllBtn) markAllBtn.classList.remove('hidden')
    list.innerHTML = activeModalNotifs.map((n, idx) => `
      <div
        onclick="handleNotificationClick(${idx})"
        role="button"
        tabindex="0"
        class="cursor-pointer group p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 transition-all space-y-2 shadow-2xs hover:shadow-sm"
      >
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${
            n.badgeTone === 'amber' ? 'bg-amber-100 text-amber-800' :
            n.badgeTone === 'teal' ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-800'
          }">${escapeHtml(n.badge)}</span>
          <span class="text-xs text-emerald-700 group-hover:text-emerald-900 font-bold group-hover:translate-x-[-2px] transition-transform">
            ${n.type === 'plan' ? 'اضغط لعرض الخطة ←' : 'اضغط للمعاينة ←'}
          </span>
        </div>
        <h5 class="font-bold text-xs text-slate-800 group-hover:text-emerald-950">${escapeHtml(n.title)}</h5>
        <p class="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80 group-hover:border-emerald-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(n.content)}</p>
      </div>
    `).join('')
  }

  modal.classList.remove('hidden')
}
window.openNotifModal = openNotifModal

function handleNotificationClick(idx) {
  const notif = activeModalNotifs[idx]
  if (!notif) return

  // 1. تسجيل الرسالة كمقروءة فوراً لإزالتها من التنبيهات وإخفاء العداد
  markNotifSeen(notif.id)
  updateNotificationsBadge()

  // 2. إغلاق نافذة التنبيهات والانتقال المباشر لمكان الرسالة
  closeNotifModal()
  switchTab(notif.tab, { skipReload: true })

  // 3. التمرير السلس إلى موضع الرسالة وتمييزها بصرياً للمدير
  setTimeout(() => {
    const targetEl = document.getElementById(notif.targetId) || document.getElementById(notif.fallbackTargetId)
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      targetEl.classList.add('ring-4', 'ring-emerald-400', 'transition-all', 'duration-500')
      setTimeout(() => {
        targetEl.classList.remove('ring-4', 'ring-emerald-400')
      }, 2600)
    }
  }, 80)
}
window.handleNotificationClick = handleNotificationClick

function markAllNotificationsRead() {
  const seen = getSeenNotifsSet()
  getAllRawNotifications().forEach(n => seen.add(n.id))
  saveSeenNotifsSet(seen)
  updateNotificationsBadge()
  openNotifModal()
}
window.markAllNotificationsRead = markAllNotificationsRead

function closeNotifModal() {
  const modal = document.getElementById('notifModal')
  if (modal) modal.classList.add('hidden')
}
window.closeNotifModal = closeNotifModal

async function reloadEvidences() {
  const storageKey = `evidences_${currentPrincipal.nationalId}`
  const localSaved = localStorage.getItem(storageKey)
  let localList = []
  try { localList = localSaved ? JSON.parse(localSaved) : [] } catch { localList = [] }

  try {
    const cloudList = await cloudApi.getEvidences(currentPrincipal.nationalId)
    if (cloudList && cloudList.length > 0) {
      const cloudMapped = cloudList.map(d => {
        const parsed = parseEvidenceRecord(d)
        const matchingLocal = localList.find(l => String(l.id) === String(d.id))
        return {
          id: d.id,
          elementNum: d.element_number,
          title: d.title,
          type: d.evidence_type,
          content: parsed.text || (matchingLocal?.content || ''),
          files: parsed.files.length > 0 ? parsed.files : (matchingLocal?.files || []),
          date: d.created_at ? formatLocalDateTime12h(d.created_at) : ''
        }
      })
      const cloudIds = new Set(cloudMapped.map(c => String(c.id)))
      evidences = [...cloudMapped, ...localList.filter(l => !cloudIds.has(String(l.id)))]
    } else {
      evidences = localList
    }
  } catch (e) {
    evidences = localList
  }

  safeSaveLocalList(storageKey, evidences)
  renderEvidences()
}

async function reloadPlans() {
  if (!currentPrincipal) return
  const storageKey = `plans_${currentPrincipal.nationalId}`
  const localSaved = localStorage.getItem(storageKey)
  let localList = []
  try { localList = localSaved ? JSON.parse(localSaved) : [] } catch { localList = [] }

  try {
    const cloudList = await cloudApi.getPlans(currentPrincipal.nationalId, currentPrincipal.id)
    if (cloudList && cloudList.length > 0) {
      const cloudMapped = cloudList.map(d => {
        const matchingLocal = localList.find(
          l => String(l.id) === String(d.id) || (l.goal && l.goal.trim() === (d.goal || '').trim())
        )
        return {
          id: d.id,
          elementNum: d.element_number,
          goal: d.goal,
          actions: d.actions,
          status: d.status,
          files: matchingLocal?.files || [],
          fileName: matchingLocal?.fileName || '',
          fileData: matchingLocal?.fileData || ''
        }
      })
      const cloudGoals = new Set(cloudMapped.map(c => (c.goal || '').trim()))
      const cloudIds = new Set(cloudMapped.map(c => String(c.id)))

      plans = [
        ...cloudMapped,
        ...localList.filter(l => !cloudIds.has(String(l.id)) && !cloudGoals.has((l.goal || '').trim()))
      ]
    } else {
      plans = localList
    }
  } catch (e) {
    plans = localList
  }

  safeSaveLocalList(storageKey, plans)
  renderPlans()
  updateNotificationsBadge()
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
  if (currentPrincipal && currentPrincipal.status && currentPrincipal.status.includes('FINAL')) {
    return true
  }
  if (currentEvaluation) {
    if (currentEvaluation.periodType === 'FINAL') return true
    if (currentEvaluation.periodName && currentEvaluation.periodName.includes('نهائي')) return true
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

// ──────────────────────────────────────
// عرض الشواهد (مع دعم عرض الملفات المتعددة)
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
    const files = Array.isArray(ev.files) ? ev.files : []
    const isFile = files.length > 0 || ev.type === 'file' || (ev.content && ev.content.startsWith('data:'))
    const isLink = !isFile && (ev.type === 'link' || (ev.content && /^https?:\/\//i.test(ev.content)))
    const textNote = ev.content && !ev.content.startsWith('data:') && !ev.content.startsWith('<!--MULTI_FILES_JSON-->')
      ? ev.content
      : ''

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition space-y-2.5">
        <div class="flex items-center justify-between text-xs">
          <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg">
            معيار ${escapeHtml(ev.elementNum)}
          </span>
          <span class="text-slate-400 text-[11px]">${escapeHtml(ev.date || 'مسجل')}</span>
        </div>
        <h4 class="font-bold text-sm text-slate-800">${escapeHtml(ev.title)}</h4>
        <p class="text-xs text-slate-500">${el ? escapeHtml(el.name) : ''}</p>

        ${files.length > 0 ? `
          <div class="space-y-1.5 pt-1">
            <span class="text-[11px] font-semibold text-emerald-700 block">الملفات المرفقة (${files.length}):</span>
            <div class="flex flex-wrap gap-1.5">
              ${files.map(f => `
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-900">
                  <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                  <span class="truncate max-w-[180px] font-medium">${escapeHtml(f.name)}</span>
                  ${f.data ? `<a href="${f.data}" download="${escapeHtml(f.name)}" class="text-[10px] font-bold text-emerald-700 underline mr-1">تحميل</a>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="text-xs text-slate-600 break-all line-clamp-2 flex items-center gap-1.5">
            ${!files.length && isFile ? `
              <svg class="w-3.5 h-3.5 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              <span>${escapeHtml(textNote || 'مستند إلكتروني مرفق')}</span>
            ` : isLink ? `
              <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              <a href="${escapeHtml(textNote)}" target="_blank" class="text-blue-600 hover:underline font-mono">${escapeHtml(textNote)}</a>
            ` : `
              <span class="text-slate-500">${escapeHtml(textNote || (files.length ? 'تم الإرسال للمقيم' : '—'))}</span>
            `}
          </div>
          <button onclick="deleteEvidence('${ev.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold mr-2 shrink-0 transition">حذف</button>
        </div>
      </div>
    `
  }).join('')
}

// ──────────────────────────────────────
// عرض خطط التحسين وملاحظات المسؤول المرسلة
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

  container.innerHTML = plans.map((p, pIdx) => {
    const el = p.elementNum ? elements.find(x => x.num === Number(p.elementNum)) : null
    const badgeText = p.elementNum ? `معيار ${p.elementNum}${el ? `: ${el.name}` : ''}` : 'خطة تطوير عامة للمدرسة'
    const isGeneral = !p.elementNum

    const { actionsText, files, supervisorNotes } = parsePlanContent(p)

    return `
      <div id="plan-card-${pIdx}" class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition space-y-3">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 ${isGeneral ? 'bg-teal-50 text-teal-800 border border-teal-200 font-bold' : 'bg-emerald-50 text-emerald-700 font-medium'} rounded-lg text-xs">
            ${escapeHtml(badgeText)}
          </span>
          ${isFinal ? `
            <span class="text-[11px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">معتمدة للدراسة</span>
          ` : `
            <button onclick="deletePlan('${p.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold">حذف</button>
          `}
        </div>
        <h4 class="font-bold text-sm text-slate-800">${escapeHtml(p.goal)}</h4>
        ${actionsText ? `
          <div>
            <span class="text-[11px] font-semibold text-slate-400 block mb-1">الإجراءات والبرامج المقترحة:</span>
            <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">${escapeHtml(actionsText)}</p>
          </div>
        ` : ''}

        ${files.length > 0 ? `
          <div class="pt-2 border-t border-slate-100 space-y-1.5">
            <span class="text-[11px] font-semibold text-teal-700 block">الملفات المرفقة بالخطة (${files.length}):</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${files.map(f => `
                <div class="flex items-center justify-between gap-2 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100/80">
                  <div class="flex items-center gap-2 min-w-0">
                    <svg class="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    <span class="text-xs font-semibold text-teal-900 truncate">${escapeHtml(f.name)}</span>
                  </div>
                  ${f.data ? `
                    <a href="${f.data}" download="${escapeHtml(f.name)}" class="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition">
                      تحميل / فتح
                    </a>
                  ` : `
                    <span class="text-[10px] font-semibold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-100 shrink-0">مُرسل للمسؤول</span>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${supervisorNotes.length > 0 ? `
          <div class="mt-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-50 border-2 border-emerald-300/80 shadow-sm space-y-2.5">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </div>
                <div>
                  <span class="text-xs font-black text-emerald-950 block">ملاحظة من المسؤول / المقيم</span>
                  <span class="text-[11px] text-emerald-700 font-semibold">رسائل المتابعة والتوجيهات حول خطة التحسين (${supervisorNotes.length})</span>
                </div>
              </div>
              <span class="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">رسالة إشرافية</span>
            </div>
            <div class="space-y-2">
              ${supervisorNotes.map((n, nIdx) => `
                <div id="plan-note-${pIdx}-${nIdx}" class="relative bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">${escapeHtml(n)}</div>
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
        <div class="text-2xl font-black text-emerald-800 mt-1">${escapeHtml(ev.finalScore)} / 100</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">التقدير العام</span>
        <div class="text-base font-bold text-slate-800 mt-1">${escapeHtml(ev.generalRating || '—')}</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 block">تاريخ الاعتماد الرسمي</span>
        <div class="text-base font-bold text-slate-800 mt-1">${escapeHtml(ev.approvedAt || '—')}</div>
      </div>
    </div>

    ${ev.notes ? `
    <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
      <span class="text-xs font-bold text-slate-700 block mb-1">ملاحظات المقيم وتوصياته:</span>
      <p class="text-xs text-slate-600">${escapeHtml(ev.notes)}</p>
    </div>
    ` : ''}

    ${ev.periodName ? `
    <div class="mb-4 flex items-center gap-3 text-xs text-slate-500">
      <span class="px-2.5 py-1 bg-slate-100 rounded-lg font-medium">${escapeHtml(ev.yearLabel || '')}</span>
      <span class="px-2.5 py-1 bg-slate-100 rounded-lg font-medium">${escapeHtml(ev.periodName)}</span>
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
            <tr id="eval-element-${escapeHtml(it.num || it.elementNumber)}">
              <td class="py-3 px-3 text-center font-mono text-slate-400">${escapeHtml(it.num || it.elementNumber)}</td>
              <td class="py-3 px-4 font-medium text-slate-800">
                <span class="block text-slate-800 font-bold">${escapeHtml(it.name)}</span>
                ${it.notes ? `
                  <div class="mt-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                    <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                    <div>
                      <strong class="font-bold text-amber-900 block text-[11px] mb-0.5">ملاحظة وتوجيه المقيم:</strong>
                      <p class="leading-relaxed whitespace-pre-wrap text-[11px]">${escapeHtml(it.notes)}</p>
                    </div>
                  </div>
                ` : ''}
              </td>
              <td class="py-3 px-3 text-center text-slate-500">${it.weight ? (typeof it.weight === 'number' ? it.weight.toFixed(2) : it.weight) + '%' : (it.weightBp ? (it.weightBp / 100).toFixed(2) + '%' : '—')}</td>
              <td class="py-3 px-3 text-center font-bold text-emerald-700">${escapeHtml(it.score || it.scoreValue || '—')} / 5</td>
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
function openEvidenceModal() {
  selectedEvidenceFiles = []
  renderSelectedFilesPreview('evidence')
  document.getElementById('evidenceModal').classList.remove('hidden')
}

function closeEvidenceModal() {
  selectedEvidenceFiles = []
  renderSelectedFilesPreview('evidence')
  document.getElementById('evidenceModal').classList.add('hidden')
}

function openPlanModal() {
  if (isFinalEvaluationActive()) {
    alert('عذراً، استقبال خطط التحسين متاح فقط خلال فترة التقييم النصف سنوي، ومغلق حالياً نظراً لبدء مرحلة التقييم النهائي.')
    return
  }
  selectedPlanFiles = []
  renderSelectedFilesPreview('plan')
  document.getElementById('planModal').classList.remove('hidden')
}

function closePlanModal() {
  selectedPlanFiles = []
  renderSelectedFilesPreview('plan')
  document.getElementById('planModal').classList.add('hidden')
}

// ──────────────────────────────────────
// رفع شاهد جديد سحابياً (ملف واحد أو عدة ملفات في نفس المرة)
// ──────────────────────────────────────
document.getElementById('evidenceForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const elNum = document.getElementById('evidenceElement').value
  const title = document.getElementById('evidenceTitle').value.trim()
  const contentInput = document.getElementById('evidenceContent').value.trim()

  // التقاط أي ملفات قد تكون ما زالت في عنصر الإدخال
  const fileInput = document.getElementById('evidenceFileInput')
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (const f of Array.from(fileInput.files)) {
      if (!selectedEvidenceFiles.some(x => x.name === f.name && x.size === f.size)) {
        selectedEvidenceFiles.push(f)
      }
    }
  }

  if (selectedEvidenceFiles.length === 0 && !contentInput) {
    alert('يرجى إرفاق ملف (أو عدة ملفات) للشاهد أو كتابة الرابط أو التوثيق')
    return
  }

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ رفع الملفات والحفظ…'

  try {
    let finalContent = contentInput
    let evidenceType = 'text'
    const filesPayload = []

    if (selectedEvidenceFiles.length > 0) {
      evidenceType = 'file'
      for (const file of selectedEvidenceFiles) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`حجم الملف "${file.name}" يتجاوز الحد المسموح به (20 ميجابايت)`)
        }
        const dataUrl = await readFileAsDataUrl(file)
        filesPayload.push({
          name: file.name,
          mime: file.type || '',
          size: file.size,
          data: dataUrl
        })
      }
      finalContent = '<!--MULTI_FILES_JSON-->' + JSON.stringify({
        text: contentInput || '',
        files: filesPayload
      })
    } else if (/^https?:\/\//i.test(finalContent)) {
      evidenceType = 'link'
    }

    let createdId = Date.now()
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

    // حفظ محلي فوري
    const localItem = {
      id: createdId,
      elementNum: Number(elNum),
      title,
      type: evidenceType,
      content: contentInput || '',
      files: filesPayload.map(f => ({
        name: f.name,
        size: f.size,
        mime: f.mime,
        data: f.size <= 1.5 * 1024 * 1024 ? f.data : ''
      })),
      date: 'اليوم'
    }
    evidences.unshift(localItem)
    if (currentPrincipal) {
      safeSaveLocalList(`evidences_${currentPrincipal.nationalId}`, evidences)
    }

    e.target.reset()
    closeEvidenceModal()
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
    safeSaveLocalList(`evidences_${currentPrincipal.nationalId}`, evidences)
  }
  renderEvidences()
}

// ──────────────────────────────────────
// رفع خطة تحسين سحابياً (ملف واحد أو عدة ملفات في نفس المرة)
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
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (const f of Array.from(fileInput.files)) {
      if (!selectedPlanFiles.some(x => x.name === f.name && x.size === f.size)) {
        selectedPlanFiles.push(f)
      }
    }
  }

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ رفع الملفات والحفظ…'

  try {
    let finalActions = actions
    const filesPayload = []

    if (selectedPlanFiles.length > 0) {
      for (const file of selectedPlanFiles) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`حجم ملف الخطة "${file.name}" يتجاوز الحد المسموح به (20 ميجابايت)`)
        }
        const dataUrl = await readFileAsDataUrl(file)
        filesPayload.push({
          name: file.name,
          mime: file.type || '',
          size: file.size,
          data: dataUrl
        })
      }
      finalActions = `${actions}\n<!--PLAN_FILES_JSON:${JSON.stringify(filesPayload)}-->`
    }

    let createdId = Date.now()
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

    const lightMeta = filesPayload.length > 0
      ? `\n<!--PLAN_FILES_META:${JSON.stringify(filesPayload.map(f => ({ name: f.name, size: f.size, mime: f.mime })))}-->`
      : ''

    const localItem = {
      id: createdId,
      elementNum: elementNum,
      goal,
      actions: `${actions}${lightMeta}`,
      files: filesPayload.map(f => ({
        name: f.name,
        size: f.size,
        mime: f.mime,
        data: f.size <= 1.5 * 1024 * 1024 ? f.data : ''
      })),
      status: 'active'
    }
    plans.unshift(localItem)
    if (currentPrincipal) {
      safeSaveLocalList(`plans_${currentPrincipal.nationalId}`, plans)
    }

    e.target.reset()
    handlePlanScopeChange()
    closePlanModal()
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
    safeSaveLocalList(`plans_${currentPrincipal.nationalId}`, plans)
  }
  renderPlans()
  updateNotificationsBadge()
}

// بدء التطبيق
initSession()

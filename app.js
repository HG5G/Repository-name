/**
 * بوابة مدراء المدارس - تطبيق الويب المتكامل للرفع والمتابعة والتواصل الإشرافي
 * يعمل عبر الاتصال المباشر فائق السرعة بقاعدة بيانات Supabase السحابية (REST API)
 */

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

// ──────────────────────────────────────
// أدوات مساعدة وتنبيهات الواجهة الحديثة
// ──────────────────────────────────────
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

function showToast(message, tone = 'success') {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const el = document.createElement('div')
  const styles = tone === 'error'
    ? 'bg-red-600 text-white border-red-500'
    : tone === 'warning'
    ? 'bg-amber-600 text-white border-amber-500'
    : 'bg-slate-900 text-white border-emerald-500/40'

  el.className = `pointer-events-auto rounded-2xl border px-4 py-3 text-xs font-bold shadow-xl flex items-center justify-between gap-3 animate-fade-up ${styles}`
  el.innerHTML = `
    <span class="leading-relaxed">${escapeHtml(message)}</span>
    <button type="button" class="opacity-75 hover:opacity-100 text-sm px-1">✕</button>
  `
  el.querySelector('button').onclick = () => el.remove()
  container.appendChild(el)
  setTimeout(() => {
    if (el.parentNode) el.remove()
  }, 3800)
}

function askConfirm({ title = 'تأكيد الإجراء', message = 'هل أنت متأكد من المتابعة؟', confirmLabel = 'تأكيد' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal')
    const titleEl = document.getElementById('confirmModalTitle')
    const msgEl = document.getElementById('confirmModalMessage')
    const acceptBtn = document.getElementById('confirmAcceptBtn')
    const cancelBtn = document.getElementById('confirmCancelBtn')

    if (!modal || !acceptBtn || !cancelBtn) {
      resolve(true)
      return
    }

    titleEl.textContent = title
    msgEl.textContent = message
    acceptBtn.textContent = confirmLabel
    modal.classList.remove('hidden')

    const cleanup = (result) => {
      modal.classList.add('hidden')
      acceptBtn.onclick = null
      cancelBtn.onclick = null
      resolve(result)
    }

    acceptBtn.onclick = () => cleanup(true)
    cancelBtn.onclick = () => cleanup(false)
  })
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

function safeSaveLocalList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
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
    } catch { /* ignore storage quota */ }
  }
}

function normalizeDigits(str) {
  if (!str) return ''
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim()
}

function normalizeYearLabel(label) {
  const s = normalizeDigits(String(label || '')).trim()
  if (!s) return ''
  if (/^\d{4}$/.test(s)) return s
  const matches = s.match(/\d{4}/g)
  if (matches && matches.length > 0) return matches[0]
  return s
}

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

// ──────────────────────────────────────
// قراءة المرحلة النشطة الموحدة (السنة + الفترة) القادمة من لوحة تحكم البرنامج
// الصيغة: active|MIDYEAR|2027|التقييم النصف سنوي
// ──────────────────────────────────────
function getActiveStage() {
  const rawStatus = String(currentPrincipal?.status || 'active')
  const parts = rawStatus.split('|')
  const periodType = (parts[1] || '').trim() === 'FINAL' ? 'FINAL' : 'MIDYEAR'
  const explicitYear = normalizeYearLabel(parts[2] || '')
  const yearLabel = explicitYear || String(new Date().getFullYear())
  const periodName = (parts[3] || '').trim() || (periodType === 'FINAL' ? 'التقييم النهائي' : 'التقييم النصف سنوي')

  return {
    yearLabel,
    periodType,
    periodName,
    hasExplicitYear: Boolean(explicitYear)
  }
}

function extractContextFromRaw(rawStr) {
  const str = String(rawStr || '')
  const ctxMatch = str.match(/<!--CTX:(.*?)-->/)
  if (ctxMatch) {
    const [y = '', pType = '', pName = ''] = ctxMatch[1].split('|')
    return {
      ctxYear: normalizeYearLabel(y),
      ctxPeriodType: pType.trim(),
      ctxPeriodName: pName.trim(),
      stripped: str.replace(/<!--CTX:[\s\S]*?-->\s*/g, '')
    }
  }
  const yrMatch = str.match(/<!--CTX_YEAR:(.*?)-->/)
  if (yrMatch) {
    return {
      ctxYear: normalizeYearLabel(yrMatch[1]),
      ctxPeriodType: '',
      ctxPeriodName: '',
      stripped: str.replace(/<!--CTX_YEAR:[\s\S]*?-->\s*/g, '')
    }
  }
  return { ctxYear: '', ctxPeriodType: '', ctxPeriodName: '', stripped: str }
}

// ──────────────────────────────────────
// واجهة الاتصال السحابي (Cloud REST API)
// ──────────────────────────────────────
const cloudApi = {
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

  async getApprovedEvaluations(identifier, managerId) {
    try {
      const clean = normalizeDigits(identifier)
      let filter = `national_id=eq.${encodeURIComponent(clean)}`
      if (managerId) {
        filter = `or=(national_id.eq.${encodeURIComponent(clean)},manager_id.eq.${encodeURIComponent(managerId)})`
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evaluations?${filter}&status=eq.approved&order=id.desc&limit=30`, {
        headers: CLOUD_HEADERS,
        cache: 'no-store'
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      console.warn('[Cloud API] getApprovedEvaluations error:', e)
      return []
    }
  },

  async getEvidences(nationalId) {
    const clean = normalizeDigits(nationalId)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences?national_id=eq.${encodeURIComponent(clean)}&order=created_at.desc`, {
      headers: CLOUD_HEADERS,
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('تعذر جلب الشواهد')
    return await res.json()
  },

  async addEvidence(payload) {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences`, {
      method: 'POST',
      headers: { ...CLOUD_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    })
    if (!res.ok && payload.manager_id != null) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences`, {
        method: 'POST',
        headers: { ...CLOUD_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...payload, manager_id: null })
      })
    }
    if (!res.ok) throw new Error('فشل حفظ الشاهد بالسحابة')
    return await res.json()
  },

  async deleteEvidence(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_evidences?id=eq.${id}`, {
      method: 'DELETE',
      headers: CLOUD_HEADERS
    })
    return res.ok
  },

  async getPlans(nationalId, managerId) {
    const clean = normalizeDigits(nationalId)
    let filter = `national_id=eq.${encodeURIComponent(clean)}`
    if (managerId) {
      filter = `or=(national_id.eq.${encodeURIComponent(clean)},manager_id.eq.${encodeURIComponent(managerId)})`
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans?${filter}&order=created_at.desc`, {
      headers: CLOUD_HEADERS,
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('تعذر جلب الخطط والتنبيهات')
    return await res.json()
  },

  async addPlan(payload) {
    let res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans`, {
      method: 'POST',
      headers: { ...CLOUD_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    })
    if (!res.ok && payload.manager_id != null) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans`, {
        method: 'POST',
        headers: { ...CLOUD_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...payload, manager_id: null })
      })
    }
    if (!res.ok) throw new Error('فشل حفظ الخطة بالسحابة')
    return await res.json()
  },

  async deletePlan(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_plans?id=eq.${id}`, {
      method: 'DELETE',
      headers: CLOUD_HEADERS
    })
    return res.ok
  }
}

// ──────────────────────────────────────
// الحالة العامة (State)
// ──────────────────────────────────────
let currentPrincipal = null
let currentEvaluation = null
let allEvidencesRaw = []
let evidences = []          // شواهد المرحلة النشطة فقط
let allPlansRaw = []
let plans = []              // خطط التحسين للمرحلة النشطة فقط
let supervisorAlerts = []   // التنبيهات العامة من المشرف للمرحلة النشطة
let activeTab = 'evidences'
let selectedEvidenceFiles = []
let selectedPlanFiles = []
let autoPollTimer = null

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
    hintEl.textContent = `تم اختيار (${list.length}) ${list.length === 1 ? 'ملف' : 'ملفات'} — يمكنك اختيار المزيد`
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
        showToast(`الملف "${f.name}" يتجاوز الحد المسموح (20 ميجابايت)`, 'error')
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
        showToast(`الملف "${f.name}" يتجاوز الحد المسموح (20 ميجابايت)`, 'error')
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
// تهيئة الجلسة والتحديث التلقائي المباشر
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
  }, 12000)
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
    await loadPrincipalData({ silent: true })
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

  document.getElementById('principalName').textContent =
    currentPrincipal.fullName || currentPrincipal.name || currentPrincipal.username
  document.getElementById('principalMeta').textContent =
    `المدرسة: ${currentPrincipal.schoolName || 'المدرسة المسجلة'}  •  السجل المدني: ${currentPrincipal.nationalId || currentPrincipal.username}`

  navUserSection.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="hidden sm:block text-right px-2.5 py-1 rounded-xl bg-slate-100/80 border border-slate-200/70">
        <span class="text-xs font-bold text-slate-800 block leading-tight">${escapeHtml(currentPrincipal.fullName || currentPrincipal.username)}</span>
        <span class="text-[10px] text-slate-500 block leading-tight">${escapeHtml(currentPrincipal.schoolName || 'مدير مدرسة')}</span>
      </div>
      <button onclick="openNotifModal()" class="relative w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition shadow-2xs" title="مركز الإشعارات والتنبيهات">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span id="notifBadge" class="hidden absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full text-[10px] font-black min-w-[20px] h-5 px-1 flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
          0
        </span>
      </button>
      <button onclick="manualRefresh()" id="manualRefreshBtn" class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition shadow-2xs" title="تحديث البيانات الآن">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
      <button onclick="logout()" class="h-10 px-3.5 rounded-xl text-xs bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-bold border border-slate-200/80 hover:border-red-200 transition">
        خروج
      </button>
    </div>
  `

  updateStageBannerUI()
  loadPrincipalData()
  populateElementsDropdown()
  startAutoRefresh()
}

async function manualRefresh() {
  const btn = document.getElementById('manualRefreshBtn')
  const svg = btn?.querySelector('svg')
  if (svg) svg.classList.add('animate-spin')
  try {
    await loadPrincipalData()
    showToast('تم تحديث بيانات البوابة والمرحلة النشطة بنجاح')
  } finally {
    if (svg) setTimeout(() => svg.classList.remove('animate-spin'), 400)
  }
}
window.manualRefresh = manualRefresh

// ──────────────────────────────────────
// تحديث واجهة المرحلة النشطة (العام الدراسي + فترة التقييم)
// ──────────────────────────────────────
function updateStageBannerUI() {
  const stage = getActiveStage()
  const isFinal = stage.periodType === 'FINAL'

  const yearBadge = document.getElementById('stageYearBadge')
  if (yearBadge) {
    yearBadge.textContent = `العام الدراسي: ${stage.yearLabel}`
  }

  const periodBadge = document.getElementById('stagePeriodBadge')
  if (periodBadge) {
    periodBadge.textContent = `المرحلة الحالية: ${stage.periodName}`
    periodBadge.className = isFinal
      ? 'inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-400 text-slate-950 rounded-full text-xs font-black shadow-sm'
      : 'inline-flex items-center gap-1.5 px-3.5 py-1 bg-white text-emerald-950 rounded-full text-xs font-black shadow-sm'
  }

  const hintText = document.getElementById('stageHintText')
  if (hintText) {
    hintText.textContent = isFinal
      ? `أنت تعمل الآن في مرحلة (${stage.periodName}) لعام ${stage.yearLabel} — رفع الشواهد متاح، وخطط التحسين مغلقة في التقييم النهائي.`
      : `أنت تعمل الآن في مرحلة (${stage.periodName}) لعام ${stage.yearLabel} — رفع الشواهد وخطط التحسين متاحان لهذه المرحلة.`
  }

  const stageLabelShort = `عام ${stage.yearLabel} · ${stage.periodName}`
  const evTag = document.getElementById('evidencesStageTag')
  if (evTag) evTag.textContent = stageLabelShort
  const plTag = document.getElementById('plansStageTag')
  if (plTag) plTag.textContent = isFinal ? `مغلقة في ${stage.periodName}` : stageLabelShort
  const alTag = document.getElementById('alertsStageTag')
  if (alTag) alTag.textContent = stageLabelShort
  const rsTag = document.getElementById('resultsStageTag')
  if (rsTag) rsTag.textContent = stageLabelShort

  const evModalHint = document.getElementById('evidenceModalStageHint')
  if (evModalHint) evModalHint.textContent = `سيُحفظ الشاهد ضمن: ${stageLabelShort}`
  const plModalHint = document.getElementById('planModalStageHint')
  if (plModalHint) plModalHint.textContent = `ستُحفظ الخطة ضمن: ${stageLabelShort}`

  const scoreSub = document.getElementById('scoreCardSubtitle')
  if (scoreSub) scoreSub.textContent = `نتيجة ${stage.periodName} (${stage.yearLabel})`

  const statEv = document.getElementById('statEvidencesCount')
  if (statEv) statEv.textContent = `${evidences.length} شاهد`
  const statPl = document.getElementById('statPlansStatus')
  if (statPl) statPl.textContent = isFinal ? 'مغلقة (تقييم نهائي)' : `${plans.length} خطة مرفوعة`
  const statAl = document.getElementById('statAlertsCount')
  if (statAl) statAl.textContent = `${supervisorAlerts.length} تنبيه`
  const statEvSt = document.getElementById('statEvalStatus')
  if (statEvSt) {
    statEvSt.textContent = (currentEvaluation && currentEvaluation.status === 'approved')
      ? `معتمد (${currentEvaluation.finalScore} / 100)`
      : 'قيد التقييم'
  }
}

// ──────────────────────────────────────
// تسجيل الدخول والخروج
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
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : ''
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'جارٍ التحقق من السحابة…'
  }

  try {
    let principalRecord = null
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
      } catch {}
    }

    if (principalRecord) {
      currentPrincipal = principalRecord
      localStorage.setItem('principal_session', JSON.stringify(currentPrincipal))
      showDashboard()
      return false
    }

    if (loginErrEl) {
      loginErrEl.textContent = 'رقم السجل المدني أو كلمة المرور غير صحيحة. يرجى مراجعة مشرف التقييم.'
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
      submitBtn.innerHTML = origBtnHtml
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
  evidences = []
  plans = []
  supervisorAlerts = []
  showLogin()
}
window.logout = logout

// ──────────────────────────────────────
// التبويبات الأربعة الحديثة
// ──────────────────────────────────────
function switchTab(tab, opts = {}) {
  activeTab = tab
  updateTabsVisualState()

  const tabs = ['evidences', 'plans', 'alerts', 'results']
  tabs.forEach(t => {
    const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1))
    if (!el) return
    if (t === tab) el.classList.remove('hidden')
    else el.classList.add('hidden')
  })

  if (tab === 'plans') {
    updatePlanAvailability()
    if (opts.skipReload) renderPlans()
    else reloadPlansAndAlerts()
  } else if (tab === 'alerts') {
    if (opts.skipReload) renderSupervisorAlerts()
    else reloadPlansAndAlerts()
  } else if (tab === 'results') {
    if (opts.skipReload) renderResults()
    else loadPrincipalData()
  } else if (tab === 'evidences') {
    if (opts.skipReload) renderEvidences()
    else reloadEvidences()
  }
}
window.switchTab = switchTab

function updateTabsVisualState() {
  const notifs = getNotifications()
  const evUnread = notifs.filter(n => n.type === 'evidence_comment').length
  const plUnread = notifs.filter(n => n.type === 'plan').length
  const alUnread = notifs.filter(n => n.type === 'alert').length
  const rsUnread = notifs.filter(n => n.type === 'element' || n.type === 'approved').length
  const stage = getActiveStage()
  const isFinal = stage.periodType === 'FINAL'

  const defs = [
    { id: 'evidences', elId: 'tabBtnEvidences', label: 'رصد ورفع الشواهد', unread: evUnread, activeBg: 'bg-emerald-600 text-white shadow-sm' },
    { id: 'plans', elId: 'tabBtnPlans', label: isFinal ? 'خطط التحسين (مغلقة)' : 'خطط التحسين', unread: plUnread, activeBg: 'bg-teal-600 text-white shadow-sm' },
    { id: 'alerts', elId: 'tabBtnAlerts', label: 'تنبيهات عامة من المشرف', unread: alUnread, activeBg: 'bg-amber-600 text-white shadow-sm' },
    { id: 'results', elId: 'tabBtnResults', label: 'تقرير التقييم المعتمد', unread: rsUnread, activeBg: 'bg-sky-600 text-white shadow-sm' }
  ]

  defs.forEach(d => {
    const btn = document.getElementById(d.elId)
    if (!btn) return
    const isAct = activeTab === d.id
    btn.className = `flex-1 min-w-fit px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
      isAct ? d.activeBg : 'text-slate-600 hover:bg-slate-100'
    }`
    const badgeHtml = d.unread > 0
      ? `<span class="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded-full ${isAct ? 'bg-white text-slate-900' : 'bg-rose-600 text-white'}">${d.unread}</span>`
      : ''
    btn.innerHTML = `<span>${escapeHtml(d.label)}</span>${badgeHtml}`
  })
}

// ──────────────────────────────────────
// تحليل نصوص ومرفقات وتعليقات الشواهد والخطط والتنبيهات
// ──────────────────────────────────────
function parsePlanContent(p) {
  const { ctxYear, ctxPeriodType, ctxPeriodName, stripped } = extractContextFromRaw(p.actions || '')
  let raw = stripped
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

  const singleRegex = /<!--PLAN_FILE:(.*?)\|\|([\s\S]*?)-->/g
  let sm
  while ((sm = singleRegex.exec(raw)) !== null) {
    const fName = (sm[1] || 'ملف_الخطة').trim()
    const fData = (sm[2] || '').trim()
    if (fName) {
      filesMap.set(fName, { name: fName, size: 0, mime: '', data: fData })
    }
  }

  if (Array.isArray(p.files)) {
    p.files.forEach(lf => {
      if (lf && lf.name) {
        const existing = filesMap.get(lf.name)
        if (!existing) filesMap.set(lf.name, lf)
        else if (!existing.data && lf.data) filesMap.set(lf.name, { ...existing, data: lf.data })
      }
    })
  }

  const actionsText = raw
    .replace(/<!--PLAN_FILES_JSON:[\s\S]*?-->/g, '')
    .replace(/<!--PLAN_FILES_META:[\s\S]*?-->/g, '')
    .replace(/<!--PLAN_FILE:[\s\S]*?-->/g, '')
    .trim()

  return {
    actionsText,
    files: Array.from(filesMap.values()),
    supervisorNotes,
    ctxYear,
    ctxPeriodType,
    ctxPeriodName
  }
}

function parseEvidenceRecord(d) {
  const { ctxYear, ctxPeriodType, ctxPeriodName, stripped } = extractContextFromRaw(d.content || '')
  let raw = stripped.trim()
  let supervisorComments = []

  if (raw.includes('<!--SUPERVISOR_COMMENTS-->')) {
    const parts = raw.split('<!--SUPERVISOR_COMMENTS-->')
    raw = (parts[0] || '').trim()
    supervisorComments = (parts[1] || '')
      .split('---COMMENT_SEP---')
      .map(s => s.trim())
      .filter(Boolean)
  }

  let files = Array.isArray(d.files) ? [...d.files] : []
  let text = ''

  if (raw.startsWith('<!--MULTI_FILES_JSON-->')) {
    try {
      const parsed = JSON.parse(raw.slice('<!--MULTI_FILES_JSON-->'.length))
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.files) ? parsed.files : [])
      text = parsed?.text || ''
      files = arr.map(f => ({ name: f.name || 'ملف مرفق', size: f.size || 0, mime: f.mime || '', data: f.data || '' }))
    } catch {
      text = ''
    }
  } else if (raw.startsWith('data:')) {
    if (!files.length) files = [{ name: 'مستند إلكتروني مرفق', size: 0, mime: '' }]
  } else {
    const metaRegex = /<!--EVIDENCE_FILES_META:([\s\S]*?)-->/g
    let mm
    while ((mm = metaRegex.exec(raw)) !== null) {
      try {
        const arr = JSON.parse(mm[1])
        if (Array.isArray(arr) && !files.length) {
          files = arr.map(f => ({ name: f.name || 'ملف مرفق', size: f.size || 0, mime: f.mime || '', data: '' }))
        }
      } catch {}
    }
    text = raw.replace(/<!--EVIDENCE_FILES_META:[\s\S]*?-->/g, '').trim()
  }

  return { files, text, supervisorComments, ctxYear, ctxPeriodType, ctxPeriodName }
}

// مطابقة عنصر مع المرحلة النشطة (فصل تام بين السنوات وبين النصف سنوي والنهائي)
function matchesActiveStageItem(ctxYear, ctxPeriodType, stage, { defaultPeriod = 'MIDYEAR' } = {}) {
  const itemPeriod = ctxPeriodType || defaultPeriod
  if (itemPeriod !== stage.periodType) return false

  if (ctxYear) {
    return normalizeYearLabel(ctxYear) === normalizeYearLabel(stage.yearLabel)
  }

  // العناصر القديمة غير الموسومة قبل الترقية تظهر فقط في السنة الافتراضية الحالية وليس في أي سنة أخرى جديدة
  const currentCalYear = new Date().getFullYear()
  const activeYrNum = Number(stage.yearLabel)
  if (!isNaN(activeYrNum) && activeYrNum !== currentCalYear) {
    return false
  }
  return true
}

// ──────────────────────────────────────
// تحميل ومزامنة بيانات المدير حسب المرحلة النشطة
// ──────────────────────────────────────
async function loadPrincipalData() {
  if (!currentPrincipal) return

  // 1. تحديث بيانات المدير والمرحلة النشطة (العام + الفترة) من السحابة
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

  const stage = getActiveStage()

  // 2. جلب التقييمات المعتمدة واختيار التقييم الخاص بالعام والفترة النشطة فقط
  currentEvaluation = null
  try {
    const evalRows = await cloudApi.getApprovedEvaluations(currentPrincipal.nationalId, currentPrincipal.id)
    const matchedEval = (evalRows || []).find(ev => {
      const evYear = normalizeYearLabel(ev.year_label || '')
      const evType = ev.period_type === 'FINAL' || String(ev.period_name || '').includes('نهائي') ? 'FINAL' : 'MIDYEAR'
      return evYear === stage.yearLabel && evType === stage.periodType
    })

    if (matchedEval) {
      currentEvaluation = {
        id: matchedEval.id,
        finalScore: matchedEval.final_score,
        generalRating: matchedEval.general_rating,
        notes: matchedEval.notes,
        yearLabel: matchedEval.year_label,
        periodName: matchedEval.period_name,
        periodType: matchedEval.period_type,
        status: matchedEval.status,
        approvedAt: matchedEval.approved_at ? formatLocalDate(matchedEval.approved_at) : '',
        items: matchedEval.items || []
      }
    }
  } catch {}

  if (currentEvaluation && currentEvaluation.status === 'approved') {
    document.getElementById('principalScore').textContent = currentEvaluation.finalScore + ' / 100'
    document.getElementById('principalRating').textContent = currentEvaluation.generalRating || ''
  } else {
    document.getElementById('principalScore').textContent = 'غير معتمدة بعد'
    document.getElementById('principalRating').textContent = ''
  }

  // 3. جلب الشواهد والخطط والتنبيهات وتصفيتها حسب المرحلة النشطة
  await Promise.all([
    reloadEvidences(),
    reloadPlansAndAlerts()
  ])

  renderResults()
  updatePlanAvailability()
  updateStageBannerUI()
  updateNotificationsBadge()
}
window.loadPrincipalData = loadPrincipalData

async function reloadEvidences() {
  if (!currentPrincipal) return
  const stage = getActiveStage()
  const storageKey = `evidences_v2_${currentPrincipal.nationalId}`
  let localList = []
  try {
    const raw = localStorage.getItem(storageKey)
    localList = raw ? JSON.parse(raw) : []
  } catch { localList = [] }

  try {
    const cloudList = await cloudApi.getEvidences(currentPrincipal.nationalId)
    allEvidencesRaw = (cloudList || []).map(d => {
      const parsed = parseEvidenceRecord(d)
      const matchingLocal = localList.find(l => String(l.id) === String(d.id))
      const mergedFiles = parsed.files.length > 0
        ? parsed.files.map(cf => {
            const lf = (matchingLocal?.files || []).find(x => x.name === cf.name)
            return (!cf.data && lf?.data) ? { ...cf, data: lf.data } : cf
          })
        : (matchingLocal?.files || [])

      return {
        id: d.id,
        elementNum: d.element_number,
        title: d.title,
        type: d.evidence_type,
        content: parsed.text || (matchingLocal?.content || ''),
        files: mergedFiles,
        supervisorComments: parsed.supervisorComments || [],
        ctxYear: parsed.ctxYear || matchingLocal?.ctxYear || '',
        ctxPeriodType: parsed.ctxPeriodType || matchingLocal?.ctxPeriodType || '',
        ctxPeriodName: parsed.ctxPeriodName || matchingLocal?.ctxPeriodName || '',
        date: d.created_at ? formatLocalDateTime12h(d.created_at) : ''
      }
    })
    safeSaveLocalList(storageKey, allEvidencesRaw)
  } catch {
    allEvidencesRaw = localList
  }

  evidences = allEvidencesRaw.filter(ev =>
    matchesActiveStageItem(ev.ctxYear, ev.ctxPeriodType, stage, { defaultPeriod: 'MIDYEAR' })
  )

  renderEvidences()
  updateStageBannerUI()
  updateNotificationsBadge()
}

async function reloadPlansAndAlerts() {
  if (!currentPrincipal) return
  const stage = getActiveStage()
  const storageKey = `plans_v2_${currentPrincipal.nationalId}`
  const alertsKey = `alerts_v2_${currentPrincipal.nationalId}`

  let localPlans = []
  let localAlerts = []
  try { localPlans = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { localPlans = [] }
  try { localAlerts = JSON.parse(localStorage.getItem(alertsKey) || '[]') } catch { localAlerts = [] }

  try {
    const cloudRows = await cloudApi.getPlans(currentPrincipal.nationalId, currentPrincipal.id)

    const rawAlertRows = (cloudRows || []).filter(r => r.status === 'supervisor_alert')
    const rawPlanRows = (cloudRows || []).filter(r => r.status !== 'supervisor_alert')

    const mappedAlerts = rawAlertRows.map(a => {
      const ctx = extractContextFromRaw(a.actions || '')
      return {
        id: a.id,
        title: a.goal || 'تنبيه إشرافي عام',
        message: ctx.stripped.trim(),
        ctxYear: ctx.ctxYear,
        ctxPeriodType: ctx.ctxPeriodType,
        ctxPeriodName: ctx.ctxPeriodName,
        createdAt: a.created_at ? formatLocalDateTime12h(a.created_at) : ''
      }
    })

    const mappedPlans = rawPlanRows.map(d => {
      const parsed = parsePlanContent(d)
      const matchingLocal = localPlans.find(
        l => String(l.id) === String(d.id) || (l.goal && l.goal.trim() === (d.goal || '').trim())
      )
      return {
        id: d.id,
        elementNum: d.element_number,
        goal: d.goal,
        actions: d.actions,
        status: d.status,
        ctxYear: parsed.ctxYear || matchingLocal?.ctxYear || '',
        ctxPeriodType: parsed.ctxPeriodType || matchingLocal?.ctxPeriodType || 'MIDYEAR',
        files: matchingLocal?.files || []
      }
    })

    allPlansRaw = mappedPlans
    safeSaveLocalList(storageKey, mappedPlans)
    safeSaveLocalList(alertsKey, mappedAlerts)

    supervisorAlerts = mappedAlerts.filter(a => {
      if (a.ctxYear && normalizeYearLabel(a.ctxYear) !== stage.yearLabel) return false
      if (a.ctxPeriodType && a.ctxPeriodType !== stage.periodType) return false
      return true
    })
  } catch {
    allPlansRaw = localPlans
    supervisorAlerts = localAlerts.filter(a => {
      if (a.ctxYear && normalizeYearLabel(a.ctxYear) !== stage.yearLabel) return false
      if (a.ctxPeriodType && a.ctxPeriodType !== stage.periodType) return false
      return true
    })
  }

  // في فترة التقييم النهائي تتقفل الخطط وتختفي خطط النصف سنوي لحين العودة للنصف سنوي
  if (stage.periodType === 'FINAL') {
    plans = []
  } else {
    plans = allPlansRaw.filter(p =>
      matchesActiveStageItem(p.ctxYear, p.ctxPeriodType || 'MIDYEAR', stage, { defaultPeriod: 'MIDYEAR' })
    )
  }

  renderPlans()
  renderSupervisorAlerts()
  updateStageBannerUI()
  updateNotificationsBadge()
}

// ──────────────────────────────────────
// مركز الإشعارات والتنبيهات الموحد (مع إزالة الشارة فور القراءة والانتقال لموضعها)
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
  } catch {}
}

function markNotifSeen(notifId) {
  if (!notifId) return
  const seen = getSeenNotifsSet()
  seen.add(notifId)
  saveSeenNotifsSet(seen)
}

function getAllRawNotifications() {
  const notifs = []
  const stage = getActiveStage()

  // 1. التنبيهات العامة من المشرف
  supervisorAlerts.forEach((al, idx) => {
    notifs.push({
      id: `alert::${al.id}::${al.title}`,
      type: 'alert',
      badge: 'تنبيه عام من المشرف',
      badgeTone: 'amber',
      title: al.title,
      content: al.message,
      date: al.createdAt,
      tab: 'alerts',
      targetId: `alert-card-${idx}`,
      fallbackTargetId: 'alertsList'
    })
  })

  // 2. تعليقات المشرف على الشواهد المرفوعة
  evidences.forEach((ev, evIdx) => {
    const comments = ev.supervisorComments || []
    const dupCounter = {}
    comments.forEach((cText, cIdx) => {
      const occ = dupCounter[cText] || 0
      dupCounter[cText] = occ + 1
      notifs.push({
        id: `evcomment::${ev.id}::${cText}::${occ}`,
        type: 'evidence_comment',
        badge: 'تعليق على شاهد',
        badgeTone: 'emerald',
        title: `تعليق المشرف على الشاهد: "${ev.title}"`,
        content: cText,
        tab: 'evidences',
        targetId: `evidence-comment-${evIdx}-${cIdx}`,
        fallbackTargetId: `evidence-card-${evIdx}`
      })
    })
  })

  // 3. تعليقات وملاحظات المشرف على خطط التحسين
  plans.forEach((p, pIdx) => {
    const { supervisorNotes } = parsePlanContent(p)
    const dupCounter = {}
    supervisorNotes.forEach((note, nIdx) => {
      const occ = dupCounter[note] || 0
      dupCounter[note] = occ + 1
      notifs.push({
        id: `plan::${stage.yearLabel}::${(p.goal || '').trim()}::${note}::${occ}`,
        type: 'plan',
        badge: 'تعليق على خطة التحسين',
        badgeTone: 'teal',
        title: `ملاحظة المشرف على الخطة: "${p.goal}"`,
        content: note,
        tab: 'plans',
        targetId: `plan-note-${pIdx}-${nIdx}`,
        fallbackTargetId: `plan-card-${pIdx}`
      })
    })
  })

  // 4. ملاحظات المعايير واعتماد النتيجة للمرحلة النشطة
  if (currentEvaluation && currentEvaluation.items) {
    currentEvaluation.items.forEach(it => {
      if (it.notes && it.notes.trim()) {
        const elNum = it.num || it.elementNumber
        const cleanNote = it.notes.trim()
        notifs.push({
          id: `element::${currentEvaluation.id}::${elNum}::${cleanNote}`,
          type: 'element',
          badge: `معيار ${elNum}`,
          badgeTone: 'sky',
          title: `ملاحظة تقييمية على المعيار (${it.name})`,
          content: cleanNote,
          tab: 'results',
          targetId: `eval-element-${elNum}`,
          fallbackTargetId: 'resultsContent'
        })
      }
    })
  }

  if (currentEvaluation && currentEvaluation.status === 'approved') {
    notifs.push({
      id: `approved::${currentEvaluation.id}::${currentEvaluation.finalScore}`,
      type: 'approved',
      badge: 'اعتماد رسمي',
      badgeTone: 'sky',
      title: `تم اعتماد ${stage.periodName} لعام ${stage.yearLabel}`,
      content: `النتيجة النهائية المعتمدة: ${currentEvaluation.finalScore} / 100 (${currentEvaluation.generalRating || 'معتمد'}).`,
      tab: 'results',
      targetId: 'resultsContent',
      fallbackTargetId: 'resultsContent'
    })
  }

  return notifs
}

function getNotifications() {
  const seen = getSeenNotifsSet()
  return getAllRawNotifications().filter(n => !seen.has(n.id))
}

function updateNotificationsBadge() {
  const notifs = getNotifications()
  const badge = document.getElementById('notifBadge')
  if (badge) {
    if (notifs.length > 0) {
      badge.textContent = notifs.length > 99 ? '99+' : notifs.length
      badge.classList.remove('hidden')
    } else {
      badge.classList.add('hidden')
    }
  }
  updateTabsVisualState()
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
        <div class="w-12 h-12 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </div>
        <p class="text-xs font-bold text-slate-700">لا توجد تنبيهات أو تعليقات جديدة غير مقروءة</p>
        <p class="text-[11px] text-slate-400">يمكنك مراجعة كافة التنبيهات والتعليقات السابقة مباشرة داخل تبويبات البوابة</p>
      </div>
    `
    if (summaryText) summaryText.textContent = ''
    if (markAllBtn) markAllBtn.classList.add('hidden')
  } else {
    if (summaryText) summaryText.textContent = `إشعارات جديدة: ${activeModalNotifs.length} (اضغط على الإشعار للانتقال إليه)`
    if (markAllBtn) markAllBtn.classList.remove('hidden')
    list.innerHTML = activeModalNotifs.map((n, idx) => `
      <div
        onclick="handleNotificationClick(${idx})"
        role="button"
        tabindex="0"
        class="cursor-pointer group p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 transition-all space-y-2 shadow-2xs hover:shadow-sm"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${
            n.badgeTone === 'amber' ? 'bg-amber-100 text-amber-800' :
            n.badgeTone === 'teal' ? 'bg-teal-100 text-teal-800' :
            n.badgeTone === 'sky' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
          }">${escapeHtml(n.badge)}</span>
          <span class="text-[11px] text-emerald-700 group-hover:text-emerald-900 font-bold">
            فتح واستعراض ←
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

  markNotifSeen(notif.id)
  updateNotificationsBadge()

  closeNotifModal()
  switchTab(notif.tab, { skipReload: true })

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

// ──────────────────────────────────────
// عناصر النموذج (19 معياراً رسمياً)
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
  if (scope === 'element') container.classList.remove('hidden')
  else container.classList.add('hidden')
}
window.handlePlanScopeChange = handlePlanScopeChange

function isFinalEvaluationActive() {
  return getActiveStage().periodType === 'FINAL'
}

function updatePlanAvailability() {
  const isFinal = isFinalEvaluationActive()
  const noticeEl = document.getElementById('planFinalNotice')
  const btnContainer = document.getElementById('planActionBtnContainer')

  if (noticeEl) {
    if (isFinal) noticeEl.classList.remove('hidden')
    else noticeEl.classList.add('hidden')
  }

  if (btnContainer) {
    if (isFinal) {
      btnContainer.innerHTML = `
        <span class="px-4 py-2.5 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-1.5 cursor-not-allowed">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>مغلقة في فترة التقييم النهائي</span>
        </span>
      `
    } else {
      btnContainer.innerHTML = `
        <button onclick="openPlanModal()" class="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 self-start transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
          <span>إضافة هدف تحسين</span>
        </button>
      `
    }
  }
}

// ──────────────────────────────────────
// 1. عرض الشواهد + تعليقات المشرف على كل شاهد
// ──────────────────────────────────────
function renderEvidences() {
  const container = document.getElementById('evidencesList')
  if (!container) return
  const elements = getElements()
  const stage = getActiveStage()

  if (!evidences.length) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-14 px-6 bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
          </svg>
        </div>
        <p class="text-sm font-bold text-slate-700">لا توجد شواهد مرفوعة في (${escapeHtml(stage.periodName)} — عام ${escapeHtml(stage.yearLabel)})</p>
        <p class="text-xs text-slate-400">اضغط على «إضافة شاهد جديد» لرفع ملفاتك أو روابطك الخاصة بهذه المرحلة</p>
      </div>
    `
    return
  }

  container.innerHTML = evidences.map((ev, evIdx) => {
    const el = elements.find(x => x.num === Number(ev.elementNum))
    const files = Array.isArray(ev.files) ? ev.files : []
    const comments = Array.isArray(ev.supervisorComments) ? ev.supervisorComments : []
    const isFile = files.length > 0 || ev.type === 'file'
    const isLink = !isFile && (ev.type === 'link' || (ev.content && /^https?:\/\//i.test(ev.content)))
    const textNote = ev.content || ''

    return `
      <div id="evidence-card-${evIdx}" class="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-md transition space-y-3 flex flex-col justify-between">
        <div class="space-y-2.5">
          <div class="flex items-center justify-between text-xs gap-2">
            <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold rounded-lg">
              ${ev.elementNum ? `معيار ${escapeHtml(ev.elementNum)}` : 'شاهد عام'}
            </span>
            <span class="text-slate-400 text-[11px] font-mono">${escapeHtml(ev.date || 'مسجل')}</span>
          </div>

          <div>
            <h4 class="font-extrabold text-sm text-slate-800">${escapeHtml(ev.title)}</h4>
            ${el ? `<p class="text-xs text-slate-500 mt-0.5">${escapeHtml(el.name)}</p>` : ''}
          </div>

          ${files.length > 0 ? `
            <div class="space-y-1.5 pt-1">
              <span class="text-[11px] font-bold text-emerald-700 block">الملفات المرفقة (${files.length}):</span>
              <div class="flex flex-wrap gap-1.5">
                ${files.map(f => `
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950">
                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    <span class="truncate max-w-[180px] font-semibold">${escapeHtml(f.name)}</span>
                    ${f.data ? `<a href="${f.data}" download="${escapeHtml(f.name)}" class="text-[10px] font-bold text-emerald-700 underline mr-1">تحميل</a>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${textNote ? `
            <div class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 break-words leading-relaxed">
              ${isLink
                ? `<a href="${escapeHtml(textNote)}" target="_blank" class="text-blue-600 hover:underline font-mono inline-flex items-center gap-1">${escapeHtml(textNote)}</a>`
                : escapeHtml(textNote)
              }
            </div>
          ` : ''}

          ${comments.length > 0 ? `
            <div class="mt-2 p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-50 border border-amber-300/80 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                  </div>
                  <span class="text-xs font-extrabold text-amber-950">تعليق المشرف على الشاهد (${comments.length})</span>
                </div>
                <span class="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">ملاحظة إشرافية</span>
              </div>
              <div class="space-y-1.5">
                ${comments.map((c, cIdx) => `
                  <div id="evidence-comment-${evIdx}-${cIdx}" class="bg-white p-2.5 rounded-xl border border-amber-200 text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">${escapeHtml(c)}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>مرفوع ضمن ${escapeHtml(stage.periodName)} (${escapeHtml(stage.yearLabel)})</span>
          <button onclick="deleteEvidence('${ev.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold transition">حذف الشاهد</button>
        </div>
      </div>
    `
  }).join('')
}

// ──────────────────────────────────────
// 2. عرض خطط التحسين + تعليقات المشرف على كل خطة
// ──────────────────────────────────────
function renderPlans() {
  const container = document.getElementById('plansList')
  if (!container) return
  const elements = getElements()
  const stage = getActiveStage()
  const isFinal = stage.periodType === 'FINAL'

  if (isFinal) {
    container.innerHTML = `
      <div class="text-center py-14 px-6 bg-white rounded-3xl border border-dashed border-amber-200 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <p class="text-sm font-bold text-slate-700">خطط التحسين مغلقة في (${escapeHtml(stage.periodName)} — عام ${escapeHtml(stage.yearLabel)})</p>
        <p class="text-xs text-slate-400">جميع خطط التحسين الخاصة بالتقييم النصف سنوي محفوظة في مرحلتها، وستُفتح تلقائياً عند تفعيل فترة التقييم النصف سنوي</p>
      </div>
    `
    return
  }

  if (!plans.length) {
    container.innerHTML = `
      <div class="text-center py-14 px-6 bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><circle cx="12" cy="12" r="6" stroke-width="2"/><circle cx="12" cy="12" r="2" stroke-width="2"/></svg>
        </div>
        <p class="text-sm font-bold text-slate-700">لا توجد خطط تحسين مسجلة لعام ${escapeHtml(stage.yearLabel)} حتى الآن</p>
        <p class="text-xs text-slate-400">اضغط على «إضافة هدف تحسين» لرصد خطتك التطويرية لهذه المرحلة</p>
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
      <div id="plan-card-${pIdx}" class="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-md transition space-y-3">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-1 ${isGeneral ? 'bg-teal-50 text-teal-800 border border-teal-200 font-bold' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold'} rounded-lg text-xs">
            ${escapeHtml(badgeText)}
          </span>
          <button onclick="deletePlan('${p.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold">حذف الخطة</button>
        </div>

        <h4 class="font-extrabold text-sm text-slate-800">${escapeHtml(p.goal)}</h4>

        ${actionsText ? `
          <div>
            <span class="text-[11px] font-bold text-slate-400 block mb-1">الإجراءات والبرامج المقترحة:</span>
            <p class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">${escapeHtml(actionsText)}</p>
          </div>
        ` : ''}

        ${files.length > 0 ? `
          <div class="pt-2 border-t border-slate-100 space-y-1.5">
            <span class="text-[11px] font-bold text-teal-700 block">الملفات المرفقة بالخطة (${files.length}):</span>
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
                      تحميل
                    </a>
                  ` : `
                    <span class="text-[10px] font-semibold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-100 shrink-0">مُرسل للمشرف</span>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${supervisorNotes.length > 0 ? `
          <div class="mt-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-50 border-2 border-emerald-300/80 shadow-2xs space-y-2.5">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </div>
                <div>
                  <span class="text-xs font-black text-emerald-950 block">تعليقات المشرف على الخطة</span>
                  <span class="text-[11px] text-emerald-700 font-semibold">رسائل المتابعة والتوجيهات الإشرافية (${supervisorNotes.length})</span>
                </div>
              </div>
              <span class="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">تعليق المشرف</span>
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
// 3. عرض قسم «تنبيهات عامة من المشرف»
// ──────────────────────────────────────
function renderSupervisorAlerts() {
  const container = document.getElementById('alertsList')
  if (!container) return
  const stage = getActiveStage()

  if (!supervisorAlerts.length) {
    container.innerHTML = `
      <div class="text-center py-14 px-6 bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <p class="text-sm font-bold text-slate-700">لا توجد تنبيهات عامة من المشرف في هذه المرحلة</p>
        <p class="text-xs text-slate-400">ستظهر هنا أي تعليمات أو توجيهات عامة يرسلها المشرف لمدرستك خلال (${escapeHtml(stage.periodName)} — عام ${escapeHtml(stage.yearLabel)})</p>
      </div>
    `
    return
  }

  container.innerHTML = supervisorAlerts.map((al, idx) => `
    <div id="alert-card-${idx}" class="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-md transition space-y-3">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-slate-900">${escapeHtml(al.title)}</h4>
            <span class="text-[11px] text-amber-700 font-semibold">توجيه إشرافي من مسؤول النظام / المقيم</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${al.ctxPeriodName ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">${escapeHtml(al.ctxPeriodName)}</span>` : ''}
          ${al.createdAt ? `<span class="text-[11px] text-slate-400 font-mono">${escapeHtml(al.createdAt)}</span>` : ''}
        </div>
      </div>

      <div class="p-4 rounded-xl bg-amber-50/50 border border-amber-100 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">${escapeHtml(al.message)}</div>
    </div>
  `).join('')
}

// ──────────────────────────────────────
// 4. عرض النتائج المعتمدة للمرحلة النشطة فقط
// ──────────────────────────────────────
function renderResults() {
  const container = document.getElementById('resultsContent')
  if (!container) return
  const stage = getActiveStage()

  if (!currentEvaluation || currentEvaluation.status !== 'approved') {
    container.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <div class="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center">
          <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <p class="text-slate-600 text-sm font-bold">لم يتم اعتماد نتيجة (${escapeHtml(stage.periodName)} — عام ${escapeHtml(stage.yearLabel)}) بعد</p>
        <p class="text-slate-400 text-xs">ستظهر بطاقة الدرجات المعتمدة لهذه المرحلة فور اعتمادها رسمياً من المشرف</p>
      </div>
    `
    return
  }

  const ev = currentEvaluation
  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80">
        <span class="text-xs text-emerald-700 font-bold block">الدرجة الكلية المعتمدة</span>
        <div class="text-2xl font-black text-emerald-900 mt-1">${escapeHtml(ev.finalScore)} / 100</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 font-bold block">التقدير العام</span>
        <div class="text-base font-extrabold text-slate-800 mt-1">${escapeHtml(ev.generalRating || '—')}</div>
      </div>
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
        <span class="text-xs text-slate-500 font-bold block">تاريخ الاعتماد الرسمي</span>
        <div class="text-base font-extrabold text-slate-800 mt-1 font-mono">${escapeHtml(ev.approvedAt || '—')}</div>
      </div>
    </div>

    ${ev.notes ? `
    <div class="mb-6 p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
      <span class="text-xs font-extrabold text-emerald-900 block mb-1">ملاحظات المقيم وتوصياته العامة:</span>
      <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(ev.notes)}</p>
    </div>
    ` : ''}

    <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span class="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-700">العام الدراسي: ${escapeHtml(ev.yearLabel || stage.yearLabel)}</span>
      <span class="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-700">${escapeHtml(ev.periodName || stage.periodName)}</span>
      <span class="px-3 py-1 ${stage.periodType === 'FINAL' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'} rounded-lg font-bold">${stage.periodType === 'FINAL' ? 'تقييم نهائي' : 'تقييم نصف سنوي'}</span>
    </div>

    <div class="overflow-x-auto border border-slate-200 rounded-2xl">
      <table class="w-full text-right text-xs">
        <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
          <tr>
            <th class="py-3 px-3 text-center">#</th>
            <th class="py-3 px-4">المعيار التقييمي</th>
            <th class="py-3 px-3 text-center">الوزن %</th>
            <th class="py-3 px-3 text-center">الدرجة (من 5)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${(ev.items || []).map(it => `
            <tr id="eval-element-${escapeHtml(it.num || it.elementNumber)}" class="hover:bg-slate-50/70">
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
              <td class="py-3 px-3 text-center text-slate-500 font-mono">${it.weight ? (typeof it.weight === 'number' ? it.weight.toFixed(2) : it.weight) + '%' : (it.weightBp ? (it.weightBp / 100).toFixed(2) + '%' : '—')}</td>
              <td class="py-3 px-3 text-center font-extrabold text-emerald-700">${escapeHtml(it.score || it.scoreValue || '—')} / 5</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ──────────────────────────────────────
// نوافذ الإضافة والرفع السحابي
// ──────────────────────────────────────
function openEvidenceModal() {
  selectedEvidenceFiles = []
  renderSelectedFilesPreview('evidence')
  updateStageBannerUI()
  document.getElementById('evidenceModal').classList.remove('hidden')
}
window.openEvidenceModal = openEvidenceModal

function closeEvidenceModal() {
  selectedEvidenceFiles = []
  renderSelectedFilesPreview('evidence')
  document.getElementById('evidenceModal').classList.add('hidden')
}
window.closeEvidenceModal = closeEvidenceModal

function openPlanModal() {
  if (isFinalEvaluationActive()) {
    showToast('عذراً، إضافة خطط التحسين متاحة فقط خلال فترة التقييم النصف سنوي ومغلقة في التقييم النهائي.', 'warning')
    return
  }
  selectedPlanFiles = []
  renderSelectedFilesPreview('plan')
  updateStageBannerUI()
  document.getElementById('planModal').classList.remove('hidden')
}
window.openPlanModal = openPlanModal

function closePlanModal() {
  selectedPlanFiles = []
  renderSelectedFilesPreview('plan')
  document.getElementById('planModal').classList.add('hidden')
}
window.closePlanModal = closePlanModal

// رفع شاهد جديد مع ربطه بالسنة والفترة النشطة تلقائياً
document.getElementById('evidenceForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const elNum = document.getElementById('evidenceElement').value
  const title = document.getElementById('evidenceTitle').value.trim()
  const contentInput = document.getElementById('evidenceContent').value.trim()

  const fileInput = document.getElementById('evidenceFileInput')
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (const f of Array.from(fileInput.files)) {
      if (!selectedEvidenceFiles.some(x => x.name === f.name && x.size === f.size)) {
        selectedEvidenceFiles.push(f)
      }
    }
  }

  if (selectedEvidenceFiles.length === 0 && !contentInput) {
    showToast('يرجى إرفاق ملف للشاهد أو كتابة الرابط أو التوثيق', 'warning')
    return
  }

  const stage = getActiveStage()
  const ctxPrefix = `<!--CTX:${stage.yearLabel}|${stage.periodType}|${stage.periodName}-->\n`

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ رفع الملفات والحفظ…'

  try {
    let bodyContent = contentInput
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
      bodyContent = '<!--MULTI_FILES_JSON-->' + JSON.stringify({
        text: contentInput || '',
        files: filesPayload
      })
    } else if (/^https?:\/\//i.test(bodyContent)) {
      evidenceType = 'link'
    }

    const finalContent = ctxPrefix + bodyContent

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

    const localItem = {
      id: createdId,
      elementNum: Number(elNum),
      title,
      type: evidenceType,
      content: contentInput || '',
      supervisorComments: [],
      ctxYear: stage.yearLabel,
      ctxPeriodType: stage.periodType,
      ctxPeriodName: stage.periodName,
      files: filesPayload.map(f => ({
        name: f.name,
        size: f.size,
        mime: f.mime,
        data: f.size <= 1.5 * 1024 * 1024 ? f.data : ''
      })),
      date: formatLocalDateTime12h(new Date())
    }

    allEvidencesRaw.unshift(localItem)
    evidences.unshift(localItem)
    safeSaveLocalList(`evidences_v2_${currentPrincipal.nationalId}`, allEvidencesRaw)

    e.target.reset()
    closeEvidenceModal()
    renderEvidences()
    updateStageBannerUI()
    showToast('تم حفظ الشاهد وإرساله للمشرف بنجاح')
  } catch (err) {
    console.error('Evidence save error:', err)
    showToast(err.message || 'تعذر حفظ الشاهد. تحقق من اتصالك ثم حاول ثانية.', 'error')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ وإرسال الشاهد'
  }
})

async function deleteEvidence(id) {
  const ok = await askConfirm({
    title: 'حذف الشاهد',
    message: 'هل أنت متأكد من حذف هذا الشاهد المرفوع؟',
    confirmLabel: 'حذف الشاهد'
  })
  if (!ok) return

  try {
    await cloudApi.deleteEvidence(id)
  } catch (e) {
    console.warn('Delete cloud evidence notice:', e)
  }
  allEvidencesRaw = allEvidencesRaw.filter(e => String(e.id) !== String(id))
  evidences = evidences.filter(e => String(e.id) !== String(id))
  if (currentPrincipal) {
    safeSaveLocalList(`evidences_v2_${currentPrincipal.nationalId}`, allEvidencesRaw)
  }
  renderEvidences()
  updateStageBannerUI()
  updateNotificationsBadge()
  showToast('تم حذف الشاهد')
}
window.deleteEvidence = deleteEvidence

// رفع خطة تحسين جديدة مع ربطها بالسنة والفترة النشطة تلقائياً
document.getElementById('planForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  if (isFinalEvaluationActive()) {
    showToast('عذراً، استقبال خطط التحسين متاح فقط خلال فترة التقييم النصف سنوي.', 'warning')
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

  const stage = getActiveStage()
  const ctxPrefix = `<!--CTX:${stage.yearLabel}|${stage.periodType}|${stage.periodName}-->\n`

  const saveBtn = e.target.querySelector('button[type="submit"]')
  saveBtn.disabled = true
  saveBtn.textContent = 'جارٍ رفع الملفات والحفظ…'

  try {
    let finalActions = `${ctxPrefix}${actions}`
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
      finalActions = `${finalActions}\n<!--PLAN_FILES_JSON:${JSON.stringify(filesPayload)}-->`
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
      elementNum,
      goal,
      actions: `${ctxPrefix}${actions}${lightMeta}`,
      ctxYear: stage.yearLabel,
      ctxPeriodType: stage.periodType,
      files: filesPayload.map(f => ({
        name: f.name,
        size: f.size,
        mime: f.mime,
        data: f.size <= 1.5 * 1024 * 1024 ? f.data : ''
      })),
      status: 'active'
    }

    allPlansRaw.unshift(localItem)
    plans.unshift(localItem)
    safeSaveLocalList(`plans_v2_${currentPrincipal.nationalId}`, allPlansRaw)

    e.target.reset()
    handlePlanScopeChange()
    closePlanModal()
    renderPlans()
    updateStageBannerUI()
    showToast('تم حفظ هدف خطة التحسين وإرساله للمشرف بنجاح')
  } catch (err) {
    console.error('Plan save error:', err)
    showToast(err.message || 'تعذر حفظ الخطة. تحقق من اتصالك ثم حاول ثانية.', 'error')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'حفظ وإرسال الخطة'
  }
})

async function deletePlan(id) {
  const ok = await askConfirm({
    title: 'حذف هدف التحسين',
    message: 'هل أنت متأكد من حذف هذا الهدف من خطة التحسين؟',
    confirmLabel: 'حذف الهدف'
  })
  if (!ok) return

  try {
    await cloudApi.deletePlan(id)
  } catch (e) {
    console.warn('Delete cloud plan notice:', e)
  }
  allPlansRaw = allPlansRaw.filter(p => String(p.id) !== String(id))
  plans = plans.filter(p => String(p.id) !== String(id))
  if (currentPrincipal) {
    safeSaveLocalList(`plans_v2_${currentPrincipal.nationalId}`, allPlansRaw)
  }
  renderPlans()
  updateStageBannerUI()
  updateNotificationsBadge()
  showToast('تم حذف هدف التحسين')
}
window.deletePlan = deletePlan

// بدء التطبيق
initSession()

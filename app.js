import { supabase } from './supabase.js';

const SUPABASE_FUNCTIONS_URL = 'https://hixuqxymfkqwtpgpowcz.supabase.co/functions/v1';

async function callEdgeFunction(path, body) {
    const token = app.state.session?.access_token;
    if (!token) throw new Error('로그인 세션이 없습니다. 다시 로그인해주세요.');
    const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`Edge Function ${path} error ${resp.status}:`, errBody);
        throw new Error(`Edge Function error: ${resp.status}`);
    }
    return resp.json();
}

function mapDbToJob(row) {
    return {
        id: row.id,
        company: row.company,
        role: row.role,
        deadline: row.deadline,
        sourceUrl: row.source_url,
        status: row.status,
        googleEventId: row.google_event_id,
        questions: row.questions || [],
        answers: row.answers || [],
        pdfs: row.pdfs || [],
    };
}

function mapJobToDb(job, userId) {
    return {
        id: job.id,
        user_id: userId,
        company: job.company || '',
        role: job.role || '',
        deadline: job.deadline || null,
        source_url: job.sourceUrl || null,
        status: job.status || 'todo',
        google_event_id: job.googleEventId || null,
        questions: job.questions || [],
        answers: job.answers || [],
        pdfs: job.pdfs || [],
    };
}

const app = {
    // ── Language / i18n ──────────────────────────────────────────────────
    lang: localStorage.getItem('appLang') || 'ko',
    _i18n: {
        ko: {
            loginDesc: '나만의 취업 준비 공간, 로그인 후 이용하세요.',
            loginBtn: 'Google로 시작하기',
            navDashboard:'대시보드', navAddjob:'공고 등록', navEditor:'자소서 에디터', navArchive:'과거 보관함',
            calWeek:'주간', calMonth:'월간',
            kanbanTodo:'지원 전', kanbanApplied:'지원 완료', kanbanInterview:'면접 예정',
            addjobLabel1:'1. 채용 공고 원문 URL', addjobUrlhint:'대시보드에서 바로가기를 위해 필수입니다.',
            addjobLabel2:'2. 공고 내용 텍스트 복붙 또는 캡처본(스크린샷)',
            addjobAttach:'사진 첨부', addjobParse:'내용 파싱',
            parsingLoader:'AI가 공고의 핵심 정보를 추출하고 있습니다...',
            parsedTitle:'AI 파싱 완료',
            fieldCompany:'기업명', fieldRole:'직무', fieldDeadline:'마감일', fieldAlways:'상시모집', fieldQuestions:'자기소개서 문항',
            saveDashboard:'저장하고 대시보드로 이동',
            editorImport:'불러오기', editorSelectq:'작성할 문항을 왼쪽에서 선택해주세요.',
            editorReady:'에디터 준비됨', spellCheck:'맞춤법 검사', charCount:'자 (공백포함)',
            modalOriginal:'공고 원문 보기', modalOriginalLink:'공고 원문 보기', modalSearchLink:'공고 원문 보기',
            modalUnknown:'알 수 없음', modalNoQ:'등록된 문항이 없습니다.',
            importTitle:'과거 지원 문항 불러오기', importHint:'불러올 문항을 클릭하면 현재 작성창에 내용이 복사됩니다.',
            importNoData:'작성 완료된 과거 지원 자소서들 중 재활용할 만한 데이터가 아직은 없습니다.',
            importConfirm:'해당 자소서 내용을 현재 작성 중인 창에 덮어씌우시겠습니까?',
            tutSkip:'건너뛰기', tutNext:'다음', tutDone:'완료',
            statusTodo:'상태: 지원 준비중', statusApplied:'상태: 지원 완료',
            statusInterview:'상태: 서류합격 / 면접', statusFail:'상태: 불합격 (보관함)', statusPass:'상태: 최종 합격 🎉',
            btnWrite:'자소서 쓰기', btnViewDocs:'제출 자소서 보기', btnAddDoc:'+ 서류 원본 제출', btnAddMore:'+ 서류 추가',
            alwaysTag:'🌟 상시모집', alwaysLabel:'🌟 상시모집 공고:',
            archiveNoData:'보관된 내역이 없습니다.', archiveReuse:'자소서 열람 (재활용하기)',
            archiveStatusChange:'상태 변경 (대시보드 복구)', archiveTodo:'지원 준비중으로 변경',
            archiveApplied:'지원 완료로 변경', archiveFailKeep:'불합격 유지', archivePassKeep:'합격 유지',
            editCompany:'기업명', editRole:'직무', editDeadline:'마감일 (상시모집 시 비워주세요)', editUrl:'공고 원문 링크(URL)',
            editQLabel:'번 문항:', editQSection:'자소서 문항 관리', editAddQ:'+ 새 문항 추가', editSave:'수정내용 저장',
            autoSaveAlert:'데이터 변경 시 로컬 스토리지에 100% 안전하게 자동 저장됩니다!',
            termsAll:'전체 동의',
            termsService:'[필수] 서비스 이용약관',
            termsPrivacy:'[필수] 개인정보 수집 및 이용',
            termsServiceTitle:'서비스 이용약관',
            termsServiceBody:`제1조 (목적)\n본 약관은 Career Log(이하 "서비스")의 이용 조건 및 절차, 이용자와 서비스 운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제2조 (서비스 이용)\n이용자는 본 약관에 동의한 후 서비스를 이용할 수 있습니다. 서비스는 취업 준비를 위한 공고 관리, 자기소개서 작성, 면접 일정 관리 기능을 제공합니다.\n\n제3조 (개인정보 보호)\n서비스는 이용자의 개인정보를 관련 법령에 따라 보호합니다.\n\n제4조 (서비스 변경 및 중단)\n운영상 필요에 따라 사전 고지 후 서비스를 변경하거나 중단할 수 있습니다.`,
            termsPrivacyTitle:'개인정보 수집 및 이용',
            termsPrivacyBody:`1. 수집하는 개인정보\n- 필수: 이름, 이메일 주소 (Google 로그인 시 자동 수집)\n- 선택: 공고 정보, 자기소개서 등 입력 데이터\n\n2. 수집 및 이용 목적\n- 서비스 제공 및 회원 식별\n- 취업 준비 데이터 저장 및 관리\n- 서비스 개선 및 통계 분석\n\n3. 보유 및 이용 기간\n- 회원 탈퇴 시까지 또는 수집·이용 목적 달성 시\n- 관련 법령에 따른 보존 기간 준수\n\n4. 동의 거부 권리\n동의를 거부할 권리가 있으나, 거부 시 서비스 이용이 제한될 수 있습니다.`,
            saveSuccess:'공고가 성공적으로 등록되었습니다!',
            urlError:'올바른 공고 링크(URL)를 입력해주세요.', contentError:'공고 내용을 텍스트로 복붙하거나 스크린샷으로 첨부해주세요.',
            deleteConfirm:'서류를 정말 삭제하시겠습니까?',
            jobDeleteConfirm:'공고를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            spellEmpty:'먼저 작성창에 글을 작성해주세요.', spellScanning:'AI가 맞춤법 교정안을 스캔 중...',
            spellSummary:'💡 맞춤법 교정 요약:', spellEditHint:'원하는 부분이 있다면 위 텍스트를 직접 수정한 뒤 적용할 수 있습니다.',
            spellCancel:'취소하고 닫기', spellApply:'이 내용으로 덮어씌울게요!',
            spellDone:'교정 제안 생성 완료 (내용을 확인해주세요)', spellCancelled:'교정이 취소되었습니다.',
            spellApplied:'에디터에 성공적으로 반영/저장됨', spellError:'검수 에러 발생 (재시도 요망)',
            calAuthError: '구글 캘린더 연동 권한이 부족합니다. 다시 로그인하여 [캘린더 관리] 권한을 승인하시겠습니까?',
            calAuthSuccess: '구글 캘린더 권한이 성공적으로 획득되었습니다!',
            calAuthDenied: '권한 승인이 거부되었습니다. 캘린더 기능을 사용하시려면 승인이 필요합니다.',
            calDays:['일','월','화','수','목','금','토'],
            calYearMonth:(y,m)=>`${y}년 ${m+1}월 달력`,
            calWeekLabel:(y,m,w)=>`${y}년 ${m+1}월 ${w}주차`,
            tutSteps:[
                '이곳은 대시보드입니다. 전체 채용 일정과 지원 현황을 한눈에 파악할 수 있어요.',
                '공고 등록 메뉴에서는 새로운 채용 공고를 등록하고 AI가 자동으로 정보를 분석해줍니다.',
                '자소서 에디터에서는 자기소개서를 작성하고 AI 맞춤법 검사를 받을 수 있습니다.',
                '과거 보관함에서는 합격/불합격한 예전 지원 기록과 문항들을 다시 모아볼 수 있습니다.'
            ]
        },
        en: {
            loginDesc:'Your personal job-hunting workspace. Please log in to continue.',
            loginBtn:'Sign in with Google',
            navDashboard:'Dashboard', navAddjob:'Add Job', navEditor:'Essay Editor', navArchive:'Archive',
            calWeek:'Week', calMonth:'Month',
            kanbanTodo:'To Apply', kanbanApplied:'Applied', kanbanInterview:'Interview',
            addjobLabel1:'1. Job Posting URL', addjobUrlhint:'Required for quick-access links on the dashboard.',
            addjobLabel2:'2. Paste job description text or attach screenshots',
            addjobAttach:'Attach Image', addjobParse:'Parse with AI',
            parsingLoader:'AI is extracting key information from the posting...',
            parsedTitle:'AI Parsing Complete',
            fieldCompany:'Company', fieldRole:'Role', fieldDeadline:'Deadline', fieldAlways:'Always Open', fieldQuestions:'Essay Questions',
            saveDashboard:'Save & Go to Dashboard',
            editorImport:'Import', editorSelectq:'Select a question from the left to start writing.',
            editorReady:'Editor ready', spellCheck:'Spell Check', charCount:'chars (incl. spaces)',
            modalOriginal:'View Original', modalOriginalLink:'View Original', modalSearchLink:'View Original',
            modalUnknown:'Unknown', modalNoQ:'No questions registered.',
            importTitle:'Import Past Essay', importHint:'Click a question to copy its content into the current editor.',
            importNoData:'No reusable past essays found yet.',
            importConfirm:'Overwrite the current editor content with this essay?',
            tutSkip:'Skip', tutNext:'Next', tutDone:'Done',
            statusTodo:'Status: Preparing', statusApplied:'Status: Applied',
            statusInterview:'Status: Interview Scheduled', statusFail:'Status: Rejected (Archive)', statusPass:'Status: Offer Accepted 🎉',
            btnWrite:'Write Essay', btnViewDocs:'View Submitted Docs', btnAddDoc:'+ Submit Document', btnAddMore:'+ Add Document',
            alwaysTag:'🌟 Always Open', alwaysLabel:'🌟 Always Open:',
            archiveNoData:'No archived applications yet.', archiveReuse:'View Essay (Reuse)',
            archiveStatusChange:'Change Status (Restore)', archiveTodo:'Move to Preparing',
            archiveApplied:'Move to Applied', archiveFailKeep:'Keep as Rejected', archivePassKeep:'Keep as Accepted',
            editCompany:'Company', editRole:'Role', editDeadline:'Deadline (leave blank if always open)', editUrl:'Job Posting URL',
            editQLabel:' Question:', editQSection:'Essay Question Management', editAddQ:'+ Add Question', editSave:'Save Changes',
            autoSaveAlert:'All changes are auto-saved 100% safely to local storage!',
            termsAll:'Agree to All',
            termsService:'[Required] Terms of Service',
            termsPrivacy:'[Required] Privacy Policy',
            termsServiceTitle:'Terms of Service',
            termsServiceBody:`제1조 (목적)\n본 약관은 'Career Log'가 제공하는 취업 준비 관리 서비스의 이용 조건 및 절차를 규정함을 목적으로 합니다.\n\n제2조 (이용자의 의무)\n이용자는 본인의 취업 준비를 위해 성실히 서비스를 이용해야 하며, 타인의 정보를 도용하지 않습니다.\n\n제3조 (서비스 변경)\n서비스는 운영상 필요 시 사전 고지 후 변경될 수 있습니다.`,
            termsPrivacyTitle:'Privacy Policy',
            termsPrivacyBody:`1. 수집 항목: 이름, 이메일, 프로필 사진 (Google 로그인 시 자동 수집)\n2. 수집 목적: 서비스 회원 식별 및 개인별 진도(성경 통독, 취업 준비) 관리\n3. 보유 기간: 서비스 회원 탈퇴 시까지 보유하며, 탈퇴 시 즉시 파기합니다.\n4. 동의 거부: 이용자는 동의를 거부할 수 있으나, 거부 시 서비스 이용이 제한됩니다.`,
            saveSuccess:'Job posted successfully!',
            urlError:'Please enter a valid job posting URL.', contentError:'Please paste the job description text or attach a screenshot.',
            deleteConfirm:'Are you sure you want to delete this document?',
            jobDeleteConfirm:'Are you sure you want to delete this job? This action cannot be undone.',
            spellEmpty:'Please write something in the editor first.', spellScanning:'AI is scanning for spelling corrections...',
            spellSummary:'💡 Spell-check summary:', spellEditHint:'You can edit the text above before applying.',
            spellCancel:'Cancel', spellApply:'Apply This Version!',
            spellDone:'Correction ready — please review', spellCancelled:'Spell-check cancelled.',
            spellApplied:'Successfully applied and saved to editor', spellError:'Error during spell-check (please retry)',
            calAuthError: 'Insufficient Google Calendar permissions. Would you like to re-login and grant [Calendar Management] permission?',
            calAuthSuccess: 'Google Calendar permissions granted successfully!',
            calAuthDenied: 'Permission denied. Granting permission is required to use calendar features.',
            calDays:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
            calYearMonth:(y,m)=>{const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${M[m]} ${y}`;},
            calWeekLabel:(y,m,w)=>{const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${M[m]} ${y} – Week ${w}`;},
            tutSteps:[
                'This is your Dashboard. See your full application schedule and status at a glance.',
                'In Add Job, register new job postings and let AI automatically extract key info.',
                'In Essay Editor, write your cover letters and get AI-powered spell-checking.',
                'In Archive, review past applications (accepted/rejected) and reuse your essays.'
            ]
        }
    },
    t(key) { return (this._i18n[this.lang] || this._i18n.ko)[key] ?? key; },
    setLang(lang) {
        this.lang = lang;
        localStorage.setItem('appLang', lang);
        document.documentElement.lang = lang;
        document.getElementById('lang-ko-btn').classList.toggle('active', lang === 'ko');
        document.getElementById('lang-en-btn').classList.toggle('active', lang === 'en');
        this.applyLang();
        this.renderDashboard(); this.renderCalendar(); this.renderArchive();
    },
    applyLang() {
        const L = this._i18n[this.lang] || this._i18n.ko;
        // Static HTML elements via CSS class
        const map = {
            'i18n-nav-dashboard': L.navDashboard, 'i18n-nav-addjob': L.navAddjob,
            'i18n-nav-editor': L.navEditor, 'i18n-nav-archive': L.navArchive,
            'i18n-kanban-todo': L.kanbanTodo, 'i18n-kanban-applied': L.kanbanApplied, 'i18n-kanban-interview': L.kanbanInterview,
            'i18n-addjob-label1': L.addjobLabel1, 'i18n-addjob-urlhint': L.addjobUrlhint,
            'i18n-addjob-label2': L.addjobLabel2, 'i18n-addjob-attach': L.addjobAttach, 'i18n-addjob-parse': L.addjobParse,
            'i18n-parsing-loader': L.parsingLoader, 'i18n-parsed-title': L.parsedTitle,
            'i18n-field-company': L.fieldCompany, 'i18n-field-role': L.fieldRole, 'i18n-field-deadline': L.fieldDeadline,
            'i18n-field-always': L.fieldAlways, 'i18n-field-questions': L.fieldQuestions,
            'i18n-save-dashboard': L.saveDashboard,
            'i18n-editor-import': L.editorImport, 'i18n-editor-selectq': L.editorSelectq,
            'i18n-editor-ready': L.editorReady, 'i18n-spell-check': L.spellCheck, 'i18n-char-count': L.charCount,
            'i18n-modal-original': L.modalOriginal,
            'i18n-import-title': L.importTitle, 'i18n-import-hint': L.importHint,
            'i18n-tutorial-skip': L.tutSkip, 'i18n-tutorial-next': L.tutNext,
            'i18n-terms-all': L.termsAll,
            'i18n-terms-service': L.termsService,
            'i18n-terms-privacy': L.termsPrivacy,
        };
        Object.keys(map).forEach(cls => {
            document.querySelectorAll('.' + cls).forEach(el => { el.textContent = map[cls]; });
        });
        // Login wall
        const ld = document.getElementById('login-desc'); if (ld) ld.textContent = L.loginDesc;
        const lb = document.getElementById('login-btn-text'); if (lb) lb.textContent = L.loginBtn;
        // Cal view btn
        const calBtn = document.getElementById('cal-view-btn');
        if (calBtn) calBtn.textContent = this.calViewMode === 'month' ? L.calWeek : L.calMonth;
        // Essay input placeholder
        const ea = document.getElementById('essay-input'); if (ea) ea.placeholder = this.lang === 'ko' ? '여기에 자기소개서를 작성하세요...' : 'Write your cover letter here...';
        const jt = document.getElementById('job-text'); if (jt) jt.placeholder = L.addjobTextPlaceholder || (this.lang === 'ko' ? '여기에 채용공고 텍스트를 통째로 복붙하시거나, 화면 캡처 후 Ctrl+V로 붙여넣어주세요.' : 'Paste the full job posting text here, or press Ctrl+V to paste a screenshot.');
    },
    showAutoSaveAlert() { alert(this.t('autoSaveAlert')); },

    // ── 약관 동의 로직 ─────────────────────────────────────────────────
    onCheckAll(el) {
        const checked = el.checked;
        const terms = document.getElementById('check-terms');
        const privacy = document.getElementById('check-privacy');
        if (terms) terms.checked = checked;
        if (privacy) privacy.checked = checked;
        this._updateLoginBtn();
    },
    onCheckItem() {
        const terms = document.getElementById('check-terms')?.checked;
        const privacy = document.getElementById('check-privacy')?.checked;
        const all = document.getElementById('check-all');
        if (all) all.checked = !!(terms && privacy);
        this._updateLoginBtn();
    },
    _updateLoginBtn() {
        const terms = document.getElementById('check-terms')?.checked;
        const privacy = document.getElementById('check-privacy')?.checked;
        const btn = document.getElementById('google-login-btn');
        if (!btn) return;
        const ok = !!(terms && privacy);
        btn.disabled = !ok;
        btn.style.background = ok ? 'var(--primary)' : '#94a3b8';
        btn.style.cursor = ok ? 'pointer' : 'not-allowed';
        btn.style.boxShadow = ok ? '0 2px 4px rgba(37,99,235,0.2)' : 'none';
    },
    // ──────────────────────────────────────────────────────────────────

    // ── 약관 동의 로직 ──────────────────────────────────────────────
    handleCheckAll(checkbox) {
        const checked = checkbox.checked;
        document.getElementById('check-terms').checked = checked;
        document.getElementById('check-privacy').checked = checked;
        this.updateLoginBtn();
    },

    handleCheckItem() {
        const terms = document.getElementById('check-terms')?.checked;
        const privacy = document.getElementById('check-privacy')?.checked;
        const allCheck = document.getElementById('check-all');
        if (allCheck) allCheck.checked = terms && privacy;
        this.updateLoginBtn();
    },

    updateLoginBtn() {
        const terms = document.getElementById('check-terms')?.checked;
        const privacy = document.getElementById('check-privacy')?.checked;
        const btn = document.getElementById('google-login-btn');
        if (!btn) return;
        const allChecked = terms && privacy;
        btn.disabled = !allChecked;
        btn.style.background = allChecked ? 'var(--primary)' : '#94a3b8';
        btn.style.cursor = allChecked ? 'pointer' : 'not-allowed';
    },

    openTermsModal(type) {
    const modal = document.getElementById('terms-modal');
    const title = document.getElementById('terms-modal-title');
    const body = document.getElementById('terms-modal-body');
    if (!modal || !title || !body) return;

    // 상단에 정의된 i18n 텍스트를 불러와서 채워넣음
    title.textContent = type === 'terms' ? this.t('termsServiceTitle') : this.t('termsPrivacyTitle');
    body.textContent = type === 'terms' ? this.t('termsServiceBody') : this.t('termsPrivacyBody');
    
    // 강제로 화면에 보이게 함
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
},
    // ─────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────

    state: { user: null, session: null, jobs: [], editorJobId: null, editorActiveQIndex: 0 },
    tempUploadJobId: null,
    currentModalJobId: null,
    tempParsedSourceUrl: "",
    pendingImages: [],
    calOffset: 0,
    calViewMode: 'month',
    get tutorialSteps() {
        const steps = this.t('tutSteps');
        const selectors = ['.nav-item[data-view="dashboard"]','.nav-item[data-view="add-job"]','.nav-item[data-view="editor"]','.nav-item[data-view="archive"]'];
        return steps.map((text, i) => ({ selector: selectors[i], text }));
    },
    currentTutorialStep: 0,

    _eventsBound: false,

    async init() {
        this.applyLang();
        document.getElementById('lang-ko-btn')?.classList.toggle('active', this.lang === 'ko');
        document.getElementById('lang-en-btn')?.classList.toggle('active', this.lang === 'en');
        await this.checkUser();
        if (!this.state.user) {
            this.showLoginWall();
        }
    },

    _initUI() {
        if (!this._eventsBound) {
            this.bindEvents();
            this.initCharCounter();
            this._eventsBound = true;
        }
        this.renderDashboard();
        this.renderCalendar();
        this.checkTutorial();
    },

    showLoginWall() {
        const wall = document.getElementById('login-wall');
        wall.style.display = 'flex';
        document.querySelector('.app-container').style.display = 'none';
    },

    hideLoginWall() {
        const wall = document.getElementById('login-wall');
        wall.style.display = 'none';
        document.querySelector('.app-container').style.display = '';
    },

    async loadFromSupabase() {
        const [jobsResult, tokenResult] = await Promise.all([
            supabase.from('jobs').select('*').eq('user_id', this.state.user.id).order('created_at', { ascending: false }),
            supabase.from('user_data').select('google_refresh_token').eq('user_id', this.state.user.id).single()
        ]);
        if (jobsResult.error) console.error('Load jobs error:', jobsResult.error);
        this.state.jobs = (jobsResult.data || []).map(mapDbToJob);
        if (tokenResult.data?.google_refresh_token) {
            this.state.googleRefreshToken = tokenResult.data.google_refresh_token;
        }
    },

    async migrateBase64PdfsToStorage() {
        const userId = this.state.user.id;
        let migrated = false;
        for (const job of this.state.jobs) {
            if (!job.pdfs) continue;
            for (const pdf of job.pdfs) {
                if (!pdf.dataUrl) continue;
                const res = await fetch(pdf.dataUrl);
                const blob = await res.blob();
                const storagePath = `${userId}/${job.id}/${pdf.name}`;
                const { error } = await supabase.storage.from('pdfs').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
                if (!error) {
                    pdf.storagePath = storagePath;
                    delete pdf.dataUrl;
                    migrated = true;
                } else {
                    console.error(`Migration failed for ${pdf.name}:`, error);
                }
            }
        }
        if (migrated) {
            await new Promise(resolve => {
                supabase.from('jobs').upsert(
                    this.state.jobs.map(job => mapJobToDb(job, userId)), { onConflict: 'id' }
                ).then(resolve);
            });
            console.log('PDF migration to Storage complete');
        }
    },

    async checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        this.state.user = session?.user ?? null;
        this.state.session = session ?? null;
        this.updateAuthUI();

        let isInitialized = false;

        supabase.auth.onAuthStateChange(async (_event, session) => {
            this.state.user = session?.user ?? null;
            this.state.session = session ?? null;
            this.updateAuthUI();
            if (this.state.user) {
                localStorage.setItem('termsAgreed', 'true');
                this.hideLoginWall();
                if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
                    if (!isInitialized) {
                        isInitialized = true;
                        if (session?.provider_refresh_token) {
                            try { await this.saveGoogleRefreshToken(session.provider_refresh_token); }
                            catch (e) { console.error('saveGoogleRefreshToken error:', e); }
                        }
                        await this.loadFromSupabase();
                        this._initUI();
                    } else if (session?.provider_refresh_token) {
                        try { await this.saveGoogleRefreshToken(session.provider_refresh_token); }
                        catch (e) { console.error('saveGoogleRefreshToken error:', e); }
                    }
                }
            } else {
                isInitialized = false;
                this.state.jobs = [];
                this.state.googleRefreshToken = null;
                this.showLoginWall();
                if (localStorage.getItem('termsAgreed')) {
                    const termsCheck = document.getElementById('check-terms');
                    const privacyCheck = document.getElementById('check-privacy');
                    if (termsCheck) termsCheck.checked = true;
                    if (privacyCheck) privacyCheck.checked = true;
                    this.updateLoginBtn();
                }
            }
        });
    },

    async login() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                scopes: 'https://www.googleapis.com/auth/calendar',
                queryParams: { access_type: 'offline' }
            }
        });
        if (error) console.error('Login Error:', error.message);
    },

    async reloginForCalendar() {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                scopes: 'https://www.googleapis.com/auth/calendar',
                queryParams: { access_type: 'offline', prompt: 'consent' }
            }
        });
        if (error) console.error('Relogin Error:', error.message);
    },

    async saveGoogleRefreshToken(token) {
        if (!this.state.user || !token) return;
        this.state.googleRefreshToken = token;
        await supabase
            .from('user_data')
            .upsert({ user_id: this.state.user.id, google_refresh_token: token }, { onConflict: 'user_id' });
    },

    getGoogleRefreshToken() {
        return this.state.session?.provider_refresh_token ?? this.state.googleRefreshToken ?? null;
    },

    async createCalendarEvent(job) {
        if (!job.deadline || job.deadline === '상시모집') return null;
        const refreshToken = await this.getGoogleRefreshToken();
        if (!refreshToken) {
            console.warn('Calendar: refresh_token 없음, 구글 캘린더 연동을 위해 재로그인이 필요할 수 있습니다.');
            return null;
        }
        try {
            const data = await callEdgeFunction('calendar-event', { operation: 'create', job, refreshToken });
            if (data.error) {
                const errStr = String(data.error).toLowerCase();
                if (errStr.includes('invalid_grant') || errStr.includes('insufficient') || errStr.includes('403')) {
                    this.notifyCalendarReloginNeeded();
                    return null;
                }
                console.error('Calendar create error from function:', data.error);
                return null;
            }
            return data.eventId ?? null;
        } catch (e) {
            console.error('Calendar create exception:', e);
            return null;
        }
    },

    async updateCalendarEvent(job) {
        if (!job.googleEventId) { job.googleEventId = await this.createCalendarEvent(job); return; }
        if (!job.deadline || job.deadline === '상시모집') return;
        const refreshToken = await this.getGoogleRefreshToken();
        if (!refreshToken) { console.warn('Calendar: refresh_token 없음, 재로그인 필요'); return; }
        try {
            const data = await callEdgeFunction('calendar-event', { operation: 'update', job, refreshToken, eventId: job.googleEventId });
            if (data?.error) {
                const errStr = String(data.error).toLowerCase();
                if (errStr.includes('invalid_grant') || errStr.includes('insufficient') || errStr.includes('403')) {
                    this.notifyCalendarReloginNeeded();
                }
            }
        } catch (e) { console.error('Calendar update error:', e); }
    },

    notifyCalendarReloginNeeded() {
        if (confirm(this.t('calAuthError'))) {
            this.reloginForCalendar();
        }
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Logout Error:', error.message);
    },

    updateAuthUI() {
        const profileArea = document.querySelector('.user-profile');
        if (!profileArea) return;

        if (this.state.user) {
            const avatar = this.state.user.user_metadata.avatar_url || '';
            const name = this.state.user.user_metadata.full_name || '사용자';
            profileArea.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.8rem; cursor:pointer;" onclick="app.logout()">
                    <img src="${avatar}" style="width:32px; height:32px; border-radius:50%; border:2px solid var(--primary);">
                    <span style="font-weight:600;">${name} 님</span>
                    <span class="material-symbols-rounded" style="font-size:1.2rem; color:var(--text-muted);">logout</span>
                </div>
            `;
        } else {
            profileArea.innerHTML = `
                <button id="login-btn" class="btn-primary" onclick="app.login()" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                    <span class="material-symbols-rounded">login</span>
                    ${this.t('loginBtn')}
                </button>
            `;
        }
    },

    saveStorage() {
        if (!this.state.user) return;
        try {
            const dbJobs = this.state.jobs.map(job => mapJobToDb(job, this.state.user.id));
            if (dbJobs.length === 0) return;
            supabase
                .from('jobs')
                .upsert(dbJobs, { onConflict: 'id' })
                .then(({ error }) => { if (error) console.error('Save error:', error); })
                .catch(e => console.error('Save catch:', e));
        } catch(e) {
            console.error('Save sync error:', e);
        }
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                const viewId = item.getAttribute('data-view');
                document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
                document.getElementById(`view-${viewId}`).classList.add('active');
                if (viewId === 'dashboard') { this.renderDashboard(); this.renderCalendar(); }
                else if (viewId === 'archive') { this.renderArchive(); }
            });
        });

        const btnParse = document.getElementById('btn-parse');
        if (btnParse) btnParse.addEventListener('click', () => this.fetchGeminiAPI());

        document.getElementById('job-modal').addEventListener('click', (e) => {
            if (e.target.id === 'job-modal') this.closeModal();
        });

        document.addEventListener('paste', (e) => {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;

            let hasImage = false;
            let hasText = false;

            if (clipboardData.types) {
                for (let i = 0; i < clipboardData.types.length; i++) {
                    if (clipboardData.types[i] === 'text/plain') hasText = true;
                }
            }

            const isImageFile = (f) => f && (f.type.indexOf('image') !== -1 || (f.name && f.name.match(/\.(png|jpe?g|webp|gif|bmp)$/i)));

            if (clipboardData.items) {
                for (let i = 0; i < clipboardData.items.length; i++) {
                    const item = clipboardData.items[i];
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (isImageFile(file)) {
                            this.addImageToQueue(file);
                            hasImage = true;
                        }
                    }
                }
            }

            if (!hasImage && clipboardData.files) {
                for (let i = 0; i < clipboardData.files.length; i++) {
                    const file = clipboardData.files[i];
                    if (isImageFile(file)) {
                        this.addImageToQueue(file);
                        hasImage = true;
                    }
                }
            }

            if (hasImage && !hasText) {
                e.preventDefault();
            }
        });
    },

    addImageToQueue(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const base64Data = dataUrl.split(',')[1];
            this.pendingImages.push({ base64Data, mimeType: file.type, dataUrl });
            this.renderImagePreviews();
        };
        reader.readAsDataURL(file);
    },

    renderImagePreviews() {
        const container = document.getElementById('image-preview-container');
        if (!container) return;
        container.innerHTML = '';
        this.pendingImages.forEach((img, idx) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.innerHTML = `
                <img src="${img.dataUrl}" style="height: 60px; border-radius: 6px; border: 1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <button onclick="app.removeImageFromQueue(${idx})" style="position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(0,0,0,0.2);">X</button>
            `;
            container.appendChild(wrapper);
        });
    },

    removeImageFromQueue(idx) {
        this.pendingImages.splice(idx, 1);
        this.renderImagePreviews();
    },

    initCharCounter() {
        const docInput = document.getElementById('essay-input');
        if (docInput) {
            docInput.addEventListener('input', (e) => {
                const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
                const val = e.target.value;
                if (job) {
                    if (!job.answers) job.answers = [];
                    job.answers[this.state.editorActiveQIndex] = val;
                    this.saveStorage();
                }
                const counter = document.getElementById('char-current');
                if (counter) counter.innerText = val.length;
            });
        }
    },

    async handleImageParse(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
            this.addImageToQueue(files[i]);
        }
        event.target.value = '';
    },

    async fetchGeminiAPI() {
        const urlInput = document.getElementById('job-url').value.trim();
        const textInput = (document.getElementById('job-text') ? document.getElementById('job-text').value.trim() : '');
        
        if (!urlInput.startsWith('http')) { alert(this.t('urlError')); return; }
        if (!textInput && this.pendingImages.length === 0) { alert(this.t('contentError')); return; }

        const resultDiv = document.getElementById('parsing-result');
        const loader = resultDiv.querySelector('.loader');
        const dataDiv = resultDiv.querySelector('.parsed-data');
        resultDiv.classList.remove('hidden'); loader.classList.remove('hidden'); dataDiv.classList.add('hidden');

        try {
            const parsed = await callEdgeFunction('gemini-parse-job', {
                text: textInput,
                sourceUrl: urlInput,
                images: this.pendingImages.map(img => ({ base64Data: img.base64Data, mimeType: img.mimeType }))
            });
            if (urlInput.trim().startsWith('http')) parsed.sourceUrl = urlInput.trim();
            this.fillParsedData(parsed);

            this.pendingImages = [];
            this.renderImagePreviews();
        } catch (e) { alert("API 오류: " + e.message); }
        finally { loader.classList.add('hidden'); dataDiv.classList.remove('hidden'); }
    },

    fillParsedData(parsed) {
        document.getElementById('p-company').value = parsed.company || "미상";
        document.getElementById('p-role').value = parsed.role || "미상";
        const dl = parsed.deadline || "";
        if (dl.includes("상시") || dl.toLowerCase().includes("open") || dl.toLowerCase().includes("until filled")) {
            document.getElementById('p-is-always').checked = true; document.getElementById('p-deadline').value = "";
        } else {
            document.getElementById('p-is-always').checked = false; document.getElementById('p-deadline').value = dl;
        }

        const qList = document.getElementById('p-questions'); qList.innerHTML = '';
        let questions = parsed.questions || [];
        
        // Ensure at least 3 input fields
        while (questions.length < 3) {
            questions.push('');
        }

        questions.forEach(q => {
            const div = document.createElement('div');
            div.className = 'q-badge';
            div.contentEditable = 'true';
            div.style.cssText = 'cursor:text; border:1px solid #cbd5e1; min-height:48px; padding:0.8rem; margin-bottom:0.5rem; display:flex; align-items:center;';
            div.textContent = q;
            if (!q) {
                div.classList.add('empty-q');
                div.setAttribute('data-placeholder', this.lang === 'ko' ? '직접 문항을 입력해주세요.' : 'Enter question text manually...');
            }
            qList.appendChild(div);
        });
        this.tempParsedSourceUrl = parsed.sourceUrl || "";
    },

    saveJob() {
        const company = document.getElementById('p-company').value.trim();
        const role = document.getElementById('p-role').value.trim();
        const isAlways = document.getElementById('p-is-always').checked;
        const deadline = isAlways ? "상시모집" : document.getElementById('p-deadline').value;
        const qBadges = document.querySelectorAll('#p-questions .q-badge');
        const questions = Array.from(qBadges).map(b => b.innerText.trim()).filter(t => t);

        const newJob = {
            id: Date.now().toString(), company, role, deadline, questions, sourceUrl: this.tempParsedSourceUrl,
            answers: new Array(questions.length).fill(''), status: 'todo', pdfName: null, googleEventId: null, pdfs: []
        };
        this.state.jobs.push(newJob);
        supabase.from('jobs').insert(mapJobToDb(newJob, this.state.user.id))
            .then(({ error }) => { if (error) console.error('Insert job error:', error); });
        this.createCalendarEvent(newJob).then(eventId => {
            if (eventId) {
                newJob.googleEventId = eventId;
                supabase.from('jobs').update({ google_event_id: eventId }).eq('id', newJob.id)
                    .then(({ error }) => { if (error) console.error('Update googleEventId error:', error); });
            }
        });
        alert(this.t('saveSuccess'));
        document.querySelector('.nav-item[data-view="dashboard"]').click();
        document.getElementById('job-url').value = ''; 
        if(document.getElementById('job-text')) document.getElementById('job-text').value = '';
        document.getElementById('parsing-result').classList.add('hidden');
    },

    calcDDay(deadline) {
        if (!deadline) return "";
        const t = new Date(); t.setHours(0, 0, 0, 0);
        const d = new Date(deadline); d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d - t) / 86400000);
        return diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
    },

    renderDashboard() {
        const colTodo = document.getElementById('col-todo'); const colApplied = document.getElementById('col-applied'); const colInterview = document.getElementById('col-interview');
        if (!colTodo) return;
        colTodo.innerHTML = ''; colApplied.innerHTML = ''; colInterview.innerHTML = '';
        let counts = { todo: 0, applied: 0, interview: 0 };

        let sortedJobs = [...this.state.jobs].sort((a, b) => {
            if (a.deadline === '상시모집') return 1; if (b.deadline === '상시모집') return -1;
            if (!a.deadline) return 1; if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });

        sortedJobs.forEach(job => {
            if (job.status === 'fail' || job.status === 'pass') return;
            let dDayStr = '', dDayClass = 'd-day-warning';
            if (job.deadline === "상시모집") { dDayStr = this.t('alwaysTag'); dDayClass = "d-day-always"; }
            else if (job.deadline) { dDayStr = this.calcDDay(job.deadline); if (dDayStr === "D-Day" || dDayStr.match(/^D-[1-3]$/)) dDayClass = 'd-day-danger'; }

            let pdfBadgeHTML = job.pdfs ? `<div style="margin-bottom:1rem; display:flex; flex-wrap:wrap; gap:0.3rem;">${job.pdfs.map(p => `<div style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding-right:0.2rem;"><div class="btn-sm" style="border:none; padding:0.3rem 0.5rem; background:transparent;" onclick="app.downloadPdf('${job.id}', '${p.name}', event)"><span class="material-symbols-rounded" style="font-size:1rem;">picture_as_pdf</span> <span style="white-space:normal; word-break:break-all; text-align:left;">${p.name}</span></div><button onclick="app.deletePdf('${job.id}', '${p.name}', event)" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:0.2rem; display:flex; align-items:center;" title="삭제"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button></div>`).join('')}</div>` : '';

            const isApplied = job.status === 'applied' || job.status === 'interview';

            const cardHTML = `
                <div class="card ${job.status === 'interview' ? 'highlight' : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                        <h4 style="cursor:pointer; color:var(--primary); margin:0;" title="상세 정보" onclick="app.showJobModal('${job.id}')">${job.company} <span class="material-symbols-rounded" style="font-size:1.1rem; vertical-align:middle; color:var(--text-muted);">open_in_new</span></h4>
                        ${dDayStr ? `<span class="d-day ${dDayClass}">${dDayStr}</span>` : ''}
                    </div>
                    <p>${job.role}</p>
                    ${pdfBadgeHTML}
                    <div class="actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn-sm" onclick="app.openEditor('${job.id}')" style="${isApplied ? 'background:#f0fdf4; color:#166534;' : ''}">${isApplied ? this.t('btnViewDocs') : this.t('btnWrite')}</button>
                        <button class="btn-sm" onclick="app.triggerPdfUpload('${job.id}')">${isApplied ? this.t('btnAddMore') : this.t('btnAddDoc')}</button>
                        <div style="flex-basis:100%; height:0; margin:0;"></div>
                        <select class="btn-sm" onchange="app.updateStatus('${job.id}', this.value)" style="width:100%; border-color:#e2e8f0; background:#f8fafc; font-weight:600; margin-top:0.3rem;">
                            <option value="todo" ${job.status === 'todo' ? 'selected' : ''}>${this.t('statusTodo')}</option>
                            <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>${this.t('statusApplied')}</option>
                            <option value="interview" ${job.status === 'interview' ? 'selected' : ''}>${this.t('statusInterview')}</option>
                            <option value="fail" ${job.status === 'fail' ? 'selected' : ''}>${this.t('statusFail')}</option>
                            <option value="pass" ${job.status === 'pass' ? 'selected' : ''}>${this.t('statusPass')}</option>
                        </select>
                    </div>
                </div>`;
            if (job.status === 'todo') { colTodo.innerHTML += cardHTML; counts.todo++; }
            if (job.status === 'applied') { colApplied.innerHTML += cardHTML; counts.applied++; }
            if (job.status === 'interview') { colInterview.innerHTML += cardHTML; counts.interview++; }
        });

        document.querySelector('#col-todo').parentElement.querySelector('.count').innerText = counts.todo;
        document.querySelector('#col-applied').parentElement.querySelector('.count').innerText = counts.applied;
        document.querySelector('#col-interview').parentElement.querySelector('.count').innerText = counts.interview;
    },

    updateStatus(id, newStatus) {
        const job = this.state.jobs.find(j => j.id === id);
        if (job) {
            job.status = newStatus;
            this.saveStorage(); this.renderDashboard(); this.renderCalendar(); this.renderArchive();
        }
    },

    triggerPdfUpload(jobId) { this.tempUploadJobId = jobId; document.getElementById('global-pdf-upload').value = ''; document.getElementById('global-pdf-upload').click(); },

    async handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const job = this.state.jobs.find(j => j.id === this.tempUploadJobId);
        if (!job) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64Full = e.target.result;
                const base64Data = base64Full.split(',')[1];

                let docType = "기타서류";
                try {
                    const result = await callEdgeFunction('gemini-classify-pdf', { pdfBase64: base64Data });
                    docType = result.type || "제출물";
                } catch (error) { console.warn("PDF parsing failed -> fallback", error); docType = "제출물"; }

                const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const count = (job.pdfs && job.pdfs.length) ? job.pdfs.length + 1 : 1;
                const userName = this.state.user?.user_metadata?.full_name || this.state.user?.email?.split('@')[0] || '제출자';
                const newFileName = `[${job.company}] ${job.role}_${userName}_${docType}_${today}${count > 1 ? ('_' + count) : ''}.pdf`;

                const storagePath = `${this.state.user.id}/${job.id}/${Date.now()}.pdf`;
                const SUPABASE_URL = 'https://hixuqxymfkqwtpgpowcz.supabase.co';
                const uploadResp = await fetch(`${SUPABASE_URL}/storage/v1/object/pdfs/${storagePath}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.session.access_token}`,
                        'Content-Type': 'application/pdf',
                        'x-upsert': 'true',
                    },
                    body: file,
                });
                if (!uploadResp.ok) {
                    const errText = await uploadResp.text();
                    alert(`파일 업로드 실패: ${errText}`);
                    return;
                }

                if (!job.pdfs) job.pdfs = [];
                job.pdfs.push({ name: newFileName, originalName: file.name, storagePath });
                if (job.status === 'todo') job.status = 'applied';

                this.saveStorage(); this.renderDashboard(); this.renderCalendar();
                alert(`문서 자동 분류 완료: [${docType}]\n'${newFileName}' 이름으로 저장/제출되었습니다!`);
            } catch (err) {
                console.error('[PDF upload error]', err);
                alert(`PDF 처리 중 오류: ${err.message}`);
            }
        };
        reader.readAsDataURL(file);
    },

    async downloadPdf(jobId, name, e) {
        if (e) e.stopPropagation();
        const job = this.state.jobs.find(j => j.id === jobId);
        if (!job || !job.pdfs) return;
        const pdf = job.pdfs.find(p => p.name === name);
        if (!pdf) return;
        if (pdf.dataUrl) {
            const link = document.createElement('a'); link.href = pdf.dataUrl; link.download = pdf.name; link.click();
            return;
        }
        if (pdf.storagePath) {
            const SUPABASE_URL = 'https://hixuqxymfkqwtpgpowcz.supabase.co';
            const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/pdfs/${pdf.storagePath}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.state.session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresIn: 60 }),
            });
            if (!resp.ok) { alert('파일을 불러오는 데 실패했습니다.'); return; }
            const { signedURL } = await resp.json();
            const link = document.createElement('a'); link.href = `${SUPABASE_URL}/storage/v1${signedURL}`; link.download = pdf.name; link.click();
        }
    },

    async deletePdf(jobId, name, event) {
        event.stopPropagation();
        if (!confirm(`'${name}' ${this.t('deleteConfirm')}`)) return;
        const job = this.state.jobs.find(j => j.id === jobId);
        if (!job || !job.pdfs) return;
        const pdf = job.pdfs.find(p => p.name === name);
        if (pdf?.storagePath) {
            const { error } = await supabase.storage.from('pdfs').remove([pdf.storagePath]);
            if (error) console.error('Storage delete error:', error);
        }
        job.pdfs = job.pdfs.filter(p => p.name !== name);
        this.saveStorage();
        this.renderDashboard();
        this.renderArchive();
    },

    changeCalendarMonth(offset) {
        this.calOffset += offset;
        this.renderCalendar();
    },

    toggleCalendarView() {
        this.calViewMode = this.calViewMode === 'month' ? 'week' : 'month';
        document.getElementById('cal-view-btn').innerText = this.calViewMode === 'month' ? this.t('calWeek') : this.t('calMonth');
        this.calOffset = 0;
        this.renderCalendar();
    },

    renderArchive() {
        const grid = document.getElementById('archive-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const archivedJobs = this.state.jobs.filter(j => j.status === 'fail' || j.status === 'pass');

        if (archivedJobs.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted); padding:2rem;">${this.t('archiveNoData')}</p>`;
            return;
        }

        archivedJobs.forEach(job => {
            let pdfBadgeHTML = job.pdfs ? `<div style="margin-top:0.5rem; display:flex; flex-wrap:wrap; gap:0.3rem;">${job.pdfs.map(p => `<div style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding-right:0.2rem;"><div class="btn-sm" style="border:none; padding:0.3rem 0.5rem; background:transparent;" onclick="app.downloadPdf('${job.id}', '${p.name}', event)"><span class="material-symbols-rounded" style="font-size:1rem;">picture_as_pdf</span> <span style="white-space:normal; word-break:break-all; text-align:left;">${p.name}</span></div><button onclick="app.deletePdf('${job.id}', '${p.name}', event)" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:0.2rem; display:flex; align-items:center;" title="삭제"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button></div>`).join('')}</div>` : '';
            grid.innerHTML += `
                <div class="card" style="border-top: 4px solid ${job.status === 'pass' ? 'var(--success)' : 'var(--danger)'};">
                    <h4 style="cursor:pointer;" onclick="app.showJobModal('${job.id}')">${job.company}</h4>
                    <p>${job.role}</p>
                    ${pdfBadgeHTML}
                    <div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <button class="btn-sm" onclick="app.openEditor('${job.id}')">${this.t('archiveReuse')}</button>
                        <select class="btn-sm" onchange="app.updateStatus('${job.id}', this.value)">
                            <option value="" disabled selected>${this.t('archiveStatusChange')}</option>
                            <option value="todo">${this.t('archiveTodo')}</option>
                            <option value="applied">${this.t('archiveApplied')}</option>
                            <option value="fail" ${job.status === 'fail' ? 'selected' : ''}>${this.t('archiveFailKeep')}</option>
                            <option value="pass" ${job.status === 'pass' ? 'selected' : ''}>${this.t('archivePassKeep')}</option>
                        </select>
                    </div>
                </div>`;
        });
    },

    showJobModal(id) {
        const job = this.state.jobs.find(j => j.id === id);
        if (!job) return;
        this.currentModalJobId = id;
        document.getElementById('modal-company').innerText = job.company;
        document.getElementById('modal-role').innerText = job.role;
        document.getElementById('modal-deadline').innerText = job.deadline || this.t('modalUnknown');

        const qList = document.getElementById('modal-questions'); qList.innerHTML = '';
        if (job.questions && job.questions.length > 0) {
            job.questions.forEach((q, idx) => { qList.innerHTML += `<li style="margin-bottom:0.5rem;">${idx + 1}. ${q}</li>`; });
        } else { qList.innerHTML = `<li>${this.t('modalNoQ')}</li>`; }

        const srcLink = document.getElementById('modal-source-link');
        if (job.sourceUrl && job.sourceUrl.startsWith('http')) {
            srcLink.href = job.sourceUrl; srcLink.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.1rem">link</span> ${this.t('modalOriginalLink')}`;
            srcLink.classList.remove('hidden');
        } else {
            srcLink.href = `https://www.google.com/search?q=${encodeURIComponent(job.company + ' ' + job.role + ' 채용공고')}`;
            srcLink.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.1rem">search</span> ${this.t('modalSearchLink')}`;
            srcLink.classList.remove('hidden');
        }

        document.getElementById('modal-body-view').classList.remove('hidden');
        const editContainer = document.getElementById('modal-body-edit');
        if (editContainer) editContainer.classList.add('hidden');

        document.getElementById('job-modal').classList.remove('hidden');
    },

    editJobInModal() {
        const job = this.state.jobs.find(j => j.id === this.currentModalJobId);
        if (!job) return;
        document.getElementById('modal-body-view').classList.add('hidden');
        const editContainer = document.getElementById('modal-body-edit');
        editContainer.classList.remove('hidden');

        let qInputs = job.questions.map((q, i) => `<div style="margin-bottom:0.8rem;"><span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${i + 1}${this.t('editQLabel')}</span><textarea class="edit-q" style="width:100%; min-height:80px; padding:0.8rem; margin-top:0.3rem; border-radius:6px; border:1px solid var(--border-color); font-family:inherit;">${q}</textarea></div>`).join('');

        editContainer.innerHTML = `
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">${this.t('editCompany')}</label><input type="text" id="edit-m-company" value="${job.company}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">${this.t('editRole')}</label><input type="text" id="edit-m-role" value="${job.role}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">${this.t('editUrl')}</label><input type="url" id="edit-m-url" value="${job.sourceUrl || ''}" placeholder="https://..." style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">${this.t('editDeadline')}</label><input type="date" id="edit-m-deadline" value="${job.deadline === '상시모집' ? '' : job.deadline}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border-color); border-radius:8px; background:#f8fafc;"><label style="font-size:1rem;color:var(--primary);display:block;font-weight:700;margin-bottom:0.8rem;">${this.t('editQSection')}</label>${qInputs}<button class="btn-sm" onclick="app.addEmptyQuestionInput()" style="margin-top:0.5rem; background:#eff6ff; color:var(--primary); font-weight:600;">${this.t('editAddQ')}</button></div>
            <button class="btn-primary" style="width:100%; margin-top:1.5rem; justify-content:center; padding:1.2rem;" onclick="app.saveEditedJobModal()">${this.t('editSave')}</button>
        `;
    },

    addEmptyQuestionInput() {
        const editContainer = document.getElementById('modal-body-edit');
        const count = editContainer.querySelectorAll('.edit-q').length;
        const btn = editContainer.querySelector('button.btn-sm');
        const wrapper = document.createElement('div'); wrapper.style.marginBottom = '0.8rem';
        wrapper.innerHTML = `<span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${count + 1}${this.t('editQLabel')}</span><textarea class="edit-q" style="width:100%; min-height:80px; padding:0.8rem; margin-top:0.3rem; border-radius:6px; border:1px solid var(--border-color); font-family:inherit;"></textarea>`;
        btn.parentNode.insertBefore(wrapper, btn);
    },

    saveEditedJobModal() {
        const job = this.state.jobs.find(j => j.id === this.currentModalJobId);
        if (!job) return;
        job.company = document.getElementById('edit-m-company').value.trim();
        job.role = document.getElementById('edit-m-role').value.trim();
        job.sourceUrl = document.getElementById('edit-m-url').value.trim();
        const dl = document.getElementById('edit-m-deadline').value;
        job.deadline = dl ? dl : "상시모집";

        const qNodes = document.querySelectorAll('.edit-q');
        job.questions = Array.from(qNodes).map(n => n.value.trim()).filter(v => v);

        if (!job.answers) job.answers = [];
        while (job.answers.length < job.questions.length) job.answers.push('');
        if (job.answers.length > job.questions.length) job.answers = job.answers.slice(0, job.questions.length);

        this.updateCalendarEvent(job).then(() => this.saveStorage());
        this.saveStorage(); this.renderDashboard(); this.renderCalendar(); this.showJobModal(job.id);
        if (this.state.editorJobId === job.id) this.openEditor(job.id);
    },

    async deleteJobInModal() {
        const job = this.state.jobs.find(j => j.id === this.currentModalJobId);
        if (!job) return;
        if (!confirm(`'${job.company}' ${this.t('jobDeleteConfirm')}`)) return;
        if (job.googleEventId) {
            const refreshToken = await this.getGoogleRefreshToken();
            if (refreshToken) {
                try {
                    await callEdgeFunction('calendar-event', { operation: 'delete', job, refreshToken, eventId: job.googleEventId });
                } catch (e) { console.error('Calendar delete error:', e); }
            }
        }
        const deletedId = this.currentModalJobId;
        this.state.jobs = this.state.jobs.filter(j => j.id !== deletedId);
        supabase.from('jobs').delete().eq('id', deletedId).eq('user_id', this.state.user.id)
            .then(({ error }) => { if (error) console.error('Delete job error:', error); });
        this.renderDashboard();
        this.renderCalendar();
        this.closeModal();
    },

    closeModal() { document.getElementById('job-modal').classList.add('hidden'); },

    renderCalendar() {
        const calGrid = document.getElementById('calendar-grid');
        const calMonthEl = document.getElementById('calendar-month');
        if (!calGrid) return;

        calGrid.innerHTML = '';
        const today = new Date();

        const alwaysContainer = document.getElementById('always-recruit-container');
        const L = this._i18n[this.lang] || this._i18n.ko;
        if (alwaysContainer) {
            const alwaysJobs = this.state.jobs.filter(j => j.deadline === '상시모집' && j.status !== 'fail' && j.status !== 'pass');
            if (alwaysJobs.length > 0) {
                alwaysContainer.style.display = 'flex';
                alwaysContainer.style.alignItems = 'center';
                alwaysContainer.style.flexWrap = 'wrap';
                let ajHtml = `<strong style="color:var(--primary); font-size:0.9rem; margin-right:0.5rem;">${this.t('alwaysLabel')}</strong> `;
                alwaysJobs.forEach(j => { ajHtml += `<span class="cal-job-badge ${j.status}" style="cursor:pointer; display:inline-block; margin-right:0.5rem;" onclick="app.showJobModal('${j.id}')">${j.company}</span>`; });
                alwaysContainer.innerHTML = ajHtml;
            } else { alwaysContainer.style.display = 'none'; }
        }

        const days = L.calDays;
        for (let d of days) calGrid.innerHTML += `<div class="cal-day-header">${d}</div>`;

        if (this.calViewMode === 'week') {
            const targetWeekStart = new Date(today);
            targetWeekStart.setDate(today.getDate() - today.getDay() + (this.calOffset * 7));
            if (calMonthEl) calMonthEl.innerText = L.calWeekLabel(targetWeekStart.getFullYear(), targetWeekStart.getMonth(), Math.ceil(targetWeekStart.getDate() / 7));

            for (let i = 0; i < 7; i++) {
                const targetDay = new Date(targetWeekStart);
                targetDay.setDate(targetWeekStart.getDate() + i);
                const dStr = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, '0')}-${String(targetDay.getDate()).padStart(2, '0')}`;
                const dayJobs = this.state.jobs.filter(j => j.deadline === dStr && j.status !== 'fail' && j.status !== 'pass');
                let jobsHTML = '';
                dayJobs.forEach(j => { jobsHTML += `<div class="cal-job-badge ${j.status}" style="cursor:pointer;" onclick="app.showJobModal('${j.id}')">${j.company}</div>`; });
                const isToday = targetDay.toDateString() === today.toDateString();
                calGrid.innerHTML += `<div class="cal-day ${isToday ? 'today' : ''}"><span class="date-num">${targetDay.getDate()}</span><div class="cal-jobs">${jobsHTML}</div></div>`;
            }
        } else {
            const targetMonth = new Date(today.getFullYear(), today.getMonth() + this.calOffset, 1);
            const year = targetMonth.getFullYear();
            const month = targetMonth.getMonth();
            if (calMonthEl) calMonthEl.innerText = L.calYearMonth(year, month);
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDay; i++) calGrid.innerHTML += `<div class="cal-day empty"></div>`;
            for (let i = 1; i <= daysInMonth; i++) {
                const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const dayJobs = this.state.jobs.filter(j => j.deadline === currentDateStr && j.status !== 'fail' && j.status !== 'pass');
                let jobsHTML = '';
                dayJobs.forEach(j => { jobsHTML += `<div class="cal-job-badge ${j.status}" style="cursor:pointer;" onclick="app.showJobModal('${j.id}')">${j.company}</div>`; });
                const isTodayStr = new Date(year, month, i).toDateString() === today.toDateString();
                calGrid.innerHTML += `<div class="cal-day ${isTodayStr ? 'today' : ''}"><span class="date-num">${i}</span><div class="cal-jobs">${jobsHTML}</div></div>`;
            }
        }
    },

    openEditor(jobId) {
        document.querySelector('.nav-item[data-view="editor"]').click();
        const job = this.state.jobs.find(j => j.id === jobId);
        if (!job) return;
        this.state.editorJobId = jobId; this.state.editorActiveQIndex = 0;
        const editorCompany = document.getElementById('editor-company');
        editorCompany.textContent = job.company;
        this.renderEditorQuestions(job); this.loadEditorQuestion(0);
        this.renderCompanySelector();
    },

    renderCompanySelector() {
        const dropdown = document.getElementById('company-selector-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';
        const activeJobs = this.state.jobs.filter(j => j.status !== 'pass' && j.status !== 'fail');
        activeJobs.forEach(job => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <span class="comp">${job.company}</span>
                <span class="role">${job.role}</span>
            `;
            item.onclick = (e) => { e.stopPropagation(); this.openEditor(job.id); dropdown.classList.add('hidden'); };
            dropdown.appendChild(item);
        });
    },

    toggleCompanySelector(event) {
        event.stopPropagation();
        const dropdown = document.getElementById('company-selector-dropdown');
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            const close = () => { dropdown.classList.add('hidden'); document.removeEventListener('click', close); };
            document.addEventListener('click', close);
        }
    },

    renderEditorQuestions(job) {
        const qList = document.querySelector('.q-list'); qList.innerHTML = '';
        
        if (!job.questions || job.questions.length === 0) {
            qList.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">등록된 문항이 없습니다.<br>우측 상단 + 버튼으로 추가하세요.</div>`;
            return;
        }

        job.questions.forEach((q, idx) => {
            const div = document.createElement('div');
            div.className = `q-item ${idx === this.state.editorActiveQIndex ? 'active' : ''}`;
            div.dataset.idx = idx;
            div.innerHTML = `
                <div style="padding-right:1.5rem;">${idx + 1}. ${q || (this.lang === 'ko' ? '새 문항' : 'New Question')}</div>
                <button class="q-delete-btn material-symbols-rounded" style="font-size:1.1rem;" onclick="app.deleteEditorQuestion(event, ${idx})">delete</button>
            `;
            div.onclick = () => app.loadEditorQuestion(idx);
            qList.appendChild(div);
        });
    },

    deleteEditorQuestion(event, idx) {
        event.stopPropagation();
        if (!confirm(this.lang === 'ko' ? '이 문항을 삭제하시겠습니까?' : 'Delete this question?')) return;
        const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
        if (!job) return;

        job.questions.splice(idx, 1);
        if (job.answers) job.answers.splice(idx, 1);

        if (this.state.editorActiveQIndex >= job.questions.length) {
            this.state.editorActiveQIndex = Math.max(0, job.questions.length - 1);
        }

        this.saveStorage();
        this.renderEditorQuestions(job);
        this.loadEditorQuestion(this.state.editorActiveQIndex);
    },

    addEditorQuestion() {
        const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
        if (!job) return;
        if (!job.questions) job.questions = [];
        if (!job.answers) job.answers = [];
        
        job.questions.push('');
        job.answers.push('');
        
        const newIdx = job.questions.length - 1;
        this.state.editorActiveQIndex = newIdx;
        
        this.saveStorage();
        this.renderEditorQuestions(job);
        this.loadEditorQuestion(newIdx);
        
        const titleInput = document.getElementById('current-q-title');
        if (titleInput) {
            titleInput.focus();
            titleInput.placeholder = this.lang === 'ko' ? '문항 내용을 입력하세요...' : 'Enter question text...';
        }
    },

    loadEditorQuestion(idx) {
        this.state.editorActiveQIndex = idx;
        const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
        if (!job) {
            document.getElementById('current-q-title').value = '';
            document.getElementById('essay-input').value = '';
            return;
        }

        document.querySelectorAll('.q-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.q-item[data-idx="${idx}"]`);
        if (activeItem) activeItem.classList.add('active');

        const qNumBadge = document.getElementById('current-q-num');
        if (qNumBadge) qNumBadge.textContent = job.questions.length > 0 ? idx + 1 : '0';

        const titleInput = document.getElementById('current-q-title');
        titleInput.value = job.questions[idx] || '';
        
        titleInput.style.height = 'auto';
        titleInput.style.height = (titleInput.scrollHeight) + 'px';
        
        titleInput.oninput = (e) => {
            job.questions[idx] = e.target.value;
            titleInput.style.height = 'auto';
            titleInput.style.height = (titleInput.scrollHeight) + 'px';
            const qItem = document.querySelector(`.q-item[data-idx="${idx}"] div`);
            if (qItem) qItem.textContent = `${idx + 1}. ${e.target.value || (this.lang === 'ko' ? '새 문항' : 'New Question')}`;
            this.triggerAutoSaveFeedback();
            this.saveStorage();
        };

        const essayInput = document.getElementById('essay-input');
        const val = (job.answers && job.answers[idx]) ? job.answers[idx] : '';
        essayInput.value = val;

        const counter = document.getElementById('char-current');
        if (counter) counter.innerText = val.length;

        const st = document.getElementById('spell-check-status');
        if (st) { st.innerHTML = `<span class="material-symbols-rounded">check_circle</span> ${this.t('editorReady')}`; st.className = 'spell-check-status ideal'; }
    },

    triggerAutoSaveFeedback() {
        const indicator = document.getElementById('auto-save-indicator');
        if (!indicator) return;
        indicator.style.color = 'var(--primary)';
        indicator.style.transform = 'scale(1.2)';
        setTimeout(() => {
            indicator.style.color = '';
            indicator.style.transform = '';
        }, 300);
    },

    async runSpellCheck() {
        const essayInput = document.getElementById('essay-input');
        const textToFix = essayInput.value;
        if (!textToFix || textToFix.trim().length <= 5) { alert(this.t('spellEmpty')); return; }

        const statusLabel = document.getElementById('spell-check-status');
        statusLabel.innerHTML = `<span class="material-symbols-rounded spinning">sync</span> ${this.t('spellScanning')}`;
        statusLabel.className = 'spell-check-status warning';
        document.getElementById('ai-suggestion-box').style.display = 'none';

        try {
            const parsed = await callEdgeFunction('gemini-spell-check', { text: textToFix });

            const suggBox = document.getElementById('ai-suggestion-box');
            suggBox.style.display = 'block';
            suggBox.innerHTML = `
                <div style="margin-bottom:0.5rem; color:var(--text-main);"><strong>${this.t('spellSummary')}</strong> <span id="spell-explanation"></span></div>
                <textarea id="spell-check-edit-area" style="width:100%; min-height:120px; background:#fff; border:1px solid #fbcfe8; padding:1rem; border-radius:6px; margin-bottom:0.8rem; font-size:0.95rem; color:var(--text-main); font-family:inherit; resize:vertical;"></textarea>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:-0.5rem; margin-bottom:0.8rem;">${this.t('spellEditHint')}</div>
                <div class="ai-suggestion-actions">
                    <button class="btn-sm" style="background:#fff; border:1px solid var(--border-color); color:var(--text-muted);" onclick="app.cancelSpellCheck()">${this.t('spellCancel')}</button>
                    <button class="btn-primary" style="padding:0.5rem 1rem; border-radius:6px;" onclick="app.applySpellCheck()">${this.t('spellApply')}</button>
                </div>
            `;
            document.getElementById('spell-explanation').textContent = parsed.explanation;
            document.getElementById('spell-check-edit-area').value = parsed.correctedText;
            statusLabel.innerHTML = `<span class="material-symbols-rounded">check_circle</span> ${this.t('spellDone')}`;
            statusLabel.className = 'spell-check-status ideal';
        } catch (e) {
            statusLabel.innerHTML = `<span class="material-symbols-rounded">error</span> ${this.t('spellError')}`;
            statusLabel.className = 'spell-check-status warning';
        }
    },

    applySpellCheck() {
        const textArea = document.getElementById('spell-check-edit-area');
        if (!textArea) return;
        const text = textArea.value;
        const essayInput = document.getElementById('essay-input');
        essayInput.value = text;
        const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
        if (job) { job.answers[this.state.editorActiveQIndex] = text; this.saveStorage(); }
        document.getElementById('char-current').innerText = text.length;

        document.getElementById('ai-suggestion-box').style.display = 'none';
        const statusLabel = document.getElementById('spell-check-status');
        statusLabel.innerHTML = `<span class="material-symbols-rounded">check_circle</span> ${this.t('spellApplied')}`;
        statusLabel.className = 'spell-check-status ideal';
    },

    cancelSpellCheck() {
        document.getElementById('ai-suggestion-box').style.display = 'none';
        const statusLabel = document.getElementById('spell-check-status');
        statusLabel.innerHTML = `<span class="material-symbols-rounded">info</span> ${this.t('spellCancelled')}`;
        statusLabel.className = 'spell-check-status warning';
    },

    openImportModal() {
        const listDiv = document.getElementById('import-list');
        listDiv.innerHTML = '';
        const pastJobs = this.state.jobs.filter(j => (j.status === 'pass' || j.status === 'fail' || j.status === 'applied') && j.id !== this.state.editorJobId);

        let hasData = false;
        pastJobs.forEach(job => {
            job.questions.forEach((q, qIndex) => {
                const ans = job.answers[qIndex]?.trim();
                if (ans && ans.length > 5) {
                    hasData = true;
                    const btn = document.createElement('div');
                    btn.style.padding = '1.2rem'; btn.style.border = '1px solid var(--border-color)';
                    btn.style.borderRadius = '12px'; btn.style.cursor = 'pointer'; btn.style.background = '#f8fafc'; btn.style.transition = 'all 0.2s';
                    btn.onmouseover = () => { btn.style.background = '#eff6ff'; btn.style.borderColor = 'var(--primary)'; btn.style.boxShadow = '0 2px 4px rgba(37,99,235,0.1)'; };
                    btn.onmouseout = () => { btn.style.background = '#f8fafc'; btn.style.borderColor = 'var(--border-color)'; btn.style.boxShadow = 'none'; };
                    btn.innerHTML = `
                        <div style="font-weight:700; color:var(--text-main); margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;">
                            <span>[${job.company}] ${job.role}</span>
                            <span style="color:var(--primary); font-size:0.85rem; font-weight:600; padding:0.2rem 0.5rem; background:#fff; border-radius:12px; border:1px solid var(--primary);">${ans.length}${this.lang === 'ko' ? '자' : ' chars'}</span>
                        </div>
                        <div style="font-size:0.95rem; font-weight:600; margin-bottom:0.8rem; color:var(--text-muted); border-bottom:1px solid #cbd5e1; padding-bottom:0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">Q. ${q}</div>
                        <div style="font-size:0.95rem; color:var(--text-main); line-height:1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${ans}</div>
                    `;
                    btn.onclick = () => {
                        if (confirm(this.t('importConfirm'))) {
                            const essayInput = document.getElementById('essay-input');
                            essayInput.value = ans;
                            const currJob = this.state.jobs.find(j => j.id === this.state.editorJobId);
                            if (currJob) { currJob.answers[this.state.editorActiveQIndex] = ans; this.saveStorage(); }
                            document.getElementById('char-current').innerText = ans.length;
                            document.getElementById('import-modal').classList.add('hidden');
                        }
                    };
                    listDiv.appendChild(btn);
                }
            });
        });

        if (!hasData) {
            listDiv.innerHTML = `<p style="padding:3rem; text-align:center; color:var(--text-muted); font-size:1.1rem;">${this.t('importNoData')}</p>`;
        }
        document.getElementById('import-modal').classList.remove('hidden');
    },

    checkTutorial() {
        if (!localStorage.getItem('tutorialCompleted')) {
            setTimeout(() => { this.startTutorial(); }, 500);
        }
    },

    startTutorial() {
        this.currentTutorialStep = 0;
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.remove('hidden');
        this.showTutorialStep();
    },

    showTutorialStep() {
        if (this.currentTutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
            return;
        }
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        const step = this.tutorialSteps[this.currentTutorialStep];
        const targetEl = document.querySelector(step.selector);
        if (targetEl) {
            targetEl.classList.add('tutorial-highlight');
            const rect = targetEl.getBoundingClientRect();
            const bubble = document.getElementById('tutorial-bubble');
            const textEl = document.getElementById('tutorial-text');
            const nextBtn = document.getElementById('tutorial-next-btn');
            if (textEl) textEl.innerText = step.text;
            if (bubble) {
                const isMobile = window.matchMedia('(max-width: 768px)').matches;
                if (isMobile) {
                    // On mobile, items are in bottom nav. Show bubble ABOVE the target.
                    bubble.classList.add('mobile-bubble');
                    // Reset mobile styles first to get correct height
                    bubble.style.width = 'calc(100vw - 40px)';
                    bubble.style.maxWidth = '340px';
                    
                    const bubbleHeight = bubble.offsetHeight || 120; // fallback if hidden
                    bubble.style.top = (rect.top - bubbleHeight - 20) + 'px';
                    
                    // Center bubble horizontally relative to screen, keeping it within bounds
                    const screenWidth = window.innerWidth;
                    const bubbleWidth = Math.min(screenWidth - 40, 340);
                    let leftPos = rect.left + (rect.width / 2) - (bubbleWidth / 2);
                    
                    // Constrain to screen edges
                    leftPos = Math.max(10, Math.min(screenWidth - bubbleWidth - 10, leftPos));
                    bubble.style.left = leftPos + 'px';

                    // Calculate arrow position (relative to bubble)
                    const targetCenter = rect.left + (rect.width / 2);
                    const arrowPos = targetCenter - leftPos;
                    bubble.style.setProperty('--arrow-left', arrowPos + 'px');
                } else {
                    bubble.classList.remove('mobile-bubble');
                    bubble.style.width = '300px';
                    bubble.style.maxWidth = '';
                    bubble.style.top = Math.max(10, rect.top - 10) + 'px';
                    bubble.style.left = (rect.right + 25) + 'px';
                }
            }
            if (nextBtn) {
                nextBtn.innerText = this.currentTutorialStep === this.tutorialSteps.length - 1 ? this.t('tutDone') : this.t('tutNext');
            }
        }
    },

    nextTutorialStep() {
        this.currentTutorialStep++;
        this.showTutorialStep();
    },

    endTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.add('hidden');
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        localStorage.setItem('tutorialCompleted', 'true');
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => { app.init(); });

const API_KEY = import.meta.env.VITE_API_KEY;

const app = {
    state: { jobs: [], editorJobId: null, editorActiveQIndex: 0 },
    tempUploadJobId: null,
    currentModalJobId: null,
    tempParsedSourceUrl: "",
    pendingImages: [],
    calOffset: 0,
    calViewMode: 'month',

    init() {
        this.loadStorage();
        this.bindEvents();
        this.renderDashboard();
        this.initCharCounter();
        this.renderCalendar();
    },

    loadStorage() {
        const saved = localStorage.getItem('jobAgentData');
        if (saved) {
            try { this.state = JSON.parse(saved); } catch (e) { }
        } else {
            this.state.jobs = [{ id: Date.now().toString(), company: "우아한형제들", role: "프론트엔드 개발자", deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0], status: 'todo', questions: ["지원동기를 작성해주세요.", "가장 큰 성취 경험을 적어주세요."], answers: ["", ""], pdfName: null, sourceUrl: "" }];
            this.saveStorage();
        }
    },

    saveStorage() { localStorage.setItem('jobAgentData', JSON.stringify(this.state)); },

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

        // Global Paste Event for Screenshots
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

            // Allow image paste in text areas too so user can paste screenshot into job-text
            if (hasImage && !hasText) {
                // Prevent default so we don't paste pure image blob text "[object File]" string into textarea
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
        
        if (!urlInput.startsWith('http')) {
            alert('올바른 공고 링크(URL)를 입력해주세요.');
            return;
        }
        if (!textInput && this.pendingImages.length === 0) {
            alert('공고 내용을 텍스트로 복붙하거나 스크린샷으로 첨부해주세요.');
            return;
        }

        const resultDiv = document.getElementById('parsing-result');
        const loader = resultDiv.querySelector('.loader');
        const dataDiv = resultDiv.querySelector('.parsed-data');
        resultDiv.classList.remove('hidden'); loader.classList.remove('hidden'); dataDiv.classList.add('hidden');

        // AI 검색 우회 대신, 사용자가 입력한 텍스트/이미지만으로 파싱
        const prompt = `다음 채용 공고 정보(입력 텍스트 및 첨부된 캡처본)에서 기업명, 직무명, 마감일, 자소서 문항을 추출해 순수 JSON만 반환하세요.
원본 출처 URL은 사용자가 별도로 입력했으므로 해당 URL을 그대로 유지하세요.
반환할 JSON 형식:
{ "company": "기업명", "role": "직무명", "deadline": "YYYY-MM-DD(상시모집이면 '상시모집')", "questions": ["문항1", "문항2"], "sourceUrl": "${urlInput}" }
입력된 텍스트/URL 정보: ${textInput || '빈 텍스트(첨부된 이미지 참조)'}`;

        const parts = [{ text: prompt }];
        this.pendingImages.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } });
        });

        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts }], 
                    generationConfig: { responseMimeType: "application/json" } 
                })
            });
            const data = await resp.json();
            let parsed = JSON.parse(data.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());
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
        if (parsed.questions && parsed.questions.length > 0) {
            parsed.questions.forEach(q => { qList.innerHTML += `<div class="q-badge" contenteditable="true" style="cursor:text; border:1px solid #cbd5e1">${q}</div>`; });
        } else {
            qList.innerHTML = '<div class="q-badge empty-q" contenteditable="true" data-placeholder="직접 문항을 입력해주세요." style="cursor:text; border:1px solid #cbd5e1"></div>';
        }
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
            answers: new Array(questions.length).fill(''), status: 'todo', pdfName: null
        };
        this.state.jobs.push(newJob); this.saveStorage();
        alert("공고가 성공적으로 등록되었습니다!");
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
            if (job.deadline === "상시모집") { dDayStr = "🌟 상시모집"; dDayClass = "d-day-always"; }
            else if (job.deadline) { dDayStr = this.calcDDay(job.deadline); if (dDayStr === "D-Day" || dDayStr.match(/^D-[1-3]$/)) dDayClass = 'd-day-danger'; }

            let pdfBadgeHTML = job.pdfs ? `<div style="margin-bottom:1rem; display:flex; flex-wrap:wrap; gap:0.3rem;">${job.pdfs.map(p => `<div style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding-right:0.2rem;"><div class="btn-sm" style="border:none; padding:0.3rem 0.5rem; background:transparent;" onclick="app.downloadPdf('${job.id}', '${p.name}', event)"><span class="material-symbols-rounded" style="font-size:1rem;">picture_as_pdf</span> <span style="white-space:normal; word-break:break-all; text-align:left;">${p.name}</span></div><button onclick="app.deletePdf('${job.id}', '${p.name}', event)" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:0.2rem; display:flex; align-items:center;" title="삭제"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button></div>`).join('')}</div>` : '';

            const isApplied = job.status === 'applied' || job.status === 'interview';

            const cardHTML = `
                <div class="card ${job.status === 'interview' ? 'highlight' : ''}">
                    <div class="card-header">${dDayStr ? `<span class="d-day ${dDayClass}">${dDayStr}</span>` : ''}</div>
                    <h4 style="cursor:pointer; color:var(--primary);" title="상세 정보" onclick="app.showJobModal('${job.id}')">${job.company} <span class="material-symbols-rounded" style="font-size:1.1rem; vertical-align:middle; color:var(--text-muted);">open_in_new</span></h4>
                    <p>${job.role}</p>
                    ${pdfBadgeHTML}
                    <div class="actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn-sm" onclick="app.openEditor('${job.id}')" style="${isApplied ? 'background:#f0fdf4; color:#166534;' : ''}">${isApplied ? '제출 서류 보기' : '자소서 쓰기'}</button>
                        <button class="btn-sm" onclick="app.triggerPdfUpload('${job.id}')">${isApplied ? '+ 서류 추가' : '+ 서류 원본 제출'}</button>
                        <div style="flex-basis:100%; height:0; margin:0;"></div>
                        <select class="btn-sm" onchange="app.updateStatus('${job.id}', this.value)" style="width:100%; border-color:#e2e8f0; background:#f8fafc; font-weight:600; margin-top:0.3rem;">
                            <option value="todo" ${job.status === 'todo' ? 'selected' : ''}>상태: 지원 준비중</option>
                            <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>상태: 지원 완료</option>
                            <option value="interview" ${job.status === 'interview' ? 'selected' : ''}>상태: 서류합격 / 면접</option>
                            <option value="fail" ${job.status === 'fail' ? 'selected' : ''}>상태: 불합격 (보관함)</option>
                            <option value="pass" ${job.status === 'pass' ? 'selected' : ''}>상태: 최종 합격 🎉</option>
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
            const base64Full = e.target.result;
            const base64Data = base64Full.split(',')[1];

            let docType = "기타서류";
            try {
                // PDF 파싱: Gemini로 문서 종류 식별
                const prompt = `이 문서(PDF)의 내용을 분석해서, 다음 중 어떤 종류의 문서인지 정확히 1개만 알려주세요: [이력서, 자기소개서, 포트폴리오, 기타서류]. 
1. 이력서: 개인사진, 학력, 경력사항, 기본인적사항 있음
2. 자기소개서: 1, 2, 3번 문항 등 에세이 형식의 긴 글위주
3. 포트폴리오: 프로젝트 명세, 역할, 디자인, 시각화 산출물 등
반드시 순수 JSON 형식으로 응답: {"type": "문서종류"}`;
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: base64Data } }] }], generationConfig: { responseMimeType: "application/json" } })
                });
                const d = await resp.json();
                let txt = d.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                docType = JSON.parse(txt.trim()).type || "제출물";
            } catch (error) { console.warn("PDF parsing failed -> fallback", error); docType = "제출물"; }

            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const count = (job.pdfs && job.pdfs.length) ? job.pdfs.length + 1 : 1;
            const newFileName = `[${job.company}] ${job.role}_박채연_${docType}_${today}${count > 1 ? ('_' + count) : ''}.pdf`;

            if (!job.pdfs) job.pdfs = [];
            job.pdfs.push({ name: newFileName, originalName: file.name, dataUrl: base64Full });
            if (job.status === 'todo') job.status = 'applied';

            try {
                this.saveStorage(); this.renderDashboard(); this.renderCalendar();
                alert(`문서 자동 분류 완료: [${docType}]\n'${newFileName}' 이름으로 저장/제출되었습니다!`);
            } catch (err) { job.pdfs.pop(); alert("파일 제한 초과."); }
        };
        reader.readAsDataURL(file);
    },

    downloadPdf(jobId, name, e) {
        if (e) e.stopPropagation();
        const job = this.state.jobs.find(j => j.id === jobId);
        if (job && job.pdfs) {
            const pdf = job.pdfs.find(p => p.name === name);
            if (pdf && pdf.dataUrl) {
                const link = document.createElement('a'); link.href = pdf.dataUrl; link.download = pdf.name; link.click();
            }
        }
    },

    deletePdf(jobId, name, event) {
        event.stopPropagation();
        if (!confirm(`'${name}' 서류를 정말 삭제하시겠습니까?`)) return;
        const job = this.state.jobs.find(j => j.id === jobId);
        if (job && job.pdfs) {
            job.pdfs = job.pdfs.filter(p => p.name !== name);
            this.saveStorage();
            this.renderDashboard();
            this.renderArchive();
        }
    },

    changeCalendarMonth(offset) {
        this.calOffset += offset;
        this.renderCalendar();
    },

    toggleCalendarView() {
        this.calViewMode = this.calViewMode === 'month' ? 'week' : 'month';
        document.getElementById('cal-view-btn').innerText = this.calViewMode === 'month' ? '주간' : '월간';
        this.calOffset = 0;
        this.renderCalendar();
    },

    renderArchive() {
        const grid = document.getElementById('archive-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const archivedJobs = this.state.jobs.filter(j => j.status === 'fail' || j.status === 'pass');

        if (archivedJobs.length === 0) { grid.innerHTML = '<p style="color:var(--text-muted); padding:2rem;">보관된 내역이 없습니다.</p>'; return; }

        archivedJobs.forEach(job => {
            let pdfBadgeHTML = job.pdfs ? `<div style="margin-top:0.5rem; display:flex; flex-wrap:wrap; gap:0.3rem;">${job.pdfs.map(p => `<div style="display:inline-flex; align-items:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding-right:0.2rem;"><div class="btn-sm" style="border:none; padding:0.3rem 0.5rem; background:transparent;" onclick="app.downloadPdf('${job.id}', '${p.name}', event)"><span class="material-symbols-rounded" style="font-size:1rem;">picture_as_pdf</span> <span style="white-space:normal; word-break:break-all; text-align:left;">${p.name}</span></div><button onclick="app.deletePdf('${job.id}', '${p.name}', event)" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:0.2rem; display:flex; align-items:center;" title="삭제"><span class="material-symbols-rounded" style="font-size:1rem;">close</span></button></div>`).join('')}</div>` : '';
            grid.innerHTML += `
                <div class="card" style="border-top: 4px solid ${job.status === 'pass' ? 'var(--success)' : 'var(--danger)'};">
                    <h4 style="cursor:pointer;" onclick="app.showJobModal('${job.id}')">${job.company}</h4>
                    <p>${job.role}</p>
                    ${pdfBadgeHTML}
                    <div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <button class="btn-sm" onclick="app.openEditor('${job.id}')">자소서 열람 (재활용하기)</button>
                        <select class="btn-sm" onchange="app.updateStatus('${job.id}', this.value)">
                            <option value="fail" disabled selected>상태 변경 (대시보드 복구)</option>
                            <option value="todo">지원 준비중으로 변경</option>
                            <option value="applied">지원 완료로 변경</option>
                            <option value="fail" ${job.status === 'fail' ? 'selected' : ''}>불합격 유지</option>
                            <option value="pass" ${job.status === 'pass' ? 'selected' : ''}>합격 유지</option>
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
        document.getElementById('modal-deadline').innerText = job.deadline || '알 수 없음';

        const qList = document.getElementById('modal-questions'); qList.innerHTML = '';
        if (job.questions && job.questions.length > 0) {
            job.questions.forEach((q, idx) => { qList.innerHTML += `<li style="margin-bottom:0.5rem;">${idx + 1}. ${q}</li>`; });
        } else { qList.innerHTML = '<li>등록된 문항이 없습니다.</li>'; }

        const srcLink = document.getElementById('modal-source-link');
        if (job.sourceUrl && job.sourceUrl.startsWith('http')) {
            srcLink.href = job.sourceUrl; srcLink.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.1rem">link</span> 원본 공고 바로가기';
            srcLink.classList.remove('hidden');
        } else {
            srcLink.href = `https://www.google.com/search?q=${encodeURIComponent(job.company + ' ' + job.role + ' 채용공고')}`;
            srcLink.innerHTML = '<span class="material-symbols-rounded" style="font-size:1.1rem">search</span> 관련된 추천 공고 검색';
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

        let qInputs = job.questions.map((q, i) => `<div style="margin-bottom:0.8rem;"><span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${i + 1}번 문항:</span><textarea class="edit-q" style="width:100%; min-height:80px; padding:0.8rem; margin-top:0.3rem; border-radius:6px; border:1px solid var(--border-color); font-family:inherit;">${q}</textarea></div>`).join('');

        editContainer.innerHTML = `
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">기업명</label><input type="text" id="edit-m-company" value="${job.company}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">직무</label><input type="text" id="edit-m-role" value="${job.role}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem;"><label style="font-size:0.9rem;font-weight:600;display:block;margin-bottom:0.3rem;">마감일 (상시모집 시 비워주세요)</label><input type="date" id="edit-m-deadline" value="${job.deadline === '상시모집' ? '' : job.deadline}" style="width:100%; border:1px solid var(--border-color); padding:0.8rem; border-radius:6px;"></div>
            <div style="margin-bottom:1rem; padding:1rem; border:1px solid var(--border-color); border-radius:8px; background:#f8fafc;"><label style="font-size:1rem;color:var(--primary);display:block;font-weight:700;margin-bottom:0.8rem;">자소서 문항 관리</label>${qInputs}<button class="btn-sm" onclick="app.addEmptyQuestionInput()" style="margin-top:0.5rem; background:#eff6ff; color:var(--primary); font-weight:600;">+ 새 문항 추가</button></div>
            <button class="btn-primary" style="width:100%; margin-top:1.5rem; justify-content:center; padding:1.2rem;" onclick="app.saveEditedJobModal()">수정내용 저장</button>
        `;
    },

    addEmptyQuestionInput() {
        const editContainer = document.getElementById('modal-body-edit');
        const count = editContainer.querySelectorAll('.edit-q').length;
        const btn = editContainer.querySelector('button.btn-sm');
        const wrapper = document.createElement('div'); wrapper.style.marginBottom = '0.8rem';
        wrapper.innerHTML = `<span style="font-size:0.9rem;color:var(--text-muted);font-weight:600;">${count + 1}번 문항:</span><textarea class="edit-q" style="width:100%; min-height:80px; padding:0.8rem; margin-top:0.3rem; border-radius:6px; border:1px solid var(--border-color); font-family:inherit;"></textarea>`;
        btn.parentNode.insertBefore(wrapper, btn);
    },

    saveEditedJobModal() {
        const job = this.state.jobs.find(j => j.id === this.currentModalJobId);
        if (!job) return;
        job.company = document.getElementById('edit-m-company').value.trim();
        job.role = document.getElementById('edit-m-role').value.trim();
        const dl = document.getElementById('edit-m-deadline').value;
        job.deadline = dl ? dl : "상시모집";

        const qNodes = document.querySelectorAll('.edit-q');
        job.questions = Array.from(qNodes).map(n => n.value.trim()).filter(v => v);

        if (!job.answers) job.answers = [];
        while (job.answers.length < job.questions.length) job.answers.push('');
        if (job.answers.length > job.questions.length) job.answers = job.answers.slice(0, job.questions.length);

        this.saveStorage(); this.renderDashboard(); this.renderCalendar(); this.showJobModal(job.id);
        if (this.state.editorJobId === job.id) this.openEditor(job.id);
    },

    closeModal() { document.getElementById('job-modal').classList.add('hidden'); },

    renderCalendar() {
        const calGrid = document.getElementById('calendar-grid');
        const calMonthEl = document.getElementById('calendar-month');
        if (!calGrid) return;

        calGrid.innerHTML = '';
        const today = new Date();

        const alwaysContainer = document.getElementById('always-recruit-container');
        if (alwaysContainer) {
            const alwaysJobs = this.state.jobs.filter(j => j.deadline === '상시모집' && j.status !== 'fail' && j.status !== 'pass');
            if (alwaysJobs.length > 0) {
                alwaysContainer.style.display = 'flex';
                alwaysContainer.style.alignItems = 'center';
                alwaysContainer.style.flexWrap = 'wrap';
                let ajHtml = '<strong style="color:var(--primary); font-size:0.9rem; margin-right:0.5rem;">🌟 상시모집 공고:</strong> ';
                alwaysJobs.forEach(j => { ajHtml += `<span class="cal-job-badge ${j.status}" style="cursor:pointer; display:inline-block; margin-right:0.5rem;" onclick="app.showJobModal('${j.id}')">${j.company}</span>`; });
                alwaysContainer.innerHTML = ajHtml;
            } else { alwaysContainer.style.display = 'none'; }
        }

        const days = ['일', '월', '화', '수', '목', '금', '토'];
        for (let d of days) calGrid.innerHTML += `<div class="cal-day-header">${d}</div>`;

        if (this.calViewMode === 'week') {
            const targetWeekStart = new Date(today);
            targetWeekStart.setDate(today.getDate() - today.getDay() + (this.calOffset * 7));
            if (calMonthEl) calMonthEl.innerText = `${targetWeekStart.getFullYear()}년 ${targetWeekStart.getMonth() + 1}월 ${Math.ceil(targetWeekStart.getDate() / 7)}주차`;

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
            if (calMonthEl) calMonthEl.innerText = `${year}년 ${month + 1}월 달력`;
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
        document.getElementById('editor-company').innerHTML = `${job.company} <span style="font-weight:500; font-size:1.1rem; color:var(--text-muted)">| ${job.role}</span>`;
        this.renderEditorQuestions(job); this.loadEditorQuestion(0);
    },

    renderEditorQuestions(job) {
        const qList = document.querySelector('.q-list'); qList.innerHTML = '';
        if (!job.questions || job.questions.length === 0) { qList.innerHTML = '<div class="q-item active" style="white-space:normal; word-break:keep-all;">문항이 없습니다.</div>'; return; }
        job.questions.forEach((q, idx) => {
            qList.innerHTML += `<div class="q-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}" onclick="app.loadEditorQuestion(${idx})" style="white-space:normal; word-break:keep-all;">${idx + 1}. ${q}</div>`;
        });
    },

    loadEditorQuestion(idx) {
        this.state.editorActiveQIndex = idx;
        const job = this.state.jobs.find(j => j.id === this.state.editorJobId);
        if (!job) return;

        document.querySelectorAll('.q-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.q-item[data-idx="${idx}"]`);
        if (activeItem) activeItem.classList.add('active');

        document.getElementById('current-q-title').innerText = `${idx + 1}. ${job.questions[idx] || '문항 정보 없음'}`;
        const essayInput = document.getElementById('essay-input');
        const val = (job.answers && job.answers[idx]) ? job.answers[idx] : '';
        essayInput.value = val;

        const counter = document.getElementById('char-current');
        if (counter) counter.innerText = val.length;

        const st = document.getElementById('spell-check-status');
        if (st) { st.innerHTML = '<span class="material-symbols-rounded">check_circle</span> 에디터 준비됨'; st.className = 'spell-check-status ideal'; }
    },

    async runSpellCheck() {
        const essayInput = document.getElementById('essay-input');
        const textToFix = essayInput.value;
        if (!textToFix || textToFix.trim().length <= 5) { alert("먼저 작성창에 글을 작성해주세요."); return; }

        const statusLabel = document.getElementById('spell-check-status');
        statusLabel.innerHTML = '<span class="material-symbols-rounded spinning">sync</span> AI가 맞춤법 교정안을 스캔 중...';
        statusLabel.className = 'spell-check-status warning';
        document.getElementById('ai-suggestion-box').style.display = 'none';

        const prompt = `제공된 한국어 자소서 텍스트의 맞춤법, 띄어쓰기, 오탈자를 교정하고 어색한 표현을 더 자연스럽게 다듬어주세요. 
결과는 오직 순수 JSON으로만 반환해야 합니다. 응답 형식: {"explanation": "무엇이 틀렸고 어떻게 고쳤는지 브리핑 (2-3문장)", "correctedText": "최종 완성된 전체 텍스트 본문 (해당 텍스트 속성은 마크다운이 없어야 함)"}
텍스트: ${textToFix}`;

        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } })
            });
            const d = await resp.json();
            const parsed = JSON.parse(d.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());

            const suggBox = document.getElementById('ai-suggestion-box');
            suggBox.style.display = 'block';
            suggBox.innerHTML = `
                <div style="margin-bottom:0.5rem; color:var(--text-main);"><strong>💡 맞춤법 교정 요약:</strong> ${parsed.explanation}</div>
                <textarea id="spell-check-edit-area" style="width:100%; min-height:120px; background:#fff; border:1px solid #fbcfe8; padding:1rem; border-radius:6px; margin-bottom:0.8rem; font-size:0.95rem; color:var(--text-main); font-family:inherit; resize:vertical;">${parsed.correctedText}</textarea>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:-0.5rem; margin-bottom:0.8rem;">원하는 부분이 있다면 위 텍스트를 직접 수정한 뒤 적용할 수 있습니다.</div>
                <div class="ai-suggestion-actions">
                    <button class="btn-sm" style="background:#fff; border:1px solid var(--border-color); color:var(--text-muted);" onclick="document.getElementById('ai-suggestion-box').style.display='none'; document.getElementById('spell-check-status').innerHTML='<span class=\\'material-symbols-rounded\\'>info</span> 교정이 취소되었습니다.'; document.getElementById('spell-check-status').className='spell-check-status warning';">취소하고 닫기</button>
                    <button class="btn-primary" style="padding:0.5rem 1rem; border-radius:6px;" onclick="app.applySpellCheck()">이 내용으로 덮어씌울게요!</button>
                </div>
            `;
            statusLabel.innerHTML = '<span class="material-symbols-rounded">check_circle</span> 교정 제안 생성 완료 (내용을 확인해주세요)';
            statusLabel.className = 'spell-check-status ideal';
        } catch (e) {
            statusLabel.innerHTML = '<span class="material-symbols-rounded">error</span> 검수 에러 발생 (재시도 요망)';
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
        statusLabel.innerHTML = '<span class="material-symbols-rounded">check_circle</span> 에디터에 성공적으로 반영/저장됨';
        statusLabel.className = 'spell-check-status ideal';
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
                            <span style="color:var(--primary); font-size:0.85rem; font-weight:600; padding:0.2rem 0.5rem; background:#fff; border-radius:12px; border:1px solid var(--primary);">${ans.length}자</span>
                        </div>
                        <div style="font-size:0.95rem; font-weight:600; margin-bottom:0.8rem; color:var(--text-muted); border-bottom:1px solid #cbd5e1; padding-bottom:0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">Q. ${q}</div>
                        <div style="font-size:0.95rem; color:var(--text-main); line-height:1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${ans}</div>
                    `;
                    btn.onclick = () => {
                        if (confirm("해당 자소서 내용을 현재 작성 중인 창에 덮어씌우시겠습니까?")) {
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
            listDiv.innerHTML = '<p style="padding:3rem; text-align:center; color:var(--text-muted); font-size:1.1rem;">작성 완료된 과거 지원 자소서들 중 재활용할 만한 데이터가 아직은 없습니다.</p>';
        }
        document.getElementById('import-modal').classList.remove('hidden');
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => { app.init(); });

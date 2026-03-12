let db;
const request = indexedDB.open("MemoryMaster_V6", 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    db.createObjectStore("subjects", { keyPath: "id", autoIncrement: true });
    let q = db.createObjectStore("questions", { keyPath: "id", autoIncrement: true });
    q.createIndex("sid", "sid", { unique: false });
};
request.onsuccess = e => { db = e.target.result; renderSubjects(); };

let curSid = null, curQid = null, itemToDelete = null, deleteType = "";

function navigate(id, title = "") {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id + '-screen').classList.remove('hidden');
    if (title) document.getElementById('nav-title').innerText = title;
    document.getElementById('back-btn').classList.toggle('hidden', id === 'subjects');
}

document.getElementById('back-btn').onclick = () => {
    const active = document.querySelector('section:not(.hidden)').id;
    if (active === 'questions-screen') navigate('subjects', 'المكتبة');
    else navigate('questions');
};

function showAlert(msg) { document.getElementById('alert-msg').innerText = msg; document.getElementById('alert-modal').classList.remove('hidden'); }
function closeAlert() { document.getElementById('alert-modal').classList.add('hidden'); }
function closeDeleteModal() { document.getElementById('delete-modal').classList.add('hidden'); itemToDelete = null; }

function renderSubjects() {
    const list = document.getElementById('subjects-list'); list.innerHTML = "";
    db.transaction("subjects").objectStore("subjects").openCursor().onsuccess = e => {
        const c = e.target.result; if (!c) return;
        const s = c.value;
        const div = document.createElement('div');
        div.className = "subject-card"; div.style.backgroundColor = s.color;
        div.innerHTML = `<div>${s.name}</div><div class="edit-icon-small" onclick='openSubEdit(${JSON.stringify(s)}, event)'><i class="fas fa-pen"></i></div>`;
        div.onclick = () => { curSid = s.id; navigate('questions', s.name); renderQuestions(); };
        
        let timer;
        div.onmousedown = div.ontouchstart = () => {
            timer = setTimeout(() => { itemToDelete = s.id; deleteType = "sub"; document.getElementById('delete-modal').classList.remove('hidden'); }, 1000);
        };
        div.onmouseup = div.ontouchend = () => clearTimeout(timer);
        list.appendChild(div); c.continue();
    };
}

function renderQuestions() {
    const list = document.getElementById('questions-list'); list.innerHTML = "";
    db.transaction("questions").objectStore("questions").index("sid").openCursor(IDBKeyRange.only(curSid)).onsuccess = e => {
        const c = e.target.result; if (!c) return;
        const q = c.value;
        const div = document.createElement('div');
        div.className = `q-box status-${q.status}`;
        div.innerHTML = `<div style="position:absolute;top:3px;left:3px;font-size:0.6rem;color:#4834d4;" onclick='event.stopPropagation(); openQEditor(${JSON.stringify(q)})'><i class="fas fa-pen"></i></div><span>${q.num}</span>`;
        div.onclick = () => startQuiz(q);
        
        let timer;
        div.onmousedown = div.ontouchstart = () => {
            timer = setTimeout(() => { itemToDelete = q.id; deleteType = "q"; document.getElementById('delete-modal').classList.remove('hidden'); }, 1000);
        };
        div.onmouseup = div.ontouchend = () => clearTimeout(timer);
        list.appendChild(div); c.continue();
    };
}

document.getElementById('confirm-delete-btn').onclick = () => {
    if (!itemToDelete) return;
    const store = deleteType === "sub" ? "subjects" : "questions";
    db.transaction(store, "readwrite").objectStore(store).delete(itemToDelete).onsuccess = () => {
        closeDeleteModal();
        deleteType === "sub" ? renderSubjects() : renderQuestions();
    };
};

function saveSubject() {
    const name = document.getElementById('sub-name').value.trim();
    const color = document.querySelector('input[name="sub-color"]:checked').value;
    const eid = document.getElementById('edit-sub-id').value;
    if (!name) return;
    const tx = db.transaction("subjects", "readwrite");
    const store = tx.objectStore("subjects");
    store.getAll().onsuccess = (e) => {
        const isDuplicate = e.target.result.some(s => s.name === name && s.id !== Number(eid));
        if (isDuplicate) { showAlert("هذا الاسم موجود مسبقاً في المكتبة"); return; }
        if (eid) store.put({ id: Number(eid), name, color });
        else store.add({ name, color });
        tx.oncomplete = () => { closeSubModal(); renderSubjects(); };
    };
}

function openSubModal() { document.getElementById('sub-modal-title').innerText = "مادة جديدة"; document.getElementById('edit-sub-id').value = ""; document.getElementById('sub-name').value = ""; document.getElementById('sub-modal').classList.remove('hidden'); }
function closeSubModal() { document.getElementById('sub-modal').classList.add('hidden'); }
function openSubEdit(s, ev) { ev.stopPropagation(); document.getElementById('sub-modal-title').innerText = "تعديل المادة"; document.getElementById('edit-sub-id').value = s.id; document.getElementById('sub-name').value = s.name; document.querySelector(`input[name="sub-color"][value="${s.color}"]`).checked = true; document.getElementById('sub-modal').classList.remove('hidden'); }

function saveQuestion() {
    const num = document.getElementById('q-num').value.trim();
    const text = document.getElementById('q-text').value;
    if (!num || !text) return;
    const data = { 
        sid: curSid, num, title: document.getElementById('q-title').value, text,
        status: document.querySelector('input[name="status"]:checked').value,
        grouping: Number(document.querySelector('input[name="grouping"]:checked').value),
        diff: parseFloat(document.querySelector('input[name="diff"]:checked').value)
    };
    if (curQid) data.id = curQid;
    const tx = db.transaction("questions", "readwrite");
    const store = tx.objectStore("questions");
    store.index("sid").getAll(IDBKeyRange.only(curSid)).onsuccess = (e) => {
        const isDuplicate = e.target.result.some(q => q.num === num && q.id !== curQid);
        if (isDuplicate) { showAlert("هذا الرقم مستخدم بالفعل في هذه المادة"); return; }
        store.put(data);
        tx.oncomplete = () => { navigate('questions'); renderQuestions(); };
    };
}

function openQEditor(q = null) {
    curQid = q ? q.id : null;
    document.getElementById('q-num').value = q ? q.num : "";
    document.getElementById('q-title').value = q ? q.title : "";
    document.getElementById('q-text').value = q ? q.text : "";
    if(q) {
        document.querySelector(`input[name="status"][value="${q.status}"]`).checked = true;
        document.querySelector(`input[name="grouping"][value="${q.grouping}"]`).checked = true;
        document.querySelector(`input[name="diff"][value="${q.diff}"]`).checked = true;
    }
    navigate('editor', q ? "تعديل" : "إضافة");
}

function startQuiz(q) {
    const lines = q.text.split('\n');
    let content = [];
    lines.forEach((line, idx) => {
        const words = line.split(/\s+/).filter(w => w);
        for (let j = 0; j < words.length; j += q.grouping) content.push({ t: words.slice(j, j + q.grouping).join(" "), isBr: false });
        if (idx < lines.length - 1) content.push({ isBr: true });
    });
    const wordOnly = content.filter(i => !i.isBr);
    let gaps = [];
    let count = Math.ceil(wordOnly.length * q.diff);
    while(gaps.length < count) {
        let r = Math.floor(Math.random() * wordOnly.length);
        if(!gaps.includes(r)) gaps.push(r);
    }
    gaps.sort((a,b) => a-b);
    navigate('quiz', q.title || "تمرين");
    const body = document.getElementById('quiz-display'); body.innerHTML = "";
    let wCounter = 0;
    content.forEach(item => {
        if (item.isBr) body.appendChild(document.createElement('br'));
        else {
            if (gaps.includes(wCounter)) {
                const s = document.createElement('span'); s.className = "gap"; s.id = `g-${wCounter}`;
                body.appendChild(s);
            } else body.appendChild(document.createTextNode(item.t + " "));
            wCounter++;
        }
    });
    const pool = document.getElementById('quiz-pool'); pool.innerHTML = "";
    let solved = 0;
    gaps.map(i => wordOnly[i].t).sort(() => Math.random() - 0.5).forEach(txt => {
        const b = document.createElement('div'); 
        b.className = "pool-item"; 
        b.innerText = txt;
        b.onclick = () => {
            if (txt === wordOnly[gaps[solved]].t) {
                const target = document.getElementById(`g-${gaps[solved]}`);
                target.innerText = txt; target.className = "gap correct";
                b.style.opacity = "0.1"; b.style.pointerEvents = "none";
                solved++;
                if (solved === gaps.length) setTimeout(() => navigate('questions'), 800);
            } else {
                const target = document.getElementById(`g-${gaps[solved]}`);
                target.classList.add('error-flash');
                setTimeout(() => target.classList.remove('error-flash'), 400);
            }
        };
        pool.appendChild(b);
    });
}

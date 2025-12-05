/* app.js - enhanced board logic
   Features:
   - Tasks as objects with id, text, user, date, status
   - Add task (auto date + current user)
   - Move forward / backward via buttons
   - Delete tasks (confirm)
   - Drag & drop between columns updates task status
   - Persist tasks array in localStorage
*/
(function(){
    const STATUS_ORDER = ['pendiente','proceso','completo'];
    function qs(id){ return document.getElementById(id); }

    let tasks = [];

    let members = [];

    // Usuarios simulados: { name, password } where password is "encrypted" (reversed)
    let users = [];

    // Genera un color HSL determinístico a partir del nombre (misma entrada -> mismo color)
    function generateColorForName(name){
        let h = 0;
        for (let i=0;i<name.length;i++){ h = (h<<5) - h + name.charCodeAt(i); h |= 0; }
        h = Math.abs(h) % 360;
        return `hsl(${h} 70% 45%)`;
    }

    // Simulated "encryption": reverse the password string
    function encryptPassword(p){ if (typeof p !== 'string') return ''; return p.split('').reverse().join(''); }
    function decryptPassword(enc){ if (typeof enc !== 'string') return ''; return enc.split('').reverse().join(''); }

    function findUserByName(name){ if (!name) return null; return users.find(u => u.name === name) || null; }

    function addUser(name, password){
        const n = (name||'').trim();
        if (!n) return { ok:false, msg:'Nombre inválido' };
        if (findUserByName(n)) return { ok:false, msg:'Usuario ya existe' };
        if (!password || password.length < 4) return { ok:false, msg:'Contraseña debe tener al menos 4 caracteres' };
        users.push({ name: n, password: encryptPassword(password) });
        // also add as member for assignment convenience
        addMember(n);
        saveState();
        return { ok:true };
    }

    // Devuelve el usuario actualmente mostrado en la UI (login)
    function currentUser(){
        const el = qs('usernameDisplay');
        if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
        const u = qs('user');
        return (u && u.value) ? u.value.trim() : '';
    }

    // Carga el estado (tasks y members) desde localStorage y normaliza formatos antiguos
    function loadState(){
        try{
            const raw = localStorage.getItem('boardState');
            if (!raw) { tasks = []; members = []; return; }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) { tasks = parsed; members = []; return; }
            if (parsed && (parsed.pendiente || parsed.proceso || parsed.completo)){
                tasks = [];
                ['pendiente','proceso','completo'].forEach(s => {
                    (parsed[s]||[]).forEach(text => {
                        tasks.push({ id: 't'+Date.now()+Math.random().toString(36).slice(2,6), text: text, user: '', date: (new Date()).toISOString(), status: s });
                    });
                });
                saveState();
                return;
            }
            tasks = parsed.tasks || [];
            members = (parsed.members || []).map(m => {
                if (!m) return null;
                if (typeof m === 'string') return { name: m, color: generateColorForName(m) };
                if (typeof m === 'object' && m.name) return { name: m.name, color: m.color || generateColorForName(m.name) };
                return null;
            }).filter(Boolean);
            // users persisted as { name, password }
            users = (parsed.users || []).map(u => {
                if (!u) return null;
                if (typeof u === 'string') return { name: u, password: '' };
                if (typeof u === 'object' && u.name) return { name: u.name, password: u.password || '' };
                return null;
            }).filter(Boolean);
    } catch(e){ tasks = []; members = []; }
    }

    function saveState(){
        try{ localStorage.setItem('boardState', JSON.stringify({ tasks: tasks, members: members, users: users })); } catch(e){}
    }

    // Rellena el <select> de miembros en la barra superior
    function renderMembers(){
        const sel = qs('memberSelect');
        if (!sel) return;
        sel.innerHTML = '';
        const defaultOpt = document.createElement('option'); defaultOpt.value = ''; defaultOpt.textContent = '(Usuario actual)'; sel.appendChild(defaultOpt);
                (members || []).forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; o.style.background = m.color; sel.appendChild(o); });
    }

    // Añade un miembro nuevo con color generado. Devuelve false si ya existe o nombre inválido
    function addMember(name){
        const n = (name||'').trim();
        if (!n) return false;
        if (members.find(m => m.name === n)) return false;
        const color = generateColorForName(n);
        members.push({ name: n, color });
        saveState(); renderMembers(); return true;
    }

    function createTask(text){
        const t = {
            id: 't'+Date.now() + '-' + Math.random().toString(36).slice(2,6),
            text: text,
            // prefer selected member if any
            user: (function(){ const sel = qs('memberSelect'); if (sel && sel.value) return sel.value; return currentUser() || ''; })(),
            date: (new Date()).toISOString(),
            status: 'pendiente'
        };
        tasks.push(t);
        saveState();
        renderBoard();
        return t;
    }

    // Task validation: trimmed length 3..200, no angle brackets
    function isValidTask(text){
        if (typeof text !== 'string') return { ok:false, msg:'Contenido inválido' };
        const t = text.trim();
        if (t.length < 3) return { ok:false, msg:'La tarea es muy corta (mín 3 caracteres)' };
        if (t.length > 200) return { ok:false, msg:'La tarea es demasiado larga (máx 200 caracteres)' };
        if (/[<>]/.test(t)) return { ok:false, msg:'La tarea no puede contener caracteres < o >' };
        return { ok:true };
    }

    function escapeHtml(s){
        return (s||'').toString().replace(/[&<>"']/g, function(ch){
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[ch];
        });
    }

    function makeTaskElement(task){
        const el = document.createElement('div');
        el.className = 'task';
        el.dataset.id = task.id;
        el.draggable = true;

        const content = document.createElement('div');
        content.className = 'content';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = task.text;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const userSpan = document.createElement('span');
    userSpan.className = 'user';
    userSpan.textContent = task.user || '';
    userSpan.title = 'Editar usuario';
    userSpan.style.cursor = 'pointer';
    const memberObj = members.find(m => m.name === (task.user || ''));
    if (memberObj && memberObj.color){
        userSpan.style.background = memberObj.color;
    }

    const dateSpan = document.createElement('span');
    dateSpan.className = 'date';
    dateSpan.textContent = task.date ? new Date(task.date).toLocaleString() : '';
    dateSpan.title = 'Editar fecha';
    dateSpan.style.cursor = 'pointer';

    meta.appendChild(userSpan);
    meta.appendChild(dateSpan);

        content.appendChild(title);
        content.appendChild(meta);

        const controls = document.createElement('div');
        controls.className = 'controls';

        const btnBack = document.createElement('button');
        btnBack.className = 'btn btn-move';
        btnBack.title = 'Retroceder';
        btnBack.innerHTML = '&#9664;';
        btnBack.addEventListener('click', function(){ moveTask(task.id, -1); });

        const btnForward = document.createElement('button');
        btnForward.className = 'btn btn-move';
        btnForward.title = 'Avanzar';
        btnForward.innerHTML = '&#9654;';
        btnForward.addEventListener('click', function(){ moveTask(task.id, +1); });

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-delete';
        btnDelete.title = 'Eliminar';
        btnDelete.innerHTML = '&#128465;';
        btnDelete.addEventListener('click', function(){ deleteTask(task.id); });

        controls.appendChild(btnBack);
        controls.appendChild(btnForward);
        controls.appendChild(btnDelete);

        el.appendChild(content);
        el.appendChild(controls);

        el.addEventListener('dragstart', function(e){
            try { e.dataTransfer.setData('text/plain', task.id); } catch(err){}
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        });

        el.addEventListener('dragend', function(){
            el.classList.remove('dragging');
            saveState();
        });

    // Editar usuario en línea: reemplaza el badge por un select de miembros
        userSpan.addEventListener('click', function(){
            // create select
            const sel = document.createElement('select');
            sel.className = 'inline-member-select';
            const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.textContent = '(Usuario actual)'; sel.appendChild(emptyOpt);
            (members || []).forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; if (m.name === task.user) o.selected = true; sel.appendChild(o); });
            sel.addEventListener('change', function(){
                task.user = sel.value || '';
                if (task.user && !members.find(m=>m.name===task.user)){
                    addMember(task.user);
                }
                saveState();
                renderBoard();
            });
            sel.addEventListener('blur', function(){ renderBoard(); });
            userSpan.replaceWith(sel);
            sel.focus();
        });

    // Editar fecha en línea usando input datetime-local
        dateSpan.addEventListener('click', function(){
            const input = document.createElement('input');
            input.type = 'datetime-local';
            // convert ISO to input value
            const dt = task.date ? new Date(task.date) : new Date();
            const v = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0') + 'T' + String(dt.getHours()).padStart(2,'0') + ':' + String(dt.getMinutes()).padStart(2,'0');
            input.value = v;
            input.addEventListener('change', function(){
                const newVal = input.value; if (!newVal) return;
                const parsed = new Date(newVal);
                if (!isNaN(parsed)){
                    task.date = parsed.toISOString();
                    saveState();
                    renderBoard();
                }
            });
            input.addEventListener('blur', function(){ renderBoard(); });
            dateSpan.replaceWith(input);
            input.focus();
        });

        return el;
    }

    function renderBoard(){
        ['list-pendiente','list-proceso','list-completo'].forEach(id => {
            const container = qs(id);
            if (!container) return;
            container.innerHTML = '';
        });
        tasks.forEach(t => {
            const listId = t.status === 'pendiente' ? 'list-pendiente' : (t.status === 'proceso' ? 'list-proceso' : 'list-completo');
            const container = qs(listId);
            if (container) container.appendChild(makeTaskElement(t));
        });
        updateControlStates();
    }

    function updateControlStates(){
        tasks.forEach(t => {
            const el = document.querySelector('[data-id="'+t.id+'"]');
            if (!el) return;
            const btns = el.querySelectorAll('.btn-move');
            if (btns && btns.length >= 2){
                const idx = STATUS_ORDER.indexOf(t.status);
                btns[0].disabled = idx <= 0;
                btns[1].disabled = idx >= STATUS_ORDER.length - 1;
            }
        });
    }

    function moveTask(id, dir){
        const i = tasks.findIndex(x => x.id === id);
        if (i < 0) return;
        const idx = STATUS_ORDER.indexOf(tasks[i].status);
        const newIdx = Math.min(Math.max(0, idx + dir), STATUS_ORDER.length - 1);
        tasks[i].status = STATUS_ORDER[newIdx];
        saveState();
        renderBoard();
    }

    function deleteTask(id){
        if (!confirm('¿Eliminar esta tarea?')) return;
        tasks = tasks.filter(x => x.id !== id);
        saveState();
        renderBoard();
    }

    function setupDropZones(){
        const mapping = [ {id:'list-pendiente', status:'pendiente'}, {id:'list-proceso', status:'proceso'}, {id:'list-completo', status:'completo'} ];
        mapping.forEach(m => {
            const el = qs(m.id);
            if (!el) return;
            el.addEventListener('dragover', function(e){ e.preventDefault(); el.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; });
            el.addEventListener('dragleave', function(){ el.classList.remove('drag-over'); });
            el.addEventListener('drop', function(e){
                e.preventDefault(); el.classList.remove('drag-over');
                const data = e.dataTransfer.getData('text/plain');
                if (!data) return;
                const t = tasks.find(x => x.id === data);
                if (t){ t.status = m.status; saveState(); renderBoard(); }
            });
        });
    }

    // Public API for buttons/HTML attributes
    window.addTask = function(){
        const inp = qs('newTask');
        const v = (inp && inp.value) ? inp.value.trim() : '';
        const errEl = qs('taskError'); if (errEl) errEl.textContent = '';
        if (!v){ if (errEl) errEl.textContent = 'Ingrese una tarea'; if (inp) inp.focus(); return; }
        const check = isValidTask(v);
        if (!check.ok){ if (errEl) errEl.textContent = check.msg; if (inp) inp.focus(); return; }
        createTask(v);
        if (inp) inp.value = '';
    };

    window.exportState = function(){
        const data = JSON.stringify({ tasks: tasks, members: members, users: users }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'boardState.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    window.handleImport = function(event){
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e){
            try{
                const parsed = JSON.parse(e.target.result);
                if (Array.isArray(parsed)){
                    tasks = parsed; members = [];
                } else if (parsed && (parsed.pendiente || parsed.proceso || parsed.completo)){
                    tasks = [];
                    ['pendiente','proceso','completo'].forEach(s => {
                        (parsed[s]||[]).forEach(text => tasks.push({ id: 't'+Date.now()+Math.random().toString(36).slice(2,6), text: text, user: '', date: (new Date()).toISOString(), status: s }));
                    });
                } else if (parsed.tasks) {
                    tasks = parsed.tasks;
                    members = (parsed.members || []).map(m => {
                        if (!m) return null;
                        if (typeof m === 'string') return { name: m, color: generateColorForName(m) };
                        if (typeof m === 'object' && m.name) return { name: m.name, color: m.color || generateColorForName(m.name) };
                        return null;
                    }).filter(Boolean);
                    users = (parsed.users || []).map(u => {
                        if (!u) return null;
                        if (typeof u === 'string') return { name: u, password: '' };
                        if (typeof u === 'object' && u.name) return { name: u.name, password: u.password || '' };
                        return null;
                    }).filter(Boolean);
                } else {
                    throw new Error('Formato desconocido');
                }
                saveState(); renderMembers(); renderBoard(); alert('Tablero importado correctamente.');
            } catch(err){
                alert('Error al importar: archivo inválido.');
            }
            if (qs('importFile')) qs('importFile').value = '';
        };
        reader.readAsText(file);
    };

    window.clearBoard = function(){
        if (!confirm('¿Limpiar todo el tablero? Esta acción no se puede deshacer.')) return;
        tasks = [];
        saveState(); renderBoard();
    };

    window.logout = function(){
        if (qs('loginOverlay')) qs('loginOverlay').style.display = '';
        if (qs('app')) { qs('app').style.display = 'none'; qs('app').classList.add('hidden'); }
        if (qs('userIndicator')) qs('userIndicator').classList.add('hidden');
        if (qs('usernameDisplay')) qs('usernameDisplay').textContent = '';
        // Do not wipe tasks on logout; just persist current state and re-render (board hidden)
        saveState(); renderBoard();
    };

    // Register a new simulated user (reads inputs from the login overlay)
    window.registerUser = function(){
        const u = qs('user') && qs('user').value && qs('user').value.trim();
        const p = qs('pass') && qs('pass').value;
        const pc = qs('passConfirm') && qs('passConfirm').value;
        if (!u || !p){ if (qs('errorMsg')) qs('errorMsg').innerText = 'Ingrese usuario y contraseña'; return; }
        if (p !== pc){ if (qs('errorMsg')) qs('errorMsg').innerText = 'Las contraseñas no coinciden'; return; }
        loadState(); // ensure users loaded
        const res = addUser(u, p);
        if (!res.ok){ if (qs('errorMsg')) qs('errorMsg').innerText = res.msg; return; }
        // auto-login after register
        if (qs('loginOverlay')) qs('loginOverlay').style.display = 'none';
        if (qs('app')) { qs('app').style.display = ''; qs('app').classList.remove('hidden'); }
        if (qs('userIndicator')) qs('userIndicator').classList.remove('hidden');
        if (qs('usernameDisplay')) qs('usernameDisplay').textContent = u;
        if (qs('errorMsg')) qs('errorMsg').innerText = '';
        renderMembers(); renderBoard(); setupDropZones();
        // clear password inputs after successful register/login
        if (qs('pass')) qs('pass').value = '';
        if (qs('passConfirm')) qs('passConfirm').value = '';
    };

    window.login = function(){
        const u = qs('user') && qs('user').value && qs('user').value.trim();
        const p = qs('pass') && qs('pass').value;
        if (!u || !p){ if (qs('errorMsg')) qs('errorMsg').innerText = 'Ingrese credenciales'; return; }
        loadState();
        const userObj = findUserByName(u);
        if (!userObj){ if (qs('errorMsg')) qs('errorMsg').innerText = 'Usuario o contraseña inválidos'; return; }
        const realPass = decryptPassword(userObj.password);
        if (realPass !== p){ if (qs('errorMsg')) qs('errorMsg').innerText = 'Usuario o contraseña inválidos'; return; }
        // success
        if (qs('loginOverlay')) qs('loginOverlay').style.display = 'none';
        if (qs('app')) { qs('app').style.display = ''; qs('app').classList.remove('hidden'); }
        if (qs('userIndicator')) qs('userIndicator').classList.remove('hidden');
        if (qs('usernameDisplay')) qs('usernameDisplay').textContent = u;
        if (qs('errorMsg')) qs('errorMsg').innerText = '';
        renderMembers(); renderBoard(); setupDropZones();
        // clear password inputs after successful login
        if (qs('pass')) qs('pass').value = '';
        if (qs('passConfirm')) qs('passConfirm').value = '';
    };

    // Init
    document.addEventListener('DOMContentLoaded', function(){
        if (!qs('app')) return;
        loadState(); renderMembers(); renderBoard(); setupDropZones();
        const inp = qs('newTask');
        if (inp) inp.addEventListener('keypress', function(e){ if (e.key === 'Enter') window.addTask(); });
        const addMemberBtn = qs('addMemberBtn');
        if (addMemberBtn){
            addMemberBtn.addEventListener('click', function(){
                const name = prompt('Nombre del nuevo miembro:');
                if (name && name.trim()){
                    addMember(name.trim());
                }
            });
        }
        const userInput = qs('user'); const passInput = qs('pass'); const passConfirmInput = qs('passConfirm');
        [userInput, passInput, passConfirmInput].forEach(inp => { if (!inp) return; inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){
                // If passConfirm has a value (user likely wants to register) call registerUser,
                // otherwise call login. This avoids accidentally logging in when pressing Enter while registering.
                if (passConfirmInput && passConfirmInput.value && passConfirmInput.value.trim() !== ''){
                    window.registerUser();
                } else {
                    window.login();
                }
            } }); });
    });

})();

let db;
let globalClients = [];

// --- 1. INDEXEDDB CONFIG ---
const request = indexedDB.open("CRM_Database_V2", 1); // Cambié nombre V2 para asegurar actualización limpia

request.onerror = (e) => showToast("Error al abrir la base de datos", "error");

request.onsuccess = (e) => {
    db = e.target.result;
    loadClients();
};

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if(!db.objectStoreNames.contains('clients')) {
        const objectStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('email', 'email', { unique: true });
    }
};

// --- 2. VARIABLES DOM ---
const form = document.getElementById('client-form');
const addBtn = document.getElementById('add-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clientList = document.getElementById('client-list');
const searchInput = document.getElementById('search-input');
const countBadge = document.getElementById('count-badge');
const inputs = form.querySelectorAll('input[required]');

const validationStatus = { name: false, email: false, phone: false };
const regex = {
    name: /^[a-zA-ZÀ-ÿ\s]{3,}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\d\s-]{7,15}$/
};

// --- 3. FUNCIONES AUXILIARES (Toast) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- 4. BUSCADOR ---
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = globalClients.filter(client =>
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.phone.includes(term) ||
        (client.type && client.type.includes(term)) // Busca también por tipo
    );
    renderClients(filtered);
});

// --- 5. VALIDACIONES ---
inputs.forEach(input => {
    input.addEventListener('input', validateField);
    input.addEventListener('blur', validateField);
});

function validateField(e) {
    const field = e.target;
    const isValid = regex[field.name].test(field.value.trim());
    validationStatus[field.name] = isValid;

    if(isValid) {
        field.classList.add('valid');
        field.classList.remove('invalid');
    } else {
        field.classList.add('invalid');
        field.classList.remove('valid');
    }
    addBtn.disabled = !Object.values(validationStatus).every(v => v);
}

// --- 6. CRUD ---

form.addEventListener('submit', e => {
    e.preventDefault();
    saveClient();
});

function saveClient() {
    const id = document.getElementById('clientId').value;

    // NUEVO: Recogemos el valor del selector de tipo
    const client = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        type: document.getElementById('type').value // 'regular', 'nuevo', 'vip'
    };

    if (id) client.id = parseInt(id);

    const tx = db.transaction(['clients'], 'readwrite');
    const store = tx.objectStore('clients');
    const req = id ? store.put(client) : store.add(client);

    req.onsuccess = () => {
        showToast(id ? "Cliente actualizado" : "Cliente agregado", "success");
        resetForm();
        loadClients();
    };

    req.onerror = () => showToast("Error: El email ya existe", "error");
}

function loadClients() {
    const tx = db.transaction(['clients'], 'readonly');
    const store = tx.objectStore('clients');
    const req = store.getAll();

    req.onsuccess = () => {
        globalClients = req.result;
        renderClients(globalClients);
    };
}

function renderClients(clientsToRender) {
    clientList.innerHTML = '';
    countBadge.textContent = clientsToRender.length;

    if (clientsToRender.length === 0) {
        clientList.innerHTML = '<p style="text-align:center; color:#888">No se encontraron resultados.</p>';
        return;
    }

    clientsToRender.forEach(client => {
        // Lógica para la etiqueta (si es antiguo y no tiene tipo, por defecto regular)
        const type = client.type || 'regular';
        const typeLabel = type === 'vip' ? 'VIP' : (type === 'nuevo' ? 'NUEVO' : 'REGULAR');

        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${client.name}</strong> 
                <span class="badge ${type}">${typeLabel}</span><br>
                <small>📧 ${client.email} | 📞 ${client.phone}</small>
            </div>
            <div class="actions">
                <button class="edit" onclick="editClient(${client.id})"><i class="fas fa-edit"></i></button>
                <button class="delete" onclick="deleteClient(${client.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        clientList.appendChild(li);
    });
}

window.editClient = function(id) {
    const client = globalClients.find(c => c.id === id);
    if(client) {
        document.getElementById('clientId').value = client.id;
        document.getElementById('name').value = client.name;
        document.getElementById('email').value = client.email;
        document.getElementById('phone').value = client.phone;

        // NUEVO: Seleccionamos el tipo correcto en el dropdown
        document.getElementById('type').value = client.type || 'regular';

        inputs.forEach(i => {
            i.classList.add('valid');
            validationStatus[i.name] = true;
        });

        addBtn.textContent = "Actualizar";
        addBtn.disabled = false;
        cancelBtn.style.display = 'inline-block';
        showToast("Modo edición activado", "info");
    }
};

window.deleteClient = function(id) {
    if(!confirm("¿Eliminar este cliente permanentemente?")) return;

    const tx = db.transaction(['clients'], 'readwrite');
    tx.objectStore('clients').delete(id);

    tx.oncomplete = () => {
        showToast("Cliente eliminado", "warning");
        loadClients();
    };
};

cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    form.reset();
    document.getElementById('clientId').value = '';
    inputs.forEach(i => i.classList.remove('valid', 'invalid'));
    // Resetear select al valor por defecto
    document.getElementById('type').value = 'regular';

    addBtn.textContent = "Guardar Cliente";
    addBtn.disabled = true;
    cancelBtn.style.display = 'none';
    showToast("Formulario limpio", "info");
}
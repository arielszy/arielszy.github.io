if (serviceWorker in navigator) {
    navigator.serviceWorker.register(sw.js).catch(() => {});
}

let db;
const DB_NAME = GestionPedidosDB;
const DB_VERSION = 1;

const STORES = {
    CLIENTS: clients,
    ORDERS: orders,
    PAYMENTS: payments,
    CONFIG: config,
    SYNC_QUEUE: syncQueue
};

let ticketConfig = {
    showLogo: true,
    showClientName: true,
    showClientPhone: true,
    showClientAddress: true,
    showDate: true,
    showDescription: true,
    showAmount: true,
    showFooter: true,
    businessName: 'Mi Negocio',
    footerText: 'Gracias por su compra',
};

let editingClientId = null;
let editingOrderId = null;
let reportFilter = todos;
const ITEMS_PER_PAGE = 10;
let currentPage = { clients: 1, orders: 1, accounts: 1, payments: 1, summary: 1 };
let orderFilters = { clientId: ,  status: , dateFrom: , dateTo:  };
let paymentFilters = { clientId: , dateFrom: , dateTo:  };

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            [STORES.CLIENTS, STORES.ORDERS, STORES.PAYMENTS, STORES.CONFIG].forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: id });
                }
            });
            if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: id, autoIncrement: true });
            }
        };
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readonly);
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function getById(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readonly);
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function add(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readwrite);
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function put(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readwrite);
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function delete_(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readwrite);
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

function clear(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], readwrite);
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function addToSyncQueue(action, store, data) {
    await add(STORES.SYNC_QUEUE, {
        action: action,
        store: store,
        data: data,
        timestamp: new Date().toISOString(),
        synced: false
    });
    syncWithServer();
}

async function syncWithServer() {
    if (!navigator.onLine) return;
    
    try {
        const queue = await getAll(STORES.SYNC_QUEUE);
        const unsyncedItems = queue.filter(item => !item.synced);

        for (const item of unsyncedItems) {
            try {
                const method = item.action === delete ? DELETE : (item.action === update ? PUT : POST);
                const response = await fetch(/api/ + item.store, {
                    method: method,
                    headers: { Content-Type: application/json },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    item.synced = true;
                    await put(STORES.SYNC_QUEUE, item);
                }
            } catch (error) {
                console.error(Error sincronizando:, error);
            }
        }
        updateSyncIndicator();
    } catch (error) {
        console.error(Error en sincronización:, error);
    }
}

function updateSyncIndicator() {
    const status = document.getElementById(syncStatus);
    if (navigator.onLine) {
        status.className = sync-status online;
        status.innerHTML = <span class="sync-indicator"></span>En línea;
    } else {
        status.className = sync-status offline;
        status.innerHTML = <span class="sync-indicator offline"></span>Sin conexión;
    }
}

window.addEventListener(online, () => {
    updateSyncIndicator();
    syncWithServer();
});

window.addEventListener(offline, updateSyncIndicator);

setInterval(syncWithServer, 30000);

async function initApp() {
    try {
        await initDB();
        await loadTicketConfig();
        setCurrentDate();
        await renderAll();
        setupSearchListeners();
        await updateFilterOptions();
        updateSyncIndicator();
    } catch (error) {
        console.error(Error inicializando app:, error);
    }
}

async function loadTicketConfig() {
    try {
        const config = await getById(STORES.CONFIG, ticketConfig);
        if (config) {
            ticketConfig = config.value;
        }
    } catch (error) {
        console.error(Error cargando configuración:, error);
    }
}

async function saveTicketConfig() {
    try {
        await put(STORES.CONFIG, { key: ticketConfig, value: ticketConfig });
    } catch (error) {
        console.error(Error guardando configuración:, error);
    }
}

function switchSettingsTab(tabName) {
    document.querySelectorAll(.settings-tab-btn).forEach(btn => btn.classList.remove(active));
    document.querySelectorAll(.settings-tab-content).forEach(content => content.classList.remove(active));
    event.target.classList.add(active);
    document.getElementById(tabName).classList.add(active);
    
    if (tabName === database) {
        updateDatabaseInfo();
    }
}

async function updateDatabaseInfo() {
    const clients = await getAll(STORES.CLIENTS);
    const orders = await getAll(STORES.ORDERS);
    const payments = await getAll(STORES.PAYMENTS);
    
    document.getElementById(dbInfo).innerHTML = `
        <strong>Registros en la base de datos:</strong><br>
        • Clientes: ${clients.length}<br>
        • Pedidos: ${orders.length}<br>
        • Pagos: ${payments.length}
    `;
}

function openSettings() {
    document.getElementById(showLogo).checked = ticketConfig.showLogo;
    document.getElementById(showClientName).checked = ticketConfig.showClientName;
    document.getElementById(showClientPhone).checked = ticketConfig.showClientPhone;
    document.getElementById(showClientAddress).checked = ticketConfig.showClientAddress;
    document.getElementById(showDate).checked = ticketConfig.showDate;
    document.getElementById(showDescription).checked = ticketConfig.showDescription;
    document.getElementById(showAmount).checked = ticketConfig.showAmount;
    document.getElementById(showFooter).checked = ticketConfig.showFooter;
    document.getElementById(businessName).value = ticketConfig.businessName;
    document.getElementById(footerText).value = ticketConfig.footerText;

    updatePreview();
    document.getElementById(settingsModal).classList.add(active);
}

function closeSettings() {
    document.getElementById(settingsModal).classList.remove(active);
}

function updatePreview() {
    const preview = document.getElementById(previewTicket);
    let html = '';

    if (document.getElementById(showLogo).checked) {
        html += `<h3>${document.getElementById(businessName).value}</h3><hr>`;
    }

    if (document.getElementById(showDate).checked) {
        html += `<p>${new Date().toLocaleDateString(es-ES)}</p>`;
    }

    if (document.getElementById(showClientName).checked) {
        html += `<p style="margin:2px 0;">Cliente: Test</p>`;
    }
    if (document.getElementById(showClientPhone).checked) {
        html += `<p style="margin:2px 0;">Tel: 000000000</p>`;
    }
    if (document.getElementById(showClientAddress).checked) {
        html += `<p style="margin:2px 0;">Dir: Calle Principal</p>`;
    }

    html += `<hr>`;

    if (document.getElementById(showDescription).checked) {
        html += `<p style="margin:2px 0;">Desc: Producto</p><hr>`;
    }

    if (document.getElementById(showAmount).checked) {
        html += `<p style="font-size: 14px; font-weight: bold;">TOTAL: $100.00</p><hr>`;
    }

    if (document.getElementById(showFooter).checked) {
        html += `<p>${document.getElementById(footerText).value}</p>`;
    }

    preview.innerHTML = html;
}

function setCurrentDate() {
    const today = new Date().toISOString().split(T)[0];
    document.getElementById(orderDate).value = today;
    document.getElementById(paymentDate).value = today;
}

function switchTab(tabName) {
    document.querySelectorAll(.tab-button).forEach(btn => btn.classList.remove(active));
    document.querySelectorAll(.tab-content).forEach(content => content.classList.remove(active));
    event.target.classList.add(active);
    document.getElementById(tabName).classList.add(active);
    if (tabName === reportes) updateReports();
}

function setupSearchListeners() {
    document.getElementById(clientsTableSearch).addEventListener(keyup, () => {
        currentPage.clients = 1;
        renderClients();
    });
    document.getElementById(accountsTableSearch).addEventListener(keyup, () => {
        currentPage.accounts = 1;
        renderAccountsStatus();
    });
    document.getElementById(reportTableSearch).addEventListener(keyup, () => {
        currentPage.summary = 1;
        updateReports();
    });
    document.getElementById(orderClientSearch).addEventListener(keyup, () => filterOrderClientSelect());
    document.getElementById(paymentClientSearch).addEventListener(keyup, () => filterPaymentClientSelect());
    
    document.querySelectorAll(.checkbox-item input).forEach(checkbox => {
        checkbox.addEventListener(change, updatePreview);
    });
    document.getElementById(businessName).addEventListener(input, updatePreview);
    document.getElementById(footerText).addEventListener(input, updatePreview);
}

async function updateFilterOptions() {
    const allClients = await getAll(STORES.CLIENTS);
    const html = allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join();
    
    document.getElementById(filterClient).innerHTML = <option value="">Todos los clientes</option> + html;
    document.getElementById(filterPaymentClient).innerHTML = <option value="">Todos los clientes</option> + html;
}

// CLIENTES
async function saveClient() {
    const name = document.getElementById(clientName).value.trim();
    if (!name) { showAlert(alertClientes, Ingrese nombre, error); return; }

    try {
        if (editingClientId) {
            const client = await getById(STORES.CLIENTS, editingClientId);
            if (client) {
                client.name = name;
                client.phone = document.getElementById(clientPhone).value.trim();
                client.email = document.getElementById(clientEmail).value.trim();
                client.doc = document.getElementById(clientDoc).value.trim();
                client.address = document.getElementById(clientAddress).value.trim();
                await put(STORES.CLIENTS, client);
                await addToSyncQueue(update, clients, client);
            }
            await renderClients();
            cancelEditClient();
            await updateClientSelects();
            await updateFilterOptions();
            showAlert(alertClientes, ✅ Cliente actualizado, success);
        } else {
            const clientData = {
                id: Date.now(),
                name: name,
                phone: document.getElementById(clientPhone).value.trim(),
                email: document.getElementById(clientEmail).value.trim(),
                doc: document.getElementById(clientDoc).value.trim(),
                address: document.getElementById(clientAddress).value.trim(),
                createdAt: new Date().toISOString()
            };
            await add(STORES.CLIENTS, clientData);
            await addToSyncQueue(create, clients, clientData);
            clearClientForm();
            currentPage.clients = 1;
            await renderClients();
            await updateClientSelects();
            await updateFilterOptions();
            showAlert(alertClientes, ✅ Cliente agregado, success);
        }
        await updateClientCount();
    } catch (error) {
        console.error(Error guardando cliente:, error);
    }
}

async function editClient(id) {
    const client = await getById(STORES.CLIENTS, id);
    if (!client) return;
    editingClientId = id;
    document.getElementById(clientName).value = client.name;
    document.getElementById(clientPhone).value = client.phone || ;
    document.getElementById(clientEmail).value = client.email || ;
    document.getElementById(clientDoc).value = client.doc || ;
    document.getElementById(clientAddress).value = client.address || ;
    document.getElementById(clientFormCard).classList.add(editing);
    document.getElementById(clientFormTitle).textContent = ✏️ Editando;
    document.getElementById(clientSubmitBtn).textContent = 💾 Guardar;
    document.getElementById(clientCancelBtn).style.display = block;
    document.getElementById(clientFormCard).scrollIntoView({ behavior: smooth });
}

function cancelEditClient() {
    editingClientId = null;
    clearClientForm();
    document.getElementById(clientFormCard).classList.remove(editing);
    document.getElementById(clientFormTitle).textContent = Nuevo Cliente;
    document.getElementById(clientSubmitBtn).textContent = ➕ Agregar;
    document.getElementById(clientCancelBtn).style.display = none;
}

async function deleteClient(id) {
    if (!confirm(¿Eliminar cliente?)) return;
    try {
        await delete_(STORES.CLIENTS, id);
        await addToSyncQueue(delete, clients, { id: id });
        const allOrders = await getAll(STORES.ORDERS);
        const allPayments = await getAll(STORES.PAYMENTS);

        for (const order of allOrders.filter(o => o.clientId === id)) {
            await delete_(STORES.ORDERS, order.id);
            await addToSyncQueue(delete, orders, { id: order.id });
        }
        for (const payment of allPayments.filter(p => p.clientId === id)) {
            await delete_(STORES.PAYMENTS, payment.id);
            await addToSyncQueue(delete, payments, { id: payment.id });
        }

        await renderClients();
        await renderOrders();
        await renderPayments();
        await updateClientSelects();
        await updateFilterOptions();
        await updateClientCount();
        showAlert(alertClientes, Cliente eliminado, success);
    } catch (error) {
        console.error(Error eliminando cliente:, error);
    }
}

function clearClientForm() {
    document.getElementById(clientName).value = ;
    document.getElementById(clientPhone).value = ;
    document.getElementById(clientEmail).value = ;
    document.getElementById(clientDoc).value = ;
    document.getElementById(clientAddress).value = ;
}

function goToClientsPage(page) {
    currentPage.clients = page;
    renderClients();
}

async function renderClients() {
    const container = document.getElementById(clientsList);
    const query = document.getElementById(clientsTableSearch).value.toLowerCase();
    const allClients = await getAll(STORES.CLIENTS);
    const toDisplay = allClients.filter(c => 
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query))
    );
    
    if (!toDisplay.length) {
        container.innerHTML = <div class="empty-state">Sin clientes</div>;
        document.getElementById(clientsPagination).innerHTML = ;
        return;
    }
    
    const totalPages = Math.ceil(toDisplay.length / ITEMS_PER_PAGE);
    const start = (currentPage.clients - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = toDisplay.slice(start, end);

    let html = <table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Domicilio</th><th>Acciones</th></tr></thead><tbody>;
    pageData.forEach(client => {
        html += `<tr><td><strong>${client.name}</strong></td><td>${client.phone || -}</td><td>${client.address || -}</td><td style="font-size:0.85em;"><button class="btn-info" style="padding:4px 8px;font-size:0.8em;" onclick="viewClientHistory(${client.id})">📜</button> <button class="btn-secondary" style="padding:4px 8px;font-size:0.8em;" onclick="editClient(${client.id})">✏️</button> <button class="btn-danger" onclick="deleteClient(${client.id})">X</button></td></tr>`;
    });
    container.innerHTML = html + </tbody></table>;
    
    renderPagination(clientsPagination, currentPage.clients, totalPages, goToClientsPage);
}

async function viewClientHistory(id) {
    const client = await getById(STORES.CLIENTS, id);
    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);

    const orders = allOrders.filter(o => o.clientId === id);
    const payments = allPayments.filter(p => p.clientId === id);
    
    const totalO = orders.reduce((s, o) => s + (o.amount || 0), 0);
    const totalP = payments.reduce((s, p) => s + p.amount, 0);
    const balance = totalO - totalP;

    let statusText = ;
    let statusColor = ;
    if (balance > 0) {
        statusText = ⚠️ Deuda: $ + balance.toFixed(2);
        statusColor = #ff6b6b;
    } else if (balance < 0) {
        statusText = 💰 A Favor: $ + Math.abs(balance).toFixed(2);
        statusColor = #004085;
    } else {
        statusText = ✅ Al día;
        statusColor = #28a745;
    }

    let allItems = [];
    orders.forEach(o => allItems.push({...o, type: order, date: new Date(o.date)}));
    payments.forEach(p => allItems.push({...p, type: payment, date: new Date(p.date)}));
    allItems.sort((a, b) => b.date - a.date);

    let html = `<div class="client-header">
        <h2>${client.name}</h2>
        <div class="client-info">
            <div class="client-info-item">
                <div class="client-info-label">📱 Teléfono</div>
                <div>${client.phone || N/A}</div>
            </div>
            <div class="client-info-item">
                <div class="client-info-label">📍 Dirección</div>
                <div>${client.address || N/A}</div>
            </div>
            <div class="client-info-item">
                <div class="client-info-label">💰 Total Deudor</div>
                <div>$${totalO.toFixed(2)}</div>
            </div>
            <div class="client-info-item">
                <div class="client-info-label">✅ Total Pagado</div>
                <div>$${totalP.toFixed(2)}</div>
            </div>
        </div>
        <div class="client-balance">
            <strong>Saldo:</strong> <span style="color:${statusColor};">${statusText}</span>
        </div>
    </div>`;

    if (allItems.length === 0) {
        html += <div class="empty-state">Sin historial</div>;
    } else {
        html += `<table class="history-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Monto</th></tr></thead>
            <tbody>`;
        
        allItems.forEach(item => {
            if (item.type === order) {
                html += `<tr class="history-row order">
                    <td>${item.date.toLocaleDateString(es-ES)}</td>
                    <td><span class="history-type order">📋 PEDIDO</span></td>
                    <td>${item.description}</td>
                    <td class="history-amount order">+ $${(item.amount || 0).toFixed(2)}</td>
                </tr>`;
            } else {
                html += `<tr class="history-row payment">
                    <td>${item.date.toLocaleDateString(es-ES)}</td>
                    <td><span class="history-type payment">💰 PAGO</span></td>
                    <td>${item.method}</td>
                    <td class="history-amount payment">- $${item.amount.toFixed(2)}</td>
                </tr>`;
            }
        });
        
        html += </tbody></table>;
    }

    document.getElementById(historyBody).innerHTML = html;
    document.getElementById(historyModal).classList.add(active);
}

// PEDIDOS
async function saveOrder() {
    const clientId = document.getElementById(orderClient).value;
    const description = document.getElementById(orderDescription).value.trim();
    const status = document.getElementById(orderStatus).value;
    const amount = parseFloat(document.getElementById(orderAmount).value);

    if (!clientId || !description) {
        showAlert(alertPedidos, Complete campos requeridos, error);
        return;
    }

    try {
        if (editingOrderId) {
            const order = await getById(STORES.ORDERS, editingOrderId);
            if (order) {
                order.clientId = parseInt(clientId);
                order.date = document.getElementById(orderDate).value;
                order.description = description;
                order.comments = document.getElementById(orderComments).value.trim();
                order.amount = isNaN(amount) ? 0 : amount;
                order.status = status;
                order.delivery = document.getElementById(orderDelivery).value;
                await put(STORES.ORDERS, order);
                await addToSyncQueue(update, orders, order);
            }
            await renderOrders();
            cancelEditOrder();
            showAlert(alertPedidos, ✅ Pedido actualizado, success);
        } else {
            const orderData = {
                id: Date.now(),
                clientId: parseInt(clientId),
                date: document.getElementById(orderDate).value,
                description: description,
                comments: document.getElementById(orderComments).value.trim(),
                amount: isNaN(amount) ? 0 : amount,
                status: status,
                delivery: document.getElementById(orderDelivery).value,
                createdAt: new Date().toISOString()
            };
            await add(STORES.ORDERS, orderData);
            await addToSyncQueue(create, orders, orderData);
            clearOrderForm();
            currentPage.orders = 1;
            await renderOrders();
            showAlert(alertPedidos, ✅ Pedido registrado, success);
        }
    } catch (error) {
        console.error(Error guardando pedido:, error);
        showAlert(alertPedidos, Error al guardar, error);
    }
}

async function editOrder(id) {
    const order = await getById(STORES.ORDERS, id);
    if (!order) return;
    editingOrderId = id;
    const client = await getById(STORES.CLIENTS, order.clientId);
    document.getElementById(orderClient).value = order.clientId;
    document.getElementById(orderClientSearch).value = client?.name || ;
    document.getElementById(orderDate).value = order.date;
    document.getElementById(orderDescription).value = order.description;
    document.getElementById(orderComments).value = order.comments || ;
    document.getElementById(orderAmount).value = order.amount || ;
    document.getElementById(orderStatus).value = order.status;
    document.getElementById(orderDelivery).value = order.delivery || ;
    document.getElementById(orderFormCard).classList.add(editing);
    document.getElementById(orderFormTitle).textContent = ✏️ Editando;
    document.getElementById(orderSubmitBtn).textContent = 💾 Guardar;
    document.getElementById(orderCancelBtn).style.display = block;
    document.getElementById(orderFormCard).scrollIntoView({ behavior: smooth });
}

function cancelEditOrder() {
    editingOrderId = null;
    clearOrderForm();
    document.getElementById(orderFormCard).classList.remove(editing);
    document.getElementById(orderFormTitle).textContent = Nuevo Pedido;
    document.getElementById(orderSubmitBtn).textContent = ➕ Registrar;
    document.getElementById(orderCancelBtn).style.display = none;
}

async function deleteOrder(id) {
    if (!confirm(¿Eliminar?)) return;
    try {
        await delete_(STORES.ORDERS, id);
        await addToSyncQueue(delete, orders, { id: id });
        await renderOrders();
        showAlert(alertPedidos, Pedido eliminado, success);
    } catch (error) {
        console.error(Error eliminando pedido:, error);
    }
}

function clearOrderForm() {
    document.getElementById(orderClient).value = ;
    document.getElementById(orderClientSearch).value = ;
    document.getElementById(orderDescription).value = ;
    document.getElementById(orderComments).value = ;
    document.getElementById(orderAmount).value = ;
    document.getElementById(orderStatus).value = pendiente;
    document.getElementById(orderDelivery).value = ;
    setCurrentDate();
}

function goToOrdersPage(page) {
    currentPage.orders = page;
    renderOrders();
}

async function renderOrders() {
    const container = document.getElementById(ordersList);
    let allOrders = await getAll(STORES.ORDERS);

    if (orderFilters.clientId) {
        allOrders = allOrders.filter(o => o.clientId === parseInt(orderFilters.clientId));
    }
    if (orderFilters.status) {
        allOrders = allOrders.filter(o => o.status === orderFilters.status);
    }
    if (orderFilters.dateFrom) {
        allOrders = allOrders.filter(o => o.date >= orderFilters.dateFrom);
    }
    if (orderFilters.dateTo) {
        allOrders = allOrders.filter(o => o.date <= orderFilters.dateTo);
    }

    if (!allOrders.length) {
        container.innerHTML = <div class="empty-state">Sin pedidos</div>;
        document.getElementById(ordersPagination).innerHTML = ;
        return;
    }
    
    const totalPages = Math.ceil(allOrders.length / ITEMS_PER_PAGE);
    const start = (currentPage.orders - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = allOrders.slice(start, end);

    let html = <div class="table-wrapper"><table><thead><tr><th>Cliente</th><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>;
    for (const order of pageData) {
        const client = await getById(STORES.CLIENTS, order.clientId);
        const monto = order.amount ? `$${order.amount.toFixed(2)}` : -;
        html += `<tr><td>${client?.name || -}</td><td>${order.date}</td><td>${order.description}</td><td>${monto}</td><td><span class="status-badge status-${order.status}">${order.status}</span></td><td style="font-size:0.85em;"><button class="btn-secondary" style="padding:4px 8px;font-size:0.8em;" onclick="editOrder(${order.id})">✏️</button> <button class="btn-danger" onclick="deleteOrder(${order.id})">X</button></td></tr>`;
    }
    container.innerHTML = html + </tbody></table></div>;
    
    renderPagination(ordersPagination, currentPage.orders, totalPages, goToOrdersPage);
}

// PAGOS
async function addPayment() {
    const clientId = document.getElementById(paymentClient).value;
    const amount = parseFloat(document.getElementById(paymentAmount).value);
    
    if (!clientId || isNaN(amount) || amount <= 0) { 
        showAlert(alertPagos, Complete campos requeridos, error); 
        return; 
    }
    
    try {
        const paymentData = {
            id: Date.now(),
            clientId: parseInt(clientId),
            amount: amount,
            date: document.getElementById(paymentDate).value,
            method: document.getElementById(paymentMethod).value,
            ref: document.getElementById(paymentRef).value.trim(),
            createdAt: new Date().toISOString()
        };
        await add(STORES.PAYMENTS, paymentData);
        await addToSyncQueue(create, payments, paymentData);
        clearPaymentForm();
        currentPage.payments = 1;
        await renderPayments();
        await renderAccountsStatus();
        showAlert(alertPagos, ✅ Pago registrado, success);
    } catch (error) {
        console.error(Error agregando pago:, error);
    }
}

async function deletePayment(id) {
    if (!confirm(¿Eliminar?)) return;
    try {
        await delete_(STORES.PAYMENTS, id);
        await addToSyncQueue(delete, payments, { id: id });
        await renderPayments();
        await renderAccountsStatus();
        showAlert(alertPagos, Pago eliminado, success);
    } catch (error) {
        console.error(Error eliminando pago:, error);
    }
}

function clearPaymentForm() {
    document.getElementById(paymentClient).value = ;
    document.getElementById(paymentClientSearch).value = ;
    document.getElementById(paymentAmount).value = ;
    document.getElementById(paymentMethod).value = efectivo;
    document.getElementById(paymentRef).value = ;
    setCurrentDate();
}

function goToAccountsPage(page) {
    currentPage.accounts = page;
    renderAccountsStatus();
}

function goToPaymentsPage(page) {
    currentPage.payments = page;
    renderPayments();
}

async function renderPayments() {
    const container = document.getElementById(paymentsList);
    let allPayments = await getAll(STORES.PAYMENTS);

    if (paymentFilters.clientId) {
        allPayments = allPayments.filter(p => p.clientId === parseInt(paymentFilters.clientId));
    }
    if (paymentFilters.dateFrom) {
        allPayments = allPayments.filter(p => p.date >= paymentFilters.dateFrom);
    }
    if (paymentFilters.dateTo) {
        allPayments = allPayments.filter(p => p.date <= paymentFilters.dateTo);
    }

    if (!allPayments.length) {
        container.innerHTML = <div class="empty-state">Sin pagos</div>;
        document.getElementById(paymentsPagination).innerHTML = ;
        return;
    }
    
    const totalPages = Math.ceil(allPayments.length / ITEMS_PER_PAGE);
    const start = (currentPage.payments - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = allPayments.slice(start, end);

    let html = <table><thead><tr><th>Cliente</th><th>Monto</th><th>Fecha</th><th>Método</th><th>Acciones</th></tr></thead><tbody>;
    for (const payment of pageData) {
        const client = await getById(STORES.CLIENTS, payment.clientId);
        html += `<tr><td>${client?.name || -}</td><td>$${payment.amount.toFixed(2)}</td><td>${payment.date}</td><td>${payment.method}</td><td style="font-size:0.85em;"><button class="btn-danger" onclick="deletePayment(${payment.id})">X</button></td></tr>`;
    }
    container.innerHTML = html + </tbody></table>;
    
    renderPagination(paymentsPagination, currentPage.payments, totalPages, goToPaymentsPage);
}

async function renderAccountsStatus() {
    const container = document.getElementById(accountsList);
    const query = document.getElementById(accountsTableSearch).value.toLowerCase();
    const allClients = await getAll(STORES.CLIENTS);
    const toDisplay = allClients.filter(c => c.name.toLowerCase().includes(query));
    
    if (!toDisplay.length) {
        container.innerHTML = <div class="empty-state">Sin clientes</div>;
        document.getElementById(accountsPagination).innerHTML = ;
        return;
    }
    
    const totalPages = Math.ceil(toDisplay.length / ITEMS_PER_PAGE);
    const start = (currentPage.accounts - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = toDisplay.slice(start, end);

    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);

    let html = <table><thead><tr><th>Cliente</th><th>Deudor</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>;
    pageData.forEach(client => {
        const orders = allOrders.filter(o => o.clientId === client.id);
        const payments = allPayments.filter(p => p.clientId === client.id);
        const totalO = orders.reduce((s, o) => s + (o.amount || 0), 0);
        const totalP = payments.reduce((s, p) => s + p.amount, 0);
        const balance = totalO - totalP;
        
        let statusBadge = ;
        let statusColor = ;
        if (balance > 0) {
            statusBadge = ⚠️ Deuda;
            statusColor = #fff3cd;
        } else if (balance < 0) {
            statusBadge = 💰 A Favor;
            statusColor = #cce5ff;
        } else {
            statusBadge = ✅ Al día;
            statusColor = #d4edda;
        }
        
        html += `<tr><td>${client.name}</td><td>$${totalO.toFixed(2)}</td><td>$${totalP.toFixed(2)}</td><td style="color:${balance > 0 ? #ff6b6b : balance < 0 ? #004085 : #28a745};font-weight:bold;">$${Math.abs(balance).toFixed(2)}</td><td><span class="status-badge" style="background:${statusColor};color:#333;">${statusBadge}</span></td></tr>`;
    });
    container.innerHTML = html + </tbody></table>;
    
    renderPagination(accountsPagination, currentPage.accounts, totalPages, goToAccountsPage);
}

// REPORTES
async function updateReports() {
    const allClients = await getAll(STORES.CLIENTS);
    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);

    const totalClients = allClients.length;
    const totalOrders = allOrders.length;
    const totalSales = allOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const totalPayments = allPayments.reduce((s, p) => s + p.amount, 0);
    const balance = totalSales - totalPayments;
    let debtors = 0, favor = 0;
    
    allClients.forEach(client => {
        const orders = allOrders.filter(o => o.clientId === client.id);
        const payments = allPayments.filter(p => p.clientId === client.id);
        const totalO = orders.reduce((s, o) => s + (o.amount || 0), 0);
        const totalP = payments.reduce((s, p) => s + p.amount, 0);
        if (totalO - totalP > 0) debtors++;
        if (totalO - totalP < 0) favor++;
    });
    
    document.getElementById(statClients).textContent = totalClients;
    document.getElementById(statOrders).textContent = totalOrders;
    document.getElementById(statSales).textContent = $ + totalSales.toFixed(0);
    document.getElementById(statPayments).textContent = $ + totalPayments.toFixed(0);
    document.getElementById(statBalance).textContent = $ + balance.toFixed(0);
    document.getElementById(statDebtors).textContent = debtors + + + favor;

    await renderSummary();
}

function goToSummaryPage(page) {
    currentPage.summary = page;
    renderSummary();
}

async function renderSummary() {
    const allClients = await getAll(STORES.CLIENTS);
    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);
    const query = document.getElementById(reportTableSearch).value.toLowerCase();

    let toDisplay = allClients.filter(client => {
        const orders = allOrders.filter(o => o.clientId === client.id);
        const payments = allPayments.filter(p => p.clientId === client.id);
        const totalO = orders.reduce((s, o) => s + (o.amount || 0), 0);
        const totalP = payments.reduce((s, p) => s + p.amount, 0);
        const balance = totalO - totalP;

        let showRow = false;
        if (reportFilter === todos) showRow = true;
        else if (reportFilter === deudores && balance > 0) showRow = true;
        else if (reportFilter === pagados && balance === 0) showRow = true;
        else if (reportFilter === favor && balance < 0) showRow = true;

        return showRow && client.name.toLowerCase().includes(query);
    });

    const container = document.getElementById(summaryList);
    
    const totalPages = Math.ceil(toDisplay.length / ITEMS_PER_PAGE);
    const start = (currentPage.summary - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = toDisplay.slice(start, end);

    let summaryHtml = <table><thead><tr><th>Cliente</th><th>Deudor</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>;
    pageData.forEach(client => {
        const orders = allOrders.filter(o => o.clientId === client.id);
        const payments = allPayments.filter(p => p.clientId === client.id);
        const totalO = orders.reduce((s, o) => s + (o.amount || 0), 0);
        const totalP = payments.reduce((s, p) => s + p.amount, 0);
        const balance = totalO - totalP;

        let statusBadge = ;
        let statusColor = ;
        if (balance > 0) {
            statusBadge = ⚠️ Deuda;
            statusColor = #fff3cd;
        } else if (balance < 0) {
            statusBadge = 💰 A Favor;
            statusColor = #cce5ff;
        } else {
            statusBadge = ✅ Al día;
            statusColor = #d4edda;
        }
        
        summaryHtml += `<tr><td>${client.name}</td><td>$${totalO.toFixed(2)}</td><td>$${totalP.toFixed(2)}</td><td style="color:${balance > 0 ? #ff6b6b : balance < 0 ? #004085 : #28a745};font-weight:bold;">$${Math.abs(balance).toFixed(2)}</td><td><span class="status-badge" style="background:${statusColor};color:#333;">${statusBadge}</span></td></tr>`;
    });
    container.innerHTML = summaryHtml + </tbody></table>;
    
    renderPagination(summaryPagination, currentPage.summary, totalPages, goToSummaryPage);
}

function filterReports(type) {
    reportFilter = type;
    currentPage.summary = 1;
    document.querySelectorAll(.filter-btn).forEach(btn => btn.classList.remove(active));
    event.target.classList.add(active);
    updateReports();
}

function printReport() {
    window.print();
}

async function exportCSV() {
    const allClients = await getAll(STORES.CLIENTS);
    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);

    let csv = CLIENTES\nNombre,Teléfono,Email,Domicilio\n;
    allClients.forEach(c => csv += `${c.name},${c.phone},${c.email},${c.address}\n`);
    csv += \nPEDIDOS\nCliente,Fecha,Descripción,Monto,Estado\n;
    allOrders.forEach(o => {
        const c = allClients.find(x => x.id === o.clientId);
        csv += `${c?.name},${o.date},${o.description},$${o.amount || 0},${o.status}\n`;
    });
    csv += \nPAGOS\nCliente,Monto,Fecha\n;
    allPayments.forEach(p => {
        const c = allClients.find(x => x.id === p.clientId);
        csv += `${c?.name},$${p.amount},${p.date}\n`;
    });
    const blob = new Blob([csv], {type: text/csv});
    const link = document.createElement(a);
    link.href = URL.createObjectURL(blob);
    link.download = reporte.csv;
    link.click();
}

// UTILIDADES
function showAlert(id, msg, type) {
    const alert = document.getElementById(id);
    alert.textContent = msg;
    alert.className = alert show  + type;
    setTimeout(() => { alert.className = alert; }, 3500);
}

async function updateClientSelects() {
    const allClients = await getAll(STORES.CLIENTS);
    const html = <option value="">-- Seleccionar --</option> + allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join();
    document.getElementById(orderClient).innerHTML = html;
    document.getElementById(paymentClient).innerHTML = html;
}

async function updateClientCount() {
    const allClients = await getAll(STORES.CLIENTS);
    document.getElementById(clientCount).textContent = `Clientes: ${allClients.length}`;
}

async function filterOrderClientSelect() {
    const query = document.getElementById(orderClientSearch).value.toLowerCase();
    const allClients = await getAll(STORES.CLIENTS);
    const results = allClients.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.phone && c.phone.toLowerCase().includes(query))
    );
    
    let html = ;
    results.forEach(client => {
        html += `<div class="option-item" onclick="selectOrderClient(${client.id})">
            <div class="option-name">${client.name}</div>
            <div class="option-detail">📞 ${client.phone || -}</div>
        </div>`;
    });
    
    document.getElementById(orderClientOptions).innerHTML = html;
    document.getElementById(orderClientOptions).classList.toggle(show, query.length > 0 && results.length > 0);
}

async function filterPaymentClientSelect() {
    const query = document.getElementById(paymentClientSearch).value.toLowerCase();
    const allClients = await getAll(STORES.CLIENTS);
    const results = allClients.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.phone && c.phone.toLowerCase().includes(query))
    );
    
    let html = ;
    results.forEach(client => {
        html += `<div class="option-item" onclick="selectPaymentClient(${client.id})">
            <div class="option-name">${client.name}</div>
            <div class="option-detail">📞 ${client.phone || -}</div>
        </div>`;
    });
    
    document.getElementById(paymentClientOptions).innerHTML = html;
    document.getElementById(paymentClientOptions).classList.toggle(show, query.length > 0 && results.length > 0);
}

function selectOrderClient(id) {
    getById(STORES.CLIENTS, id).then(client => {
        document.getElementById(orderClient).value = id;
        document.getElementById(orderClientSearch).value = client.name;
        document.getElementById(orderClientOptions).classList.remove(show);
    });
}

function selectPaymentClient(id) {
    getById(STORES.CLIENTS, id).then(client => {
        document.getElementById(paymentClient).value = id;
        document.getElementById(paymentClientSearch).value = client.name;
        document.getElementById(paymentClientOptions).classList.remove(show);
    });
}

function applyOrderFilters() {
    orderFilters.clientId = document.getElementById(filterClient).value;
    orderFilters.status = document.getElementById(filterStatus).value;
    orderFilters.dateFrom = document.getElementById(filterDateFrom).value;
    orderFilters.dateTo = document.getElementById(filterDateTo).value;
    currentPage.orders = 1;
    renderOrders();
}

function clearOrderFilters() {
    orderFilters = { clientId: , status: , dateFrom: , dateTo:  };
    document.getElementById(filterClient).value = ;
    document.getElementById(filterStatus).value = ;
    document.getElementById(filterDateFrom).value = ;
    document.getElementById(filterDateTo).value = ;
    currentPage.orders = 1;
    renderOrders();
}

function applyPaymentFilters() {
    paymentFilters.clientId = document.getElementById(filterPaymentClient).value;
    paymentFilters.dateFrom = document.getElementById(filterPaymentDateFrom).value;
    paymentFilters.dateTo = document.getElementById(filterPaymentDateTo).value;
    currentPage.payments = 1;
    renderPayments();
}

function clearPaymentFilters() {
    paymentFilters = { clientId: , dateFrom: , dateTo:  };
    document.getElementById(filterPaymentClient).value = ;
    document.getElementById(filterPaymentDateFrom).value = ;
    document.getElementById(filterPaymentDateTo).value = ;
    currentPage.payments = 1;
    renderPayments();
}

function renderPagination(containerId, currentPageNum, totalPages, pageCallback) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) {
        container.innerHTML = ;
        return;
    }

    let html = `<div class="pagination-info">Página ${currentPageNum} de ${totalPages}</div>`;
    html += `<button class="btn-pagination" onclick="${pageCallback}(1)" ${currentPageNum === 1 ? disabled : }>« Primera</button>`;
    html += `<button class="btn-pagination" onclick="${pageCallback}(${currentPageNum - 1})" ${currentPageNum === 1 ? disabled : ''}>‹ Anterior</button>`;
    
    for (let i = Math.max(1, currentPageNum - 2); i <= Math.min(totalPages, currentPageNum + 2); i++) {
        html += `<button class="btn-pagination ${i === currentPageNum ? active : }" onclick="${pageCallback}(${i})">${i}</button>`;
    }
    
    html += `<button class="btn-pagination" onclick="${pageCallback}(${currentPageNum + 1})" ${currentPageNum === totalPages ? disabled : ''}>Siguiente ›</button>`;
    html += `<button class="btn-pagination" onclick="${pageCallback}(${totalPages})" ${currentPageNum === totalPages ? disabled : ''}>Última »</button>`;
    
    container.innerHTML = html;
}

async function deleteOldRecords() {
    const days = parseInt(document.getElementById(deleteOldDaysSelect).value);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split(T)[0];

    if (!confirm(`¿Eliminar registros anteriores a ${cutoffDateStr}?`)) return;

    try {
        const allOrders = await getAll(STORES.ORDERS);
        const allPayments = await getAll(STORES.PAYMENTS);

        const ordersToDelete = allOrders.filter(o => o.date < cutoffDateStr);
        const paymentsToDelete = allPayments.filter(p => p.date < cutoffDateStr);

        for (const order of ordersToDelete) {
            await delete_(STORES.ORDERS, order.id);
            await addToSyncQueue(delete, orders, { id: order.id });
        }
        for (const payment of paymentsToDelete) {
            await delete_(STORES.PAYMENTS, payment.id);
            await addToSyncQueue(delete, payments, { id: payment.id });
        }

        await renderAll();
        alert(`✅ Se eliminaron ${ordersToDelete.length} pedidos y ${paymentsToDelete.length} pagos`);
        updateDatabaseInfo();
    } catch (error) {
        console.error(Error eliminando registros antiguos:, error);
    }
}

async function clearAllData() {
    if (!confirm(⚠️ ¿CONFIRMA que desea eliminar TODOS los datos?)) return;
    if (!confirm(⚠️ ÚLTIMA CONFIRMACIÓN: ¡No se puede deshacer!)) return;

    try {
        await clear(STORES.CLIENTS);
        await clear(STORES.ORDERS);
        await clear(STORES.PAYMENTS);
        await renderAll();
        alert(✅ Base de datos limpiada);
        updateDatabaseInfo();
    } catch (error) {
        console.error(Error limpiando datos:, error);
    }
}

async function exportData() {
    const allClients = await getAll(STORES.CLIENTS);
    const allOrders = await getAll(STORES.ORDERS);
    const allPayments = await getAll(STORES.PAYMENTS);
    
    const data = { clients: allClients, orders: allOrders, payments: allPayments };

    const blob = new Blob([JSON.stringify(data, null, 2)], {type: application/json});
    const link = document.createElement(a);
    link.href = URL.createObjectURL(blob);
    link.download = backup.json;
    link.click();
}

function importData() {
    document.getElementById(importFile).click();
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.clients && imported.orders && imported.payments) {
                await clear(STORES.CLIENTS);
                await clear(STORES.ORDERS);
                await clear(STORES.PAYMENTS);

                for (const client of imported.clients) await add(STORES.CLIENTS, client);
                for (const order of imported.orders) await add(STORES.ORDERS, order);
                for (const payment of imported.payments) await add(STORES.PAYMENTS, payment);

                await renderAll();
                alert(✅ Datos importados);
            } else {
                alert(❌ Formato inválido);
            }
        } catch {
            alert(❌ Error en archivo);
        }
    };
    reader.readAsText(file);
}

function closeHistory() {
    document.getElementById(historyModal).classList.remove(active);
}

async function renderAll() {
    await renderClients();
    await renderOrders();
    await renderPayments();
    await renderAccountsStatus();
    await updateClientSelects();
    await updateClientCount();
}

function saveSettings() {
    ticketConfig.showLogo = document.getElementById(showLogo).checked;
    ticketConfig.showClientName = document.getElementById(showClientName).checked;
    ticketConfig.showClientPhone = document.getElementById(showClientPhone).checked;
    ticketConfig.showClientAddress = document.getElementById(showClientAddress).checked;
    ticketConfig.showDate = document.getElementById(showDate).checked;
    ticketConfig.showDescription = document.getElementById(showDescription).checked;
    ticketConfig.showAmount = document.getElementById(showAmount).checked;
    ticketConfig.showFooter = document.getElementById(showFooter).checked;
    ticketConfig.businessName = document.getElementById(businessName).value;
    ticketConfig.footerText = document.getElementById(footerText).value;

    saveTicketConfig();
    updatePreview();
    alert(✅ Configuración guardada);
}

initApp();

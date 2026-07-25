import { supabase } from './supabaseClient.js'

let tickets = []
let currentRole = 'client_tenant_a'
let activeTicketId = null

const POWER_AUTOMATE_WEBHOOK_URL = import.meta.env.VITE_POWER_AUTOMATE_WEBHOOK_URL || ''

// Elementos del DOM
const roleSelector = document.getElementById('role-selector')
const filterTenant = document.getElementById('filter-tenant')
const newTicketForm = document.getElementById('new-ticket-form')
const btnOpenModal = document.getElementById('btn-open-modal')
const btnCloseModal = document.getElementById('btn-close-modal')
const btnCancelModal = document.getElementById('btn-cancel-modal')
const btnCloseDetail = document.getElementById('btn-close-detail')
const btnCloseDetailFooter = document.getElementById('btn-close-detail-footer')
const btnAddNote = document.getElementById('btn-add-note')

// Event Listeners
roleSelector.addEventListener('change', (e) => switchRole(e.target.value))
filterTenant.addEventListener('change', () => renderTickets())
btnOpenModal.addEventListener('click', () => openModal())
btnCloseModal.addEventListener('click', () => closeModal())
btnCancelModal.addEventListener('click', () => closeModal())
btnCloseDetail.addEventListener('click', () => closeDetailModal())
btnCloseDetailFooter.addEventListener('click', () => closeDetailModal())
newTicketForm.addEventListener('submit', (e) => handleCreateTicket(e))
btnAddNote.addEventListener('click', () => addNote())

async function fetchTickets() {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('id', { ascending: false })
    
    if (error) {
        console.error('Error al cargar tickets:', error)
        return
    }
    
    tickets = data.map(t => ({
        id: t.ticket_code,
        dbId: t.id,
        tenant: t.tenant,
        clientName: t.client_name,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        date: t.date,
        description: t.description,
        teamsUrl: t.teams_url,
        notes: t.notes || []
    }))
    
    renderTickets()
}

function switchRole(role) {
    currentRole = role
    const indicator = document.getElementById('current-role-indicator')
    const clientView = document.getElementById('view-client')
    const adminView = document.getElementById('view-admin')
    const tenantBadge = document.getElementById('tenant-badge')

    if (role === 'client_tenant_a') {
        indicator.innerText = 'Vista actual: Cliente (Acme Corp - Tenant A)'
        tenantBadge.innerText = 'Tenant: Acme Corp'
        clientView.classList.remove('hidden')
        adminView.classList.add('hidden')
    } else if (role === 'client_tenant_b') {
        indicator.innerText = 'Vista actual: Cliente (Globex - Tenant B)'
        tenantBadge.innerText = 'Tenant: Globex'
        clientView.classList.remove('hidden')
        adminView.classList.add('hidden')
    } else if (role === 'admin') {
        indicator.innerText = 'Vista actual: Administrador / Operador Global'
        clientView.classList.add('hidden')
        adminView.classList.remove('hidden')
    }
    renderTickets()
}

function renderTickets() {
    const clientTable = document.getElementById('client-tickets-table')
    const currentTenantFilter = currentRole === 'client_tenant_b' ? 'Tenant B' : 'Tenant A'
    const tenantTickets = tickets.filter(t => t.tenant === currentTenantFilter)
    
    let clientHtml = ''
    tenantTickets.forEach(t => {
        clientHtml += `
            <tr class="hover:bg-slate-50 transition cursor-pointer" data-id="${t.id}">
                <td class="px-6 py-4 font-bold text-corporate-gray">${t.id}</td>
                <td class="px-6 py-4 font-medium text-slate-900">${t.title}</td>
                <td class="px-6 py-4"><span class="px-2.5 py-1 rounded text-xs font-bold ${getPriorityBadge(t.priority)}">${t.priority}</span></td>
                <td class="px-6 py-4"><span class="px-2.5 py-1 rounded text-xs font-semibold ${getStatusBadge(t.status)}">${t.status}</span></td>
                <td class="px-6 py-4 text-slate-500 text-xs">${t.date}</td>
                <td class="px-6 py-4 text-right"><i class="fa-solid fa-chevron-right text-slate-400"></i></td>
            </tr>
        `
    })
    clientTable.innerHTML = clientHtml.length ? clientHtml : `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No hay incidentes registrados.</td></tr>`

    clientTable.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', () => openDetailModal(row.getAttribute('data-id')))
    })

    document.getElementById('client-open-count').innerText = tenantTickets.filter(t => t.status === 'Nuevo').length
    document.getElementById('client-progress-count').innerText = tenantTickets.filter(t => t.status === 'En progreso' || t.status === 'En análisis').length
    document.getElementById('client-resolved-count').innerText = tenantTickets.filter(t => t.status === 'Resuelto' || t.status === 'Cerrado').length

    const adminTable = document.getElementById('admin-tickets-table')
    const tenantFilterVal = filterTenant.value
    const filteredAdminTickets = tenantFilterVal === 'ALL' ? tickets : tickets.filter(t => t.tenant === tenantFilterVal)

    let adminHtml = ''
    filteredAdminTickets.forEach(t => {
        adminHtml += `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-6 py-4 font-bold text-corporate-gray cursor-pointer admin-detail" data-id="${t.id}">${t.id}</td>
                <td class="px-6 py-4"><span class="bg-slate-200 text-slate-800 text-xs font-semibold px-2 py-0.5 rounded">${t.tenant}</span></td>
                <td class="px-6 py-4 font-medium text-slate-900 cursor-pointer admin-detail" data-id="${t.id}">${t.title}</td>
                <td class="px-6 py-4"><span class="px-2.5 py-1 rounded text-xs font-bold ${getPriorityBadge(t.priority)}">${t.priority}</span></td>
                <td class="px-6 py-4">
                    <select class="status-select text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium" data-id="${t.id}">
                        <option ${t.status === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
                        <option ${t.status === 'En análisis' ? 'selected' : ''}>En análisis</option>
                        <option ${t.status === 'En progreso' ? 'selected' : ''}>En progreso</option>
                        <option ${t.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
                        <option ${t.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    ${t.teamsUrl ? `<a href="${t.teamsUrl}" target="_blank" class="text-[#6264A7] font-bold text-xs hover:underline flex items-center"><i class="fa-solid fa-video mr-1.5"></i> Unirse a Teams</a>` : `<span class="text-xs text-slate-400">No creada</span>`}
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="admin-detail bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded text-xs font-semibold" data-id="${t.id}">Gestionar</button>
                </td>
            </tr>
        `
    })
    adminTable.innerHTML = adminHtml

    adminTable.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', (e) => updateTicketStatus(e.target.getAttribute('data-id'), e.target.value))
    })

    adminTable.querySelectorAll('.admin-detail').forEach(el => {
        el.addEventListener('click', () => openDetailModal(el.getAttribute('data-id')))
    })
}

function getPriorityBadge(priority) {
    if (priority === 'Crítica') return 'bg-red-100 text-red-700'
    if (priority === 'Alta') return 'bg-orange-100 text-orange-700'
    if (priority === 'Media') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-700'
}

function getStatusBadge(status) {
    if (status === 'Nuevo') return 'bg-blue-100 text-blue-700'
    if (status === 'En progreso' || status === 'En análisis') return 'bg-amber-100 text-amber-700'
    return 'bg-emerald-100 text-emerald-700'
}

function openModal() { document.getElementById('ticket-modal').classList.remove('hidden') }
function closeModal() { document.getElementById('ticket-modal').classList.add('hidden') }

async function handleCreateTicket(e) {
    e.preventDefault()
    const title = document.getElementById('ticket-title').value
    const category = document.getElementById('ticket-category').value
    const priority = document.getElementById('ticket-priority').value
    const description = document.getElementById('ticket-description').value

    const tenantName = currentRole === 'client_tenant_b' ? 'Tenant B' : 'Tenant A'
    const clientName = currentRole === 'client_tenant_b' ? 'Globex' : 'Acme Corp'
    const ticketCode = `INC-100${Math.floor(100 + Math.random() * 900)}`
    const currentDate = new Date().toISOString().replace('T', ' ').substring(0, 16)

    const { error } = await supabase.from('tickets').insert([{
        ticket_code: ticketCode,
        tenant: tenantName,
        client_name: clientName,
        title: title,
        category: category,
        priority: priority,
        status: 'Nuevo',
        date: currentDate,
        description: description,
        teams_url: null,
        notes: []
    }])

    if (error) {
        alert('Error al crear el ticket en Supabase.')
        console.error(error)
        return
    }

    closeModal()
    newTicketForm.reset()
    await fetchTickets()
    alert('¡Ticket creado exitosamente en la base de datos!')
}

function openDetailModal(id) {
    activeTicketId = id
    const ticket = tickets.find(t => t.id === id)
    if (!ticket) return

    document.getElementById('detail-modal-title').innerText = `Detalle del Incidente: ${ticket.id}`
    document.getElementById('detail-tenant').innerText = `${ticket.tenant} (${ticket.clientName})`
    document.getElementById('detail-priority').innerText = ticket.priority
    document.getElementById('detail-date').innerText = ticket.date
    document.getElementById('detail-desc').innerText = ticket.description

    const statusContainer = document.getElementById('detail-status-container')
    if (currentRole === 'admin') {
        statusContainer.innerHTML = `
            <select id="modal-status-select" class="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium">
                <option ${ticket.status === 'Nuevo' ? 'selected' : ''}>Nuevo</option>
                <option ${ticket.status === 'En análisis' ? 'selected' : ''}>En análisis</option>
                <option ${ticket.status === 'En progreso' ? 'selected' : ''}>En progreso</option>
                <option ${ticket.status === 'Resuelto' ? 'selected' : ''}>Resuelto</option>
                <option ${ticket.status === 'Cerrado' ? 'selected' : ''}>Cerrado</option>
            </select>
        `
        document.getElementById('modal-status-select').addEventListener('change', (e) => {
            updateTicketStatus(ticket.id, e.target.value)
        })
    } else {
        statusContainer.innerHTML = `<span class="px-2.5 py-1 rounded text-xs font-semibold ${getStatusBadge(ticket.status)}">${ticket.status}</span>`
    }

    const teamsStatus = document.getElementById('detail-teams-status')
    const teamsAction = document.getElementById('teams-action-container')
    teamsAction.innerHTML = ''

    if (ticket.teamsUrl) {
        teamsStatus.innerText = 'Sala de crisis activa en Microsoft Teams (Disponible para unirse).'
        const link = document.createElement('a')
        link.href = ticket.teamsUrl
        link.target = '_blank'
        link.className = 'bg-teams-purple hover:bg-teams-purple-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow'
        link.innerHTML = '<i class="fa-solid fa-video mr-1.5"></i> Entrar a Teams'
        teamsAction.appendChild(link)
    } else {
        teamsStatus.innerText = 'No se ha generado sala de crisis para este incidente.'
        if (currentRole === 'admin') {
            const btn = document.createElement('button')
            btn.className = 'bg-teams-purple hover:bg-teams-purple-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow'
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Crear Sala Teams (Power Automate)'
            btn.addEventListener('click', () => generateCrisisRoomViaPowerAutomate(ticket))
            teamsAction.appendChild(btn)
        } else {
            teamsAction.innerHTML = `<span class="text-xs text-slate-400 italic">Esperando a que soporte active la sala</span>`
        }
    }

    renderNotes(ticket)
    document.getElementById('detail-modal').classList.remove('hidden')
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.add('hidden')
    activeTicketId = null
}

function renderNotes(ticket) {
    const notesList = document.getElementById('detail-notes-list')
    let html = ''
    ticket.notes.forEach(n => {
        html += `<div class="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
            <span class="font-bold text-corporate-gray">${n.author}:</span> ${n.text}
        </div>`
    })
    notesList.innerHTML = html.length ? html : `<p class="text-xs text-slate-400 italic">No hay notas registradas.</p>`
}

async function addNote() {
    const input = document.getElementById('new-note-input')
    if (!input.value.trim() || !activeTicketId) return

    const ticket = tickets.find(t => t.id === activeTicketId)
    const author = currentRole === 'admin' ? 'Soporte (Admin)' : 'Cliente (' + ticket.clientName + ')'
    
    ticket.notes.push({ author: author, text: input.value.trim() })

    const { error } = await supabase
        .from('tickets')
        .update({ notes: ticket.notes })
        .eq('id', ticket.dbId)

    if (error) {
        console.error('Error al guardar nota:', error)
        return
    }

    input.value = ''
    renderNotes(ticket)
    await fetchTickets()
}

async function updateTicketStatus(id, newStatus) {
    const ticket = tickets.find(t => t.id === id)
    if (!ticket) return

    const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticket.dbId)

    if (error) {
        console.error('Error al actualizar estado:', error)
        return
    }
    await fetchTickets()
}

async function generateCrisisRoomViaPowerAutomate(ticket) {
    if (!POWER_AUTOMATE_WEBHOOK_URL) {
        alert('Falta configurar la URL del webhook de Power Automate en el entorno (.env).')
        return
    }

    try {
        alert('Enviando solicitud a Power Automate para crear la reunión en Teams...')
        
        const response = await fetch(POWER_AUTOMATE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketCode: ticket.id,
                title: ticket.title,
                tenant: ticket.tenant,
                priority: ticket.priority,
                description: ticket.description
            })
        })

        if (!response.ok) {
            throw new Error('Error al conectar con el flujo de Power Automate.')
        }

        const result = await response.json()
        const teamsUrl = result.teamsUrl

        const { error } = await supabase
            .from('tickets')
            .update({ teams_url: teamsUrl })
            .eq('id', ticket.dbId)

        if (error) {
            console.error('Error al actualizar Supabase con la URL de Teams:', error)
            return
        }

        alert('¡Sala de crisis en Microsoft Teams creada correctamente a través de Power Automate!')
        await fetchTickets()
        openDetailModal(ticket.id)

    } catch (err) {
        console.error(err)
        alert('Ocurrió un error al ejecutar el flujo de Power Automate.')
    }
}

fetchTickets()
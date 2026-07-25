// Variable temporal para mantener el ticket activo al configurar Teams
let pendingTeamsTicket = null

// Añade estos listeners al inicio de tu main.js junto a los demás
document.getElementById('btn-close-teams-modal').addEventListener('click', closeTeamsModal)
document.getElementById('btn-cancel-teams-modal').addEventListener('click', closeTeamsModal)
document.getElementById('teams-config-form').addEventListener('submit', (e) => handleSendTeamsFlow(e))

function openTeamsModal(ticket) {
    pendingTeamsTicket = ticket
    // Rellenar por defecto con la fecha actual formateada para datetime-local si está vacía
    const now = new Date()
    const later = new Date(now.getTime() + 60*60*1000) // 1 hora después
    
    document.getElementById('hora-inicio').value = now.toISOString().slice(0, 16)
    document.getElementById('hora-fin').value = later.toISOString().slice(0, 16)
    
    document.getElementById('teams-modal').classList.remove('hidden')
}

function closeTeamsModal() {
    document.getElementById('teams-modal').classList.add('hidden')
    pendingTeamsTicket = null
}

// Modificación en openDetailModal para el botón de Admin:
// En lugar de llamar directo al fetch, ahora llama a openTeamsModal(ticket)
/* 
   ... dentro de openDetailModal, cuando el rol es admin y no hay teamsUrl:
   const btn = document.createElement('button')
   btn.className = 'bg-teams-purple hover:bg-teams-purple-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow'
   btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Crear Sala Teams (Power Automate)'
   btn.addEventListener('click', () => openTeamsModal(ticket))
   teamsAction.appendChild(btn)
*/

// NUEVA FUNCIÓN: Envía los datos completos del modal al Webhook de Power Automate
async function handleSendTeamsFlow(e) {
    e.preventDefault()
    if (!pendingTeamsTicket) return

    const POWER_AUTOMATE_WEBHOOK_URL = import.meta.env.VITE_POWER_AUTOMATE_WEBHOOK_URL || ''
    if (!POWER_AUTOMATE_WEBHOOK_URL) {
        alert('Falta configurar la URL del webhook de Power Automate en las variables de entorno.')
        return
    }

    const invitadosRequeridos = document.getElementById('invitados-requeridos').value
    const invitadosOpcionales = document.getElementById('invitados-opcionales').value
    const horaInicio = document.getElementById('hora-inicio').value
    const horaFin = document.getElementById('hora-fin').value

    try {
        alert('Enviando solicitud y parámetros a Power Automate...')
        closeTeamsModal()

        const response = await fetch(POWER_AUTOMATE_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: pendingTeamsTicket.title,
                tenant: pendingTeamsTicket.tenant,
                category: pendingTeamsTicket.category,
                priority: pendingTeamsTicket.priority,
                description: pendingTeamsTicket.description,
                invitados_requeridos: invitadosRequeridos,
                invitados_opcionales: invitadosOpcionales,
                Hora_Inicio: horaInicio,
                Hora_Fin: horaFin
            })
        });

        if (!response.ok) {
            throw new Error("Error enviando datos al flujo de Power Automate");
        }

        const result = await response.json();
        const teamsUrl = result.teamsUrl; // El flujo debe responder con un JSON que contenga la URL

        // Guardar la URL devuelta en Supabase
        const { error } = await supabase
            .from('tickets')
            .update({ teams_url: teamsUrl })
            .eq('id', pendingTeamsTicket.dbId)

        if (error) {
            console.error('Error al actualizar Supabase:', error)
            return
        }

        alert('¡Sala de Teams creada y vinculada correctamente!');
        await fetchTickets();
        openDetailModal(pendingTeamsTicket.id);

    } catch (error) {
        console.error(error);
        alert("Ocurrió un error ejecutando el flujo de Power Automate.");
    }
}
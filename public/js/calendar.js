import showError from './utils/showError.js'
import showSuccess from './utils/showSuccess.js';
import fetchOK from './utils/fetch.js'

const form = document.querySelector('form');
const formModal = bootstrap.Modal.getOrCreateInstance(document.querySelector('.modal'));
const newEventBtn = document.querySelector('#new-event');

newEventBtn.addEventListener('click', () => {
    formModal.show();
})

const token = localStorage.getItem('token');
const eventContainer = document.querySelector('#event-container');
const errorMessage = document.querySelector("#error-message");
const eventTitle = document.querySelector('[name=title]');
const eventDesc = document.querySelector('[name=description]');
const startDate = document.querySelector('[name=startDate]');
const endDate = document.querySelector('[name=endDate]');
const importance = document.querySelector('[name=importance]');

form.addEventListener('submit', async (evt) => {

    evt.preventDefault();

    const response = fetchOK('/api/events', {
        method: 'POST',
        headers: {
            'token': token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: eventTitle.value,
            description: eventDesc.value,
            startDate: startDate.value,
            endDate: endDate.value,
            typeEvent: importance.value
        })
    })

    response
        .then(() => showEvents())
        .catch(failedResponse => {

            if (failedResponse.status == 400) {
                return showError('Datos enviados incorrectamente')
            }

            return showError('Error inesperado. ' + failedResponse.statusText || "", errorMessage);
        })

    formModal.hide();
    form.reset();

    return showSucces('Evento creado exitosamente', '');
})

// Recuperan los eventos para el usuario actual
async function getEvents() {

    const responseObj = await fetch('/api/events', {
        method: 'GET',
        headers: {
            token: token
        }
    })

    if (responseObj.status == 404) return [];

    const { events } = await responseObj.json();

    return events;
}


async function showEvents() {

    while (eventContainer.hasChildNodes()) {
        eventContainer.removeChild(eventContainer.firstChild);
    }

    const events = await getEvents();

    if (events.length == 0) {
        eventContainer.innerHTML = `
            <p class="display-5 text-center">No se han encontrado eventos</p>
        `;
    }


    events.map(renderEvent)
          .forEach(event => eventContainer.appendChild(event));
}

async function updateEvent(id) {

    const response = fetch('/api/events', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            token
        },
        body: JSON.stringify({
            title: eventTitle.value,
            description: eventDesc.value,
            startDate: startDate.value,
            endDate: endDate.value,
            typeEvent: importance.value
        })
    })

    if (response.ok) {
        showSuccess('Evento eliminado', '');
    } else {
        showError('Algo salió mal', errorMessage);
    }

    showEvents();
}

async function deleteEvent(id) {
    
    const response = await fetch('/api/events', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            token: token
        },
        body: JSON.stringify({
            id
        })
    })

    if (response.ok) {
        showSuccess('Evento eliminado', '');
    } else {
        showError('Algo salió mal', errorMessage);
    }

    showEvents();
}

document.addEventListener('DOMContentLoaded', showEvents); 

// Manejan el renderizado de los eventos

const typeColorsMap = new Map([
    [1, "var(--clr-green-400)"],
    [2, "var(--clr-red-600)"]
]);

const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
];


function renderEvent({ id, title, description, startTime, typeId }) {
    const template = document.createElement('template');

    const startDate = new Date(startTime);

    const eventColor = typeColorsMap.get(typeId);

    template.innerHTML = `
    <section class="d-flex position-relative flex-column flex-md-row border border-3 shadow event-container align-content-center">
        <div class="event-date flex-shrink-0" style="background-color:${eventColor}">
            <span class="event-month">${months[startDate.getMonth()].slice(0, 3)}</span>
            <span class="event-day">${startDate.getDate()}</span>
        </div>
        <button class="btn event-delete-btn" id="delete-btn">
            <i class="bi bi-trash"></i>
            <span class="visually-hidden">Eliminar</span>
        </button>
        <div class="p-2 my-2 mx-3 event-text flex-shrink-1">
            <h3 class="display-5">${title}</h3>
            <p class="fs-3">
                ${description}
            </p>
        </div>
    </section>
`
    template.content.querySelector('#delete-btn').addEventListener('click', () => deleteEvent(id));

    return template.content;
}


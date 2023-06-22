import fetchOK from "./utils/fetch.js";
import showError from "./utils/showError.js";

const usernameInput = document.querySelector('[name="login"');
const passwordInput = document.querySelector('[name="password"]'); 
const form = document.querySelector('form');

const errorMessage = document.querySelector('#error-message');

form.addEventListener('submit', async (evt) => {

    evt.preventDefault();

    const username = usernameInput.value;
    const password = passwordInput.value;

    const requestBody = JSON.stringify({
        username,
        password
    });

    const request = new Request(`/login/`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: requestBody
    });

    fetchOK(request)
        .then(handleLogin)
        .catch(failedResponse => {

            console.log(failedResponse.ok)

            if (failedResponse.status == 400) {
                return showError('Error al iniciar sesión: Usuario o contraseña incorrectos.', errorMessage);
            }

            return showError('No se estableció conexión con el servidor', errorMessage);
        })
})

async function handleLogin(response) {
    
    const { token } = await response.json();

    localStorage.setItem('token', token);
    setTimeout(() => {
        window.location.assign('./workspace/timer');
    }, 1000);
}
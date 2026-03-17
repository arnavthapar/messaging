document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();

    // Get the clicked submit button
    const submitter = e.submitter;
    const action = submitter?.value;

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (action === 'login') {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username, password})
        });

        if (res.ok) {
            window.location.href = "/home";
        } else if (res.status === 429) {
            document.getElementById('error').textContent = 'Too many login attempts. Please wait and try again.';
        } else if (res.status == 403) {
            document.getElementById('error').textContent =
                'Login failed. Check to make sure the username and password is correct.';
        } else {
            const data = res[0].nonSQL;
            if (data) {
                document.getElementById('error').textContent = 'An internal server error occured. Try again later.';
            } else {
                document.getElementById('error').textContent = 'The database is waking up, try again in a couple of seconds.';
            }
        }

    } else {
        const res = await fetch('/api/create-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username, password})
        });

        const data = await res.json();
        const createError = document.getElementById('error');
        const createSuccess = document.getElementById('success');
        createError.textContent = '';
        createSuccess.textContent = '';

        if (res.ok) {
            createSuccess.textContent = 'Account created! You can now log in.';
        } else {
            if (res.status === 413) {
                createError.textContent = res.message || 'Username and password must be between 3 and 50 characters.';
            } else if (res.status === 429) {
                document.getElementById('error').textContent = 'Too many account creation attempts. Please wait and try again.';
            } else if (res.status === 400) {
                document.getElementById('error').textContent = 'Username can only contain letters, numbers, dashes, and underscores.';
            } else {
                createError.textContent = data.message || 'Account creation failed.';
            }

        }
    }
};